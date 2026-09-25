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
    strict=False
)

def analyze_cost_spikes(
    combined_data_df: pd.DataFrame,
    usage_df: pd.DataFrame,
    time_window_minutes: int = 120,
    traffic_requests_threshold: int = 2000,
    cpu_utilization_threshold: float = 75.0
) -> pd.DataFrame:
    """
    Applies the CostTrace rule-based correlation engine to attribute cost spikes to root causes.
    
    Correlation Rules:
    1. Spike + Deployment within 1-2 hours -> 'Deployment' (High Confidence ~0.85)
    2. Spike + Traffic/CPU surge without deployment -> 'External Traffic/Usage Increase' (Medium Confidence ~0.75)
    3. Spike only (no deployment, no traffic surge) -> 'Unknown' Anomaly/Orphaned Resource (Confidence ~0.35)
    """
    logging.info("Starting rule-based correlation analysis for cost spikes.")

    # Filter for detected cost spikes
    spikes_df = combined_data_df[combined_data_df['cost_spike']].copy()
    if spikes_df.empty:
        logging.info("No cost spikes detected for analysis.")
        return pd.DataFrame(columns=[
            'spike_time', 'affected_service', 'service', 'cost_increase_pct',
            'suspected_cause', 'confidence_score', 'deployment_version',
            'current_cost', 'baseline_cost', 'root_cause_explanation'
        ])

    # Join nearest preceding usage metrics for the same service
    spikes_df = pd.merge_asof(
        spikes_df.sort_values(by='timestamp'),
        usage_df.rename(columns={
            'timestamp': 'usage_timestamp',
            'requests_per_second': 'spike_requests_per_second',
            'cpu_utilization': 'spike_cpu_utilization'
        })[['service', 'usage_timestamp', 'spike_requests_per_second', 'spike_cpu_utilization']].sort_values(by='usage_timestamp'),
        left_on='timestamp',
        right_on='usage_timestamp',
        by='service',
        direction='nearest',
        tolerance=pd.Timedelta(minutes=time_window_minutes)
    )

    # Initialize attribution fields
    spikes_df['suspected_cause'] = "Unknown"
    spikes_df['confidence_score'] = 0.35
    spikes_df['root_cause_explanation'] = "Unexplained spike (Potential Orphaned Compute / Memory Leak / Idle Resource)"

    # Rule 1: Deployment-correlated spike
    has_deployment = (
        spikes_df['deployment_version'].notna() & 
        (spikes_df['deployment_version'] != 'nan') &
        (spikes_df['deployment_version'] != 'None')
    )
    spikes_df.loc[has_deployment, 'suspected_cause'] = "Deployment"
    spikes_df.loc[has_deployment, 'confidence_score'] = 0.85
    for idx in spikes_df[has_deployment].index:
        ver = spikes_df.loc[idx, 'deployment_version']
        pct = spikes_df.loc[idx, 'cost_increase_pct']
        spikes_df.loc[idx, 'root_cause_explanation'] = (
            f"Likely deployment issue: Service deployed {ver} within the preceding lookback window."
        )

    # Rule 2: Traffic/Usage surge-correlated spike (if not already deployment-caused)
    traffic_surge = (
        (~has_deployment) & (
            (spikes_df['spike_requests_per_second'] > traffic_requests_threshold) |
            (spikes_df['spike_cpu_utilization'] > cpu_utilization_threshold)
        )
    )
    spikes_df.loc[traffic_surge, 'suspected_cause'] = "External Traffic/Usage Increase"
    spikes_df.loc[traffic_surge, 'confidence_score'] = 0.75
    for idx in spikes_df[traffic_surge].index:
        req = spikes_df.loc[idx, 'spike_requests_per_second']
        cpu = spikes_df.loc[idx, 'spike_cpu_utilization']
        spikes_df.loc[idx, 'root_cause_explanation'] = (
            f"Traffic surge: Elevated traffic load ({req} req/s, {cpu}% CPU) drove auto-scaling and spend."
        )

    # Build structured output DataFrame
    correlation_output_df = pd.DataFrame({
        'spike_time': spikes_df['timestamp'],
        'affected_service': spikes_df['service'],
        'service': spikes_df['service'],
        'cost_increase_pct': spikes_df['cost_increase_pct'],
        'suspected_cause': spikes_df['suspected_cause'],
        'confidence_score': spikes_df['confidence_score'],
        'deployment_version': spikes_df['deployment_version'].fillna("None"),
        'current_cost': spikes_df['cost'],
        'baseline_cost': spikes_df['rolling_avg_cost'],
        'root_cause_explanation': spikes_df['root_cause_explanation']
    })

    try:
        correlation_output_schema.validate(correlation_output_df, lazy=True)
        logging.info("Correlation output validated successfully against schema.")
    except pa.errors.SchemaErrors as err:
        logging.error(f"Schema validation failed for correlation output:\n{err}")
        raise

    logging.info(f"Correlation analysis complete: {len(correlation_output_df)} spikes attributed.")
    return correlation_output_df
