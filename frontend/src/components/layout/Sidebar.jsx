import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  GitCommit,
  Activity,
  AlertTriangle,
  Cloud,
  ChevronRight
} from 'lucide-react';

export default function Sidebar({ activeTab, onSelectTab, spikesCount = 0 }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'billing', label: 'Billing', icon: Receipt },
    { id: 'deployments', label: 'Deployments', icon: GitCommit },
    { id: 'usage', label: 'Usage', icon: Activity },
    {
      id: 'spikes',
      label: 'Cost Spikes',
      icon: AlertTriangle,
      badge: spikesCount > 0 ? spikesCount : null
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <Cloud className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-white tracking-tight">CloudCause</h1>
          <p className="text-[11px] text-slate-400 font-medium">Cost Attribution</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 py-4 px-3 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Core Sections
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>

              {item.badge ? (
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                  isActive ? 'bg-white text-blue-600' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  {item.badge}
                </span>
              ) : isActive ? (
                <ChevronRight className="w-3.5 h-3.5 opacity-70" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Attribution Context Card in Sidebar */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-lg p-3 text-xs">
          <div className="flex items-center space-x-2 text-slate-200 font-medium mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Finance Attribution</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Correlates billing spikes directly with software releases and compute surges.
          </p>
        </div>
      </div>
    </aside>
  );
}

