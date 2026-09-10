import pandas as pd
import pandera as pa
from pandera import DataFrameSchema, Column, Check
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# TODO: Add real-time data ingestion support (Kafka, Kinesis, Pub/Sub streaming)
# - Implement a streaming consumer to process events as they arrive
# - Add watermarking and windowed aggregations
# - Support incremental writes to SQLite (append instead of replace)

# Define schema for cleaned billing data
cleaned_billing_schema = DataFrameSchema(
    columns={
        "timestamp": Column(pa.DateTime, nullable=False),
        "service": Column(str, nullable=False, checks=Check(lambda s: s.str.islower())),
        "cost": Column(float, Check.greater_than_or_equal_to(0), nullable=False),
    },
    strict=True
)

# Define schema for cleaned deployment data (assuming no significant changes after cleaning)
cleaned_deployment_schema = DataFrameSchema(
    columns={
        "service": Column(str, nullable=False, checks=Check(lambda s: s.str.islower())),
        "version": Column(str, nullable=False),
        "timestamp": Column(pa.DateTime, nullable=False),
    },
    strict=True
)

# Define schema for cleaned usage data (assuming no significant changes after cleaning)
cleaned_usage_schema = DataFrameSchema(
    columns={
        "timestamp": Column(pa.DateTime, nullable=False),
        "service": Column(str, nullable=False, checks=Check(lambda s: s.str.islower())),
        "cpu_utilization": Column(float, Check.in_range(0, 100), nullable=False),
        "requests_per_second": Column(int, Check.greater_than_or_equal_to(0), nullable=False),
    },
    strict=True
)

def clean_billing_data(df: pd.DataFrame) -> pd.DataFrame:
    """Cleans billing data: handles duplicates, missing values, and standardizes service names."""
    logging.info("Cleaning billing data...")
    original_rows = len(df)

    # Drop duplicates
    df = df.drop_duplicates().copy()
    logging.info(f"Dropped {original_rows - len(df)} duplicate rows from billing data.")
    original_rows = len(df)

    # Handle missing values (e.g., cost)
    initial_missing_cost = df['cost'].isnull().sum()
    df.loc[:, 'cost'] = df['cost'].fillna(0)
    if initial_missing_cost > 0:
        logging.warning(f"Filled {initial_missing_cost} missing 'cost' values with 0 in billing data.")

    # Standardize service names
    df.loc[:, 'service'] = df['service'].str.strip().str.lower()
    logging.info("Standardized 'service' names in billing data.")

    try:
        cleaned_billing_schema.validate(df, lazy=True)
        logging.info("Cleaned billing data validated successfully against schema.")
    except pa.errors.SchemaErrors as err:
        logging.error(f"Schema validation failed for cleaned billing data:\n{err}")
        raise
    
    return df

def clean_deployment_data(df: pd.DataFrame) -> pd.DataFrame:
    """Cleans deployment data: handles duplicates and standardizes service names."""
    logging.info("Cleaning deployment data...")
    original_rows = len(df)

    # Drop duplicates
    df = df.drop_duplicates().copy()
    logging.info(f"Dropped {original_rows - len(df)} duplicate rows from deployment data.")

    # Standardize service names
    df.loc[:, 'service'] = df['service'].str.strip().str.lower()
    logging.info("Standardized 'service' names in deployment data.")

    try:
        cleaned_deployment_schema.validate(df, lazy=True)
        logging.info("Cleaned deployment data validated successfully against schema.")
    except pa.errors.SchemaErrors as err:
        logging.error(f"Schema validation failed for cleaned deployment data:\n{err}")
        raise

    return df

def clean_usage_data(df: pd.DataFrame) -> pd.DataFrame:
    """Cleans usage data: handles duplicates and standardizes service names."""
    logging.info("Cleaning usage data...")
    original_rows = len(df)

    # Drop duplicates
    df = df.drop_duplicates().copy()
    logging.info(f"Dropped {original_rows - len(df)} duplicate rows from usage data.")

    # Standardize service names
    df.loc[:, 'service'] = df['service'].str.strip().str.lower()
    logging.info("Standardized 'service' names in usage data.")

    try:
        cleaned_usage_schema.validate(df, lazy=True)
        logging.info("Cleaned usage data validated successfully against schema.")
    except pa.errors.SchemaErrors as err:
        logging.error(f"Schema validation failed for cleaned usage data:\n{err}")
        raise

    return df

def save_cleaned_data(cleaned_data: dict, processed_dir: str) -> None:
    """Saves cleaned dataframes to the processed directory as CSV files."""
    os.makedirs(processed_dir, exist_ok=True)
    logging.info(f"Saving cleaned data to: {processed_dir}")

    for key, df in cleaned_data.items():
        filepath = os.path.join(processed_dir, f"{key}_cleaned.csv")
        df.to_csv(filepath, index=False)
        logging.info(f"Saved cleaned {key} data to {filepath}")


def clean_all_data(raw_data: dict, save_to_disk: bool = False, processed_dir: str = None) -> dict:
    """Applies cleaning to all raw dataframes."""
    cleaned_data = {
        "billing": clean_billing_data(raw_data['billing'].copy()),
        "deployments": clean_deployment_data(raw_data['deployments'].copy()),
        "usage": clean_usage_data(raw_data['usage'].copy())
    }
    logging.info("All data cleaning complete.")

    if save_to_disk:
        if processed_dir is None:
            processed_dir = os.path.join(os.path.dirname(__file__), '../../data/processed')
        save_cleaned_data(cleaned_data, processed_dir)

    return cleaned_data

if __name__ == "__main__":
    # This block is for testing the cleaning script independently
    # In a real pipeline, raw_data would come from the ingestion step
    import sys
    import os

    # Add the project root to sys.path to enable module imports
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    sys.path.insert(0, project_root)

    from src.ingestion.ingest import ingest_data

    RAW_DATA_DIR = os.path.join(os.path.dirname(__file__), '../../data/raw')
    try:
        raw_data = ingest_data(RAW_DATA_DIR)
        cleaned_data = clean_all_data(raw_data)
        print("\nCleaning successful. Cleaned DataFrames head:")
        for key, df in cleaned_data.items():
            print(f"\n--- {key} ---")
            print(df.head())
            print(f"DataFrame Info for {key}:")
            df.info()
    except Exception as e:
        logging.error(f"Data cleaning process failed: {e}")
