import React from 'react';

export function LoadingSpinner({ message = 'Loading cloud data...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-3">
      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm font-medium text-slate-500">{message}</p>
    </div>
  );
}

export function EmptyState({ title = 'No records found', description = 'Try adjusting your filters or search criteria.', action }) {
  return (
    <div className="text-center py-12 px-4 bg-white rounded-xl border border-dashed border-slate-300">
      <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        🔍
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

