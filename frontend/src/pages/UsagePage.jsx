import React, { useEffect, useState } from 'react';
import FilterBar from '../components/common/FilterBar';
import StatCard from '../components/common/StatCard';
import UsageTrendChart from '../components/charts/UsageTrendChart';
import { LoadingSpinner, EmptyState } from '../components/common/LoadingSpinner';
import { fetchUsageMetrics, fetchServicesList } from '../services/api';
import { formatNumber, formatDate } from '../utils/formatters';
import { Cpu, Server, Globe, HardDrive } from 'lucide-react';

export default function UsagePage() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState('Worker Service');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState({ metrics: [], summary: {}, tableData: [] });

  useEffect(() => {
    fetchServicesList()
      .then((sList) => {
        setServices(sList);
        if (sList.length > 0 && selectedService === 'All') {
          setSelectedService(sList[0]);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadUsage();
  }, [selectedService, startDate, endDate]);

  async function loadUsage() {
    try {
      setLoading(true);
      const res = await fetchUsageMetrics({
        service: selectedService,
        startDate,
        endDate
      });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const handleReset = () => {
    if (services.length > 0) setSelectedService(services[0]);
    setStartDate('');
    setEndDate('');
  };

  const { summary, metrics, tableData } = data;

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <FilterBar
        services={services}
        selectedService={selectedService}
        onServiceChange={setSelectedService}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onReset={handleReset}
      />

      {/* Metrics Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Avg CPU Utilization"
          value={`${summary?.avgCpu || 0}%`}
          changeText="Across monitored period"
          icon={Cpu}
        />
        <StatCard
          title="Peak CPU Utilization"
          value={`${summary?.maxCpu || 0}%`}
          changeText="Maximum registered peak"
          icon={Cpu}
          isNegativeGood={true}
        />
        <StatCard
          title="Total Requests Processed"
          value={formatNumber(summary?.totalRequests || 0)}
          changeText="Cumulative volume"
          icon={Globe}
        />
        <StatCard
          title="Peak Instance Count"
          value={`${summary?.peakInstances || 0} nodes`}
          changeText="Auto-scale max capacity"
          icon={Server}
        />
      </div>

      {/* Usage Trend Chart */}
      <UsageTrendChart
        data={metrics}
        title={`Utilization Trend — ${selectedService}`}
        height={300}
      />

      {/* Usage Metrics Log Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Recent Service Usage Records</h3>
          <span className="text-xs text-slate-500">Showing last 30 daily data points</span>
        </div>

        {loading ? (
          <LoadingSpinner message="Loading usage telemetries..." />
        ) : tableData.length === 0 ? (
          <EmptyState
            title="No usage metrics found"
            description="Adjust your service or date filters to inspect usage data."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 text-slate-500 font-semibold border-b border-slate-100 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-6">Date</th>
                  <th className="py-3 px-6">Service</th>
                  <th className="py-3 px-6">CPU Utilization</th>
                  <th className="py-3 px-6">Memory Usage</th>
                  <th className="py-3 px-6">Total Daily Requests</th>
                  <th className="py-3 px-6 text-right">Active Instances</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tableData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-slate-800">
                      {formatDate(row.date)}
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-slate-900">
                      {row.service_name}
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              row.cpu_utilization > 80 ? 'bg-red-500' : row.cpu_utilization > 60 ? 'bg-amber-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(100, row.cpu_utilization)}%` }}
                          ></div>
                        </div>
                        <span className="font-medium text-slate-800">{row.cpu_utilization}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 font-medium text-slate-700">
                      {row.memory_utilization}%
                    </td>
                    <td className="py-3.5 px-6 font-medium text-slate-700">
                      {formatNumber(row.request_count)}
                    </td>
                    <td className="py-3.5 px-6 text-right font-bold text-slate-900">
                      {row.instance_count}
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

