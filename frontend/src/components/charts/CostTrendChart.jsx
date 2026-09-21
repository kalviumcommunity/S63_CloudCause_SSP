import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot
} from 'recharts';
import { formatCurrency, formatDate } from '../../utils/formatters';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs border border-slate-700 min-w-[150px]">
        <div className="font-semibold text-slate-300 mb-1">{formatDate(label)}</div>
        <div className="text-base font-bold text-white mb-1">
          {formatCurrency(payload[0].value)}
        </div>
        {data.hasSpike ? (
          <div className="inline-flex items-center text-rose-400 font-semibold mt-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5 animate-pulse"></span>
            Cost Spike Detected
          </div>
        ) : (
          <div className="text-slate-400">Normal Range</div>
        )}
      </div>
    );
  }
  return null;
};

// Custom dot to clearly highlight spike days on the line
const CustomizedDot = (props) => {
  const { cx, cy, payload } = props;
  if (payload.hasSpike) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={7} fill="#ef4444" fillOpacity={0.3} className="animate-ping" />
        <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#ffffff" strokeWidth={2} />
      </g>
    );
  }
  return null;
};

export default function CostTrendChart({ data = [], height = 280, title = 'Cloud Cost Trend Over Time' }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 flex items-center justify-center h-64 text-slate-400 text-sm">
        No cost trend data available
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map((item) => ({
    date: item.date,
    cost: Number(item.totalCost || item.cost || item.dailyCost || 0),
    hasSpike: Boolean(item.hasSpike || item.status === 'Cost Spike')
  }));

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily aggregate infrastructure spend with highlighted anomaly spikes
          </p>
        </div>
        <div className="flex items-center space-x-3 text-xs text-slate-600">
          <div className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5"></span>
            Daily Spend
          </div>
          <div className="flex items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5"></span>
            Cost Spike
          </div>
        </div>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              minTickGap={25}
            />
            <YAxis
              tickFormatter={(val) => `$${val}`}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="cost"
              stroke="#2563eb"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#costGradient)"
              dot={<CustomizedDot />}
              activeDot={{ r: 6, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

