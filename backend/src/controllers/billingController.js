import db from '../config/database.js';

export function getBillingRecords(req, res) {
  try {
    const { service, startDate, endDate, status, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

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
    if (status && status !== 'All') {
      conditions.push('status = ?');
      params.push(status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total records matching filters
    const countQuery = `SELECT COUNT(*) as total FROM billing_records ${whereClause}`;
    const totalRecords = db.prepare(countQuery).get(...params).total;

    // Filtered total spend
    const sumQuery = `SELECT ROUND(SUM(cost), 2) as filteredTotal FROM billing_records ${whereClause}`;
    const filteredTotal = db.prepare(sumQuery).get(...params).filteredTotal || 0;

    // Select paginated records
    const dataQuery = `
      SELECT * FROM billing_records 
      ${whereClause}
      ORDER BY date DESC, cost DESC
      LIMIT ? OFFSET ?
    `;
    const records = db.prepare(dataQuery).all(...params, limitNum, offset);

    // Filtered daily trend for chart
    const trendQuery = `
      SELECT date, ROUND(SUM(cost), 2) as dailyCost
      FROM billing_records
      ${whereClause}
      GROUP BY date
      ORDER BY date ASC
    `;
    const trend = db.prepare(trendQuery).all(...params);

    res.json({
      records,
      trend,
      filteredTotal,
      pagination: {
        total: totalRecords,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalRecords / limitNum)
      }
    });
  } catch (err) {
    console.error('Error in getBillingRecords:', err);
    res.status(500).json({ error: 'Failed to retrieve billing records' });
  }
}

export function getServicesList(req, res) {
  try {
    const services = db.prepare('SELECT DISTINCT service_name FROM billing_records ORDER BY service_name ASC').all();
    res.json(services.map(s => s.service_name));
  } catch (err) {
    console.error('Error in getServicesList:', err);
    res.status(500).json({ error: 'Failed to retrieve services list' });
  }
}

