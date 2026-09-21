import React, { useEffect, useState } from 'react';
import FilterBar from '../components/common/FilterBar';
import StatusBadge from '../components/common/StatusBadge';
import CostTrendChart from '../components/charts/CostTrendChart';
import { LoadingSpinner, EmptyState } from '../components/common/LoadingSpinner';
import { fetchBillingRecords, fetchServicesList } from '../services/api';
import { formatCurrency, formatPercent, formatDate } from '../utils/formatters';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';

export default function BillingPage({ onInvestigateSpike }) {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ records: [], trend: [], filteredTotal: 0, pagination: { total: 0, totalPages: 1 } });

  useEffect(() => {
    fetchServicesList().then(setServices).catch(console.error);
  }, []);

  useEffect(() => {
    loadBilling();
  }, [selectedService, selectedStatus, startDate, endDate, page]);

  async function loadBilling() {
    try {
      setLoading(true);
      const res = await fetchBillingRecords({
        service: selectedService,
        status: selectedStatus,
        startDate,
        endDate,
        page,
        limit: 15
      });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleReset = () => {
    setSelectedService('All');
    setSelectedStatus('All');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <FilterBar
        services={services}
        selectedService={selectedService}
        onServiceChange={(s) => { setSelectedService(s); setPage(1); }}
        statusOptions={['Normal', 'Increased', 'Cost Spike']}
        selectedStatus={selectedStatus}
        onStatusChange={(st) => { setSelectedStatus(st); setPage(1); }}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={(d) => { setStartDate(d); setPage(1); }}
        onEndDateChange={(d) => { setEndDate(d); setPage(1); }}
        onReset={handleReset}
      />

      {/* Filtered Cost Trend Chart */}
      <CostTrendChart
        data={data.trend}
        title={`Billing Trend ${selectedService !== 'All' ? `— ${selectedService}` : '(All Services)'}`}
        height={240}
      />

      {/* Table Section */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Cloud Billing Records</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Filtered Total Spend: <span className="font-semibold text-slate-900">{formatCurrency(data.filteredTotal)}</span> across {data.pagination.total} records
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner message="Fetching billing ledger..." />
        ) : data.records.length === 0 ? (
          <EmptyState
            title="No billing entries match filters"
            description="Try choosing a different service, status, or date range."
            action={
              <button
                onClick={handleReset}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 transition-colors"
              >
                Reset Filters
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-6">Billing Date</th>
                  <th className="py-3 px-6">Cloud Service</th>
                  <th className="py-3 px-6">Cost</th>
                  <th className="py-3 px-6">Previous Cost</th>
                  <th className="py-3 px-6">Cost Change</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.records.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-3 px-6 font-medium text-slate-800">
                      {formatDate(row.date)}
                    </td>
                    <td className="py-3 px-6 font-medium text-slate-900">
                      {row.service_name}
                    </td>
                    <td className="py-3 px-6 font-bold text-slate-900">
                      {formatCurrency(row.cost)}
                    </td>
                    <td className="py-3 px-6 text-slate-500">
                      {formatCurrency(row.previous_cost)}
                    </td>
                    <td className="py-3 px-6">
                      <span className={`font-semibold ${
                        row.cost_change > 0 ? 'text-red-600' : row.cost_change < 0 ? 'text-emerald-600' : 'text-slate-500'
                      }`}>
                        {row.cost_change > 0 && '+'}{formatCurrency(row.cost_change)} ({formatPercent(row.cost_change_pct)})
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      <StatusBadge status={row.status} size="sm" />
                    </td>
                    <td className="py-3 px-6 text-right">
                      {row.status === 'Cost Spike' ? (
                        <button
                          onClick={() => onInvestigateSpike(row.id)}
                          className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Investigate
                          <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {data.pagination.totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <div>
              Showing Page <span className="font-semibold text-slate-800">{data.pagination.page}</span> of{' '}
              <span className="font-semibold text-slate-800">{data.pagination.totalPages}</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

