/**
 * Cost Spike Detection Service
 * Simple, rule-based cost anomaly detection.
 */

export const SPIKE_THRESHOLDS = {
  SPIKE_PCT: 35,     // 35% or higher increase indicates a Spike
  SPIKE_MIN_DELTA: 50, // Minimum $50 absolute dollar increase to avoid noise on micro-costs
  INCREASED_PCT: 15, // 15% to 35% increase indicates elevated cost
  INCREASED_MIN_DELTA: 20 // Minimum $20 absolute increase
};

/**
 * Classifies cost movement based on previous cost and current cost.
 * @param {number} currentCost 
 * @param {number} previousCost 
 * @param {object} customThresholds 
 * @returns {{ status: 'Normal' | 'Increased' | 'Cost Spike', change: number, changePct: number }}
 */
export function classifyCostStatus(currentCost, previousCost, customThresholds = {}) {
  const cfg = { ...SPIKE_THRESHOLDS, ...customThresholds };

  const prev = Number(previousCost) || 0;
  const curr = Number(currentCost) || 0;
  const change = Number((curr - prev).toFixed(2));

  let changePct = 0;
  if (prev > 0) {
    changePct = Number((((curr - prev) / prev) * 100).toFixed(1));
  } else if (curr > 0) {
    changePct = 100.0;
  }

  let status = 'Normal';

  if (changePct >= cfg.SPIKE_PCT && change >= cfg.SPIKE_MIN_DELTA) {
    status = 'Cost Spike';
  } else if (changePct >= cfg.INCREASED_PCT && change >= cfg.INCREASED_MIN_DELTA) {
    status = 'Increased';
  }

  return {
    status,
    change,
    changePct
  };
}

