"""Validation for independent raw billing, deployment, and usage datasets."""

from __future__ import annotations

import csv
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd


SUPPORTED_FORMATS = {".csv", ".json"}

SOURCE_SCHEMAS: dict[str, dict[str, str]] = {
    "billing": {
        "timestamp": "datetime",
        "service": "string",
        "cost": "number",
    },
    "deployments": {
        "service": "string",
        "version": "string",
        "timestamp": "datetime",
    },
    "usage": {
        "timestamp": "datetime",
        "service": "string",
        "cpu_utilization": "number",
        "requests_per_second": "integer",
    },
}


@dataclass
class ValidationResult:
    """Machine-readable result for one independent source dataset."""

    source: str
    path: str
    valid: bool = False
    data: pd.DataFrame | None = None
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def error_count(self) -> int:
        return len(self.errors)


def validate_dataset(path: str | Path, source: str) -> ValidationResult:
    """Validate and parse one raw CSV or JSON dataset without mixing sources."""

    dataset_path = Path(path)
    result = ValidationResult(source=source, path=str(dataset_path))

    if source not in SOURCE_SCHEMAS:
        result.errors.append(
            f"Unsupported source '{source}'. Expected one of: {', '.join(SOURCE_SCHEMAS)}."
        )
        return result
    if not dataset_path.exists():
        result.errors.append("File is not available.")
        return result
    if not dataset_path.is_file():
        result.errors.append("Path is not a file.")
        return result
    if dataset_path.suffix.lower() not in SUPPORTED_FORMATS:
        result.errors.append("Unsupported format. Only .csv and .json files are accepted.")
        return result

    try:
        raw_text = dataset_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        result.errors.append("File encoding is not valid UTF-8.")
        return result
    except OSError as error:
        result.errors.append(f"File could not be read: {error}.")
        return result

    if not raw_text.strip():
        result.errors.append("Dataset is empty.")
        return result

    try:
        dataframe = _parse_dataset(dataset_path, raw_text)
    except (csv.Error, json.JSONDecodeError, ValueError) as error:
        result.errors.append(f"Malformed {dataset_path.suffix.lower()[1:]} data: {error}.")
        return result
    except OSError as error:
        result.errors.append(f"File could not be read: {error}.")
        return result

    result.errors.extend(_validate_structure(dataframe, SOURCE_SCHEMAS[source]))
    if not result.errors:
        result.valid = True
        result.data = dataframe
    return result


def validate_raw_datasets(
    raw_data_dir: str | Path,
    dataset_paths: dict[str, str | Path] | None = None,
) -> dict[str, ValidationResult]:
    """Validate each source independently from a raw-data directory."""

    raw_dir = Path(raw_data_dir)
    paths = dataset_paths or {
        "billing": raw_dir / "billing_data.csv",
        "deployments": raw_dir / "deployment_events.json",
        "usage": raw_dir / "usage_metrics.csv",
    }
    return {
        source: validate_dataset(path, source)
        for source, path in paths.items()
    }


def _parse_dataset(path: Path, raw_text: str) -> pd.DataFrame:
    if path.suffix.lower() == ".csv":
        list(csv.reader(raw_text.splitlines(), strict=True))
        return pd.read_csv(path, encoding="utf-8", on_bad_lines="error")

    payload: Any = json.loads(raw_text)
    if not isinstance(payload, list) or any(not isinstance(row, dict) for row in payload):
        raise ValueError("JSON must contain an array of objects")
    return pd.DataFrame(payload)


def _validate_structure(dataframe: pd.DataFrame, schema: dict[str, str]) -> list[str]:
    errors: list[str] = []
    required_columns = list(schema)
    missing = [column for column in required_columns if column not in dataframe.columns]
    unexpected = [column for column in dataframe.columns if column not in schema]

    if missing:
        errors.append(f"Missing required columns: {', '.join(missing)}.")
    if unexpected:
        errors.append(f"Unexpected columns: {', '.join(unexpected)}.")
    if dataframe.empty:
        errors.append("Dataset contains no records.")
        return errors

    for column, expected_type in schema.items():
        if column not in dataframe.columns:
            continue
        values = dataframe[column]
        if values.isna().any():
            errors.append(f"Column '{column}' contains empty values.")
        if expected_type == "datetime":
            parsed = pd.to_datetime(values, errors="coerce")
            if parsed.isna().any():
                errors.append(f"Column '{column}' contains invalid datetime values.")
        elif expected_type == "number":
            parsed = pd.to_numeric(values, errors="coerce")
            if parsed.isna().any():
                errors.append(f"Column '{column}' must contain numeric values.")
        elif expected_type == "integer":
            parsed = pd.to_numeric(values, errors="coerce")
            if parsed.isna().any() or (parsed % 1 != 0).any():
                errors.append(f"Column '{column}' must contain integer values.")
        elif expected_type == "string" and not pd.api.types.is_string_dtype(values):
            errors.append(f"Column '{column}' must contain text values.")

    return errors