# CostTrace — Cloud Cost Attribution Platform

An end-to-end data engineering platform that identifies the root cause of cloud cost spikes by correlating cost data with deployment events and usage metrics.

> **Core Objective:** Directly and conclusively answer: 👉 **“What caused this cost spike?”**

---

## 1. Problem Statement

Modern engineering teams often face unexpected surges in their monthly cloud bills but lack automated attribution to trace the culprit:
- *Was it yesterday’s `v2.1.0` release that introduced a memory leak or inefficient queries?*
- *Was it an external traffic spike from a marketing campaign or bot surge?*
- *Or was it an orphaned compute instance left running unattended?*

**CostTrace** combines cloud billing data, deployment release events, and real-time system metrics through a rule-based correlation engine to automatically attribute cost spikes to their root cause with actionable confidence scores.

---

## 2. Pipeline Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│ 1. INGESTION    │ ──>  │ 2. CLEANING     │ ──>  │ 3. FEATURE ENGINEERING  │ ──>  │ 4. CORE ANALYSIS        │ ──>  │ 5. SQL & DASHBOARD      │
│ • billing CSV   │      │ • Deduplication │      │ • 3-period rolling avg  │      │ • Rule-based engine     │      │ • SQLite persistence    │
│ • deployments   │      │ • Datetime cast │      │ • Cost increase %       │      │ • 1-2 hr lookback join  │      │ • 3-Page Streamlit App  │
│ • usage metrics │      │ • Lowercase     │      │ • Spike flag (>30%)     │      │ • Confidence scoring    │      │ • GitHub Actions CI     │
└─────────────────┘      └─────────────────┘      └─────────────────────────┘      └─────────────────────────┘      └─────────────────────────┘
        │                        │                            │                                │                                │
    data/raw/             data/processed/              data/processed/              output/summary.csv              data/costtrace.db
```

### Technology Stack
| Layer | Technologies | Purpose |
|---|---|---|
| **Language & Ingestion** | Python 3.11+, Pandas, Pandera | Type-safe schema validation, parsing CSV and JSON |
| **Cleaning & Features** | Pandas, NumPy | Deduplication, median/sentinel imputation, 3-period rolling average |
| **Analysis** | Rule-Based Correlation Engine | Spike detection (>30% threshold), temporal proximity joins |
| **Database Layer** | SQLite, SQLAlchemy | Analytical persistence across 4 relational tables |
| **Visualization** | Streamlit, Altair | 3-page interactive cost intelligence UI |
| **CI / Automation** | GitHub Actions | Daily scheduled runs, artifact publishing, test suite |

---

## 3. Project Structure

```
S63_CloudCause_SSP/
├── data/
│   ├── raw/                             # Input raw datasets
│   │   ├── billing_data.csv             # Cloud billing metrics (timestamp, service, cost)
│   │   ├── deployment_events.json       # Deployment logs (service, version, timestamp)
│   │   └── usage_metrics.csv            # System metrics (cpu, requests_per_second)
│   ├── processed/                       # Cleaned and feature-engineered datasets
│   └── costtrace.db                     # Relational SQLite database
├── src/
│   ├── ingestion/
│   │   └── ingest.py                    # Multi-dataset ingestion + Pandera schemas
│   ├── cleaning/
│   │   └── clean.py                     # Data hygiene, standardization, deduplication
│   ├── feature_engineering/
│   │   └── features.py                  # Rolling averages, spike detection (>30%), window joins
│   ├── analysis/
│   │   └── correlate.py                 # Core root cause attribution engine
│   └── sql/
│       └── database.py                  # SQLAlchemy models and analytical queries
├── app/
│   └── app.py                           # 3-Page Streamlit Dashboard
├── scripts/
│   ├── run_pipeline.py                  # Full orchestrator CLI script
│   ├── data_workflow.py                 # Modular 3-function workflow script
│   └── validate_intake.py               # Intake validation & format/encoding auditor
├── output/                              # Exported run reports and JSON metrics
├── tests/                               # Comprehensive unit & integration test suite
├── .github/workflows/
│   └── ci.yml                           # GitHub Actions automated workflow
├── requirements.txt                     # Pinned project dependencies
└── README.md                            # Complete platform documentation
```

---

## 4. How to Run

### Step 1: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 2: Execute the End-to-End Pipeline
Run the full CLI pipeline to ingest, clean, feature engineer, correlate, and store data in SQLite:
```bash
python scripts/run_pipeline.py
```
*Alternatively, you can run:* `python run_pipeline.py`

**Expected Console Output:**
```text
=================================================================
      CostTrace: Cloud Cost Spike Attribution Pipeline
=================================================================
[1/5] INGESTION: Loading and validating raw data...
  ✓ Loaded billing: 48 rows, 3 columns
  ✓ Loaded deployments: 4 rows, 3 columns
  ✓ Loaded usage: 48 rows, 4 columns
[2/5] CLEANING: Standardizing and removing duplicates...
  ✓ Cleaned billing: 48 rows validated
  ✓ Cleaned deployments: 4 rows validated
  ✓ Cleaned usage: 48 rows validated
[3/5] FEATURE ENGINEERING: Computing rolling averages & spike flags...
  ✓ Feature engineering complete: 5 cost spike(s) detected
[4/5] ANALYSIS: Running rule-based root cause correlation engine...
  ✓ Attributed 5 cost spike(s) to suspected causes:
    • [2026-03-01 15:00:00] payment_service: Deployment (Confidence: 85%)
    • [2026-03-02 09:00:00] auth_service: External Traffic/Usage Increase (Confidence: 75%)
    • [2026-03-02 18:00:00] db_cluster: Unknown (Confidence: 35%)
[5/5] SQL STORAGE: Persisting to SQLite database (data/costtrace.db)...
  ✓ All tables stored in SQLite: cost_data, deployments, metrics, spike_analysis
=================================================================
                    PIPELINE SUCCESSFUL
=================================================================
```

### Step 3: Launch the Streamlit Dashboard
```bash
streamlit run app/app.py
```
Open [http://localhost:8501](http://localhost:8501) in your browser to view the interactive dashboard.

---

## 5. Root Cause Correlation Logic

The correlation engine evaluates detected cost spikes against system events within a **1–2 hour lookback window**:

```
                       ┌──────────────────────┐
                       │ Cost Spike Detected  │
                       │  (Cost > 1.30 * Avg) │
                       └──────────┬───────────┘
                                  │
                 ┌────────────────┴────────────────┐
                 │                                 │
     Recent Deployment Found?             Traffic Surge Detected?
        (within 120 mins)                  (RPS > 2000 or CPU > 75%)
          ├── YES                               ├── YES
          │    ↓                                │    ↓
          │ 🚀 DEPLOYMENT ISSUE                 │ 📈 EXTERNAL TRAFFIC
          │    Confidence: 85%                  │    Confidence: 75%
          │                                     │
          └─────────────────────┬───────────────┘
                                │ NO TO BOTH
                                ↓
                        ⚠️ STANDALONE ANOMALY
                             (Orphaned Resource / Leak)
                             Confidence: 35%
```

### Correlation Rules:
1. **Cost Spike + Deployment:** If a deployment was recorded for the affected service within the preceding 120 minutes, attribute to **Deployment** (`Confidence: 0.85`).
2. **Cost Spike + Traffic Surge:** If no deployment occurred but request volume exceeds 2,000 req/s or CPU exceeds 75%, attribute to **External Traffic/Usage Increase** (`Confidence: 0.75`).
3. **Cost Spike Only:** If neither deployments nor traffic surges occurred, flag as **Unknown / Anomaly** (`Confidence: 0.35`), pointing toward orphaned compute or resource leakage.

---

## 6. SQL Layer (SQLite)

The SQLite database (`data/costtrace.db`) stores four primary relational tables:
- **`cost_data`**: Historical hourly cost, rolling average baseline, increase percentage, and spike flags.
- **`deployments`**: Deployment releases by service, version, and timestamp.
- **`metrics`**: CPU utilization and request throughput.
- **`spike_analysis`**: Identified spikes, suspected causes, confidence scores, and findings.

Built-in analytical queries in `src/sql/database.py`:
- `query_cost_over_time(session, service)`: Time-series cost tracking.
- `query_top_cost_services(session, limit)`: Service-wise cost aggregation.
- `query_cost_spikes_with_causes(session, service)`: Root cause spike summary.
- `query_spike_summary(session)`: Aggregate breakdown by cause.

---

## 7. Streamlit Dashboard Features

1. **📊 Dashboard Page:**
   - Real-time spend KPIs (Total Spend, Spike Count, Active Services, Avg Spike Magnitude).
   - Interactive Altair line charts tracking cost over time alongside 3-period rolling baselines.
   - Top spender tables and root cause distribution bar charts.
2. **🔍 Spike Analysis Page:**
   - Chart overlay featuring **highlighted spikes** and **deployment markers**.
   - **Suspected Cause Panel** delivering a diagnosis for each spike event.
3. **📋 Insights Table:**
   - Filterable post-mortem table showing Service, Spike Timestamp, Spike %, Deployment Version, Root Cause, Confidence, and Findings.
   - One-click **CSV export** for team reporting.

---

## 8. Automated CI/CD (GitHub Actions)

Located at `.github/workflows/ci.yml`:
- **Schedule:** Automated nightly run at midnight UTC (`0 0 * * *`).
- **Triggers:** Push, pull request, and manual `workflow_dispatch`.
- **Steps:**
  1. Installs pinned dependencies.
  2. Runs pytest data validation test suite (`18 passing tests`).
  3. Executes `python scripts/run_pipeline.py`.
  4. Verifies database generation and output CSVs.
  5. Uploads attribution summaries and database as workflow artifacts.

---

## 9. Running Tests
```bash
python -m pytest tests/ -v
```
All 18 tests validate schema constraints, non-negative costs, deduplication, rolling baseline presence, and attribution confidence bounds.
