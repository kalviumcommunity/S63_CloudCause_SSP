import React, { useEffect, useState } from 'react';
import StatusBadge from '../components/common/StatusBadge';
import FilterBar from '../components/common/FilterBar';
import { LoadingSpinner, EmptyState } from '../components/common/LoadingSpinner';
import { fetchAllSpikes, fetchServicesList } from '../services/api';
import { formatCurrency, formatPercent, formatDate, formatDateTime } from '../utils/formatters';
import { AlertTriangle, ArrowUpRight, GitCommit } from 'lucide-react';

export default function CostSpikesPage({ onInvestigateSpike }) {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState('All');
  const [spikes, setSpikes] = useState([]);

  useEffect(() => {
    fetchServicesList().then(setServices).catch(console.error);
  }, []);

  useEffect(() => {
    loadSpikes();
  }, [selectedService]);

  async function loadSpikes() {
    try {
      setLoading(true);
      const res = await fetchAllSpikes({ service: selectedService });
      setSpikes(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-red-950/20 border border-red-200/60 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start space-x-3">
          <div className="p-2 bg-red-100 rounded-lg text-red-700">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-red-950">Detected Cloud Cost Spikes</h3>
            <p className="text-xs text-red-800/80 mt-0.5 max-w-xl">
              Spikes flagged using rule-based detection (&gt;35% jump and &gt;$50 delta from baseline). Click any row to inspect correlated deployments and usage metrics.
            </p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <FilterBar
        services={services}
        selectedService={selectedService}
        onServiceChange={setSelectedService}
        onReset={() => setSelectedService('All')}
      />

      {/* Spikes Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Cost Anomalies ({spikes.length})</h3>
        </div>

        {loading ? (
          <LoadingSpinner message="Scanning for cost anomalies..." />
        ) : spikes.length === 0 ? (
          <EmptyState
            title="No cost spikes detected"
            description="All service costs are within expected bounds."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Spike Date</th>
                  <th className="py-3.5 px-6">Affected Service</th>
                  <th className="py-3.5 px-6">Previous Cost</th>
                  <th className="py-3.5 px-6">Spike Cost</th>
                  <th className="py-3.5 px-6">Increase</th>
                  <th className="py-3.5 px-6">Nearby Release</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Investigation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {spikes.map((spike) => (
                  <tr
                    key={spike.id}
                    onClick={() => onInvestigateSpike(spike.id)}
                    className="hover:bg-red-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-4 px-6 font-medium text-slate-900">
                      {formatDate(spike.date)}
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-900">
                      {spike.service_name}
                    </td>
                    <td className="py-4 px-6 text-slate-500">
                      {formatCurrency(spike.previous_cost)}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900">
                      {formatCurrency(spike.cost)}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-red-600">
                          +{formatCurrency(spike.cost_change)}
                        </span>
                        <span className="text-[11px] text-red-500 font-semibold">
                          {formatPercent(spike.cost_change_pct)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {spike.recent_deployment_version ? (
                        <div className="flex items-center space-x-1.5">
                          <GitCommit className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono text-slate-800 font-semibold text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                            {spike.recent_deployment_version}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No release within 48h</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <StatusBadge status={spike.status} size="sm" />
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInvestigateSpike(spike.id);
                        }}
                        className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-semibold text-xs transition-colors"
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

