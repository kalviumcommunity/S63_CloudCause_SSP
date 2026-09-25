# CloudCause — Cloud Cost Attribution Dashboard

An end-to-end data engineering platform that identifies the root cause of cloud cost spikes by correlating cost data with deployment events and usage metrics.

> **Core Objective:** Directly and conclusively answer: 👉 **“What caused this cost spike?”**
> A clean, professional, and user-friendly web application designed for finance teams to attribute sudden cloud cost spikes to specific engineering deployments and service usage surges.

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
Cloud platforms export infrastructure billing, deployment history, and service usage metrics independently. When finance teams observe a sudden cost spike on their monthly cloud bill, they lack the tools to quickly determine:
- **When** cloud costs increased and by how much
- **Which** cloud service was affected
- **Whether** a software deployment occurred around the same time
- **Whether** compute usage, auto-scaling, or traffic surged
- **What** the probable reason for the cost spike could be

**CloudCause** unites these three independent data streams into a single, intuitive dashboard with rule-based correlation to give finance and engineering teams immediate answers.

---

## 2. Technology Stack

- **Frontend**: React 18, Tailwind CSS, Recharts (data visualizations), Lucide Icons, Vite
- **Backend**: Node.js, Express.js
- **Database**: SQLite (Node 22 native `DatabaseSync` - zero C++ compiler dependencies)
- **Architecture**: Modular REST API with clean separation of concerns (Controllers, Services, Routes, Config)

---

## 3. Application Structure

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
      CostTrace: Cloud Cost Spike Attribution Pipeline
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
                    PIPELINE SUCCESSFUL
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
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js            # SQLite database initialization & schema
│   │   ├── controllers/
│   │   │   ├── billingController.js   # Billing records, filters, trend aggregation
│   │   │   ├── deploymentController.js# Release logs & spike correlation
│   │   │   ├── usageController.js     # CPU, request count, instance metrics
│   │   │   ├── spikeController.js     # Detected anomalies & deep dive details
│   │   │   └── dashboardController.js # Overview summary metrics & charts
│   │   ├── routes/                    # Express REST route definitions
│   │   ├── services/
│   │   │   ├── spikeDetectionService.js # Rule-based cost anomaly detection
│   │   │   └── correlationService.js  # Cross-source attribution engine
│   │   ├── data/
│   │   │   └── seed.js                # 60-day realistic seed generator
│   │   └── server.js                  # Express server & static asset host
│   ├── database.sqlite                # SQLite database
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/                # StatCard, StatusBadge, FilterBar, Spinners
│   │   │   ├── charts/                # CostTrendChart, UsageTrendChart, Breakdown
│   │   │   └── layout/                # Sidebar, Header, Layout
│   │   ├── pages/
│   │   │   ├── DashboardPage.jsx      # High-level KPIs, spending trend, recent spikes
│   │   │   ├── BillingPage.jsx        # Billing ledger, date & service filters
│   │   │   ├── DeploymentsPage.jsx    # Deployment logs with spike correlation
│   │   │   ├── UsagePage.jsx          # Compute utilization & instance auto-scaling
│   │   │   ├── CostSpikesPage.jsx     # All detected cost anomalies
│   │   │   └── CostSpikeDetailPage.jsx# Deep dive attribution investigation
│   │   ├── services/api.js            # API client wrapper
│   │   ├── utils/formatters.js        # Currency, percent, date utilities
│   │   ├── App.jsx                    # Core application router
│   │   └── main.jsx
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
│
└── package.json                       # Root orchestration scripts
```

---

## 4. Main Application Sections

1. **Dashboard (`/`)**:
   - Executive KPIs: *Total Cloud Cost*, *Current Month Cost*, *MoM Cost Change %*, *Identified Cost Spikes*.
   - Interactive 60-day spend trend chart with pulsing red anomaly markers on spike days.
   - Spend breakdown by cloud service.
   - Clickable **Recent Cost Spikes** table with 1-click investigation buttons.

2. **Billing (`/billing`)**:
   - Detailed cloud billing ledger with *Date*, *Cloud Service*, *Cost*, *Previous Cost*, *Cost Change*, and *Status*.
   - Filters by Cloud Service, Anomaly Status (`Normal`, `Increased`, `Cost Spike`), and Date Range.
   - Dynamic service-specific cost trend chart.

3. **Deployments (`/deployments`)**:
   - Log of software releases with *Timestamp*, *Service*, *Version*, *Environment* (`Production` / `Staging`), *Status*, *Author*, and *Commit Message*.
   - Visual tags highlighting releases that occurred within 48 hours prior to a cost spike.

4. **Usage (`/usage`)**:
   - Time-series tracking of *CPU Utilization (%)*, *Memory Usage (%)*, *Daily Request Volume*, and *Active Instances*.
   - Auto-scaling peak capacity insights for finance planning.

5. **Cost Spikes & Investigation Detail (`/spikes/:id`)**:
   - The core attribution view:
     - **Attribution Banner**: Previous spend vs spike spend with percentage jump.
     - **Possible Explanation**: Objective, plain-English correlation synthesis.
     - **Related Deployment**: Software version, commit notes, author, and deploy time.
     - **Usage Metric Shifts**: Before vs After comparisons for CPU %, Instances, and Traffic.
     - **14-Day Trajectory Chart**: Visual timeline showing cost before and after the release event.

---

## 5. How Cost Spike Detection & Correlation Works

### Detection Rule
A billing record is classified into one of three statuses:
- **`Cost Spike`**: Cost increase $\ge 35\%$ **and** net dollar increase $\ge \$50$ from previous cost / baseline.
- **`Increased`**: Cost increase $\ge 15\%$ **and** net dollar increase $\ge \$20$.
- **`Normal`**: Cost within standard operating fluctuations.

### Correlation Engine
When a cost spike is investigated:
1. Queries the `deployments` table for the affected service within a **48-hour attribution window** prior to the spike date.
2. Compares `usage_metrics` on the spike day against the prior baseline to calculate shifts in CPU utilization, memory pressure, request volume, and instance count.
3. Synthesizes a cautious, objective explanation highlighting whether the spike correlates with a code release (e.g. compute leak, thread contention), a traffic surge, or infrastructure scaling.

---

## 6. Running Locally


## 7. Date and Time Transformations

Processed analytical data can be placed on one comparable timeline with
`src/transformations/time.py`. Use `transform_time_fields` for an individual
processed dataframe or `transform_datasets` for the independent billing,
deployment, and usage dataframes. Inputs are copied; raw data is never changed.

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
Timestamps are parsed consistently and normalized to the requested timezone
(UTC by default). Naive timestamps are interpreted in that timezone, while
timezone-aware timestamps are converted to it. Missing or invalid timestamps
raise `TimestampTransformationError` instead of being silently accepted.

The transformation adds `date`, `hour`, `day`, `day_of_week`, `week`, `month`,
`time_period`, and `week_period`. Billing and usage rows also receive
`hours_since_deployment`, calculated from the latest preceding deployment for
the same service when deployment data is supplied.
## 7. Dataset Intake and Validation

Raw source files enter through `src/ingestion/validation.py`. Keep the three
sources independent under `data/raw/`; validation does not combine, clean, or
move them into `data/processed/`.

Expected files and schemas are:

- `billing_data.csv`: `timestamp`, `service`, `cost`
- `deployment_events.json`: an array of objects with `service`, `version`, `timestamp`
- `usage_metrics.csv`: `timestamp`, `service`, `cpu_utilization`, `requests_per_second`

Use `validate_dataset(path, source)` for one file or
`validate_raw_datasets(raw_data_dir)` for the standard three-file intake. Each
call returns a `ValidationResult` with `valid`, parsed `data`, and explicit
`errors`; invalid files are never silently accepted. CSV and JSON must be
UTF-8, non-empty, structurally valid, and contain the required data types.

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

### Prerequisites
- Node.js v20+ or v22+
- npm

### Quick Start (Unified Server)
The backend is configured to serve both the Express API and the pre-built React frontend:

```bash
# 1. Start the server (from the root or backend folder)
cd backend
npm start
```
Then open your browser to **http://localhost:5000**.

### Development Mode (Vite HMR + Backend Watch)

## 9. Running Tests
```bash
python -m pytest tests/ -v
```
All 18 tests validate schema constraints, non-negative costs, deduplication, rolling baseline presence, and attribution confidence bounds.
```bash
# In terminal 1: Start Backend API
cd backend
npm run dev

# In terminal 2: Start Frontend Dev Server with HMR
cd frontend
npm run dev
```
Open **http://localhost:5173** (Vite proxies `/api` requests to port 5000).

### Re-seeding Sample Data
To reset or re-seed the SQLite database with fresh 60-day sample data:
```bash
cd backend
npm run seed
```
