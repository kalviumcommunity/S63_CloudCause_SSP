"""
CostTrace: Cloud Cost Spike Attribution Platform - Streamlit Dashboard
An interactive UI that correlates cloud costs with deployment events and traffic metrics
to directly answer: "What caused this cost spike?"
"""

import os
import sys
import pandas as pd
import altair as alt
import streamlit as st

# Ensure project root is available in module path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from src.sql.database import (
    get_db_engine,
    get_session,
    query_cost_over_time,
    query_deployments_by_service,
    query_cost_spikes_with_causes,
    query_top_cost_services,
    query_spike_summary,
)

DB_PATH = os.path.join(project_root, "data", "costtrace.db")

st.set_page_config(
    page_title="CostTrace — Cloud Cost Attribution",
    page_icon="☁️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom minimal styling
st.markdown("""
    <style>
    .metric-card {
        background-color: #f8f9fa;
        border-radius: 8px;
        padding: 16px;
        border-left: 5px solid #2b5c8f;
        box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .cause-card {
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
    }
    .badge-deployment {
        background-color: #fee2e2;
        color: #991b1b;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
    }
    .badge-traffic {
        background-color: #fef3c7;
        color: #92400e;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
    }
    .badge-anomaly {
        background-color: #e0e7ff;
        color: #3730a3;
        padding: 4px 8px;
        border-radius: 4px;
        font-weight: 600;
    }
    </style>
""", unsafe_allow_html=True)


# --- Database Helpers ---
@st.cache_resource
def get_database_session():
    """Initializes and caches database session factory."""
    if not os.path.exists(DB_PATH):
        # Auto-run pipeline to populate database if missing
        from scripts.run_pipeline import run_pipeline
        run_pipeline()
    engine = get_db_engine(DB_PATH)
    return get_session(engine)


def load_data(service=None):
    """Fetches core datasets from SQLite."""
    Session = get_database_session()
    with Session() as session:
        cost_df = query_cost_over_time(session, service)
        deployment_df = query_deployments_by_service(session, service)
        spike_df = query_cost_spikes_with_causes(session, service)
        top_services_df = query_top_cost_services(session, limit=10)
        spike_summary_df = query_spike_summary(session)

    if not cost_df.empty:
        cost_df["timestamp"] = pd.to_datetime(cost_df["timestamp"])
    if not deployment_df.empty:
        deployment_df["timestamp"] = pd.to_datetime(deployment_df["timestamp"])
    if not spike_df.empty:
        spike_df["spike_time"] = pd.to_datetime(spike_df["spike_time"])

    return cost_df, deployment_df, spike_df, top_services_df, spike_summary_df


# --- Load Base Data ---
all_costs, all_deployments, all_spikes, top_services, spike_summary = load_data()

# --- Sidebar Controls ---
st.sidebar.title("☁️ CostTrace")
st.sidebar.caption("Cloud Cost Spike Attribution Platform")
st.sidebar.markdown("---")

# Page Navigation
page = st.sidebar.radio(
    "Navigate to:",
    ["📊 Dashboard Page", "🔍 Spike Analysis Page", "📋 Insights Table"],
    index=0,
)

st.sidebar.markdown("---")
st.sidebar.subheader("Filters")

# Service Filter
available_services = sorted(all_costs["service"].unique().tolist()) if not all_costs.empty else []
selected_service = st.sidebar.selectbox("Filter Service", ["All"] + available_services)

# Date Range Filter
if not all_costs.empty:
    min_date = all_costs["timestamp"].min().date()
    max_date = all_costs["timestamp"].max().date()
else:
    min_date = pd.Timestamp.now().date()
    max_date = pd.Timestamp.now().date()

selected_date_range = st.sidebar.date_input(
    "Date Range",
    value=(min_date, max_date),
    min_value=min_date,
    max_value=max_date,
)

# Apply Filters
active_service = None if selected_service == "All" else selected_service
cost_df, deployment_df, spike_df, _, _ = load_data(active_service)

if len(selected_date_range) == 2:
    start_d, end_d = selected_date_range
    start_ts = pd.Timestamp(start_d)
    end_ts = pd.Timestamp(end_d).replace(hour=23, minute=59, second=59)

    if not cost_df.empty:
        cost_df = cost_df[(cost_df["timestamp"] >= start_ts) & (cost_df["timestamp"] <= end_ts)]
    if not deployment_df.empty:
        deployment_df = deployment_df[(deployment_df["timestamp"] >= start_ts) & (deployment_df["timestamp"] <= end_ts)]
    if not spike_df.empty:
        spike_df = spike_df[(spike_df["spike_time"] >= start_ts) & (spike_df["spike_time"] <= end_ts)]

# Re-run pipeline trigger in sidebar
st.sidebar.markdown("---")
if st.sidebar.button("🔄 Refresh / Re-run Pipeline"):
    from scripts.run_pipeline import run_pipeline
    with st.spinner("Running end-to-end pipeline..."):
        run_pipeline()
    st.cache_resource.clear()
    st.cache_data.clear()
    st.rerun()


# ==============================================================================
# PAGE 1: DASHBOARD PAGE
# ==============================================================================
if page == "📊 Dashboard Page":
    st.title("📊 Cloud Cost Trends & Overview")
    st.markdown("Monitor cloud spend over time with moving baseline averages and automated spike flags.")

    # KPI Top Metrics Row
    m1, m2, m3, m4 = st.columns(4)
    total_cost = cost_df["cost"].sum() if not cost_df.empty else 0.0
    detected_spikes = len(spike_df) if not spike_df.empty else 0
    active_count = cost_df["service"].nunique() if not cost_df.empty else 0
    avg_spike_pct = spike_df["cost_increase_pct"].mean() if not spike_df.empty else 0.0

    m1.metric("Total Monitored Spend", f"${total_cost:,.2f}")
    m2.metric("Detected Cost Spikes", f"{detected_spikes}", delta=f"{detected_spikes} alerts", delta_color="inverse")
    m3.metric("Active Cloud Services", f"{active_count}")
    m4.metric("Avg Spike Magnitude", f"+{avg_spike_pct:.1f}%")

    st.markdown("---")

    # Cost Line Chart
    st.subheader("Cost Over Time (with 3-Period Rolling Average)")
    if not cost_df.empty:
        # Base Chart
        base_chart = alt.Chart(cost_df).encode(
            x=alt.X("timestamp:T", title="Timestamp", axis=alt.Axis(format="%b %d, %H:%M")),
            color=alt.Color("service:N", title="Service", scale=alt.Scale(scheme="category10"))
        )

        # Actual Cost Line
        cost_line = base_chart.mark_line(point=True, size=2).encode(
            y=alt.Y("cost:Q", title="Hourly Cost ($)"),
            tooltip=[
                alt.Tooltip("timestamp:T", title="Time", format="%Y-%m-%d %H:%M"),
                alt.Tooltip("service:N", title="Service"),
                alt.Tooltip("cost:Q", title="Cost ($)", format="$.2f"),
                alt.Tooltip("rolling_avg_cost:Q", title="Rolling Avg ($)", format="$.2f"),
                alt.Tooltip("cost_increase_pct:Q", title="Increase %", format="+.1f"),
            ]
        )

        # Rolling Average Line (dashed)
        rolling_line = base_chart.mark_line(strokeDash=[4, 4], opacity=0.7).encode(
            y=alt.Y("rolling_avg_cost:Q", title="Rolling Baseline ($)")
        )

        final_chart = alt.layer(cost_line, rolling_line).interactive()
        st.altair_chart(final_chart, use_container_width=True)
    else:
        st.info("No cost records found for the selected filter criteria.")

    # Top Spender Breakdown
    col_left, col_right = st.columns([1, 1])
    with col_left:
        st.subheader("Top Services by Total Spend")
        if not top_services.empty:
            st.dataframe(
                top_services.rename(columns={
                    "service": "Service",
                    "total_cost": "Total Spend ($)",
                    "record_count": "Data Points",
                    "avg_cost": "Avg Cost ($)"
                }),
                use_container_width=True,
                hide_index=True
            )
    with col_right:
        st.subheader("Root Cause Distribution")
        if not spike_summary.empty:
            cause_chart = alt.Chart(spike_summary).mark_bar().encode(
                x=alt.X("spike_count:Q", title="Number of Spikes"),
                y=alt.Y("suspected_cause:N", sort="-x", title="Attributed Cause"),
                color=alt.Color("suspected_cause:N", scale=alt.Scale(scheme="set2"), legend=None),
                tooltip=["suspected_cause", "spike_count", "avg_confidence", "affected_services"]
            )
            st.altair_chart(cause_chart, use_container_width=True)


# ==============================================================================
# PAGE 2: SPIKE ANALYSIS PAGE
# ==============================================================================
elif page == "🔍 Spike Analysis Page":
    st.title("🔍 Spike Analysis & Root Cause Attribution")
    st.markdown("Directly answers: 👉 **'What caused this cost spike?'** by correlating cost anomalies with deployments and traffic.")

    if not spike_df.empty:
        # Highlighted Spike Chart with Deployment Markers
        st.subheader("Cost Curve with Highlighted Spikes & Deployment Events")

        base_chart = alt.Chart(cost_df).encode(
            x=alt.X("timestamp:T", title="Timestamp", axis=alt.Axis(format="%b %d, %H:%M"))
        )

        cost_line = base_chart.mark_line(color="#4a5568", opacity=0.8).encode(
            y=alt.Y("cost:Q", title="Cost ($)"),
            color=alt.Color("service:N", title="Service")
        )

        # Spike Points (Large Red Star/Circles)
        spike_overlay = alt.Chart(spike_df).mark_point(
            filled=True, size=220, color="#e53e3e", shape="cross"
        ).encode(
            x=alt.X("spike_time:T"),
            y=alt.Y("current_cost:Q"),
            tooltip=[
                alt.Tooltip("spike_time:T", title="Spike Time", format="%Y-%m-%d %H:%M"),
                alt.Tooltip("affected_service:N", title="Service"),
                alt.Tooltip("cost_increase_pct:Q", title="Spike %", format="+.1f"),
                alt.Tooltip("suspected_cause:N", title="Cause"),
                alt.Tooltip("confidence_score:Q", title="Confidence", format=".0%"),
            ]
        )

        # Deployment Markers (Triangles at bottom)
        deployment_markers = alt.Chart(deployment_df).mark_point(
            filled=True, size=180, color="#3182ce", shape="triangle-up"
        ).encode(
            x=alt.X("timestamp:T"),
            y=alt.value(10),
            tooltip=[
                alt.Tooltip("timestamp:T", title="Deployed At", format="%Y-%m-%d %H:%M"),
                alt.Tooltip("service:N", title="Service"),
                alt.Tooltip("version:N", title="Release Version"),
            ]
        )

        composite_chart = alt.layer(cost_line, spike_overlay, deployment_markers).interactive()
        st.altair_chart(composite_chart, use_container_width=True)

        st.caption("📌 **Legend:** Lines = Cost Trend | Red Crosses = Detected Cost Spikes (>30% threshold) | Blue Triangles = Deployment Releases")

        # Suspected Cause Panels
        st.markdown("---")
        st.subheader("🎯 Suspected Cause Breakdown")

        for idx, row in spike_df.iterrows():
            cause = row["suspected_cause"]
            badge_class = (
                "badge-deployment" if cause == "Deployment"
                else "badge-traffic" if "Traffic" in cause
                else "badge-anomaly"
            )

            icon = "🚀" if cause == "Deployment" else "📈" if "Traffic" in cause else "⚠️"

            with st.container():
                st.markdown(f"""
                <div class="cause-card">
                    <h4>{icon} {row['affected_service'].upper()} — Spike at {row['spike_time'].strftime('%Y-%m-%d %H:%M')}</h4>
                    <p><b>Cost Increase:</b> <span style="color:#e53e3e; font-size:1.1em; font-weight:bold;">+{row['cost_increase_pct']:.1f}%</span> 
                       &nbsp;|&nbsp; <b>Confidence Score:</b> {row['confidence_score']:.0%}
                       &nbsp;|&nbsp; <b>Attributed Cause:</b> <span class="{badge_class}">{cause}</span>
                    </p>
                    <p><b>Diagnosis:</b> {row['root_cause_explanation']}</p>
                    <p style="color:#64748b; font-size:0.9em;"><b>Deployment Version in Window:</b> <code>{row['deployment_version']}</code></p>
                </div>
                """, unsafe_allow_html=True)
    else:
        st.success("✓ No cost spikes detected for the selected filters.")


# ==============================================================================
# PAGE 3: INSIGHTS TABLE
# ==============================================================================
elif page == "📋 Insights Table":
    st.title("📋 Executive Insights Table")
    st.markdown("Structured attribution data ready for engineering post-mortems and cost governance.")

    if not spike_df.empty:
        # Prepare Display Table
        display_df = spike_df[[
            "affected_service",
            "spike_time",
            "cost_increase_pct",
            "deployment_version",
            "suspected_cause",
            "confidence_score",
            "root_cause_explanation"
        ]].copy()

        display_df.rename(columns={
            "affected_service": "Service",
            "spike_time": "Spike Timestamp",
            "cost_increase_pct": "Cost Spike (%)",
            "deployment_version": "Deployment Version",
            "suspected_cause": "Root Cause",
            "confidence_score": "Confidence",
            "root_cause_explanation": "Investigation Finding"
        }, inplace=True)

        display_df["Confidence"] = display_df["Confidence"].apply(lambda c: f"{c:.0%}")
        display_df["Cost Spike (%)"] = display_df["Cost Spike (%)"].apply(lambda p: f"+{p:.1f}%")

        st.dataframe(display_df, use_container_width=True, hide_index=True)

        # CSV Download Button
        csv_data = display_df.to_csv(index=False)
        st.download_button(
            label="📥 Download Insights as CSV",
            data=csv_data,
            file_name="costtrace_spike_insights.csv",
            mime="text/csv",
        )
    else:
        st.info("No spike records found to display in the insights table.")
