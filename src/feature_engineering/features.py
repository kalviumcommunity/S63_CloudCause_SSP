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
        "rolling_avg_cost": Column(float, Check.greater_than_or_equal_to(0), nullable=True),
        "cost_increase_pct": Column(float, nullable=True),
        "cost_spike": Column(bool, nullable=False),
    },
    strict=False
)

# Schema for combined data (billing + deployments)
combined_data_schema = DataFrameSchema(
    columns={
        "timestamp": Column(pa.DateTime, nullable=False),
        "service": Column(str, nullable=False, checks=Check(lambda s: s.str.islower())),
        "cost": Column(float, Check.greater_than_or_equal_to(0), nullable=False),
        "rolling_avg_cost": Column(float, Check.greater_than_or_equal_to(0), nullable=True),
        "cost_increase_pct": Column(float, nullable=True),
        "cost_spike": Column(bool, nullable=False),
        "deployment_version": Column(str, nullable=True),
        "deployment_timestamp": Column(pa.DateTime, nullable=True),
    },
    strict=False
)

def calculate_cost_per_service_over_time(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregates and sorts cost per service over time."""
    logging.info("Aggregating cost per service over time...")
    return df.sort_values(by=['service', 'timestamp']).reset_index(drop=True)

def calculate_rolling_averages(df: pd.DataFrame, window: int = 3) -> pd.DataFrame:
    """Calculates rolling average cost per service over a configurable window."""
    logging.info(f"Calculating {window}-period rolling average cost per service...")
    df['rolling_avg_cost'] = df.groupby('service')['cost'].transform(
        lambda x: x.rolling(window=window, min_periods=1).mean()
    )
    return df

def detect_cost_spikes(df: pd.DataFrame, threshold_percent: float = 0.30) -> pd.DataFrame:
    """
    Detects cost spikes where current cost is significantly higher than rolling average.
    Calculates percentage change in cost relative to rolling baseline.
    Default threshold: > 30% increase.
    """
    logging.info(f"Detecting cost spikes with threshold: {threshold_percent * 100:.1f}% increase.")
    # Percentage change in cost relative to baseline
    df['cost_increase_pct'] = np.where(
        df['rolling_avg_cost'] > 0,
        ((df['cost'] - df['rolling_avg_cost']) / df['rolling_avg_cost']) * 100.0,
        0.0
    ).round(2)

    # Boolean spike indicator
    df['cost_spike'] = (
        (df['cost'] > df['rolling_avg_cost'] * (1 + threshold_percent)) & 
        (df['rolling_avg_cost'] > 0)
    )
    return df

def join_deployments_to_costs(billing_df: pd.DataFrame, deployment_df: pd.DataFrame, time_window_minutes: int = 120) -> pd.DataFrame:
    """
    Joins deployment events to billing data within a 1-2 hour (120 minutes) lookback window.
    Correlates whether a deployment preceded the cost event for that service.
    """
    logging.info(f"Joining deployment events to cost data within {time_window_minutes} minutes.")
    
    billing_df = billing_df.sort_values(by='timestamp').reset_index(drop=True)
    deployment_df = deployment_df.sort_values(by='timestamp').reset_index(drop=True)

    # Merge nearest deployment preceding or coinciding with cost entry
    merged_df = pd.merge_asof(
        billing_df,
        deployment_df.rename(columns={'timestamp': 'deployment_timestamp', 'version': 'deployment_version'})[['service', 'deployment_timestamp', 'deployment_version']],
        left_on='timestamp',
        right_on='deployment_timestamp',
        by='service',
        direction='nearest',
        tolerance=pd.Timedelta(minutes=time_window_minutes)
    )

    # Invalidate deployments older than the time window
    merged_df['time_diff'] = (merged_df['timestamp'] - merged_df['deployment_timestamp']).dt.total_seconds() / 60
    merged_df.loc[merged_df['time_diff'] > time_window_minutes, ['deployment_version', 'deployment_timestamp']] = np.nan
    merged_df.drop(columns=['time_diff'], inplace=True)

    merged_df['deployment_version'] = merged_df['deployment_version'].astype(str).replace('nan', np.nan)
    
    try:
        combined_data_schema.validate(merged_df, lazy=True)
        logging.info("Combined data (billing + deployments) validated successfully against schema.")
    except pa.errors.SchemaErrors as err:
        logging.error(f"Schema validation failed for combined data:\n{err}")
        raise

    return merged_df

def save_featured_data(featured_data: dict, processed_dir: str) -> None:
    """Saves featured dataframes to the processed directory as CSV files."""
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
    usage_df = cleaned_data['usage'].copy()

    # Step 1: Feature engineer billing data
    featured_billing_df = calculate_cost_per_service_over_time(billing_df)
    featured_billing_df = calculate_rolling_averages(featured_billing_df)
    featured_billing_df = detect_cost_spikes(featured_billing_df, threshold_percent=0.30)
    
    try:
        featured_billing_schema.validate(featured_billing_df, lazy=True)
        logging.info("Featured billing data validated successfully against schema.")
    except pa.errors.SchemaErrors as err:
        logging.error(f"Schema validation failed for featured billing data:\n{err}")
        raise

    # Step 2: Join deployments to featured billing data
    combined_df = join_deployments_to_costs(featured_billing_df, deployment_df, time_window_minutes=120)

    logging.info("All feature engineering complete.")

    result = {
        "featured_billing": featured_billing_df,
        "combined_data": combined_df,
        "usage": usage_df
    }

    if save_to_disk:
        if processed_dir is None:
            processed_dir = os.path.join(os.path.dirname(__file__), '../../data/processed')
        save_featured_data(result, processed_dir)

    return result
