# Data Workflow Pipeline Guide

## Overview

The `scripts/data_workflow.py` script implements a modular, production-grade data engineering pipeline following the classic **ETL (Extract, Transform, Load)** paradigm:

```
┌─────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│     INGESTION       │  ──> │       PROCESSING        │  ──> │         OUTPUT          │
│ ingest_data()       │      │ process_data()          │      │ output_results()        │
│ • CSV / JSON reader │      │ • Standardize columns   │      │ • Auto-create output dir│
│ • File checks       │      │ • Drop duplicates       │      │ • Save cleaned CSV      │
│ • Non-empty guard   │      │ • Datetime conversion   │      │ • Report run metrics    │
│                     │      │ • Impute numeric/cat    │      │                         │
└─────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
```

The pipeline is designed with zero external framework dependencies beyond standard Python and **Pandas**, making it lightweight, deterministic, and easily maintainable.

---

## Quickstart: How to Run the Script

### 1. Prerequisites
Ensure you have Python 3.9+ and Pandas installed in your environment:
```bash
pip install -r requirements.txt
# or directly:
pip install pandas
```

### 2. Standard Execution
From the root of the repository, execute:
```bash
python scripts/data_workflow.py
```

### 3. Capture Execution Logs to File
To record the console output to a log file for audits or assignment verification:
```bash
python scripts/data_workflow.py > output/sample_run.txt
```

Expected terminal output:
```text
✓ Data successfully processed
✓ Rows processed: 10
✓ Output saved to output/processed.csv
```

---

## Explanation of Core Functions

The workflow is intentionally structured into **exactly three isolated, single-responsibility functions**:

### 1. `ingest_data(filepath: str) -> pd.DataFrame`
* **Purpose:** Safely ingest raw data into memory as a Pandas DataFrame.
* **Supported Formats:** Delimited CSV (`.csv`) and JSON records/arrays (`.json`).
* **Key Operations:**
  1. Checks if the target path exists using `os.path.exists()`. If the file is missing, it outputs an explicit error message and raises `FileNotFoundError`.
  2. Inspects file extension to dispatch the appropriate Pandas parser (`pd.read_csv` or `pd.read_json`).
  3. Catches empty files (`pd.errors.EmptyDataError`) and validates that the resulting DataFrame contains at least one row, raising `ValueError` otherwise.
* **Assumptions:** The file path is accessible with read permissions, and content is valid tabular data.

### 2. `process_data(df: pd.DataFrame) -> pd.DataFrame`
* **Purpose:** Cleans, normalizes, and prepares raw data for downstream analytics and storage.
* **Key Operations:**
  1. **Defensive Copying:** Operates on `df.copy()` to avoid unexpected side effects on the caller's DataFrame.
  2. **Standardize Column Names:** Converts all column headers to lowercase, strips trailing/leading whitespace, and converts internal whitespace into underscores (`snake_case`).
  3. **Deduplication:** Calls `.drop_duplicates()` to eliminate redundant records.
  4. **Datetime Conversion:** Detects timestamp and date-related columns (`timestamp`, `date`, `time`) and converts them to standard `datetime64` objects using `pd.to_datetime(..., errors="coerce")`.
  5. **Type-Aware Imputation:**
     - **Numerical Columns:** Missing values are imputed with the column's **median** value (resilient to skewness and outliers).
     - **Categorical Columns:** Missing string/object values are imputed with the literal **`"Unknown"`**.
* **Assumptions:** The input DataFrame is non-empty. Numeric columns contain meaningful numbers suitable for median imputation.

### 3. `output_results(df: pd.DataFrame, output_path: str) -> None`
* **Purpose:** Persists cleaned data to disk and prints confirmation metrics.
* **Key Operations:**
  1. Validates that the input DataFrame is not `None`.
  2. Creates the parent output directory automatically (e.g., `output/`) via `os.makedirs(..., exist_ok=True)`.
  3. Writes the DataFrame to CSV using `df.to_csv(output_path, index=False)`.
  4. Prints formatted execution metrics:
     - `✓ Data successfully processed`
     - `✓ Rows processed: <count>`
     - `✓ Output saved to <path>`
* **Assumptions:** Destination filesystem is writable.

---

## Sample Dataset (`data/raw/sample.csv`)

A representative dataset is included at `data/raw/sample.csv` to exercise every transformation rule:

| Raw Column Name | Sample Values | Tests Performed |
|---|---|---|
| `Service` | `EC2`, `RDS`, `S3`, `Lambda`, `[missing]` | Header normalization (`service`), categorical imputation (`Unknown`) |
| `Cost` | `150.25`, `240.50`, `[missing]` | Header normalization (`cost`), numeric imputation with median |
| `Timestamp` | `2026-03-01 08:00:00` | Datetime coercion (`datetime64[ns]`) |
| `Deployment Version` | `v1.0.0`, `v1.0.1`, `[missing]` | Multi-word header (`deployment_version`), categorical imputation (`Unknown`) |

**Duplicate Rows:** Rows 1 and 2 are repeated in the raw file to verify that the deduplication logic correctly filters 12 raw records down to 10 unique rows.

---

## How to Adapt for New Datasets

### 1. Ingesting Different Datasets or File Paths
Modify the arguments passed in the `__main__` execution block:
```python
if __name__ == "__main__":
    # Example: ingesting billing data or deployment events
    data = ingest_data("data/raw/billing_data.csv")
    processed = process_data(data)
    output_results(processed, "data/processed/cleaned_billing.csv")
```

### 2. Ingesting JSON Files
`ingest_data` natively recognizes `.json` files:
```python
data = ingest_data("data/raw/deployment_events.json")
processed = process_data(data)
output_results(processed, "output/processed_deployments.csv")
```

### 3. Customizing Data Cleaning Rules
To alter imputation or transformation rules, edit `process_data(df)`:
- **Zero Imputation for Specific Columns:**
  ```python
  if "cost" in cleaned_df.columns:
      cleaned_df["cost"] = cleaned_df["cost"].fillna(0.0)
  ```
- **Custom Categorical Defaults:**
  Replace `"Unknown"` with domain-specific sentinels such as `"Unassigned"` or `"General"`.
- **Filtering Rows:**
  ```python
  # Drop records with invalid or missing critical IDs
  cleaned_df = cleaned_df.dropna(subset=["service"])
  ```

### 4. Extending for Production & Cloud Environments (TODOs)
Inline `TODO` comments throughout the script highlight where enterprise capabilities can be plugged in:
- **Cloud Object Storage:** Replace local file paths with `boto3` (AWS S3) or `google-cloud-storage` (GCS) download/upload streams.
- **Contract Enforcement:** Add [Pandera](https://pandera.readthedocs.io/) schema models to guarantee incoming column types and value ranges.
- **Analytics Warehouses:** Extend `output_results()` to stream directly into PostgreSQL, BigQuery, or Snowflake via SQLAlchemy.
