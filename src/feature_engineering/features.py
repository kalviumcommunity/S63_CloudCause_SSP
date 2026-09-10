import pandas as pd
import pandera as pa
from pandera import DataFrameSchema, Column, Check
import logging
import numpy as np
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Schema for billing data with rolling averages and spikes
featured_billing_schema = DataFrameSchema(
    columns={
        "timestamp": Column(pa.DateTime, nullable=False),
        "service": Column(str, nullable=False, checks=Check(lambda s: s.str.islower())),
        "cost": Column(float, Check.greater_than_or_equal_to(0), nullable=False),
        "rolling_avg_cost": Column(float, Check.greater_than_or_equal_to(0), nullable=True), # Can be null at start
        "cost_spike": Column(bool, nullable=False),
    },
    strict=True
)

# Schema for combined data (billing + deployments)
combined_data_schema = DataFrameSchema(
    columns={
        "timestamp": Column(pa.DateTime, nullable=False),
        "service": Column(str, nullable=False, checks=Check(lambda s: s.str.islower())),
        "cost": Column(float, Check.greater_than_or_equal_to(0), nullable=False),
        "rolling_avg_cost": Column(float, Check.greater_than_or_equal_to(0), nullable=True),
        "cost_spike": Column(bool, nullable=False),
        "deployment_version": Column(str, nullable=True), # Null if no deployment
        "deployment_timestamp": Column(pa.DateTime, nullable=True), # Null if no deployment
    },
    strict=True
)

def calculate_cost_per_service_over_time(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregates cost per service per timestamp if needed (already mostly done in raw data)."""
    logging.info("Aggregating cost per service over time...")
    # Assuming billing data is already granular enough (timestamp, service, cost)
    # If not, would do: df.groupby(['timestamp', 'service'])['cost'].sum().reset_index()
    return df.sort_values(by=['service', 'timestamp']).reset_index(drop=True)

def calculate_rolling_averages(df: pd.DataFrame, window: int = 3) -> pd.DataFrame:
    """Calculates rolling average cost per service."""
    logging.info(f"Calculating {window}-period rolling average cost per service...")
    df['rolling_avg_cost'] = df.groupby('service')['cost'].transform(
        lambda x: x.rolling(window=window, min_periods=1).mean()
    )
    return df

def detect_cost_spikes(df: pd.DataFrame, threshold_percent: float = 0.20) -> pd.DataFrame:
    """Detects cost spikes where current cost is significantly higher than rolling average."""
    logging.info(f"Detecting cost spikes with threshold: {threshold_percent * 100}% increase.")
    # Avoid division by zero for rolling_avg_cost if it's 0, treat as no spike
    df['cost_spike'] = (
        (df['cost'] > df['rolling_avg_cost'] * (1 + threshold_percent)) & 
        (df['rolling_avg_cost'] > 0) # Only consider spikes if there was a base cost
    )
    return df

def join_deployments_to_costs(billing_df: pd.DataFrame, deployment_df: pd.DataFrame, time_window_minutes: int = 60) -> pd.DataFrame:
    """Joins deployment events to billing data within a specified time window."""
    logging.info(f"Joining deployment events to cost data within {time_window_minutes} minutes.")
    
    # Ensure timestamps are sorted for efficient merging/joining
    billing_df = billing_df.sort_values(by='timestamp').reset_index(drop=True)
    deployment_df = deployment_df.sort_values(by='timestamp').reset_index(drop=True)

    # Create a column for the deployment end time (for windowing)
    deployment_df['deployment_end_timestamp'] = deployment_df['timestamp'] + pd.Timedelta(minutes=time_window_minutes)

    # Perform a merge_asof to find deployments that occurred just before or during a cost entry
    # This is a bit tricky with time windows, a simple merge_asof might not capture a window.
    # A more explicit approach using a cross join (or similar) with filtering might be needed for true windowing.

    # For simplicity and to match service, let's do a more direct merge first,
    # then expand to a window logic.
    # This approach assumes a deployment impacts costs after its timestamp.
    # We'll link a deployment to the *next* cost entry for the same service within the window.

    # Using pd.merge_asof for nearest preceding deployment for each cost entry
    # This matches the latest deployment BEFORE or AT the cost timestamp.
    # We then need to filter for those within the specified time window.
    merged_df = pd.merge_asof(
        billing_df,
        deployment_df.rename(columns={'timestamp': 'deployment_timestamp', 'version': 'deployment_version'})[['service', 'deployment_timestamp', 'deployment_version']],
        left_on='timestamp',
        right_on='deployment_timestamp',
        by='service',
        direction='nearest', # Finds the nearest deployment
        tolerance=pd.Timedelta(minutes=time_window_minutes)
    )

    # Filter out deployments that are outside the time window (deployment too old)
    merged_df['time_diff'] = (merged_df['timestamp'] - merged_df['deployment_timestamp']).dt.total_seconds() / 60
    merged_df.loc[merged_df['time_diff'] > time_window_minutes, ['deployment_version', 'deployment_timestamp']] = np.nan
    merged_df.drop(columns=['time_diff'], inplace=True)

    # Ensure relevant columns are correctly typed after potential NaN assignments
    merged_df['deployment_version'] = merged_df['deployment_version'].astype(str).replace('nan', np.nan) # Convert 'nan' string to actual NaN
    
    try:
        combined_data_schema.validate(merged_df, lazy=True)
        logging.info("Combined data (billing + deployments) validated successfully against schema.")
    except pa.errors.SchemaErrors as err:
        logging.error(f"Schema validation failed for combined data:\n{err}")
        raise

    return merged_df

def save_featured_data(featured_data: dict, processed_dir: str) -> None:
    """Saves featured/engineered dataframes to the processed directory as CSV files."""
    os.makedirs(processed_dir, exist_ok=True)
    logging.info(f"Saving featured data to: {processed_dir}")

    for key, df in featured_data.items():
        filepath = os.path.join(processed_dir, f"{key}_featured.csv")
        df.to_csv(filepath, index=False)
        logging.info(f"Saved featured {key} data to {filepath}")


def feature_engineer_data(cleaned_data: dict, save_to_disk: bool = False, processed_dir: str = None) -> dict:
    """Applies all feature engineering steps to cleaned data."""
    billing_df = cleaned_data['billing'].copy()
    deployment_df = cleaned_data['deployments'].copy()
    usage_df = cleaned_data['usage'].copy() # Usage data is not directly featured in this step yet

    # Step 1: Prepare billing data
    featured_billing_df = calculate_cost_per_service_over_time(billing_df)
    featured_billing_df = calculate_rolling_averages(featured_billing_df)
    featured_billing_df = detect_cost_spikes(featured_billing_df)
    
    try:
        featured_billing_schema.validate(featured_billing_df, lazy=True)
        logging.info("Featured billing data validated successfully against schema.")
    except pa.errors.SchemaErrors as err:
        logging.error(f"Schema validation failed for featured billing data:\n{err}")
        raise

    # Step 2: Join deployments to the featured billing data
    combined_df = join_deployments_to_costs(featured_billing_df, deployment_df)

    logging.info("All feature engineering complete.")

    result = {
        "featured_billing": featured_billing_df,
        "combined_data": combined_df,
        "usage": usage_df # Pass through usage data for later steps
    }

    if save_to_disk:
        if processed_dir is None:
            processed_dir = os.path.join(os.path.dirname(__file__), '../../data/processed')
        save_featured_data(result, processed_dir)

    return result

if __name__ == "__main__":
    # For testing the feature engineering script independently
    import sys
    import os

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    sys.path.insert(0, project_root)

    from src.ingestion.ingest import ingest_data
    from src.cleaning.clean import clean_all_data

    RAW_DATA_DIR = os.path.join(project_root, 'data/raw')
    try:
        raw_data = ingest_data(RAW_DATA_DIR)
        cleaned_data = clean_all_data(raw_data)
        featured_data = feature_engineer_data(cleaned_data)

        print("\nFeature Engineering successful. Featured DataFrames head:")
        for key, df in featured_data.items():
            print(f"\n--- {key} ---")
            print(df.head(10))
            print(f"DataFrame Info for {key}:")
            df.info()
    except Exception as e:
        logging.error(f"Feature engineering process failed: {e}")
