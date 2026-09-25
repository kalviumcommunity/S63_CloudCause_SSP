import db from '../config/database.js';

export function getDeployments(req, res) {
  try {
    const { service, environment, status } = req.query;

    const conditions = [];
    const params = [];

    if (service && service !== 'All') {
      conditions.push('service_name = ?');
      params.push(service);
    }
    if (environment && environment !== 'All') {
      conditions.push('environment = ?');
      params.push(environment);
    }
    if (status && status !== 'All') {
      conditions.push('status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        d.*,
        (
          SELECT b.id
          FROM billing_records b
          WHERE b.service_name = d.service_name
            AND b.status = 'Cost Spike'
            AND date(b.date) >= date(d.deployed_at)
            AND date(b.date) <= date(d.deployed_at, '+2 days')
          ORDER BY b.date ASC LIMIT 1
        ) as correlated_spike_id,
        (
          SELECT b.cost_change_pct
          FROM billing_records b
          WHERE b.service_name = d.service_name
            AND b.status = 'Cost Spike'
            AND date(b.date) >= date(d.deployed_at)
            AND date(b.date) <= date(d.deployed_at, '+2 days')
          ORDER BY b.date ASC LIMIT 1
        ) as correlated_spike_change_pct
      FROM deployments d
      ${whereClause}
      ORDER BY d.deployed_at DESC
    `;

    const deployments = db.prepare(query).all(...params);

    res.json({
      deployments,
      total: deployments.length
    });
  } catch (err) {
    console.error('Error in getDeployments:', err);
    res.status(500).json({ error: 'Failed to retrieve deployments' });
  }
}

