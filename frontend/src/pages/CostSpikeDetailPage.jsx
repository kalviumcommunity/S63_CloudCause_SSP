import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  AlertTriangle,
  GitCommit,
  Cpu,
  Server,
  Globe,
  HardDrive,
  Info,
  CheckCircle2,
  Sliders,
  DollarSign,
  TrendingDown
} from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import { LoadingSpinner, EmptyState } from '../components/common/LoadingSpinner';
import { fetchSpikeDetails } from '../services/api';
import {
  formatCurrency,
  formatPercent,
  formatDate,
  formatDateTime,
  formatNumber
} from '../utils/formatters';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';

export default function CostSpikeDetailPage({ spikeId, onBack, onSelectService }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Interactive What-If Optimization Simulator state
  const [optimizationPct, setOptimizationPct] = useState(60);

  useEffect(() => {
    if (spikeId) {
      loadDetail(spikeId);
    }
  }, [spikeId]);

  async function loadDetail(id) {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchSpikeDetails(id);
      setData(res);
    } catch (err) {
      console.error(err);
      setError('Unable to load spike correlation details.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingSpinner message="Correlating billing anomaly with deployment & usage telemetry..." />;
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Spike Details Unavailable"
        description={error || 'Could not find details for this cost spike.'}
        action={
          <button
            onClick={onBack}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Dashboard
          </button>
        }
      />
    );
  }

  const {
    billing,
    primaryDeployment,
    allRelatedDeployments,
    usageChanges,
    possibleExplanation,
    confidenceLevel,
    timeline
  } = data;

  // Calculate simulated savings from slider
  const netSpikeDelta = Math.max(0, billing.cost - billing.previous_cost);
  const simulatedSavings = (netSpikeDelta * (optimizationPct / 100));
  const postOptimizationCost = billing.cost - simulatedSavings;

  return (
    <div className="space-y-6">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200/90 px-3.5 py-2 rounded-xl shadow-sm transition-all hover:scale-105"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Overview
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2.5 py-1 rounded-lg">
            Record ID: #{billing.id}
          </span>
        </div>
      </div>

      {/* Main Attribution Summary Banner */}
      <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Service Cost Attribution Report
              </span>
              <StatusBadge status={billing.status} />
              <span className="inline-flex items-center text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {confidenceLevel}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {billing.service_name}
            </h2>
            <div className="flex items-center text-xs text-slate-500 mt-1.5 space-x-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Anomalous Spike Recorded on {formatDate(billing.date)}</span>
            </div>
          </div>

          {/* Cost Delta Highlights */}
          <div className="flex items-center gap-6 bg-slate-50 border border-slate-200/80 rounded-2xl p-4 shadow-inner">
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Previous Cost</div>
              <div className="text-lg font-bold text-slate-700 mt-0.5">
                {formatCurrency(billing.previous_cost)}
              </div>
            </div>
            <div className="text-slate-300 text-xl font-light">→</div>
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Spike Cost</div>
              <div className="text-2xl font-black text-red-600 mt-0.5">
                {formatCurrency(billing.cost)}
              </div>
            </div>
            <div className="pl-4 border-l border-slate-200">
              <div className="text-[11px] font-semibold text-slate-500 uppercase">Net Increase</div>
              <div className="text-base font-bold text-red-700 mt-0.5">
                +{formatCurrency(billing.cost_change)} ({formatPercent(billing.cost_change_pct)})
              </div>
            </div>
          </div>
        </div>

        {/* Possible Explanation Card (The central problem statement feature) */}
        <div className="mt-6 bg-blue-50/80 border border-blue-200/90 rounded-2xl p-5">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl flex-shrink-0 mt-0.5 shadow-md shadow-blue-500/20">
              <Info className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                  Possible Explanation & Root Cause Analysis
                </h4>
                <span className="text-[11px] font-medium text-blue-700 italic">
                  Rule-based correlation (not definitive causation)
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-normal">
                {possibleExplanation}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Correlated Evidence Columns: Deployment & Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Related Deployment Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <GitCommit className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Correlated Software Deployment</h3>
              </div>
              <span className="text-[11px] text-slate-400">Within ±48h window</span>
            </div>

            {primaryDeployment ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                  <div>
                    <div className="text-[11px] text-slate-500 font-medium uppercase">Release Version</div>
                    <div className="font-mono text-base font-bold text-slate-900 mt-0.5">
                      {primaryDeployment.version}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500 font-medium uppercase">Environment</div>
                    <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded-lg mt-0.5">
                      {primaryDeployment.environment}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-500 text-[11px] block">Deployment Timestamp</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">
                      {formatDateTime(primaryDeployment.deployed_at)}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-slate-500 text-[11px] block">Author / Engineer</span>
                    <span className="font-semibold text-slate-800 mt-0.5 block">
                      {primaryDeployment.deployed_by || 'System Pipeline'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-slate-500 text-[11px] block">Commit Message & Notes</span>
                  <p className="text-xs text-slate-700 font-medium mt-1 leading-relaxed">
                    "{primaryDeployment.commit_message}"
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-500">
                  No deployments recorded for <span className="font-medium text-slate-700">{billing.service_name}</span> within the 48-hour attribution window.
                </p>
              </div>
            )}
          </div>

          {primaryDeployment && (
            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-500" />
              <span>Deployment status verified as: <strong>{primaryDeployment.status}</strong></span>
            </div>
          )}
        </div>

        {/* Relevant Usage Changes Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900">Service Usage Metrics Comparison</h3>
            </div>
            <span className="text-[11px] text-slate-400">Baseline vs Spike Day</span>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            {/* CPU Utilization */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-medium flex items-center">
                  <Cpu className="w-3.5 h-3.5 mr-1 text-purple-500" /> CPU Usage
                </span>
                <span className={`text-[11px] font-bold ${usageChanges.cpuDelta > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                  {usageChanges.cpuDelta > 0 && '+'}{usageChanges.cpuDelta}%
                </span>
              </div>
              <div className="text-base font-bold text-slate-900">
                {usageChanges.cpuCurrent !== null ? `${usageChanges.cpuCurrent}%` : 'N/A'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Baseline: {usageChanges.cpuBefore !== null ? `${usageChanges.cpuBefore}%` : 'N/A'}
              </div>
            </div>

            {/* Active Instances */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-medium flex items-center">
                  <Server className="w-3.5 h-3.5 mr-1 text-amber-500" /> Instances
                </span>
                <span className={`text-[11px] font-bold ${usageChanges.instancesDelta > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                  {usageChanges.instancesDelta > 0 && '+'}{usageChanges.instancesDelta} nodes
                </span>
              </div>
              <div className="text-base font-bold text-slate-900">
                {usageChanges.instancesCurrent !== null ? `${usageChanges.instancesCurrent} nodes` : 'N/A'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Baseline: {usageChanges.instancesBefore !== null ? `${usageChanges.instancesBefore} nodes` : 'N/A'}
              </div>
            </div>

            {/* Request Volume */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-medium flex items-center">
                  <Globe className="w-3.5 h-3.5 mr-1 text-blue-500" /> Daily Requests
                </span>
                <span className={`text-[11px] font-bold ${usageChanges.requestsDeltaPct > 0 ? 'text-blue-600' : 'text-slate-600'}`}>
                  {formatPercent(usageChanges.requestsDeltaPct)}
                </span>
              </div>
              <div className="text-base font-bold text-slate-900">
                {formatNumber(usageChanges.requestsCurrent)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Baseline: {formatNumber(usageChanges.requestsBefore)}
              </div>
            </div>

            {/* Memory Usage */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span className="font-medium flex items-center">
                  <HardDrive className="w-3.5 h-3.5 mr-1 text-cyan-500" /> Memory
                </span>
                <span className={`text-[11px] font-bold ${usageChanges.memoryDelta > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                  {usageChanges.memoryDelta > 0 && '+'}{usageChanges.memoryDelta}%
                </span>
              </div>
              <div className="text-base font-bold text-slate-900">
                {usageChanges.memoryCurrent !== null ? `${usageChanges.memoryCurrent}%` : 'N/A'}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Baseline: {usageChanges.memoryBefore !== null ? `${usageChanges.memoryBefore}%` : 'N/A'}
              </div>
            </div>
          </div>

          <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
            <strong>Finance Summary:</strong> Resource auto-scaling increases hourly compute billing. High CPU or memory pressure triggers cluster capacity expansion.
          </div>
        </div>
      </div>

      {/* 3D What-If Optimization & Recovery Simulator */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl border border-slate-800 p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Interactive "What-If" Remediation & Cost Recovery Simulator
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Simulate financial impact if a hotfix rollback or instance throttle is applied
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
          <div className="md:col-span-2 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300 font-medium">Optimization Target / Rollback Efficiency</span>
              <span className="font-bold text-emerald-400 text-sm">{optimizationPct}% Recovered</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={optimizationPct}
              onChange={(e) => setOptimizationPct(Number(e.target.value))}
              className="w-full accent-emerald-500 h-2 bg-slate-800 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>Conservative (10%)</span>
              <span>Balanced (50%)</span>
              <span>Full Reversion (100%)</span>
            </div>
          </div>

          <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 flex flex-col justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Projected Daily Savings
              </span>
              <div className="text-2xl font-black text-emerald-400 mt-1 flex items-baseline">
                <TrendingDown className="w-5 h-5 mr-1" />
                {formatCurrency(simulatedSavings)}
                <span className="text-xs text-slate-400 font-normal ml-1">/day</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400 mt-2">
              Reduced daily bill: <strong className="text-white">{formatCurrency(postOptimizationCost)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Surrounding Context Timeline Chart */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              14-Day Spend & Deployment Trajectory
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Service spending before, during, and after the spike date ({formatDate(billing.date)})
            </p>
          </div>
          <div className="flex items-center space-x-3 text-xs text-slate-600">
            <div className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 mr-1.5"></span>
              Daily Spend ($)
            </div>
            <div className="flex items-center">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 mr-1.5"></span>
              Spike Date
            </div>
          </div>
        </div>

        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="detailGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                tickFormatter={(v) => `$${v}`}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(val) => [formatCurrency(val), 'Cost']}
                labelFormatter={formatDate}
              />
              <ReferenceLine
                x={billing.date}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{ value: 'Spike Day', fill: '#ef4444', fontSize: 10, position: 'insideTopLeft' }}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="#ef4444"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#detailGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
