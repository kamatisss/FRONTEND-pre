import { Bell, X } from 'lucide-react';
import { dismissAllChanges, dismissChange } from './jobChanges';
import { useJobChanges } from './useOutbox';

/* Crew Today/Jobs: what the office changed in your jobs since you last checked (crew/jobChanges.js). */
export default function JobChangesCard({ onOpenJob }) {
  const items = useJobChanges();
  if (!items.length) return null;
  return (
    <section className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 text-sky-950" aria-labelledby="job-changes-title">
      <div className="flex items-center gap-2 px-3.5 pt-3">
        <Bell size={17} className="shrink-0 text-sky-700" />
        <h2 id="job-changes-title" className="m-0 flex-1 text-sm font-extrabold">Changed since you last checked</h2>
        {items.length > 1 && (
          <button type="button" onClick={dismissAllChanges}
            className="min-h-[36px] px-2 bg-transparent border-none text-xs font-bold text-sky-800 underline cursor-pointer">Got it, all</button>
        )}
      </div>
      <ul className="m-0 p-3.5 pt-2 list-none flex flex-col gap-2">
        {items.map((c) => (
          <li key={c.key} className="flex items-start gap-2 bg-white rounded-xl border border-sky-100 p-2.5">
            <p className="m-0 flex-1 text-sm leading-snug">{c.text}</p>
            {c.kind !== 'removed' && c.kind !== 'cancelled' && onOpenJob && (
              <button type="button" onClick={() => { dismissChange(c.key); onOpenJob(c.bookingId); }}
                className="min-h-[36px] px-2.5 rounded-lg bg-sky-700 border-none text-white text-xs font-bold cursor-pointer shrink-0">Open</button>
            )}
            <button type="button" onClick={() => dismissChange(c.key)} aria-label="Dismiss"
              className="w-9 h-9 rounded-lg bg-transparent border-none text-slate-400 hover:text-slate-700 cursor-pointer inline-flex items-center justify-center shrink-0">
              <X size={16} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
