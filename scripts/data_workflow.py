"""
Data Workflow Pipeline Script
Data Engineering Sprint - CostTrace / CloudCause

This script executes an automated end-to-end data pipeline:
1. Ingestion: Reads raw tabular data (CSV / JSON) with file existence checks.
2. Processing: Cleans data (deduplication, missing value imputation, column standardization, type casting).
3. Output: Persists cleaned data to CSV and prints execution summary metrics.
"""

import os
import sys
import pandas as pd


def ingest_data(filepath: str) -> pd.DataFrame:
    """
    purpose:
        Ingests data from a file path (supporting CSV and JSON formats) into a Pandas DataFrame.
    input:
        filepath (str): Relative or absolute path to the raw data file (.csv or .json).
    output:
        pd.DataFrame: Loaded dataset as a Pandas DataFrame.
    assumptions:
        - The file exists at the given filepath and the process has read permissions.
        - Supported file formats are delimited CSV (.csv) and JSON records/arrays (.json).
        - The file contains valid tabular data and is not empty.
    """
    # Verify file existence before attempting to read
    if not os.path.exists(filepath):
        print(f"Error: File not found at path '{filepath}'. Please check the path and try again.")
        raise FileNotFoundError(f"File not found: '{filepath}'")

    # Determine file extension to apply correct reader
    _, ext = os.path.splitext(filepath)
    ext = ext.lower()

    try:
        # Ingest based on file format
        if ext == ".csv":
            df = pd.read_csv(filepath)
        elif ext == ".json":
            df = pd.read_json(filepath)
        else:
            # Fallback attempt to read as CSV
            df = pd.read_csv(filepath)
    except pd.errors.EmptyDataError:
        print(f"Error: The file at '{filepath}' contains no data.")
        raise ValueError(f"Empty data encountered in '{filepath}'.")
    except Exception as e:
        print(f"Error: Failed to read file '{filepath}': {e}")
        raise

    # Validate that loaded DataFrame is not empty
    if df.empty:
        print(f"Error: Ingested file '{filepath}' returned an empty DataFrame.")
        raise ValueError(f"Empty DataFrame loaded from '{filepath}'.")

    # TODO: Add remote cloud object storage connectors (e.g., AWS S3, Google Cloud Storage, Azure Blob).
    # TODO: Implement chunked/streaming ingestion (chunksize parameter) for very large datasets.
    # TODO: Add file checksum/hash validation to ensure data integrity during ingestion.

    return df


def process_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    purpose:
        Cleans and standardizes raw DataFrame records by eliminating duplicates,
        handling missing values across numerical and categorical fields,
        standardizing column headers, and casting timestamp columns to datetime.
    input:
        df (pd.DataFrame): Raw ingested Pandas DataFrame.
    output:
        pd.DataFrame: Cleaned, standardized, and transformed DataFrame.
    assumptions:
        - Input is a valid, non-empty Pandas DataFrame.
        - Numerical columns should have missing values imputed with their column median.
        - Categorical / string columns should have missing values imputed with 'Unknown'.
        - Column names should follow standard lowercase snake_case convention with no whitespace.
        - Any timestamp or date column is formatted in or convertible to standard datetime format.
    """
    # Guard clause against empty or None input
    if df is None or df.empty:
        print("Error: Cannot process an empty or None DataFrame.")
        raise ValueError("Cannot process empty or None DataFrame.")

    # Create a copy to prevent accidental mutations of input data
    cleaned_df = df.copy()

    # 1. Standardize column names (lowercase, stripped, spaces replaced by underscores)
    cleaned_df.columns = (
        cleaned_df.columns.astype(str)
        .str.strip()
        .str.lower()
        .str.replace(r"\s+", "_", regex=True)
    )

    # 2. Remove duplicate rows to preserve data integrity
    cleaned_df = cleaned_df.drop_duplicates()

    # 3. Convert timestamp column to datetime if present
    for col in cleaned_df.columns:
        if "timestamp" in col or "date" in col or col == "time":
            # Coerce invalid datetime strings to NaT to prevent crashing
            cleaned_df[col] = pd.to_datetime(cleaned_df[col], errors="coerce")

    # 4. Handle missing values based on data types
    # Numerical columns: fill missing values with column median
    num_cols = cleaned_df.select_dtypes(include=["number"]).columns
    for col in num_cols:
        median_val = cleaned_df[col].median()
        # Fallback to 0.0 in the rare event that all values in the column are NaN
        fill_val = 0.0 if pd.isna(median_val) else median_val
        cleaned_df[col] = cleaned_df[col].fillna(fill_val)

    # Categorical/text columns: fill missing values with 'Unknown'
    cat_cols = cleaned_df.select_dtypes(include=["object", "string", "category"]).columns
    for col in cat_cols:
        cleaned_df[col] = cleaned_df[col].fillna("Unknown")

    # TODO: Integrate strict data contract validation using Pandera or Pydantic.
    # TODO: Add statistical outlier detection (e.g., IQR or Z-score) for anomalous cost spikes.
    # TODO: Support domain-specific business transformation rules (e.g., currency normalization).

    return cleaned_df


def output_results(df: pd.DataFrame, output_path: str) -> None:
    """
    purpose:
        Saves the processed DataFrame to a CSV destination and outputs standardized
        pipeline execution confirmation metrics.
    input:
        df (pd.DataFrame): Cleaned and processed DataFrame.
        output_path (str): Destination file path for saving the CSV.
    output:
        None
    assumptions:
        - Input DataFrame contains valid processed records.
        - Destination directory is accessible and writable.
    """
    # Guard clause against None or empty DataFrame
    if df is None:
        print(f"Error: Cannot output None DataFrame to '{output_path}'.")
        raise ValueError("Cannot output None DataFrame.")

    # Ensure parent output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    # Export DataFrame to CSV without row index
    df.to_csv(output_path, index=False)

    # Output exact confirmation metrics as required
    print("✓ Data successfully processed")
    print(f"✓ Rows processed: {len(df)}")
    print(f"✓ Output saved to {output_path}")

    # TODO: Add support for cloud data warehouse sinks (e.g., BigQuery, Snowflake, PostgreSQL).
    # TODO: Add partitioned output formats such as Parquet for optimized cloud analytics.
    # TODO: Integrate automated pipeline logging and telemetry reporting.


if __name__ == "__main__":
    data = ingest_data("data/raw/sample.csv")
    processed = process_data(data)
    output_results(processed, "output/processed.csv")
