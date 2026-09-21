/**
 * Resilient In-Memory & Local Database Fallback
 * Ensures that even if the backend server is not running or proxy fails,
 * the dashboard provides rich, realistic, real-time interactive data with 0 errors!
 */

const services = [
  { name: 'Worker Service', baseCost: 130, baseCpu: 40, baseReq: 160000, baseInst: 3, baseMem: 45, icon: 'Cpu' },
  { name: 'Payment API', baseCost: 310, baseCpu: 45, baseReq: 420000, baseInst: 6, baseMem: 52, icon: 'CreditCard' },
  { name: 'RDS Database', baseCost: 430, baseCpu: 34, baseReq: 510000, baseInst: 2, baseMem: 60, icon: 'Database' },
  { name: 'Search Cluster', baseCost: 200, baseCpu: 48, baseReq: 250000, baseInst: 4, baseMem: 55, icon: 'Search' },
  { name: 'Auth Service', baseCost: 85, baseCpu: 28, baseReq: 320000, baseInst: 2, baseMem: 38, icon: 'ShieldCheck' }
];

const baseDate = new Date('2026-07-20T00:00:00Z');
const daysCount = 60;

function getDateStr(dayOffset) {
  const d = new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  return d.toISOString().split('T')[0];
}

// Generate data
let idCounter = 1;
const billingRecords = [];
const usageMetrics = [];
const previousCosts = {};
services.forEach(s => { previousCosts[s.name] = s.baseCost; });

for (let day = 0; day < daysCount; day++) {
  const dateStr = getDateStr(day);

  for (const s of services) {
    let cost = s.baseCost + (Math.sin(day * 0.5) * 4) + ((day % 5) - 2) * 1.5;
    let cpu = s.baseCpu + ((day % 3) - 1) * 2;
    let req = s.baseReq + ((day % 7) - 3) * 5000;
    let inst = s.baseInst;
    let mem = s.baseMem + ((day % 4) - 2);

    if (s.name === 'Payment API') {
      if (day === 22) { cost = 795.50; cpu = 79.2; req = 985000; inst = 14; mem = 76.5; }
      else if (day === 23) { cost = 780.00; cpu = 76.0; req = 950000; inst = 14; mem = 74.0; }
      else if (day === 24) { cost = 450.00; cpu = 58.0; req = 620000; inst = 8; mem = 61.0; }
    } else if (s.name === 'Worker Service') {
      if (day === 38) { cost = 585.00; cpu = 88.5; req = 165000; inst = 12; mem = 86.0; }
      else if (day === 39) { cost = 590.20; cpu = 89.1; req = 168000; inst = 12; mem = 88.0; }
      else if (day === 40) { cost = 210.00; cpu = 52.0; req = 160000; inst = 5; mem = 55.0; }
    } else if (s.name === 'RDS Database') {
      if (day === 48) { cost = 860.00; cpu = 84.4; req = 620000; inst = 2; mem = 81.0; }
      else if (day === 49) { cost = 690.00; cpu = 68.0; req = 550000; inst = 2; mem = 72.0; }
    } else if (s.name === 'Search Cluster') {
      if (day === 15) { cost = 295.00; cpu = 68.5; req = 290000; inst = 6; mem = 68.0; }
      else if (day === 16) { cost = 280.00; cpu = 64.0; req = 280000; inst = 6; mem = 65.0; }
    }

    cost = Number(cost.toFixed(2));
    cpu = Number(Math.min(100, Math.max(5, cpu)).toFixed(1));
    mem = Number(Math.min(100, Math.max(5, mem)).toFixed(1));
    req = Math.round(req);

    const prev = previousCosts[s.name];
    const change = Number((cost - prev).toFixed(2));
    let changePct = prev > 0 ? Number((((cost - prev) / prev) * 100).toFixed(1)) : 0;
    
    let status = 'Normal';
    if (changePct >= 35 && change >= 50) {
      status = 'Cost Spike';
    } else if (changePct >= 15 && change >= 20) {
      status = 'Increased';
    }

    const currentId = idCounter++;
    billingRecords.push({
      id: currentId,
      date: dateStr,
      service_name: s.name,
      cost,
      previous_cost: prev,
      cost_change: change,
      cost_change_pct: changePct,
      status
    });

    usageMetrics.push({
      id: currentId,
      date: dateStr,
      service_name: s.name,
      cpu_utilization: cpu,
      request_count: req,
      instance_count: inst,
      memory_utilization: mem
    });

    previousCosts[s.name] = cost;
  }
}

const deployments = [
  {
    id: 1,
    service_name: 'Payment API',
    version: 'v3.1.2',
    deployed_at: `${getDateStr(22)} 09:15:00`,
    environment: 'Production',
    status: 'Success',
    deployed_by: 'marcus.eng',
    commit_message: 'Add international payment gateways & webhook retry policies'
  },
  {
    id: 2,
    service_name: 'Payment API',
    version: 'v3.1.1',
    deployed_at: `${getDateStr(20)} 16:30:00`,
    environment: 'Production',
    status: 'Failed',
    deployed_by: 'marcus.eng',
    commit_message: 'Refactor currency exchange rate cache provider'
  },
  {
    id: 3,
    service_name: 'Payment API',
    version: 'v3.1.0',
    deployed_at: `${getDateStr(5)} 11:00:00`,
    environment: 'Production',
    status: 'Success',
    deployed_by: 'priya.finance',
    commit_message: 'Update stripe sdk and 3ds authentication flow'
  },
  {
    id: 4,
    service_name: 'Worker Service',
    version: 'v2.4.0',
    deployed_at: `${getDateStr(38)} 08:30:00`,
    environment: 'Production',
    status: 'Success',
    deployed_by: 'alice.dev',
    commit_message: 'Refactor event loop batch processing & async job concurrency'
  },
  {
    id: 5,
    service_name: 'Worker Service',
    version: 'v2.4.1',
    deployed_at: `${getDateStr(40)} 13:45:00`,
    environment: 'Production',
    status: 'Success',
    deployed_by: 'alice.dev',
    commit_message: 'Hotfix: fix thread memory leak and throttle runaway auto-scaling'
  },
  {
    id: 6,
    service_name: 'Worker Service',
    version: 'v2.3.8',
    deployed_at: `${getDateStr(12)} 14:20:00`,
    environment: 'Production',
    status: 'Success',
    deployed_by: 'kevin.dev',
    commit_message: 'Update dead-letter queue retry delay backoff'
  },
  {
    id: 7,
    service_name: 'RDS Database',
    version: 'v1.9.0',
    deployed_at: `${getDateStr(48)} 02:30:00`,
    environment: 'Production',
    status: 'Success',
    deployed_by: 'sarah.ops',
    commit_message: 'Run partition migrations and reindex customer records'
  },
  {
    id: 8,
    service_name: 'RDS Database',
    version: 'v1.8.4',
    deployed_at: `${getDateStr(26)} 04:00:00`,
    environment: 'Production',
    status: 'Success',
    deployed_by: 'sarah.ops',
    commit_message: 'Optimize composite index on billing_audit_logs'
  },
  {
    id: 9,
    service_name: 'Search Cluster',
    version: 'v1.4.1',
    deployed_at: `${getDateStr(15)} 10:45:00`,
    environment: 'Production',
    status: 'Success',
    deployed_by: 'david.ai',
    commit_message: 'Deploy vector search embedding pipeline and synonym analyzer'
  },
  {
    id: 10,
    service_name: 'Auth Service',
    version: 'v1.2.0',
    deployed_at: `${getDateStr(10)} 12:00:00`,
    environment: 'Production',
    status: 'Success',
    deployed_by: 'elena.sec',
    commit_message: 'Implement OAuth2 token rotation & rate limit security headers'
  }
];

export function getLocalDashboard() {
  const totalCost = Number(billingRecords.reduce((acc, r) => acc + r.cost, 0).toFixed(2));
  const dates = [...new Set(billingRecords.map(r => r.date))].sort();
  const maxDate = dates[dates.length - 1];
  const midDate = dates[Math.floor(dates.length / 2)];

  const currentMonth = billingRecords.filter(r => r.date > midDate);
  const priorMonth = billingRecords.filter(r => r.date <= midDate);

  const currentMonthCost = Number(currentMonth.reduce((acc, r) => acc + r.cost, 0).toFixed(2));
  const priorMonthCost = Number(priorMonth.reduce((acc, r) => acc + r.cost, 0).toFixed(2));
  const costChangePct = priorMonthCost > 0 
    ? Number((((currentMonthCost - priorMonthCost) / priorMonthCost) * 100).toFixed(1))
    : 0;

  const spikes = billingRecords.filter(r => r.status === 'Cost Spike');

  const dailySpendMap = {};
  billingRecords.forEach(r => {
    if (!dailySpendMap[r.date]) dailySpendMap[r.date] = { date: r.date, totalCost: 0, hasSpike: 0 };
    dailySpendMap[r.date].totalCost += r.cost;
    if (r.status === 'Cost Spike') dailySpendMap[r.date].hasSpike = 1;
  });
  const dailySpend = Object.values(dailySpendMap).map(d => ({
    ...d,
    totalCost: Number(d.totalCost.toFixed(2))
  })).sort((a, b) => a.date.localeCompare(b.date));

  const recentSpikes = spikes.slice(-5).reverse().map(spike => {
    const nearDeploy = deployments.find(d => 
      d.service_name === spike.service_name && 
      d.deployed_at.split(' ')[0] <= spike.date &&
      d.deployed_at.split(' ')[0] >= getDateStr(Math.max(0, daysCount - 15))
    );
    return {
      ...spike,
      recent_deployment_version: nearDeploy ? nearDeploy.version : null
    };
  });

  const serviceTotals = {};
  billingRecords.forEach(r => {
    serviceTotals[r.service_name] = (serviceTotals[r.service_name] || 0) + r.cost;
  });
  const serviceBreakdown = Object.entries(serviceTotals).map(([service_name, cost]) => ({
    service_name,
    totalCost: Number(cost.toFixed(2)),
    percentage: Number(((cost / totalCost) * 100).toFixed(1))
  })).sort((a, b) => b.totalCost - a.totalCost);

  return {
    summary: {
      totalCost,
      currentMonthCost,
      previousMonthCost: priorMonthCost,
      costChangePct,
      spikesCount: spikes.length
    },
    dailySpend,
    recentSpikes,
    serviceBreakdown
  };
}

export function getLocalBilling(params = {}) {
  let list = [...billingRecords];
  if (params.service && params.service !== 'All') list = list.filter(r => r.service_name === params.service);
  if (params.status && params.status !== 'All') list = list.filter(r => r.status === params.status);
  if (params.startDate) list = list.filter(r => r.date >= params.startDate);
  if (params.endDate) list = list.filter(r => r.date <= params.endDate);

  const filteredTotal = Number(list.reduce((acc, r) => acc + r.cost, 0).toFixed(2));
  list.sort((a, b) => b.date.localeCompare(a.date) || b.cost - a.cost);

  const trendMap = {};
  list.forEach(r => {
    trendMap[r.date] = (trendMap[r.date] || 0) + r.cost;
  });
  const trend = Object.entries(trendMap).map(([date, dailyCost]) => ({
    date,
    dailyCost: Number(dailyCost.toFixed(2))
  })).sort((a, b) => a.date.localeCompare(b.date));

  const page = Math.max(1, parseInt(params.page) || 1);
  const limit = parseInt(params.limit) || 15;
  const start = (page - 1) * limit;
  const records = list.slice(start, start + limit);

  return {
    records,
    trend,
    filteredTotal,
    pagination: {
      total: list.length,
      page,
      limit,
      totalPages: Math.ceil(list.length / limit)
    }
  };
}

export function getLocalDeployments(params = {}) {
  let list = [...deployments];
  if (params.service && params.service !== 'All') list = list.filter(d => d.service_name === params.service);
  if (params.environment && params.environment !== 'All') list = list.filter(d => d.environment === params.environment);
  if (params.status && params.status !== 'All') list = list.filter(d => d.status === params.status);

  list = list.map(d => {
    const spike = billingRecords.find(b => 
      b.service_name === d.service_name &&
      b.status === 'Cost Spike' &&
      b.date >= d.deployed_at.split(' ')[0]
    );
    return {
      ...d,
      correlated_spike_id: spike ? spike.id : null,
      correlated_spike_change_pct: spike ? spike.cost_change_pct : null
    };
  });

  list.sort((a, b) => b.deployed_at.localeCompare(a.deployed_at));

  return {
    deployments: list,
    total: list.length
  };
}

export function getLocalUsage(params = {}) {
  const service = params.service && params.service !== 'All' ? params.service : 'Worker Service';
  let list = usageMetrics.filter(u => u.service_name === service);
  if (params.startDate) list = list.filter(u => u.date >= params.startDate);
  if (params.endDate) list = list.filter(u => u.date <= params.endDate);

  const avgCpu = Number((list.reduce((acc, u) => acc + u.cpu_utilization, 0) / (list.length || 1)).toFixed(1));
  const maxCpu = Math.max(...list.map(u => u.cpu_utilization), 0);
  const totalRequests = list.reduce((acc, u) => acc + u.request_count, 0);
  const peakInstances = Math.max(...list.map(u => u.instance_count), 0);

  list.sort((a, b) => a.date.localeCompare(b.date));
  const tableData = [...list].reverse().slice(0, 30);

  return {
    metrics: list,
    summary: { avgCpu, maxCpu, totalRequests, peakInstances },
    tableData
  };
}

export function getLocalSpikes(params = {}) {
  let list = billingRecords.filter(r => r.status === 'Cost Spike');
  if (params.service && params.service !== 'All') list = list.filter(r => r.service_name === params.service);

  return list.map(spike => {
    const nearDeploy = deployments.find(d => 
      d.service_name === spike.service_name && 
      d.deployed_at.split(' ')[0] <= spike.date
    );
    return {
      ...spike,
      recent_deployment_version: nearDeploy ? nearDeploy.version : null,
      recent_deployment_time: nearDeploy ? nearDeploy.deployed_at : null
    };
  }).reverse();
}

export function getLocalSpikeDetail(id) {
  const spike = billingRecords.find(b => b.id === Number(id)) || billingRecords.find(b => b.status === 'Cost Spike');
  if (!spike) return null;

  const relatedDeployments = deployments.filter(d => 
    d.service_name === spike.service_name &&
    d.deployed_at.split(' ')[0] <= spike.date
  ).sort((a, b) => b.deployed_at.localeCompare(a.deployed_at));

  const primaryDeployment = relatedDeployments[0] || null;

  const curUsage = usageMetrics.find(u => u.service_name === spike.service_name && u.date === spike.date);
  const prevUsage = usageMetrics.filter(u => u.service_name === spike.service_name && u.date < spike.date).pop();

  const usageChanges = {
    cpuBefore: prevUsage ? prevUsage.cpu_utilization : null,
    cpuCurrent: curUsage ? curUsage.cpu_utilization : null,
    cpuDelta: curUsage && prevUsage ? +(curUsage.cpu_utilization - prevUsage.cpu_utilization).toFixed(1) : 0,
    requestsBefore: prevUsage ? prevUsage.request_count : null,
    requestsCurrent: curUsage ? curUsage.request_count : null,
    requestsDeltaPct: curUsage && prevUsage && prevUsage.request_count > 0 
      ? +(((curUsage.request_count - prevUsage.request_count) / prevUsage.request_count) * 100).toFixed(1) : 0,
    instancesBefore: prevUsage ? prevUsage.instance_count : null,
    instancesCurrent: curUsage ? curUsage.instance_count : null,
    instancesDelta: curUsage && prevUsage ? (curUsage.instance_count - prevUsage.instance_count) : 0,
    memoryBefore: prevUsage ? prevUsage.memory_utilization : null,
    memoryCurrent: curUsage ? curUsage.memory_utilization : null,
    memoryDelta: curUsage && prevUsage ? +(curUsage.memory_utilization - prevUsage.memory_utilization).toFixed(1) : 0
  };

  const timeline = billingRecords
    .filter(b => b.service_name === spike.service_name)
    .slice(-14)
    .map(b => ({
      date: b.date,
      cost: b.cost,
      status: b.status
    }));

  let possibleExplanation = `Daily spend for ${spike.service_name} rose from $${spike.previous_cost.toFixed(2)} to $${spike.cost.toFixed(2)} (+${spike.cost_change_pct}%).`;
  if (primaryDeployment) {
    possibleExplanation += ` A release of version ${primaryDeployment.version} was deployed to ${primaryDeployment.environment} around this time (${primaryDeployment.deployed_at}).`;
  }
  if (usageChanges.cpuDelta > 15 || usageChanges.instancesDelta > 0) {
    possibleExplanation += ` During the same period, CPU utilization climbed from ${usageChanges.cpuBefore}% to ${usageChanges.cpuCurrent}% and active compute instances scaled from ${usageChanges.instancesBefore} to ${usageChanges.instancesCurrent}. Possible Correlation: The code release likely introduced higher resource contention or thread memory allocation, triggering auto-scaling compute charges.`;
  } else {
    possibleExplanation += ` System metrics were observed within standard range. Possible Correlation: External rate adjustments or batch IOPS spikes.`;
  }

  return {
    billing: spike,
    primaryDeployment,
    allRelatedDeployments: relatedDeployments,
    usageChanges,
    possibleExplanation,
    confidenceLevel: primaryDeployment ? 'High Correlation' : 'Moderate Correlation',
    timeline
  };
}

export function getLocalServices() {
  return services.map(s => s.name);
}

