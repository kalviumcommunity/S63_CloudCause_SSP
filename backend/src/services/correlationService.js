import db from '../config/database.js';

/**
 * Correlates a billing record (specifically a spike) with deployment history
 * and service usage metrics.
 * 
 * @param {object} spikeRecord - The billing record object
 * @returns {object} Detailed correlation analysis
 */
export function correlateSpike(spikeRecord) {
  if (!spikeRecord) return null;

  const { id, service_name, date, cost, previous_cost, cost_change, cost_change_pct, status } = spikeRecord;

  // 1. Look for deployments for this service within window:
  // From 2 days before the spike date up to end of the spike date
  const deploymentStmt = db.prepare(`
    SELECT * FROM deployments 
    WHERE service_name = ? 
      AND date(deployed_at) >= date(?, '-2 days')
      AND date(deployed_at) <= date(?)
    ORDER BY deployed_at DESC
  `);
  const relatedDeployments = deploymentStmt.all(service_name, date, date);

  // 2. Fetch usage metrics for spike date and previous day
  const usageCurrentStmt = db.prepare(`
    SELECT * FROM usage_metrics 
    WHERE service_name = ? AND date = ?
  `);
  const usageCurrent = usageCurrentStmt.get(service_name, date);

  const usagePrevStmt = db.prepare(`
    SELECT * FROM usage_metrics 
    WHERE service_name = ? AND date < ?
    ORDER BY date DESC LIMIT 1
  `);
  const usagePrev = usagePrevStmt.get(service_name, date);

  // 3. Calculate usage deltas
  let usageChanges = {
    cpuBefore: usagePrev ? usagePrev.cpu_utilization : null,
    cpuCurrent: usageCurrent ? usageCurrent.cpu_utilization : null,
    cpuDelta: usageCurrent && usagePrev ? +(usageCurrent.cpu_utilization - usagePrev.cpu_utilization).toFixed(1) : 0,

    requestsBefore: usagePrev ? usagePrev.request_count : null,
    requestsCurrent: usageCurrent ? usageCurrent.request_count : null,
    requestsDeltaPct: usageCurrent && usagePrev && usagePrev.request_count > 0 
      ? +(((usageCurrent.request_count - usagePrev.request_count) / usagePrev.request_count) * 100).toFixed(1) 
      : 0,

    instancesBefore: usagePrev ? usagePrev.instance_count : null,
    instancesCurrent: usageCurrent ? usageCurrent.instance_count : null,
    instancesDelta: usageCurrent && usagePrev ? (usageCurrent.instance_count - usagePrev.instance_count) : 0,

    memoryBefore: usagePrev ? usagePrev.memory_utilization : null,
    memoryCurrent: usageCurrent ? usageCurrent.memory_utilization : null,
    memoryDelta: usageCurrent && usagePrev ? +(usageCurrent.memory_utilization - usagePrev.memory_utilization).toFixed(1) : 0
  };

  // 4. Formulate possible explanation
  const primaryDeployment = relatedDeployments.length > 0 ? relatedDeployments[0] : null;
  const explanation = generateExplanation({
    service_name,
    cost,
    previous_cost,
    cost_change_pct,
    deployment: primaryDeployment,
    usage: usageChanges
  });

  return {
    billing: spikeRecord,
    primaryDeployment,
    allRelatedDeployments: relatedDeployments,
    usageChanges,
    possibleExplanation: explanation,
    confidenceLevel: determineConfidence(primaryDeployment, usageChanges)
  };
}

/**
 * Generates an objective, non-dogmatic explanation for finance users.
 */
function generateExplanation({ service_name, cost, previous_cost, cost_change_pct, deployment, usage }) {
  const parts = [];

  parts.push(
    `Daily spend for ${service_name} rose from $${previous_cost.toFixed(2)} to $${cost.toFixed(2)} (+${cost_change_pct}%).`
  );

  if (deployment) {
    parts.push(
      `A release of version ${deployment.version} was deployed to ${deployment.environment} around this time (${deployment.deployed_at.split(' ')[1] || deployment.deployed_at}).`
    );
  } else {
    parts.push(`No software deployments were recorded for ${service_name} within the 48-hour attribution window.`);
  }

  const usageNotes = [];
  if (usage.cpuDelta > 15) {
    usageNotes.push(`CPU utilization jumped from ${usage.cpuBefore}% to ${usage.cpuCurrent}% (+${usage.cpuDelta}%)`);
  }
  if (usage.instancesDelta > 0) {
    usageNotes.push(`active instances scaled up from ${usage.instancesBefore} to ${usage.instancesCurrent} (+${usage.instancesDelta})`);
  }
  if (usage.requestsDeltaPct > 25) {
    usageNotes.push(`request volume surged by ${usage.requestsDeltaPct}%`);
  }

  if (usageNotes.length > 0) {
    parts.push(`During the same period, ${usageNotes.join(', and ')}.`);
  }

  // Hypothesis summary
  if (deployment && usage.instancesDelta > 0 && usage.cpuDelta > 15) {
    parts.push(
      `Possible Correlation: The ${deployment.version} deployment likely introduced higher compute overhead or resource contention, causing the cluster to auto-scale additional compute instances and driving up infrastructure spend.`
    );
  } else if (deployment && usage.requestsDeltaPct > 25) {
    parts.push(
      `Possible Correlation: Increased user traffic coincided with the ${deployment.version} release, driving up compute hours and network egress costs.`
    );
  } else if (deployment) {
    parts.push(
      `Possible Correlation: The ${deployment.version} release coincides with the billing anomaly. Reviewing the release notes and background jobs is recommended.`
    );
  } else if (usage.requestsDeltaPct > 30 || usage.cpuDelta > 20) {
    parts.push(
      `Possible Correlation: The cost spike appears primarily usage-driven rather than deployment-induced, as system metrics climbed significantly without a code change.`
    );
  } else {
    parts.push(
      `Possible Correlation: No immediate code release or unusual traffic surge was detected. The spike may be attributed to cloud provider rate adjustments, licensing changes, or data transfer spikes.`
    );
  }

  return parts.join(' ');
}

function determineConfidence(deployment, usage) {
  if (deployment && (usage.cpuDelta > 15 || usage.instancesDelta > 0)) {
    return 'High Correlation';
  }
  if (deployment || usage.cpuDelta > 15 || usage.requestsDeltaPct > 25) {
    return 'Moderate Correlation';
  }
  return 'Uncorrelated / External Factor';
}

