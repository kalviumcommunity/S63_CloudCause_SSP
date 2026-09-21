import db from '../config/database.js';

export function getDashboardSummary(req, res) {
  try {
    // 1. Total Cloud Cost across all records
    const totalRow = db.prepare('SELECT SUM(cost) as totalCost FROM billing_records').get();
    const totalCost = totalRow?.totalCost ? Number(totalRow.totalCost.toFixed(2)) : 0;

    // 2. Get min & max dates to partition last 30 days vs prior 30 days
    const dateRange = db.prepare('SELECT MIN(date) as minDate, MAX(date) as maxDate FROM billing_records').get();
    
    let currentPeriodCost = 0;
    let priorPeriodCost = 0;
    let costChangePct = 0;

    if (dateRange && dateRange.maxDate) {
      // Split into two 30-day blocks
      const current30Days = db.prepare(`
        SELECT SUM(cost) as periodCost 
        FROM billing_records 
        WHERE date >= date(?, '-29 days') AND date <= date(?)
      `).get(dateRange.maxDate, dateRange.maxDate);

      const prior30Days = db.prepare(`
        SELECT SUM(cost) as periodCost 
        FROM billing_records 
        WHERE date >= date(?, '-59 days') AND date < date(?, '-29 days')
      `).get(dateRange.maxDate, dateRange.maxDate);

      currentPeriodCost = current30Days?.periodCost ? Number(current30Days.periodCost.toFixed(2)) : 0;
      priorPeriodCost = prior30Days?.periodCost ? Number(prior30Days.periodCost.toFixed(2)) : 0;

      if (priorPeriodCost > 0) {
        costChangePct = Number((((currentPeriodCost - priorPeriodCost) / priorPeriodCost) * 100).toFixed(1));
      }
    }

    // 3. Count of Cost Spikes
    const spikesCountRow = db.prepare("SELECT count(*) as count FROM billing_records WHERE status = 'Cost Spike'").get();
    const spikesCount = spikesCountRow ? spikesCountRow.count : 0;

    // 4. Daily cost trend aggregated across all services (and individual services)
    const dailySpend = db.prepare(`
      SELECT 
        date, 
        ROUND(SUM(cost), 2) as totalCost,
        MAX(CASE WHEN status = 'Cost Spike' THEN 1 ELSE 0 END) as hasSpike
      FROM billing_records
      GROUP BY date
      ORDER BY date ASC
    `).all();

    // 5. Recent Cost Spikes (up to 5 most recent)
    const recentSpikes = db.prepare(`
      SELECT 
        b.id,
        b.date,
        b.service_name,
        b.cost,
        b.previous_cost,
        b.cost_change,
        b.cost_change_pct,
        b.status,
        (
          SELECT version 
          FROM deployments d 
          WHERE d.service_name = b.service_name 
            AND date(d.deployed_at) <= date(b.date)
            AND date(d.deployed_at) >= date(b.date, '-2 days')
          ORDER BY d.deployed_at DESC LIMIT 1
        ) as recent_deployment_version
      FROM billing_records b
      WHERE b.status = 'Cost Spike'
      ORDER BY b.date DESC
      LIMIT 5
    `).all();

    // 6. Service Breakdown
    const serviceBreakdown = db.prepare(`
      SELECT 
        service_name,
        ROUND(SUM(cost), 2) as totalCost,
        ROUND((SUM(cost) * 100.0 / (SELECT SUM(cost) FROM billing_records)), 1) as percentage
      FROM billing_records
      GROUP BY service_name
      ORDER BY totalCost DESC
    `).all();

    res.json({
      summary: {
        totalCost,
        currentMonthCost: currentPeriodCost,
        previousMonthCost: priorPeriodCost,
        costChangePct,
        spikesCount
      },
      dailySpend,
      recentSpikes,
      serviceBreakdown
    });
  } catch (err) {
    console.error('Error in getDashboardSummary:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard summary' });
  }
}

