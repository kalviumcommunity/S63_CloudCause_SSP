import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../../database.sqlite');
const db = new DatabaseSync(dbPath);

// Enable WAL mode for concurrency and performance
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS billing_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      service_name TEXT NOT NULL,
      cost REAL NOT NULL,
      previous_cost REAL DEFAULT 0,
      cost_change REAL DEFAULT 0,
      cost_change_pct REAL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('Normal', 'Increased', 'Cost Spike')),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_name TEXT NOT NULL,
      version TEXT NOT NULL,
      deployed_at TEXT NOT NULL,
      environment TEXT NOT NULL DEFAULT 'Production',
      status TEXT NOT NULL CHECK(status IN ('Success', 'Failed', 'In Progress')),
      deployed_by TEXT,
      commit_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usage_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      service_name TEXT NOT NULL,
      cpu_utilization REAL NOT NULL,
      request_count INTEGER NOT NULL,
      instance_count INTEGER NOT NULL,
      memory_utilization REAL DEFAULT 50.0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_billing_service_date ON billing_records(service_name, date);
    CREATE INDEX IF NOT EXISTS idx_billing_date ON billing_records(date);
    CREATE INDEX IF NOT EXISTS idx_deployments_service_date ON deployments(service_name, deployed_at);
    CREATE INDEX IF NOT EXISTS idx_usage_service_date ON usage_metrics(service_name, date);
  `);

  return db;
}

export default db;

