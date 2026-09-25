import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';

export default function FilterBar({
  services = [],
  selectedService = 'All',
  onServiceChange,
  statusOptions = [],
  selectedStatus = 'All',
  onStatusChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onReset
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">
            <Filter className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Filters
          </div>

          {/* Service Dropdown */}
          <div className="flex flex-col">
            <label className="text-[11px] font-medium text-slate-500 mb-1">Cloud Service</label>
            <select
              value={selectedService}
              onChange={(e) => onServiceChange(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
            >
              <option value="All">All Services</option>
              {services.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Status Dropdown (if provided) */}
          {statusOptions.length > 0 && onStatusChange && (
            <div className="flex flex-col">
              <label className="text-[11px] font-medium text-slate-500 mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => onStatusChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
              >
                <option value="All">All Statuses</option>
                {statusOptions.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date Pickers */}
          {onStartDateChange && (
            <div className="flex flex-col">
              <label className="text-[11px] font-medium text-slate-500 mb-1">From Date</label>
              <input
                type="date"
                value={startDate || ''}
                onChange={(e) => onStartDateChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
              />
            </div>
          )}

          {onEndDateChange && (
            <div className="flex flex-col">
              <label className="text-[11px] font-medium text-slate-500 mb-1">To Date</label>
              <input
                type="date"
                value={endDate || ''}
                onChange={(e) => onEndDateChange(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
              />
            </div>
          )}
        </div>

        {/* Reset Button */}
        {onReset && (
          <button
            onClick={onReset}
            type="button"
            className="inline-flex items-center self-end text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3 h-3 mr-1.5" />
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
}

