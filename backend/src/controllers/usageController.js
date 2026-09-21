import db from '../config/database.js';

export function getUsageMetrics(req, res) {
  try {
    const { service, startDate, endDate } = req.query;

    const conditions = [];
    const params = [];

    if (service && service !== 'All') {
      conditions.push('service_name = ?');
      params.push(service);
    }
    if (startDate) {
      conditions.push('date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('date <= ?');
      params.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Usage time series for charts
    const timeSeriesQuery = `
      SELECT 
        date,
        service_name,
        cpu_utilization,
        request_count,
        instance_count,
        memory_utilization
      FROM usage_metrics
      ${whereClause}
      ORDER BY date ASC
    `;
    const metrics = db.prepare(timeSeriesQuery).all(...params);

    // Summary statistics for KPI cards
    const summaryQuery = `
      SELECT 
        ROUND(AVG(cpu_utilization), 1) as avgCpu,
        MAX(cpu_utilization) as maxCpu,
        SUM(request_count) as totalRequests,
        MAX(instance_count) as peakInstances,
        ROUND(AVG(memory_utilization), 1) as avgMemory
      FROM usage_metrics
      ${whereClause}
    `;
    const summary = db.prepare(summaryQuery).get(...params);

    // Latest records table (last 30 rows)
    const latestTableQuery = `
      SELECT * FROM usage_metrics
      ${whereClause}
      ORDER BY date DESC, service_name ASC
      LIMIT 30
    `;
    const tableData = db.prepare(latestTableQuery).all(...params);

    res.json({
      metrics,
      summary: summary || {
        avgCpu: 0,
        maxCpu: 0,
        totalRequests: 0,
        peakInstances: 0,
        avgMemory: 0
      },
      tableData
    });
  } catch (err) {
    console.error('Error in getUsageMetrics:', err);
    res.status(500).json({ error: 'Failed to retrieve usage metrics' });
  }
}

