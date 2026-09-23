"""
Dataset Intake Validation Module
Data Engineering Pipeline - CostTrace / CloudCause

Validates incoming datasets prior to downstream processing:
- File existence and non-empty status check
- File format validation (CSV, JSON, XLSX)
- Character encoding detection with confidence scoring via chardet
- Schema verification (identifying missing and extra columns)
- Dataset dimension and file size statistics
- Generation and export of structured intake report (JSON)
"""

import json
import os
from datetime import datetime, timezone
import chardet
import pandas as pd


def validate_file_exists(filepath: str) -> bool:
    """
    purpose:
        Validates that the specified file exists on the filesystem and contains data (non-empty).
    input:
        filepath (str): Path to the target file.
    output:
        bool: True if file exists and has size > 0 bytes, False otherwise.
    """
    # Check physical existence of the file
    if not os.path.exists(filepath):
        print(f"Error: File does not exist at path '{filepath}'.")
        return False

    # Check that file is not empty (0 bytes)
    if os.path.getsize(filepath) == 0:
        print(f"Error: File at '{filepath}' is empty (0 bytes).")
        return False

    return True


def validate_file_format(filepath: str) -> bool:
    """
    purpose:
        Validates that the target file extension matches allowed intake formats (.csv, .json, .xlsx).
    input:
        filepath (str): Path to the target file.
    output:
        bool: True if file format is allowed, False otherwise.
    """
    allowed_extensions = {".csv", ".json", ".xlsx"}

    # Extract extension in lowercase
    _, ext = os.path.splitext(filepath)
    ext = ext.lower()

    # Validate against allowed extensions
    if ext not in allowed_extensions:
        print(
            f"Error: Invalid file format '{ext}'. "
            f"Allowed formats are: {sorted(list(allowed_extensions))}."
        )
        return False

    return True


def validate_schema(df: pd.DataFrame, expected_columns: list) -> dict:
    """
    purpose:
        Validates DataFrame columns against an expected column schema, detecting missing and extra columns.
    input:
        df (pd.DataFrame): Ingested pandas DataFrame.
        expected_columns (list): List of expected column name strings.
    output:
        dict: Schema validation results containing 'is_valid', 'missing_columns', and 'extra_columns'.
    """
    # Normalize actual columns to list
    actual_columns = list(df.columns)
    actual_set = set(actual_columns)
    expected_set = set(expected_columns)

    # Detect missing required columns and unexpected extra columns
    missing_columns = sorted(list(expected_set - actual_set))
    extra_columns = sorted(list(actual_set - expected_set))

    # Schema is valid if all expected columns are present
    is_valid = len(missing_columns) == 0

    return {
        "is_valid": is_valid,
        "expected_columns": expected_columns,
        "actual_columns": actual_columns,
        "missing_columns": missing_columns,
        "extra_columns": extra_columns,
    }


def detect_encoding(filepath: str) -> dict:
    """
    purpose:
        Detects the file character encoding and confidence score using chardet.
    input:
        filepath (str): Path to the target file.
    output:
        dict: Dictionary containing detected 'encoding' (str) and 'confidence' (float).
    """
    # Read binary slice (up to 100KB) to reliably detect character encoding
    with open(filepath, "rb") as f:
        raw_bytes = f.read(100000)

    detected = chardet.detect(raw_bytes)

    # Fallback to utf-8 if detection returned None
    encoding = detected.get("encoding") or "utf-8"
    confidence = detected.get("confidence") or 0.0

    return {
        "encoding": encoding,
        "confidence": round(float(confidence), 4),
    }


def capture_dataset_stats(filepath: str, df: pd.DataFrame) -> dict:
    """
    purpose:
        Captures essential dataset metrics including row count, column count,
        and file size in bytes and megabytes.
    input:
        filepath (str): Path to the dataset file.
        df (pd.DataFrame): Ingested pandas DataFrame.
    output:
        dict: Dictionary containing 'rows', 'columns', 'file_size_bytes', and 'file_size_mb'.
    """
    # Query file size in bytes from the filesystem
    size_bytes = os.path.getsize(filepath)
    size_mb = round(size_bytes / (1024 * 1024), 6)

    return {
        "rows": len(df),
        "columns": len(df.columns),
        "file_size_bytes": size_bytes,
        "file_size_mb": size_mb,
    }


def generate_intake_report(filepath: str, expected_columns: list) -> dict:
    """
    purpose:
        Executes complete intake validation on a dataset, loads data with pandas,
        captures dataset statistics, prints a summary, and persists an intake report JSON.
    input:
        filepath (str): Path to the input dataset file.
        expected_columns (list): List of expected column name strings.
    output:
        dict: Complete structured validation report.
    """
    # 1. Validate file existence and non-empty status
    file_exists = validate_file_exists(filepath)
    if not file_exists:
        raise FileNotFoundError(f"Missing or empty file: '{filepath}'")

    # 2. Validate file extension format
    format_valid = validate_file_format(filepath)
    if not format_valid:
        raise ValueError(f"Invalid file format for: '{filepath}'. Allowed: csv, json, xlsx")

    # 3. Detect character encoding
    encoding_info = detect_encoding(filepath)

    # 4. Load dataset using pandas
    _, ext = os.path.splitext(filepath)
    ext = ext.lower()
    if ext == ".csv":
        df = pd.read_csv(filepath, encoding=encoding_info["encoding"])
    elif ext == ".json":
        df = pd.read_json(filepath)
    elif ext == ".xlsx":
        df = pd.read_excel(filepath)
    else:
        df = pd.read_csv(filepath)

    # 5. Validate schema against expected columns
    schema_info = validate_schema(df, expected_columns)

    # 6. Capture dataset statistics
    stats = capture_dataset_stats(filepath, df)

    # 7. Construct structured report dictionary
    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "filepath": filepath,
        "validation_results": {
            "file_exists": {
                "passed": file_exists,
                "details": "File exists and is non-empty."
            },
            "file_format": {
                "passed": format_valid,
                "extension": ext.lstrip("."),
                "allowed_extensions": ["csv", "json", "xlsx"]
            },
            "encoding": encoding_info,
            "schema": schema_info
        },
        "dataset_statistics": stats
    }

    # 8. Ensure output directory exists and persist JSON report
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)
    report_path = os.path.join(output_dir, "intake_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=4)

    # 9. Print human-readable validation summary to console
    print("\n" + "=" * 50)
    print("DATASET INTAKE VALIDATION SUMMARY")
    print("=" * 50)
    print(f"File Path        : {filepath}")
    print(f"File Exists      : {'PASSED (✓)' if file_exists else 'FAILED (✗)'}")
    print(f"File Format      : {'PASSED (✓)' if format_valid else 'FAILED (✗)'} [{ext.lstrip('.')}]")
    print(f"Detected Encoding: {encoding_info['encoding']} (Confidence: {encoding_info['confidence'] * 100:.1f}%)")
    print(f"Schema Status    : {'PASSED (✓)' if schema_info['is_valid'] else 'FAILED (✗)'}")
    if schema_info["missing_columns"]:
        print(f"  - Missing Columns: {schema_info['missing_columns']}")
    if schema_info["extra_columns"]:
        print(f"  - Extra Columns  : {schema_info['extra_columns']}")
    print(f"Dataset Size     : {stats['rows']} rows × {stats['columns']} columns")
    print(f"File Size        : {stats['file_size_bytes']} bytes ({stats['file_size_mb']} MB)")
    print(f"Report Saved     : {report_path}")
    print("=" * 50 + "\n")

    # TODO: Add dynamic schema resolution from central data catalog (e.g. AWS Glue, BigQuery).
    # TODO: Support streaming / chunked validation for multi-GB files without memory exhaustion.
    # TODO: Add automated notification triggers (Slack / Webhooks) for validation failures.
    # TODO: Implement automated data type profiling and value constraint checks (e.g., regex patterns, range limits).

    return report


if __name__ == "__main__":
    expected_columns = [
        "customer_id",
        "customer_name",
        "transaction_amount",
        "transaction_date"
    ]
    report = generate_intake_report("data/raw/sample.csv", expected_columns)
    print(report)
