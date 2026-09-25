"""
CostTrace CLI Pipeline Script
Executes end-to-end data pipeline:
1. Ingestion: Loads raw billing, deployment, and metrics datasets with Pandera schema validation.
2. Cleaning: Handles nulls, deduplicates, standardizes timestamps and service names.
3. Feature Engineering: Generates rolling averages, calculates cost increase %, and flags spikes.
4. Core Analysis: Rule-based correlation attributing spikes to deployments, traffic, or anomalies.
5. SQL Storage: Persists processed tables into SQLite (data/costtrace.db).
"""

import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

# Ensure project root is in sys.path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.ingestion.ingest import ingest_data
from src.cleaning.clean import clean_all_data
from src.feature_engineering.features import feature_engineer_data
from src.analysis.correlate import analyze_cost_spikes
from src.sql.database import (
    get_db_engine,
    create_tables,
    load_data_to_db,
    get_session,
    query_cost_over_time,
    query_top_cost_services,
    query_cost_spikes_with_causes,
    query_spike_summary,
)

RAW_DATA_DIR = os.path.join(project_root, "data", "raw")
PROCESSED_DATA_DIR = os.path.join(project_root, "data", "processed")
OUTPUT_DIR = os.path.join(project_root, "output")
DB_PATH = os.path.join(project_root, "data", "costtrace.db")


def run_pipeline() -> dict:
    """Executes the complete CostTrace data pipeline."""
    print("=" * 65)
    print("      CostTrace: Cloud Cost Spike Attribution Pipeline")
    print("=" * 65)

    # 1. Ingestion
    print("\n[1/5] INGESTION: Loading and validating raw data...")
    raw_data = ingest_data(RAW_DATA_DIR)
    for name, df in raw_data.items():
        print(f"  ✓ Loaded {name}: {len(df)} rows, {len(df.columns)} columns")

    # 2. Cleaning
    print("\n[2/5] CLEANING: Standardizing and removing duplicates...")
    cleaned_data = clean_all_data(raw_data, save_to_disk=True, processed_dir=PROCESSED_DATA_DIR)
    for name, df in cleaned_data.items():
        print(f"  ✓ Cleaned {name}: {len(df)} rows validated")

    # 3. Feature Engineering
    print("\n[3/5] FEATURE ENGINEERING: Computing rolling averages & spike flags...")
    featured_data = feature_engineer_data(cleaned_data, save_to_disk=True, processed_dir=PROCESSED_DATA_DIR)
    spike_count = int(featured_data["combined_data"]["cost_spike"].sum())
    print(f"  ✓ Feature engineering complete: {spike_count} cost spike(s) detected")

    # 4. Core Analysis (Correlation Engine)
    print("\n[4/5] ANALYSIS: Running rule-based root cause correlation engine...")
    correlation_df = analyze_cost_spikes(featured_data["combined_data"], featured_data["usage"])
    print(f"  ✓ Attributed {len(correlation_df)} cost spike(s) to suspected causes:")
    for _, row in correlation_df.iterrows():
        print(f"    • [{row['spike_time']}] {row['affected_service']}: {row['suspected_cause']} (Confidence: {row['confidence_score']:.0%})")

    # 5. SQL Storage
    print("\n[5/5] SQL STORAGE: Persisting to SQLite database (data/costtrace.db)...")
    engine = get_db_engine(DB_PATH)
    create_tables(engine)

    load_data_to_db(featured_data["combined_data"], "cost_data", engine)
    load_data_to_db(cleaned_data["deployments"], "deployments", engine)
    load_data_to_db(cleaned_data["usage"], "metrics", engine)
    load_data_to_db(correlation_df, "spike_analysis", engine)
    load_data_to_db(correlation_df, "correlations", engine)

    # Save summary report to output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    correlation_df.to_csv(os.path.join(OUTPUT_DIR, "spike_attribution_summary.csv"), index=False)
    print(f"  ✓ All tables stored in SQLite: cost_data, deployments, metrics, spike_analysis")
    print(f"  ✓ Summary exported to: {os.path.join('output', 'spike_attribution_summary.csv')}")

    # Query summary verification
    Session = get_session(engine)
    with Session() as session:
        top_services = query_top_cost_services(session, limit=3)
        summary = query_spike_summary(session)

    print("\n" + "=" * 65)
    print("                    PIPELINE SUCCESSFUL")
    print("=" * 65)
    print("\nTop Spender Services:")
    for _, s in top_services.iterrows():
        print(f"  - {s['service']}: ${s['total_cost']:,.2f}")

    print("\nSpike Attribution Summary:")
    for _, r in summary.iterrows():
        print(f"  - {r['suspected_cause']}: {r['spike_count']} event(s) across ({r['affected_services']})")
    print("=" * 65 + "\n")

    return {
        "cleaned_data": cleaned_data,
        "featured_data": featured_data,
        "correlations": correlation_df,
    }


if __name__ == "__main__":
    run_pipeline()
