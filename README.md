# CloudCause — Cloud Cost Attribution Dashboard

> A clean, professional, and user-friendly web application designed for finance teams to attribute sudden cloud cost spikes to specific engineering deployments and service usage surges.

---

## 1. Problem Statement

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

Timestamps are parsed consistently and normalized to the requested timezone
(UTC by default). Naive timestamps are interpreted in that timezone, while
timezone-aware timestamps are converted to it. Missing or invalid timestamps
raise `TimestampTransformationError` instead of being silently accepted.

The transformation adds `date`, `hour`, `day`, `day_of_week`, `week`, `month`,
`time_period`, and `week_period`. Billing and usage rows also receive
`hours_since_deployment`, calculated from the latest preceding deployment for
the same service when deployment data is supplied.

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
