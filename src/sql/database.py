import sqlalchemy
from sqlalchemy import create_engine, text, Column, String, Float, DateTime, Boolean, Integer
from sqlalchemy.orm import sessionmaker, declarative_base
import pandas as pd
import logging
import os

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

Base = declarative_base()

class CostData(Base):
    __tablename__ = 'cost_data'
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, nullable=False)
    service = Column(String, nullable=False)
    cost = Column(Float, nullable=False)
    rolling_avg_cost = Column(Float, nullable=True)
    cost_increase_pct = Column(Float, nullable=True)
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

class SpikeAnalysis(Base):
    __tablename__ = 'spike_analysis'
    id = Column(Integer, primary_key=True, autoincrement=True)
    spike_time = Column(DateTime, nullable=False)
    affected_service = Column(String, nullable=False)
    service = Column(String, nullable=True)
    cost_increase_pct = Column(Float, nullable=True)
    suspected_cause = Column(String, nullable=False)
    confidence_score = Column(Float, nullable=False)
    deployment_version = Column(String, nullable=True)
    current_cost = Column(Float, nullable=True)
    baseline_cost = Column(Float, nullable=True)
    root_cause_explanation = Column(String, nullable=True)

class Correlations(Base):
    __tablename__ = 'correlations'
    id = Column(Integer, primary_key=True, autoincrement=True)
    spike_time = Column(DateTime, nullable=False)
    affected_service = Column(String, nullable=False)
    suspected_cause = Column(String, nullable=False)
    confidence_score = Column(Float, nullable=False)

def get_db_engine(db_path: str):
    """Returns a SQLAlchemy engine for SQLite database."""
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    return create_engine(f'sqlite:///{db_path}')

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
    return sessionmaker(bind=engine)

# --- Analytics Query Functions ---

def query_cost_over_time(session, service: str = None) -> pd.DataFrame:
    """Queries cost trends over time, optionally filtered by service."""
    query = "SELECT timestamp, service, cost, rolling_avg_cost, cost_increase_pct, cost_spike FROM cost_data"
    params = {}
    if service and service != "All":
        query += " WHERE service = :service"
        params['service'] = service
    query += " ORDER BY timestamp"
    return pd.read_sql_query(text(query), session.bind, params=params)

def query_top_cost_services(session, limit: int = 5) -> pd.DataFrame:
    """Queries top N services by total cost (service-wise cost)."""
    query = """
        SELECT service, ROUND(SUM(cost), 2) as total_cost, COUNT(*) as record_count,
               ROUND(AVG(cost), 2) as avg_cost
        FROM cost_data
        GROUP BY service
        ORDER BY total_cost DESC
        LIMIT :limit
    """
    return pd.read_sql_query(text(query), session.bind, params={'limit': limit})

def query_cost_spikes_with_causes(session, service: str = None) -> pd.DataFrame:
    """Queries detected cost spikes with their suspected causes and confidence."""
    # Check if spike_analysis table exists or fallback to correlations
    query = """
        SELECT spike_time, affected_service,
               COALESCE(cost_increase_pct, 0.0) as cost_increase_pct,
               suspected_cause, confidence_score,
               COALESCE(deployment_version, 'None') as deployment_version,
               COALESCE(root_cause_explanation, 'Under investigation') as root_cause_explanation
        FROM spike_analysis
    """
    params = {}
    if service and service != "All":
        query += " WHERE (affected_service = :service OR service = :service)"
        params['service'] = service
    query += " ORDER BY spike_time DESC"
    try:
        return pd.read_sql_query(text(query), session.bind, params=params)
    except Exception:
        fallback_query = "SELECT spike_time, affected_service, suspected_cause, confidence_score FROM correlations"
        if service and service != "All":
            fallback_query += " WHERE affected_service = :service"
        return pd.read_sql_query(text(fallback_query), session.bind, params=params)

def query_spike_summary(session) -> pd.DataFrame:
    """Queries aggregate summary of spikes by suspected cause and affected service."""
    query = """
        SELECT suspected_cause, COUNT(*) as spike_count,
               ROUND(AVG(confidence_score), 2) as avg_confidence,
               GROUP_CONCAT(DISTINCT affected_service) as affected_services
        FROM spike_analysis
        GROUP BY suspected_cause
        ORDER BY spike_count DESC
    """
    try:
        return pd.read_sql_query(text(query), session.bind)
    except Exception:
        fallback = """
            SELECT suspected_cause, COUNT(*) as spike_count,
                   ROUND(AVG(confidence_score), 2) as avg_confidence,
                   GROUP_CONCAT(DISTINCT affected_service) as affected_services
            FROM correlations
            GROUP BY suspected_cause
            ORDER BY spike_count DESC
        """
        return pd.read_sql_query(text(fallback), session.bind)

def query_deployments_by_service(session, service: str = None) -> pd.DataFrame:
    """Queries deployment events, optionally filtered by service."""
    query = "SELECT timestamp, service, version FROM deployments"
    params = {}
    if service and service != "All":
        query += " WHERE service = :service"
        params['service'] = service
    query += " ORDER BY timestamp DESC"
    return pd.read_sql_query(text(query), session.bind, params=params)
