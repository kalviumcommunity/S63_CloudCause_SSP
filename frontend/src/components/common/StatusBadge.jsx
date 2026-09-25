import React from 'react';
import { getStatusTheme } from '../../utils/formatters';

export default function StatusBadge({ status, size = 'md' }) {
  const isSmall = size === 'sm';

  // Handle Deployment specific statuses
  if (status === 'Success') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
        Success
      </span>
    );
  }

  if (status === 'Failed') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
        Failed
      </span>
    );
  }

  if (status === 'In Progress') {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 animate-pulse"></span>
        In Progress
      </span>
    );
  }

  // Cost status (Cost Spike, Increased, Normal)
  const theme = getStatusTheme(status);

  return (
    <span className={`inline-flex items-center rounded-full font-medium border ${theme.bg} ${
      isSmall ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
    }`}>
      <span className={`rounded-full mr-1.5 ${theme.dot} ${
        status === 'Cost Spike' ? 'w-2 h-2 animate-pulse' : 'w-1.5 h-1.5'
      }`}></span>
      {status}
    </span>
  );
}

