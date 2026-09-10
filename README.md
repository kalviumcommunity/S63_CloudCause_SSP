# CostTrace — Cloud Cost Attribution Platform

An end-to-end data engineering pipeline that ingests cloud billing data,
deployment events, and usage metrics, then correlates them to surface *which
engineering actions caused cost spikes*.

---

## 1. Problem Statement

Engineering teams often see unexplained spikes in their monthly cloud bill but
cannot easily trace the root cause:

- Was it yesterday's v1.0.1 deployment that increased RDS spend?
- Or a traffic surge brought on by a marketing campaign?
- Or a bug that leaked orphaned compute instances?

**CostTrace** combines three data sources and a simple rule-based correlation
engine to attribute cost spikes back to their most likely cause.

---

## 2. Pipeline Architecture

The project follows a clean five-stage data flow:

```
 ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   ┌──────────────┐   ┌──────────────┐
 │  INGESTION   │ → │   CLEANING   │ → │ FEATURE ENGINEER │ → │   ANALYSIS   │ → │  SQL + APP   │
 │  (Python)    │   │  (Pandas)    │   │   (Pandas/NumPy) │   │  (Correlate) │   │ (SQLite +    │
 │  CSV / JSON  │   │  Validate +  │   │ Rolling Avg +    │   │  Rule-based  │   │  Streamlit)  │
 │  + Schemas   │   │  Standardize │   │ Spike Detection  │   │  Engine      │   │              │
 └──────────────┘   └──────────────┘   └──────────────────┘   └──────────────┘   └──────────────┘
       ↓                  ↓                    ↓                    ↓                   ↓
  data/raw/         data/processed/      data/processed/    correlations.csv    data/costtrace.db
                                                                                ↗            ↖
                                                                       Streamlit       GitHub Actions
                                                                       Dashboard          CI
```

### Technology Stack
| Stage               | Library / Tool              | Purpose                                         |
|---------------------|-----------------------------|-------------------------------------------------|
| Ingestion           | Python, Pandas, **Pandera** | Schema-validated CSV / JSON loading             |
| Cleaning            | Pandas, logging             | De-dup, fill NaNs, lowercase service names      |
| Feature Engineering | Pandas, **NumPy**           | Rolling averages, spike flags, time-window join |
| Analysis            | Pandas                      | Rule-based correlation engine                   |
| Storage             | **SQLite**, SQLAlchemy      | 4 tables (cost, deployments, metrics, corrs)    |
| Visualization       | **Streamlit**, Altair       | Interactive dashboard w/ filters + markers      |
| CI                  | **GitHub Actions**          | Validate + run pipeline on every push           |

---

## 3. Project Structure

```
S63_CloudCause_SSP/
├── data/
│   ├── raw/                         # Raw input (mock CSV + JSON)
│   │   ├── billing_data.csv
│   │   ├── deployment_events.json
│   │   └── usage_metrics.csv
│   ├── processed/                   # Cleaned + featured CSVs (auto-generated)
│   │   ├── billing_cleaned.csv
│   │   ├── deployments_cleaned.csv
│   │   ├── usage_cleaned.csv
│   │   ├── combined_data_featured.csv
│   │   └── ...
│   └── costtrace.db                 # SQLite output database
├── src/
│   ├── ingestion/
│   │   └── ingest.py                # Stage 1: Load + Pandera schema validate
│   ├── cleaning/
│   │   └── clean.py                 # Stage 2: Clean + save to processed/
│   ├── feature_engineering/
│   │   └── features.py              # Stage 3: Rolling avg, spikes, join deploys
│   ├── analysis/
│   │   └── correlate.py             # Stage 4: Rule-based cause attribution
│   └── sql/
│       └── database.py              # Stage 5: SQLite schema + queries
├── app/
│   └── app.py                       # Streamlit interactive dashboard
├── tests/
│   └── test_data_validation.py      # 20+ unittest / pytest-style tests
├── .github/
│   └── workflows/
│       └── ci.yml                   # CI: validate → test → run pipeline
├── requirements.txt                 # Python dependencies
├── run_pipeline.py                  # Orchestrator: runs all 5 stages
└── README.md
```

---

## 4. Setup Steps

### 4.1 Prerequisites
- Python 3.10+
- pip

### 4.2 Install Dependencies
```bash
cd S63_CloudCause_SSP
python -m venv .venv
source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 4.3 Run the End-to-End Pipeline
```bash
python run_pipeline.py
```
This executes all 5 stages, prints a summary, and writes:
- Cleaned + featured CSV files to `data/processed/`
- A fully populated SQLite database to `data/costtrace.db`

### 4.4 Run Validation Tests
```bash
python -m pytest tests/test_data_validation.py -v
# or:
python tests/test_data_validation.py
```

### 4.5 Launch the Streamlit Dashboard
```bash
streamlit run app/app.py
```
Then open **http://localhost:8501** in your browser. You will see:
- A cost-over-time line chart with rolling average overlay
- Red triangle markers for deployment events
- Purple star markers for detected cost spikes
- A table of spikes → suspected causes (Deployment / Traffic / Unknown)
- Sidebar filters: **Service** and **Date Range**

---

## 5. Pipeline Stage Explanations

### Stage 1 — Data Ingestion (`src/ingestion/ingest.py`)
- Reads billing + usage from CSV, deployments from JSON
- Every DataFrame is validated against a **Pandera** schema *before* leaving this stage
- Fails fast if required columns are missing, types are wrong, or cost / CPU values are out of range

### Stage 2 — Data Cleaning & Validation (`src/cleaning/clean.py`)
- Drops duplicate rows
- Fills missing `cost` values with 0 (with a WARNING log)
- Lowercases + strips all `service` names (so `Service_A` and `service_a` match)
- Re-validates with Pandera before returning
- **Quality gate** in `run_pipeline.py`: fails the CI run if any dataset has > 10% missing values

### Stage 3 — Feature Engineering (`src/feature_engineering/features.py`)
Per service, ordered by time:
1. **Rolling averages** — `rolling_avg_cost` (window = 3 periods)
2. **Cost spike detection** — `cost_spike = True` when `cost > 1.20 × rolling_avg`
3. **Join deployments** — using `pd.merge_asof(tolerance=60min)` so each cost row is linked to the nearest preceding deployment of the same service within a 1-hour window

### Stage 4 — Correlation Analysis (`src/analysis/correlate.py`)
A simple, transparent rule engine:

| Condition                                                         | Suspected Cause               | Confidence |
|-------------------------------------------------------------------|-------------------------------|------------|
| Cost spike **+** deployment_version not null (within ±60 min)    | **Deployment**                | 0.80       |
| Cost spike **+** requests_per_second > 2000 (and no deployment)  | **External Traffic Increase** | 0.70       |
| All other cost spikes                                             | **Unknown**                   | 0.30       |

Output table (`correlations` in SQLite):
```
spike_time           affected_service   suspected_cause               confidence_score
-------------------  -----------------  -----------------------------  ----------------
2023-01-02 00:00:00  service_a          Deployment                     0.80
```

### Stage 5 — SQL Layer & Dashboard (`src/sql/database.py` + `app/app.py`)
Four tables are created in `costtrace.db`:
| Table            | Contents                                             |
|------------------|------------------------------------------------------|
| `cost_data`      | Cost + rolling avg + spike flag + deploy info       |
| `deployments`    | Service, version, timestamp                          |
| `metrics`        | CPU utilization, requests per second                 |
| `correlations`   | Spike → cause attribution output                    |

Useful pre-written queries (already used by Streamlit):
- `query_cost_over_time(session, service=None)`
- `query_top_cost_services(session, limit=5)`
- `query_cost_spikes_with_causes(session, service=None)`
- `query_deployments_by_service(session, service=None)`

---

## 6. CI / CD — GitHub Actions

File: `.github/workflows/ci.yml` — triggered on **every push / pull request**:

1. Setup Python 3.11
2. `pip install -r requirements.txt`
3. **Verify** the three raw data files exist
4. **Run tests** via pytest — fail on any schema / quality error
5. **Run pipeline** via `python run_pipeline.py` — fail if:
   - Schema breaks during ingestion
   - Missing values exceed 10% threshold
   - Any stage raises an exception
6. **Verify outputs** — `costtrace.db` and all `data/processed/*.csv` exist

---

## 7. Future Work (TODOs in Code)

The codebase contains explicit `TODO:` markers marking the jump-off points for
a production deployment:

- **`src/ingestion/ingest.py`**
  - ☁️ **Real cloud billing integration** — AWS Cost Explorer / CUR, GCP BigQuery billing export, Azure Consumption API
  - 📡 **Real-time ingestion** — CloudWatch Events, Pub/Sub, Kinesis, budget alert webhooks

- **`src/cleaning/clean.py`**
  - 🌊 **Streaming mode** — watermarking, windowed aggregations, incremental SQLite appends

Suggested concrete next steps:
1. Add a `src/ingestion/aws.py` using `boto3` Cost Explorer API
2. Swap `sqlite:///` for `postgres:///` or `snowflake:///` via the SQLAlchemy `get_db_engine()` helper
3. Add CI caching for the `.venv` + Streamlit deployment to Vercel / Community Cloud

---

## 8. Mock Data Included

The repo ships with a tiny, hand-crafted mock dataset so the pipeline works
out-of-the-box:

| File                    | Rows | Notes                                      |
|-------------------------|------|--------------------------------------------|
| `billing_data.csv`      | 5    | service_A has a ~4× cost spike on Jan 2    |
| `deployment_events.json`| 3    | service_A v1.0.1 deployed 15 min before spike |
| `usage_metrics.csv`     | 5    | service_B shows high RPS (traffic cause)   |

This design intentionally surfaces **both** correlation rules (Deployment +
External Traffic) when you run the pipeline.

---

## 9. License / Purpose

Beginner-friendly reference implementation of a data engineering pipeline.
Optimised for **clarity, not production complexity**. Every module uses
`if __name__ == "__main__":` so you can run each stage independently while
learning the flow.
