import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/* Numbered pages for the staff work queues ("Showing 26–50 of 1,740", 1 … 4 5 6 … 20).
   `meta` is the paged API response: { count, page, pages, page_size }. */
export default function Pager({ meta, onPage }) {
  if (!meta || meta.count === 0) return null;
  const { page, pages, count, page_size } = meta;
  const from = (page - 1) * page_size + 1;
  const to = Math.min(count, page * page_size);
  const nums = [...new Set([1, page - 1, page, page + 1, pages])].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
  const btn = 'min-w-[36px] h-9 px-2 rounded-lg text-sm font-semibold border cursor-pointer disabled:opacity-40 disabled:cursor-default';
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <p className="text-xs text-slate-500">Showing <b className="text-slate-700">{from}–{to}</b> of <b className="text-slate-700">{count.toLocaleString()}</b></p>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <button className={`${btn} bg-white border-slate-200 text-slate-600`} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} className="mx-auto" /></button>
          {nums.map((n, i) => (
            <React.Fragment key={n}>
              {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
              <button className={`${btn} ${n === page ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined}>{n}</button>
            </React.Fragment>
          ))}
          <button className={`${btn} bg-white border-slate-200 text-slate-600`} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={16} className="mx-auto" /></button>
        </div>
      )}
    </div>
  );
}
