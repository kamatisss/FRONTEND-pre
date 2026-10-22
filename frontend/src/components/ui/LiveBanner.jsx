import React from 'react';
import { BellRing, RefreshCw } from 'lucide-react';

/* "3 new orders arrived · Show them" — or, when other staff changed this queue, a quiet
   "This list was updated" — without reloading rows under the user's mouse. */
export default function LiveBanner({ fresh, stale, noun, onShow }) {
  if (!fresh && !stale) return null;
  const text = fresh
    ? `${fresh} new ${noun}${fresh > 1 ? 's' : ''} arrived`
    : 'This list was updated by someone else';
  return (
    <div role="status" className="flex items-center gap-3 px-3 md:px-4 py-2.5 bg-emerald-50 border-b border-emerald-100">
      {fresh ? <BellRing size={16} className="text-emerald-700 shrink-0" /> : <RefreshCw size={15} className="text-emerald-700 shrink-0" />}
      <span className="text-sm font-semibold text-emerald-900 flex-1">{text}</span>
      <button onClick={onShow} className="h-8 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-none cursor-pointer">
        {fresh ? 'Show them' : 'Refresh'}
      </button>
    </div>
  );
}
