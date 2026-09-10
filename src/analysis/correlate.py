import pandas as pd
import pandera as pa
from pandera import DataFrameSchema, Column, Check
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Schema for the correlation output table
correlation_output_schema = DataFrameSchema(
    columns={
        "spike_time": Column(pa.DateTime, nullable=False),
        "affected_service": Column(str, nullable=False),
        "suspected_cause": Column(str, nullable=False),
        "confidence_score": Column(float, Check.in_range(0, 1), nullable=False),
    },
    strict=True
)

def analyze_cost_spikes(combined_data_df: pd.DataFrame, usage_df: pd.DataFrame, time_window_minutes: int = 60) -> pd.DataFrame:
    """Applies rule-based correlation engine to detect causes of cost spikes."""
    logging.info("Starting rule-based correlation analysis for cost spikes.")

    # Filter for actual cost spikes
    spikes_df = combined_data_df[combined_data_df['cost_spike']].copy()
    if spikes_df.empty:
        logging.info("No cost spikes detected for analysis.")
        return pd.DataFrame(columns=correlation_output_schema.columns.keys())

    # Merge usage data to spikes_df to get traffic metrics around spike time
    # We need to decide how to join usage: exact timestamp match, or nearest?
    # For simplicity, let's try to find usage metrics that are close to the spike_time for the same service.
    # Using merge_asof for nearest preceding usage metric
    spikes_df = pd.merge_asof(
        spikes_df,
        usage_df.rename(columns={'timestamp': 'usage_timestamp', 'requests_per_second': 'spike_requests_per_second', 'cpu_utilization': 'spike_cpu_utilization'})[['service', 'usage_timestamp', 'spike_requests_per_second', 'spike_cpu_utilization']],
        left_on='timestamp',
        right_on='usage_timestamp',
        by='service',
        direction='nearest', # Find nearest usage metric
        tolerance=pd.Timedelta(minutes=time_window_minutes) # Within specified time window
    )

    # Initialize columns for output
    spikes_df['suspected_cause'] = "Unknown"
    spikes_df['confidence_score'] = 0.0

    # Rule 1: Cost spike + Deployment within time window
    # A deployment is considered within window if deployment_timestamp is not NaT and time_diff is within window
    deployment_cause_mask = spikes_df['deployment_version'].notna()
    spikes_df.loc[deployment_cause_mask, 'suspected_cause'] = "Deployment"
    spikes_df.loc[deployment_cause_mask, 'confidence_score'] = 0.8 # High confidence

    # Rule 2: Cost spike + Traffic increase (e.g., requests_per_second > threshold or significantly higher than average)
    # For simplicity, let's assume an increase if spike_requests_per_second is > a fixed high threshold (e.g., 2000)
    # In a real scenario, this would compare to historical averages or a rolling average of traffic
    traffic_increase_threshold = 2000 # Example threshold for high traffic
    traffic_cause_mask = (spikes_df['spike_requests_per_second'].notna()) & \
                         (spikes_df['spike_requests_per_second'] > traffic_increase_threshold) & \
                         (~deployment_cause_mask) # Only if not already attributed to deployment
    
    spikes_df.loc[traffic_cause_mask, 'suspected_cause'] = "External Traffic/Usage Increase"
    spikes_df.loc[traffic_cause_mask, 'confidence_score'] = 0.7 # Medium-high confidence

    # Rule 3: Default cause if no other rules match
    unknown_cause_mask = (spikes_df['suspected_cause'] == "Unknown")
    spikes_df.loc[unknown_cause_mask, 'confidence_score'] = 0.3 # Low confidence

    # Select and rename columns for the final output
    correlation_output_df = spikes_df[[
        'timestamp',
        'service',
        'suspected_cause',
        'confidence_score'
    ]].rename(columns={
        'timestamp': 'spike_time',
        'service': 'affected_service'
    })

    try:
        correlation_output_schema.validate(correlation_output_df, lazy=True)
        logging.info("Correlation output validated successfully against schema.")
    except pa.errors.SchemaErrors as err:
        logging.error(f"Schema validation failed for correlation output:\n{err}")
        raise

    logging.info("Correlation analysis complete.")
    return correlation_output_df

if __name__ == "__main__":
    # For testing the correlation script independently
    import sys
    import os

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    sys.path.insert(0, project_root)

    from src.ingestion.ingest import ingest_data
    from src.cleaning.clean import clean_all_data
    from src.feature_engineering.features import feature_engineer_data

    RAW_DATA_DIR = os.path.join(project_root, 'data/raw')
    try:
        raw_data = ingest_data(RAW_DATA_DIR)
        cleaned_data = clean_all_data(raw_data)
        featured_data = feature_engineer_data(cleaned_data)

        combined_data_df = featured_data['combined_data']
        usage_df = featured_data['usage']

        correlation_results = analyze_cost_spikes(combined_data_df, usage_df)

        print("\nCorrelation Analysis Results:")
        print(correlation_results)
        print("\nDataFrame Info for correlation results:")
        correlation_results.info()
    except Exception as e:
        logging.error(f"Correlation analysis process failed: {e}")
