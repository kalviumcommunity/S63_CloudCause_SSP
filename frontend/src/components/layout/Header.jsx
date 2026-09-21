import React from 'react';
import { Calendar, RefreshCw } from 'lucide-react';

export default function Header({ title, subtitle, onRefresh, isRefreshing }) {
  const todayStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <header className="bg-white border-b border-slate-200/80 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm/50">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center space-x-3">
        {/* Environment / System Tag */}
        <div className="hidden sm:flex items-center px-2.5 py-1 bg-slate-100 rounded-md text-xs font-medium text-slate-600 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>
          Simulated Cloud Data
        </div>

        {/* Date indicator */}
        <div className="hidden md:flex items-center text-xs font-medium text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-md">
          <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
          <span>{todayStr}</span>
        </div>

        {/* Refresh button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh Data"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        )}
      </div>
    </header>
  );
}

