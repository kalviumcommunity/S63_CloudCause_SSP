import React, { useEffect, useState } from 'react';
import FilterBar from '../components/common/FilterBar';
import StatusBadge from '../components/common/StatusBadge';
import { LoadingSpinner, EmptyState } from '../components/common/LoadingSpinner';
import { fetchDeployments, fetchServicesList } from '../services/api';
import { formatDateTime, formatPercent } from '../utils/formatters';
import { GitCommit, User, AlertTriangle, ArrowUpRight } from 'lucide-react';

export default function DeploymentsPage({ onInvestigateSpike }) {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState('All');
  const [selectedEnv, setSelectedEnv] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [deployments, setDeployments] = useState([]);

  useEffect(() => {
    fetchServicesList().then(setServices).catch(console.error);
  }, []);

  useEffect(() => {
    loadDeployments();
  }, [selectedService, selectedEnv, selectedStatus]);

  async function loadDeployments() {
    try {
      setLoading(true);
      const res = await fetchDeployments({
        service: selectedService,
        environment: selectedEnv,
        status: selectedStatus
      });
      setDeployments(res.deployments || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleReset = () => {
    setSelectedService('All');
    setSelectedEnv('All');
    setSelectedStatus('All');
  };

  return (
    <div className="space-y-6">
      {/* Context Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center">
            <GitCommit className="w-4 h-4 mr-2 text-blue-400" />
            Engineering Release & Deployment History
          </h3>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            Correlating software releases with cloud spending. Deployments flagged with a red tag coincided with a subsequent cost spike in the service.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col">
              <label className="text-[11px] font-medium text-slate-500 mb-1">Service</label>
              <select
                value={selectedService}
                onChange={(e) => setSelectedService(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="All">All Services</option>
                {services.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-[11px] font-medium text-slate-500 mb-1">Environment</label>
              <select
                value={selectedEnv}
                onChange={(e) => setSelectedEnv(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="All">All Environments</option>
                <option value="Production">Production</option>
                <option value="Staging">Staging</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-[11px] font-medium text-slate-500 mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Success">Success</option>
                <option value="Failed">Failed</option>
                <option value="In Progress">In Progress</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleReset}
            type="button"
            className="text-xs text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Deployments Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Recorded Deployments ({deployments.length})</h3>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading deployment events..." />
        ) : deployments.length === 0 ? (
          <EmptyState
            title="No deployments found"
            description="No deployment events match the active filters."
            action={
              <button
                onClick={handleReset}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200"
              >
                Clear Filters
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-6">Deployment Timestamp</th>
                  <th className="py-3 px-6">Service</th>
                  <th className="py-3 px-6">Version</th>
                  <th className="py-3 px-6">Environment</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Deployer & Commit Notes</th>
                  <th className="py-3 px-6 text-right">Cost Correlation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {deployments.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-slate-800">
                      {formatDateTime(d.deployed_at)}
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-slate-900">
                      {d.service_name}
                    </td>
                    <td className="py-3.5 px-6">
                      <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium text-[11px]">
                        {d.version}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                        d.environment === 'Production'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {d.environment}
                      </span>
                    </td>
                    <td className="py-3.5 px-6">
                      <StatusBadge status={d.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-6 max-w-xs">
                      <div className="flex items-center text-slate-800 font-medium truncate">
                        <User className="w-3 h-3 mr-1 text-slate-400 flex-shrink-0" />
                        <span>{d.deployed_by || 'system'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5" title={d.commit_message}>
                        {d.commit_message}
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      {d.correlated_spike_id ? (
                        <button
                          onClick={() => onInvestigateSpike(d.correlated_spike_id)}
                          className="inline-flex items-center px-2.5 py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg text-xs font-semibold transition-colors"
                        >
                          <AlertTriangle className="w-3 h-3 mr-1 text-red-500" />
                          <span>Spike (+{formatPercent(d.correlated_spike_change_pct, false)})</span>
                          <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs">No cost impact</span>
                      )}
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

