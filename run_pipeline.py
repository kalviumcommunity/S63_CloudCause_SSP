"""
CostTrace Data Pipeline Orchestrator

End-to-end pipeline flow:
    1. INGESTION  - Load raw CSV/JSON data and validate schemas
    2. CLEANING   - Handle missing values, duplicates, standardize columns
    3. FEATURES   - Build rolling averages, detect spikes, join deployments
    4. ANALYSIS   - Rule-based correlation: deployment vs traffic vs unknown
    5. SQL LOAD   - Persist everything to SQLite + run sample queries
"""

import os
import sys
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)

project_root = os.path.dirname(os.path.abspath(__file__))
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
    query_deployments_by_service,
)

RAW_DATA_DIR = os.path.join(project_root, "data", "raw")
PROCESSED_DATA_DIR = os.path.join(project_root, "data", "processed")
DB_PATH = os.path.join(project_root, "data", "costtrace.db")

MISSING_VALUE_THRESHOLD = 0.10  # Fail CI if >10% of values are missing in any cleaned dataset


def validate_data_quality(cleaned_data: dict) -> None:
    """Validate cleaned data quality rules. Raises ValueError on failure."""
    logging.info("Running data quality validation...")
    for name, df in cleaned_data.items():
        total_cells = df.size
        missing_cells = int(df.isnull().sum().sum())
        missing_ratio = missing_cells / total_cells if total_cells > 0 else 0
        logging.info(
            f"  [{name}] rows={len(df)} cols={len(df.columns)} "
            f"missing={missing_cells} ({missing_ratio:.2%})"
        )
        if missing_ratio > MISSING_VALUE_THRESHOLD:
            raise ValueError(
                f"Data quality FAILED for '{name}': "
                f"{missing_ratio:.2%} missing values exceeds "
                f"threshold of {MISSING_VALUE_THRESHOLD:.2%}."
            )
        if len(df) == 0:
            raise ValueError(f"Data quality FAILED for '{name}': dataset is empty.")
    logging.info("Data quality validation PASSED.\n")


def main() -> None:
    logging.info("=" * 60)
    logging.info("  CostTrace Data Pipeline - Starting")
    logging.info("=" * 60)

    # --------------------------------------------------------------
    # Stage 1: Ingest raw data
    # --------------------------------------------------------------
    logging.info("\n[1/5] INGESTION: Loading raw datasets...")
    raw_data = ingest_data(RAW_DATA_DIR)
    for key, df in raw_data.items():
        logging.info(f"  -> {key}: {len(df)} rows, {len(df.columns)} cols")

    # --------------------------------------------------------------
    # Stage 2: Clean + validate
    # --------------------------------------------------------------
    logging.info("\n[2/5] CLEANING: Processing raw data...")
    cleaned_data = clean_all_data(raw_data, save_to_disk=True, processed_dir=PROCESSED_DATA_DIR)
    validate_data_quality(cleaned_data)

    # --------------------------------------------------------------
    # Stage 3: Feature engineering
    # --------------------------------------------------------------
    logging.info("\n[3/5] FEATURE ENGINEERING: Building derived metrics...")
    featured_data = feature_engineer_data(
        cleaned_data, save_to_disk=True, processed_dir=PROCESSED_DATA_DIR
    )
    combined = featured_data["combined_data"]
    total_spikes = int(combined["cost_spike"].sum())
    logging.info(f"  -> Detected {total_spikes} cost spike(s) across all services")

    # --------------------------------------------------------------
    # Stage 4: Correlation analysis
    # --------------------------------------------------------------
    logging.info("\n[4/5] ANALYSIS: Running cost-spike correlation engine...")
    correlations = analyze_cost_spikes(
        combined_data_df=featured_data["combined_data"],
        usage_df=featured_data["usage"],
    )
    if correlations.empty:
        logging.info("  -> No cost spikes to correlate.")
    else:
        logging.info(f"  -> Produced {len(correlations)} correlation record(s):")
        for _, row in correlations.iterrows():
            logging.info(
                f"     * {row['spike_time']} | {row['affected_service']} | "
                f"{row['suspected_cause']} | confidence={row['confidence_score']:.2f}"
            )

    # --------------------------------------------------------------
    # Stage 5: Load into SQLite + sample queries
    # --------------------------------------------------------------
    logging.info("\n[5/5] SQL: Writing to SQLite database...")
    engine = get_db_engine(DB_PATH)
    create_tables(engine)

    load_data_to_db(featured_data["combined_data"], "cost_data", engine)
    load_data_to_db(cleaned_data["deployments"], "deployments", engine)
    load_data_to_db(cleaned_data["usage"], "metrics", engine)
    load_data_to_db(correlations, "correlations", engine)

    Session = get_session(engine)
    with Session() as session:
        top_services = query_top_cost_services(session, limit=3)
        logging.info("\n  Top services by total cost:")
        for _, row in top_services.iterrows():
            logging.info(f"    - {row['service']}: ${row['total_cost']:.2f}")

        spikes = query_cost_spikes_with_causes(session)
        logging.info(f"\n  Cost spikes persisted: {len(spikes)} row(s) in 'correlations' table.")

    logging.info("\n" + "=" * 60)
    logging.info("  CostTrace Data Pipeline - SUCCESS")
    logging.info("=" * 60)


if __name__ == "__main__":
    main()
