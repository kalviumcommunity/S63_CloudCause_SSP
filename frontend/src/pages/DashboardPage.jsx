import React, { useEffect, useState } from 'react';
import { DollarSign, AlertTriangle, TrendingUp, Layers, ArrowUpRight, ChevronRight, Sparkles } from 'lucide-react';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import CostTrendChart from '../components/charts/CostTrendChart';
import ServiceBreakdownChart from '../components/charts/ServiceBreakdownChart';
import Interactive3DCloudTopology from '../components/charts/Interactive3DCloudTopology';
import { LoadingSpinner, EmptyState } from '../components/common/LoadingSpinner';
import { fetchDashboardSummary } from '../services/api';
import { formatCurrency, formatPercent, formatDate } from '../utils/formatters';

export default function DashboardPage({ onInvestigateSpike, onNavigate }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchDashboardSummary();
      setData(res);
    } catch (err) {
      console.error(err);
      setError('Unable to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <LoadingSpinner message="Calculating financial metrics & cost anomalies..." />;
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Dashboard Unavailable"
        description={error || 'No dashboard data found.'}
        action={
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        }
      />
    );
  }

  const { summary, dailySpend, recentSpikes, serviceBreakdown } = data;

  return (
    <div className="space-y-6">
      {/* 3D Modern Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-12 -bottom-12 w-64 h-64 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="max-w-2xl">
            <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Attribution Engine Active</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Cloud Infrastructure Cost Attribution
            </h2>
            <p className="text-xs sm:text-sm text-slate-300/90 mt-1 leading-relaxed">
              Synthesizing infrastructure billing, engineering releases, and telemetry. Automatically explains sudden cloud cost spikes for finance teams.
            </p>
          </div>

          <div className="flex items-center space-x-3 text-xs">
            <button
              onClick={() => onNavigate('spikes')}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/30 transition-all hover:scale-105 flex items-center"
            >
              <span>Explore All Spikes</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </div>

      {/* 3D Interactive Interactive Cloud Topology Visualizer */}
      <Interactive3DCloudTopology
        onInvestigateSpike={onInvestigateSpike}
      />

      {/* 3D Perspective KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Cloud Cost"
          value={formatCurrency(summary.totalCost)}
          icon={DollarSign}
        />
        <StatCard
          title="Current Month Cost"
          value={formatCurrency(summary.currentMonthCost)}
          change={summary.costChangePct}
          changeText="vs prior 30 days"
          icon={TrendingUp}
          isNegativeGood={true}
        />
        <StatCard
          title="Cost Change %"
          value={formatPercent(summary.costChangePct)}
          change={summary.costChangePct}
          changeText="MoM fluctuation"
          icon={Layers}
          isNegativeGood={true}
        />
        <StatCard
          title="Identified Cost Spikes"
          value={summary.spikesCount}
          icon={AlertTriangle}
          changeText="Active anomalies"
        />
      </div>

      {/* Main Charts: Spend Trend & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <CostTrendChart
            data={dailySpend}
            title="Total Daily Cloud Spending ($)"
            height={320}
          />
        </div>
        <div className="lg:col-span-1">
          <ServiceBreakdownChart
            data={serviceBreakdown}
            height={320}
          />
        </div>
      </div>

      {/* Recent Cost Spikes Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recent Cost Spikes Requiring Attribution</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any spike to view correlated software releases and usage metrics
            </p>
          </div>
          <button
            onClick={() => onNavigate('spikes')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center"
          >
            <span>View All ({summary.spikesCount})</span>
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        </div>

        {recentSpikes.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No active cost spikes detected. Cloud spend is within normal baselines.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Spike Date</th>
                  <th className="py-3.5 px-6">Affected Service</th>
                  <th className="py-3.5 px-6">Previous Cost</th>
                  <th className="py-3.5 px-6">Spike Cost</th>
                  <th className="py-3.5 px-6">Increase %</th>
                  <th className="py-3.5 px-6">Near Deployment</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Investigation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentSpikes.map((spike) => (
                  <tr
                    key={spike.id}
                    onClick={() => onInvestigateSpike(spike.id)}
                    className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-6 font-medium text-slate-800">
                      {formatDate(spike.date)}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {spike.service_name}
                    </td>
                    <td className="py-3.5 px-6 text-slate-500">
                      {formatCurrency(spike.previous_cost)}
                    </td>
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {formatCurrency(spike.cost)}
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                        {formatPercent(spike.cost_change_pct)}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-slate-600">
                      {spike.recent_deployment_version ? (
                        <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-semibold">
                          {spike.recent_deployment_version}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None within 48h</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6">
                      <StatusBadge status={spike.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInvestigateSpike(spike.id);
                        }}
                        className="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-800 group-hover:underline"
                      >
                        Investigate
                        <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
