import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { formatCurrency } from '../../utils/formatters';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

const CustomBarTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-xl text-xs border border-slate-700">
        <div className="font-semibold text-slate-200">{data.service_name}</div>
        <div className="text-sm font-bold text-white mt-1">{formatCurrency(data.totalCost)}</div>
        <div className="text-slate-400 mt-0.5">{data.percentage}% of total cloud spend</div>
      </div>
    );
  }
  return null;
};

export default function ServiceBreakdownChart({ data = [], height = 280 }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 flex items-center justify-center h-64 text-slate-400 text-sm">
        No breakdown data available
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">Spend by Cloud Service</h3>
        <p className="text-xs text-slate-500 mt-0.5">Distribution of total expenditure across services</p>
      </div>

      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis
              type="number"
              tickFormatter={(v) => `$${v}`}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="service_name"
              tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <Tooltip content={<CustomBarTooltip />} />
            <Bar dataKey="totalCost" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

