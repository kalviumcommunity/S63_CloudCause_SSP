import db, { initDatabase } from '../config/database.js';
import { classifyCostStatus } from '../services/spikeDetectionService.js';

export function seedDatabase() {
  console.log('Seeding SQLite database with realistic cloud cost, deployment, and usage data...');
  initDatabase();

  // Clean existing records
  db.exec(`
    DELETE FROM billing_records;
    DELETE FROM deployments;
    DELETE FROM usage_metrics;
  `);

  const services = [
    { name: 'Worker Service', baseCost: 130, baseCpu: 40, baseReq: 160000, baseInst: 3, baseMem: 45 },
    { name: 'Payment API', baseCost: 310, baseCpu: 45, baseReq: 420000, baseInst: 6, baseMem: 52 },
    { name: 'RDS Database', baseCost: 430, baseCpu: 34, baseReq: 510000, baseInst: 2, baseMem: 60 },
    { name: 'Search Cluster', baseCost: 200, baseCpu: 48, baseReq: 250000, baseInst: 4, baseMem: 55 },
    { name: 'Auth Service', baseCost: 85, baseCpu: 28, baseReq: 320000, baseInst: 2, baseMem: 38 }
  ];

  // Helper to format date string YYYY-MM-DD
  const baseDate = new Date('2026-07-20T00:00:00Z');
  const daysCount = 60; // 60 days of history

  const getDateStr = (dayOffset) => {
    const d = new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    return d.toISOString().split('T')[0];
  };

  const insertBilling = db.prepare(`
    INSERT INTO billing_records (date, service_name, cost, previous_cost, cost_change, cost_change_pct, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const insertUsage = db.prepare(`
    INSERT INTO usage_metrics (date, service_name, cpu_utilization, request_count, instance_count, memory_utilization)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertDeploy = db.prepare(`
    INSERT INTO deployments (service_name, version, deployed_at, environment, status, deployed_by, commit_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Track previous costs per service for calculating change and classification
  const previousCosts = {};
  services.forEach(s => { previousCosts[s.name] = s.baseCost; });

  // Generate 60 days of data
  for (let day = 0; day < daysCount; day++) {
    const dateStr = getDateStr(day);

    for (const s of services) {
      let cost = s.baseCost + (Math.sin(day * 0.5) * 4) + ((day % 5) - 2) * 1.5;
      let cpu = s.baseCpu + ((day % 3) - 1) * 2;
      let req = s.baseReq + ((day % 7) - 3) * 5000;
      let inst = s.baseInst;
      let mem = s.baseMem + ((day % 4) - 2);

      // --- INJECT REALISTIC SPIKE SCENARIOS ---

      // Spike 1: Payment API around Day 22 - Day 24 (Marketing spike + Gateway v3.1.2)
      if (s.name === 'Payment API') {
        if (day === 22) {
          cost = 795.50; // Big jump from ~310
          cpu = 79.2;
          req = 985000;
          inst = 14;
          mem = 76.5;
        } else if (day === 23) {
          cost = 780.00;
          cpu = 76.0;
          req = 950000;
          inst = 14;
          mem = 74.0;
        } else if (day === 24) {
          cost = 450.00;
          cpu = 58.0;
          req = 620000;
          inst = 8;
          mem = 61.0;
        }
      }

      // Spike 2: Worker Service around Day 38 - Day 40 (v2.4.0 memory leak & loop contention)
      if (s.name === 'Worker Service') {
        if (day === 38) {
          cost = 585.00; // Big jump from ~130
          cpu = 88.5;
          req = 165000; // Requests stay flat, compute explodes!
          inst = 12;
          mem = 86.0;
        } else if (day === 39) {
          cost = 590.20;
          cpu = 89.1;
          req = 168000;
          inst = 12;
          mem = 88.0;
        } else if (day === 40) {
          cost = 210.00; // recovering after hotfix
          cpu = 52.0;
          req = 160000;
          inst = 5;
          mem = 55.0;
        }
      }

      // Spike 3: RDS Database on Day 48 (Schema migration v1.9.0 IOPS & locks)
      if (s.name === 'RDS Database') {
        if (day === 48) {
          cost = 860.00; // Jump from ~430
          cpu = 84.4;
          req = 620000;
          inst = 2;
          mem = 81.0;
        } else if (day === 49) {
          cost = 690.00;
          cpu = 68.0;
          req = 550000;
          inst = 2;
          mem = 72.0;
        }
      }

      // Moderate Increase: Search Cluster on Day 15 (Vector index build v1.4.1)
      if (s.name === 'Search Cluster') {
        if (day === 15) {
          cost = 295.00; // Jump from ~200
          cpu = 68.5;
          req = 290000;
          inst = 6;
          mem = 68.0;
        } else if (day === 16) {
          cost = 280.00;
          cpu = 64.0;
          req = 280000;
          inst = 6;
          mem = 65.0;
        }
      }

      // Round numbers
      cost = Number(cost.toFixed(2));
      cpu = Number(Math.min(100, Math.max(5, cpu)).toFixed(1));
      mem = Number(Math.min(100, Math.max(5, mem)).toFixed(1));
      req = Math.round(req);

      const prev = previousCosts[s.name];
      const classification = classifyCostStatus(cost, prev);

      insertBilling.run(
        dateStr,
        s.name,
        cost,
        prev,
        classification.change,
        classification.changePct,
        classification.status
      );

      insertUsage.run(
        dateStr,
        s.name,
        cpu,
        req,
        inst,
        mem
      );

      previousCosts[s.name] = cost;
    }
  }

  // --- SEED DEPLOYMENT EVENTS ---
  const deployments = [
    {
      service_name: 'Payment API',
      version: 'v3.1.2',
      deployed_at: `${getDateStr(22)} 09:15:00`,
      environment: 'Production',
      status: 'Success',
      deployed_by: 'marcus.eng',
      commit_message: 'Add international payment gateways & webhook retry policies'
    },
    {
      service_name: 'Payment API',
      version: 'v3.1.1',
      deployed_at: `${getDateStr(20)} 16:30:00`,
      environment: 'Production',
      status: 'Failed',
      deployed_by: 'marcus.eng',
      commit_message: 'Refactor currency exchange rate cache provider'
    },
    {
      service_name: 'Payment API',
      version: 'v3.1.0',
      deployed_at: `${getDateStr(5)} 11:00:00`,
      environment: 'Production',
      status: 'Success',
      deployed_by: 'priya.finance',
      commit_message: 'Update stripe sdk and 3ds authentication flow'
    },
    {
      service_name: 'Worker Service',
      version: 'v2.4.0',
      deployed_at: `${getDateStr(38)} 08:30:00`,
      environment: 'Production',
      status: 'Success',
      deployed_by: 'alice.dev',
      commit_message: 'Refactor event loop batch processing & async job concurrency'
    },
    {
      service_name: 'Worker Service',
      version: 'v2.4.1',
      deployed_at: `${getDateStr(40)} 13:45:00`,
      environment: 'Production',
      status: 'Success',
      deployed_by: 'alice.dev',
      commit_message: 'Hotfix: fix thread memory leak and throttle runaway auto-scaling'
    },
    {
      service_name: 'Worker Service',
      version: 'v2.3.8',
      deployed_at: `${getDateStr(12)} 14:20:00`,
      environment: 'Production',
      status: 'Success',
      deployed_by: 'kevin.dev',
      commit_message: 'Update dead-letter queue retry delay backoff'
    },
    {
      service_name: 'RDS Database',
      version: 'v1.9.0',
      deployed_at: `${getDateStr(48)} 02:30:00`,
      environment: 'Production',
      status: 'Success',
      deployed_by: 'sarah.ops',
      commit_message: 'Run partition migrations and reindex customer records'
    },
    {
      service_name: 'RDS Database',
      version: 'v1.8.4',
      deployed_at: `${getDateStr(26)} 04:00:00`,
      environment: 'Production',
      status: 'Success',
      deployed_by: 'sarah.ops',
      commit_message: 'Optimize composite index on billing_audit_logs'
    },
    {
      service_name: 'Search Cluster',
      version: 'v1.4.1',
      deployed_at: `${getDateStr(15)} 10:45:00`,
      environment: 'Production',
      status: 'Success',
      deployed_by: 'david.ai',
      commit_message: 'Deploy vector search embedding pipeline and synonym analyzer'
    },
    {
      service_name: 'Search Cluster',
      version: 'v1.4.0',
      deployed_at: `${getDateStr(2)} 15:10:00`,
      environment: 'Production',
      status: 'Success',
      deployed_by: 'david.ai',
      commit_message: 'Upgrade Elasticsearch client driver to 8.12'
    },
    {
      service_name: 'Auth Service',
      version: 'v1.2.0',
      deployed_at: `${getDateStr(10)} 12:00:00`,
      environment: 'Production',
      status: 'Success',
      deployed_by: 'elena.sec',
      commit_message: 'Implement OAuth2 token rotation & rate limit security headers'
    },
    {
      service_name: 'Auth Service',
      version: 'v1.2.1',
      deployed_at: `${getDateStr(34)} 10:00:00`,
      environment: 'Production',
      status: 'Success',
      deployed_by: 'elena.sec',
      commit_message: 'Refresh JWKS caching and certificate expiry alarms'
    },
    {
      service_name: 'Payment API',
      version: 'v3.2.0-rc1',
      deployed_at: `${getDateStr(55)} 17:00:00`,
      environment: 'Staging',
      status: 'Success',
      deployed_by: 'marcus.eng',
      commit_message: 'Staging test for multi-currency settlement engine'
    },
    {
      service_name: 'Worker Service',
      version: 'v2.5.0-preview',
      deployed_at: `${getDateStr(57)} 11:20:00`,
      environment: 'Staging',
      status: 'In Progress',
      deployed_by: 'alice.dev',
      commit_message: 'Test new worker orchestration runner'
    }
  ];

  for (const d of deployments) {
    insertDeploy.run(
      d.service_name,
      d.version,
      d.deployed_at,
      d.environment,
      d.status,
      d.deployed_by,
      d.commit_message
    );
  }

  // Count seeded rows
  const billingCount = db.prepare('SELECT count(*) as count FROM billing_records').get().count;
  const deployCount = db.prepare('SELECT count(*) as count FROM deployments').get().count;
  const usageCount = db.prepare('SELECT count(*) as count FROM usage_metrics').get().count;
  const spikeCount = db.prepare("SELECT count(*) as count FROM billing_records WHERE status = 'Cost Spike'").get().count;

  console.log(`Successfully seeded:
  - ${billingCount} billing records
  - ${deployCount} deployment events
  - ${usageCount} usage metric records
  - ${spikeCount} identified cost spikes`);
}

// Allow direct execution
if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase();
}

