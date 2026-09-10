import streamlit as st
import pandas as pd
import altair as alt
import os
import sys

# Add the project root to sys.path to enable module imports
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from src.sql.database import get_db_engine, get_session, query_cost_over_time, query_deployments_by_service, query_cost_spikes_with_causes

# --- Configuration ---
DB_PATH = os.path.join(project_root, 'data/costtrace.db')

st.set_page_config(layout="wide", page_title="CostTrace Dashboard", page_icon=":chart_with_upwards_trend:")

# --- Helper Functions ---
@st.cache_resource
def get_database_session():
    engine = get_db_engine(DB_PATH)
    Session = get_session(engine)
    return Session

@st.cache_data(ttl=600)
def fetch_cost_data(service=None):
    Session = get_database_session()
    with Session() as session:
        return query_cost_over_time(session, service)

@st.cache_data(ttl=600)
def fetch_deployment_data(service=None):
    Session = get_database_session()
    with Session() as session:
        return query_deployments_by_service(session, service)

@st.cache_data(ttl=600)
def fetch_spike_data(service=None):
    Session = get_database_session()
    with Session() as session:
        return query_cost_spikes_with_causes(session, service)

# --- Streamlit App Layout ---
st.title("CostTrace: Cloud Cost Attribution Dashboard")
st.markdown("Track cloud costs, deployment events, and identify cost spikes with their suspected causes.")

# --- Sidebar Filters ---
st.sidebar.header("Filters")

# Fetch all services for the filter
all_cost_data = fetch_cost_data()
all_services = sorted(all_cost_data['service'].unique().tolist() if not all_cost_data.empty else [])
selected_service = st.sidebar.selectbox("Select Service", ["All"] + all_services)

# Time Range Filter
min_date = all_cost_data['timestamp'].min() if not all_cost_data.empty else pd.Timestamp.now()
max_date = all_cost_data['timestamp'].max() if not all_cost_data.empty else pd.Timestamp.now()

date_range = st.sidebar.date_input(
    "Select Date Range",
    value=(min_date, max_date),
    min_value=min_date,
    max_value=max_date
)

# --- Main Dashboard Content ---

# Apply filters to data
filtered_service = selected_service if selected_service != "All" else None

cost_df = fetch_cost_data(filtered_service)
deployment_df = fetch_deployment_data(filtered_service)
spike_df = fetch_spike_data(filtered_service)

# Ensure timestamp columns are datetime type (SQLite reads them back as strings)
if not cost_df.empty:
    cost_df['timestamp'] = pd.to_datetime(cost_df['timestamp'])
if not deployment_df.empty:
    deployment_df['timestamp'] = pd.to_datetime(deployment_df['timestamp'])
if not spike_df.empty:
    spike_df['spike_time'] = pd.to_datetime(spike_df['spike_time'])

if len(date_range) == 2:
    start_date, end_date = date_range
    cost_df = cost_df[(cost_df['timestamp'] >= pd.Timestamp(start_date)) & (cost_df['timestamp'] <= pd.Timestamp(end_date).replace(hour=23, minute=59, second=59))]
    deployment_df = deployment_df[(deployment_df['timestamp'] >= pd.Timestamp(start_date)) & (deployment_df['timestamp'] <= pd.Timestamp(end_date).replace(hour=23, minute=59, second=59))]
    spike_df = spike_df[(spike_df['spike_time'] >= pd.Timestamp(start_date)) & (spike_df['spike_time'] <= pd.Timestamp(end_date).replace(hour=23, minute=59, second=59))]

st.subheader("Cost Over Time and Deployment Events")
if not cost_df.empty:
    # Base chart for cost
    base = alt.Chart(cost_df).encode(
        x=alt.X('timestamp', title="Time"),
        y=alt.Y('cost', title="Cost"),
        tooltip=['timestamp', 'service', 'cost', 'rolling_avg_cost']
    )

    # Line chart for cost
    cost_line = base.mark_line(point=True, color='steelblue').encode(
        y=alt.Y('cost', title="Cost", axis=alt.Axis(titleColor='steelblue')),
        color=alt.value('steelblue'), # Explicitly set color for clarity
        tooltip=['timestamp', 'service', 'cost']
    )

    # Line chart for rolling average cost
    rolling_avg_line = base.mark_line(point=False, color='orange', strokeDash=[5,5]).encode(
        y=alt.Y('rolling_avg_cost', title="Rolling Avg Cost", axis=alt.Axis(titleColor='orange')),
        color=alt.value('orange'), # Explicitly set color for clarity
        tooltip=['timestamp', 'service', 'rolling_avg_cost']
    )

    # Deployment markers
    deployment_markers = alt.Chart(deployment_df).mark_point(filled=True, size=100, color='red', shape='triangle-down').encode(
        x=alt.X('timestamp', title="Time"),
        y=alt.value(50), # Position markers at a fixed y-value or bottom of chart
        tooltip=['timestamp', 'service', 'version'],
        opacity=alt.value(0.8)
    )

    # Spike markers (if any)
    if not spike_df.empty:
        spike_markers = alt.Chart(spike_df).mark_point(filled=True, size=150, color='purple', shape='star').encode(
            x=alt.X('spike_time', title="Time"),
            y=alt.value(70), # Position markers at a fixed y-value or bottom of chart
            tooltip=['spike_time', 'affected_service', 'suspected_cause', 'confidence_score'],
            opacity=alt.value(0.8)
        )
        chart = alt.layer(cost_line, rolling_avg_line, deployment_markers, spike_markers).resolve_scale(y='independent').interactive()
    else:
        chart = alt.layer(cost_line, rolling_avg_line, deployment_markers).resolve_scale(y='independent').interactive()
    
    st.altair_chart(chart, use_container_width=True)
else:
    st.info("No cost data available for the selected filters.")

st.subheader("Detected Cost Spikes and Causes")
if not spike_df.empty:
    st.dataframe(spike_df, use_container_width=True)
else:
    st.info("No cost spikes detected for the selected filters.")
