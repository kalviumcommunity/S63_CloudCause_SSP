import db from '../config/database.js';
import { correlateSpike } from '../services/correlationService.js';

export function getAllSpikes(req, res) {
  try {
    const { service } = req.query;
    const conditions = ["b.status = 'Cost Spike'"];
    const params = [];

    if (service && service !== 'All') {
      conditions.push('b.service_name = ?');
      params.push(service);
    }

    const query = `
      SELECT 
        b.*,
        (
          SELECT version 
          FROM deployments d 
          WHERE d.service_name = b.service_name 
            AND date(d.deployed_at) <= date(b.date)
            AND date(d.deployed_at) >= date(b.date, '-2 days')
          ORDER BY d.deployed_at DESC LIMIT 1
        ) as recent_deployment_version,
        (
          SELECT deployed_at 
          FROM deployments d 
          WHERE d.service_name = b.service_name 
            AND date(d.deployed_at) <= date(b.date)
            AND date(d.deployed_at) >= date(b.date, '-2 days')
          ORDER BY d.deployed_at DESC LIMIT 1
        ) as recent_deployment_time
      FROM billing_records b
      WHERE ${conditions.join(' AND ')}
      ORDER BY b.date DESC
    `;

    const spikes = db.prepare(query).all(...params);
    res.json(spikes);
  } catch (err) {
    console.error('Error in getAllSpikes:', err);
    res.status(500).json({ error: 'Failed to retrieve cost spikes' });
  }
}

export function getSpikeDetails(req, res) {
  try {
    const { id } = req.params;

    const spikeRecord = db.prepare('SELECT * FROM billing_records WHERE id = ?').get(id);
    if (!spikeRecord) {
      return res.status(404).json({ error: 'Spike record not found' });
    }

    // Run correlation logic
    const correlation = correlateSpike(spikeRecord);

    // Fetch surrounding 14-day window (-7 to +7 days) for context timeline charts
    const timelineData = db.prepare(`
      SELECT 
        b.date,
        b.cost,
        b.cost_change_pct,
        b.status as billing_status,
        u.cpu_utilization,
        u.request_count,
        u.instance_count,
        u.memory_utilization,
        d.version as deployment_version,
        d.environment as deployment_env
      FROM billing_records b
      LEFT JOIN usage_metrics u 
        ON b.service_name = u.service_name AND b.date = u.date
      LEFT JOIN deployments d 
        ON b.service_name = d.service_name AND date(d.deployed_at) = date(b.date)
      WHERE b.service_name = ? 
        AND b.date >= date(?, '-7 days')
        AND b.date <= date(?, '+7 days')
      ORDER BY b.date ASC
    `).all(spikeRecord.service_name, spikeRecord.date, spikeRecord.date);

    res.json({
      ...correlation,
      timeline: timelineData
    });
  } catch (err) {
    console.error('Error in getSpikeDetails:', err);
    res.status(500).json({ error: 'Failed to retrieve spike correlation details' });
  }
}

