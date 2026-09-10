import pandas as pd
import pandera as pa
from pandera import DataFrameSchema, Column, Check, Index, MultiIndex
import os
import json

# TODO: Integrate real cloud billing APIs
# - AWS: Use boto3 to pull Cost Explorer / CUR (Cost and Usage Report) from S3
#   Example: client = boto3.client('ce'); client.get_cost_and_usage(...)
# - GCP: Use google-cloud-bigquery to query BigQuery billing export
#   Example: from google.cloud import bigquery; client.query(billing_sql).to_dataframe()
# - Azure: Use azure-mgmt-consumption ConsumptionManagementClient
# TODO: Add real-time data ingestion support
# - Hook into AWS CloudWatch Events / GCP Pub/Sub for deployment events
# - Use AWS Kinesis / GCP Dataflow for streaming usage metrics
# - Replace mock CSV/JSON with periodic Cloud Billing budget alerts webhooks

# Define schemas for data validation
billing_schema = DataFrameSchema(
    columns={
        "timestamp": Column(pa.DateTime, nullable=False),
        "service": Column(str, nullable=False),
        "cost": Column(float, Check.greater_than_or_equal_to(0), nullable=False),
    },
    strict=True
)

deployment_schema = DataFrameSchema(
    columns={
        "service": Column(str, nullable=False),
        "version": Column(str, nullable=False),
        "timestamp": Column(pa.DateTime, nullable=False),
    },
    strict=True
)

usage_schema = DataFrameSchema(
    columns={
        "timestamp": Column(pa.DateTime, nullable=False),
        "service": Column(str, nullable=False),
        "cpu_utilization": Column(float, Check.in_range(0, 100), nullable=False),
        "requests_per_second": Column(int, Check.greater_than_or_equal_to(0), nullable=False),
    },
    strict=True
)

def load_csv_data(filepath: str, schema: DataFrameSchema) -> pd.DataFrame:
    """Loads CSV data with schema validation."""
    try:
        df = pd.read_csv(filepath, parse_dates=['timestamp'])
        schema.validate(df, lazy=True)
        print(f"Successfully loaded and validated {filepath}")
        return df
    except pa.errors.SchemaErrors as err:
        print(f"Schema validation error in {filepath}:\n{err}")
        raise
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        raise

def load_json_data(filepath: str, schema: DataFrameSchema) -> pd.DataFrame:
    """Loads JSON data with schema validation."""
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
        df = pd.DataFrame(data)
        # Ensure timestamp column is datetime for JSON data
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        schema.validate(df, lazy=True)
        print(f"Successfully loaded and validated {filepath}")
        return df
    except pa.errors.SchemaErrors as err:
        print(f"Schema validation error in {filepath}:\n{err}")
        raise
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        raise

def ingest_data(raw_data_dir: str):
    """Ingests all raw data files."""
    billing_filepath = os.path.join(raw_data_dir, 'billing_data.csv')
    deployment_filepath = os.path.join(raw_data_dir, 'deployment_events.json')
    usage_filepath = os.path.join(raw_data_dir, 'usage_metrics.csv')

    print(f"Ingesting data from: {raw_data_dir}")

    billing_df = load_csv_data(billing_filepath, billing_schema)
    deployment_df = load_json_data(deployment_filepath, deployment_schema)
    usage_df = load_csv_data(usage_filepath, usage_schema)

    return {
        "billing": billing_df,
        "deployments": deployment_df,
        "usage": usage_df
    }

if __name__ == "__main__":
    # Adjust the path as needed if running from a different directory
    RAW_DATA_DIR = os.path.join(os.path.dirname(__file__), '../../data/raw')
    
    # Create a dummy data directory for testing if it doesn't exist
    if not os.path.exists(RAW_DATA_DIR):
        print(f"Raw data directory not found at {RAW_DATA_DIR}. Creating dummy data for testing.")
        os.makedirs(RAW_DATA_DIR, exist_ok=True)
        # Create dummy billing_data.csv
        with open(os.path.join(RAW_DATA_DIR, 'billing_data.csv'), 'w') as f:
            f.write("timestamp,service,cost\n2023-01-01 00:00:00,service_A,10.50\n2023-01-01 01:00:00,service_B,20.00")
        # Create dummy deployment_events.json
        with open(os.path.join(RAW_DATA_DIR, 'deployment_events.json'), 'w') as f:
            f.write("[{\"service\": \"service_A\", \"version\": \"1.0.0\", \"timestamp\": \"2023-01-01 00:30:00\"}]")
        # Create dummy usage_metrics.csv
        with open(os.path.join(RAW_DATA_DIR, 'usage_metrics.csv'), 'w') as f:
            f.write("timestamp,service,cpu_utilization,requests_per_second\n2023-01-01 00:00:00,service_A,50.2,1000")

    try:
        raw_data = ingest_data(RAW_DATA_DIR)
        print("\nIngestion successful. DataFrames loaded:")
        for key, df in raw_data.items():
            print(f"- {key}: {df.head()}")
    except Exception as e:
        print(f"Data ingestion failed: {e}")
