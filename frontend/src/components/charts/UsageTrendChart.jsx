import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { formatDate } from '../../utils/formatters';

const CustomUsageTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs border border-slate-700 min-w-[170px]">
        <div className="font-semibold text-slate-300 mb-2">{formatDate(label)}</div>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex justify-between items-center py-0.5 space-x-3">
            <span className="flex items-center text-slate-300">
              <span className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: entry.color }}></span>
              {entry.name}:
            </span>
            <span className="font-bold text-white">
              {entry.name.includes('CPU') || entry.name.includes('Memory') ? `${entry.value}%` : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function UsageTrendChart({ data = [], height = 280, title = 'Compute & Resource Utilization' }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 flex items-center justify-center h-64 text-slate-400 text-sm">
        No usage data available for this selection
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            CPU percentage and active compute instances over time
          </p>
        </div>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              minTickGap={25}
            />
            {/* Left Axis: CPU & Memory % */}
            <YAxis
              yAxisId="left"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
            />
            {/* Right Axis: Instances */}
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => `${v} inst`}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomUsageTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="cpu_utilization"
              name="CPU Utilization"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="memory_utilization"
              name="Memory Usage"
              stroke="#06b6d4"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
            <Line
              yAxisId="right"
              type="stepAfter"
              dataKey="instance_count"
              name="Instance Count"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

