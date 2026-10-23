import { useState } from 'react';
import { CloudUpload, ChevronDown, AlertTriangle, Trash2, RotateCw, Clock } from 'lucide-react';
import { discardAction, retryAction } from './outbox';
import { useOutbox } from './useOutbox';

const time = (iso) => new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

/*
 * Crew screens: what's waiting to be sent (no signal) and anything the server refused.
 * Waiting actions go by themselves when the signal is back; refused ones show the reason and can be
 * retried or discarded (e.g. the office reassigned the job meanwhile).
 */
export default function OutboxBar({ online }) {
  const items = useOutbox();
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  const failed = items.filter((e) => e.state === 'failed');
  const waiting = items.length - failed.length;
  const tone = failed.length ? 'bg-red-50 border-red-200 text-red-900' : 'bg-amber-50 border-amber-200 text-amber-900';

  return (
    <section className={`mb-4 rounded-2xl border ${tone}`} aria-label="Waiting to send">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="w-full flex items-center gap-3 p-3.5 bg-transparent border-none cursor-pointer text-left text-inherit">
        {failed.length ? <AlertTriangle size={19} className="shrink-0" /> : <CloudUpload size={19} className="shrink-0" />}
        <span className="flex-1 text-sm leading-snug">
          {waiting > 0 && <><b>{waiting} waiting to send.</b> {online ? 'Sending now…' : 'They go by themselves when you have signal.'}</>}
          {waiting > 0 && failed.length > 0 && ' '}
          {failed.length > 0 && <b>{failed.length} not accepted. Tap to see why.</b>}
        </span>
        <ChevronDown size={18} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul className="m-0 px-3.5 pb-3.5 list-none flex flex-col gap-2">
          {items.map((e) => (
            <li key={e.id} className="bg-white rounded-xl border border-slate-200 p-3 text-slate-800">
              <div className="flex items-start gap-2">
                <Clock size={15} className="shrink-0 mt-0.5 text-slate-400" />
                <div className="flex-1 min-w-0">
                  <p className="m-0 text-sm font-semibold">{e.label}</p>
                  <p className="m-0 text-xs text-slate-500">{e.kind === 'photo' ? 'Taken' : 'Tapped'} at {time(e.at)} · {e.state === 'failed' ? 'not accepted' : 'waiting'}</p>
                  {e.error && <p className="m-0 mt-1 text-xs font-semibold text-red-700">{e.error}</p>}
                </div>
              </div>
              {e.state === 'failed' && (
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => retryAction(e.id)}
                    className="min-h-[40px] px-3 rounded-lg border border-slate-300 bg-white text-sm font-bold text-slate-700 cursor-pointer inline-flex items-center gap-1.5">
                    <RotateCw size={14} /> Try again
                  </button>
                  <button type="button" onClick={() => { if (window.confirm(`Discard "${e.label}"? It will not be sent.`)) discardAction(e.id); }}
                    className="min-h-[40px] px-3 rounded-lg border border-red-200 bg-white text-sm font-bold text-red-700 cursor-pointer inline-flex items-center gap-1.5">
                    <Trash2 size={14} /> Discard
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
