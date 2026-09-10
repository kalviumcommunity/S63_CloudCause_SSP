import sqlalchemy
from sqlalchemy import create_engine, text, inspect, Column, String, Float, DateTime, Boolean, Integer
from sqlalchemy.orm import sessionmaker, declarative_base
import pandas as pd
import logging
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Define base for declarative models
Base = declarative_base()

# Define table schemas as SQLAlchemy models
class CostData(Base):
    __tablename__ = 'cost_data'
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False)
    service = Column(String, nullable=False)
    cost = Column(Float, nullable=False)
    rolling_avg_cost = Column(Float, nullable=True)
    cost_spike = Column(Boolean, nullable=False)
    deployment_version = Column(String, nullable=True)
    deployment_timestamp = Column(DateTime, nullable=True)

class Deployments(Base):
    __tablename__ = 'deployments'
    id = Column(Integer, primary_key=True, autoincrement=True)
    service = Column(String, nullable=False)
    version = Column(String, nullable=False)
    timestamp = Column(DateTime, nullable=False)

class Metrics(Base):
    __tablename__ = 'metrics'
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False)
    service = Column(String, nullable=False)
    cpu_utilization = Column(Float, nullable=False)
    requests_per_second = Column(Integer, nullable=False)

class Correlations(Base):
    __tablename__ = 'correlations'
    id = Column(Integer, primary_key=True, autoincrement=True)
    spike_time = Column(DateTime, nullable=False)
    affected_service = Column(String, nullable=False)
    suspected_cause = Column(String, nullable=False)
    confidence_score = Column(Float, nullable=False)

def get_db_engine(db_path: str):
    """Returns a SQLAlchemy engine for the SQLite database."""
    # Ensure the directory exists
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    engine = create_engine(f'sqlite:///{db_path}')
    return engine

def create_tables(engine):
    """Creates all defined tables in the database if they don't exist."""
    logging.info("Creating database tables if they do not exist...")
    Base.metadata.create_all(engine)
    logging.info("Database tables created.")

def load_data_to_db(df: pd.DataFrame, table_name: str, engine, if_exists: str = 'replace'):
    """Loads a pandas DataFrame into a specified database table."""
    logging.info(f"Loading data into table: {table_name}...")
    try:
        df.to_sql(table_name, engine, if_exists=if_exists, index=False)
        logging.info(f"Data successfully loaded into {table_name}.")
    except Exception as e:
        logging.error(f"Error loading data into {table_name}: {e}")
        raise

def get_session(engine):
    """Returns a SQLAlchemy session factory."""
    Session = sessionmaker(bind=engine)
    return Session

# --- Query Functions ---

def query_cost_over_time(session, service: str = None) -> pd.DataFrame:
    """Queries cost data over time, optionally filtered by service."""
    logging.info(f"Querying cost over time for service: {service if service else 'All'}")
    query = "SELECT timestamp, service, cost, rolling_avg_cost FROM cost_data"
    params = {}
    if service:
        query += " WHERE service = :service"
        params['service'] = service
    query += " ORDER BY timestamp"
    return pd.read_sql_query(text(query), session.bind, params=params)

def query_top_cost_services(session, limit: int = 5) -> pd.DataFrame:
    """Queries top N services by total cost."""
    logging.info(f"Querying top {limit} services by cost.")
    query = f"SELECT service, SUM(cost) as total_cost FROM cost_data GROUP BY service ORDER BY total_cost DESC LIMIT :limit"
    return pd.read_sql_query(text(query), session.bind, params={'limit': limit})

def query_cost_spikes_with_causes(session, service: str = None) -> pd.DataFrame:
    """Queries detected cost spikes with their suspected causes."""
    logging.info(f"Querying cost spikes with causes for service: {service if service else 'All'}")
    query = "SELECT spike_time, affected_service, suspected_cause, confidence_score FROM correlations"
    params = {}
    if service:
        query += " WHERE affected_service = :service"
        params['service'] = service
    query += " ORDER BY spike_time DESC"
    return pd.read_sql_query(text(query), session.bind, params=params)

def query_deployments_by_service(session, service: str = None) -> pd.DataFrame:
    """Queries deployment events, optionally filtered by service."""
    logging.info(f"Querying deployments for service: {service if service else 'All'}")
    query = "SELECT timestamp, service, version FROM deployments"
    params = {}
    if service:
        query += " WHERE service = :service"
        params['service'] = service
    query += " ORDER BY timestamp DESC"
    return pd.read_sql_query(text(query), session.bind, params=params)


if __name__ == "__main__":
    # For testing the database module independently
    import sys
    import os

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    sys.path.insert(0, project_root)

    from src.ingestion.ingest import ingest_data
    from src.cleaning.clean import clean_all_data
    from src.feature_engineering.features import feature_engineer_data
    from src.analysis.correlate import analyze_cost_spikes

    DB_PATH = os.path.join(project_root, 'data/costtrace.db')
    RAW_DATA_DIR = os.path.join(project_root, 'data/raw')

    try:
        engine = get_db_engine(DB_PATH)
        create_tables(engine)

        # Ingest, clean, feature engineer, and analyze data
        raw_data = ingest_data(RAW_DATA_DIR)
        cleaned_data = clean_all_data(raw_data)
        featured_data = feature_engineer_data(cleaned_data)
        correlation_results = analyze_cost_spikes(
            featured_data['combined_data'], featured_data['usage']
        )

        # Load data into database
        # Cost data table will take the combined_data from feature engineering
        cost_df_to_load = featured_data['combined_data']
        load_data_to_db(cost_df_to_load, 'cost_data', engine)

        # Deployments table
        load_data_to_db(cleaned_data['deployments'], 'deployments', engine)

        # Metrics table
        load_data_to_db(cleaned_data['usage'], 'metrics', engine)

        # Correlations table
        load_data_to_db(correlation_results, 'correlations', engine)

        # Test queries
        Session = get_session(engine)
        with Session() as session:
            print("\n--- Query Results ---")
            print("\nCost over time (service_A):")
            print(query_cost_over_time(session, 'service_a'))

            print("\nTop 2 cost services:")
            print(query_top_cost_services(session, limit=2))

            print("\nCost spikes with causes:")
            print(query_cost_spikes_with_causes(session))

            print("\nDeployments for service_a:")
            print(query_deployments_by_service(session, 'service_a'))

    except Exception as e:
        logging.error(f"Database setup and data loading failed: {e}")
