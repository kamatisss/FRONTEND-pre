import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/*
 * "What went wrong?" bottom sheet for the field crew: pick a reason, add an optional note, and the
 * office is told. Used for deliveries (orders/:id/report_problem) and jobs (bookings/:id/report_problem).
 */
export default function ProblemSheet({ title = 'What went wrong?', subtitle, reasons, url, authHeaders, toast, successMessage, onClose }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const send = async () => {
    setSending(true);
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason, note }),
      });
      if (r.ok) { toast(successMessage || 'The office has been told.'); onClose(); }
      else toast((await r.json().catch(() => ({}))).error || 'Could not send the report.', 'error');
    } catch {
      toast('No connection. Try again when you have signal.', 'error');
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-4" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 m-0">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 m-0 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-lg text-slate-400 hover:text-slate-800 bg-transparent border-none cursor-pointer flex items-center justify-center"><X size={20} /></button>
        </div>
        <div className="space-y-2">
          {reasons.map(p => (
            <label key={p} className={`flex items-center gap-3 px-3 min-h-[48px] rounded-xl border cursor-pointer text-[15px] font-semibold ${reason === p ? 'border-red-300 bg-red-50 text-red-900' : 'border-slate-200 text-slate-700'}`}>
              <input type="radio" name="problem" value={p} checked={reason === p} onChange={() => setReason(p)} className="accent-red-600 w-4 h-4" />
              {p}
            </label>
          ))}
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={500} placeholder="Details for the office (optional)"
          className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-400/40" />
        <button type="button" onClick={send} disabled={!reason || sending}
          className="mt-3 w-full min-h-[52px] rounded-xl bg-red-600 hover:bg-red-700 text-white text-base font-bold border-none cursor-pointer disabled:opacity-40">
          {sending ? 'Sending…' : 'Tell the office'}
        </button>
      </div>
    </div>
  );
}
