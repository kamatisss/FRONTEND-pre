import { useEffect, useState } from 'react';
import { Clock, Loader2 } from 'lucide-react';
import api from '../services/api';

/*
 * "Forgot to clock out?" — shifts still open long after any real shift would have ended (BACKEND
 * field_work.forgotten_shifts: over 16 hours). Left alone they count every hour until the person
 * remembers, and the crew app would treat them as on shift. The owner sets the real end time
 * (POST /api/attendance/<id>/close_shift/): the shift keeps who closed it and why; the activity log too.
 */
const MAX_HOURS = 16;           // same as the server (field_work.OPEN_SHIFT_MAX_HOURS)
const NORMAL_HOURS = 8;         // a first guess for the end time

const pad = (n) => String(n).padStart(2, '0');
const toInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const when = (iso) => new Date(iso).toLocaleString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function ForgottenShifts({ onClosed, highlight = false }) {
  const [shifts, setShifts] = useState(null);
  const [editing, setEditing] = useState(null);   // { id, end, note }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get('/attendance/', { params: { forgotten: 1 } }).then(r => setShifts(r.data)).catch(() => setShifts([]));
  useEffect(() => { load(); }, []);

  if (!shifts?.length) return null;

  const start = (s) => {
    const inAt = new Date(s.clock_in_time);
    const guess = new Date(Math.min(inAt.getTime() + NORMAL_HOURS * 3600e3, Date.now() - 60e3));
    setError('');
    setEditing({ id: s.id, end: toInput(guess), note: 'Forgot to clock out' });
  };
  const save = async (s) => {
    setBusy(true); setError('');
    try {
      await api.post(`/attendance/${s.id}/close_shift/`, { clock_out_time: new Date(editing.end).toISOString(), note: editing.note });
      setEditing(null);
      await load();
      onClosed?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not close the shift. Try again.');
    } finally { setBusy(false); }
  };

  return (
    <section aria-labelledby="forgotten-title"
      className={`mb-5 rounded-2xl border bg-amber-50 p-4 ${highlight ? 'border-amber-400 ring-2 ring-amber-200' : 'border-amber-200'}`}>
      <h2 id="forgotten-title" className="m-0 text-[15px] font-extrabold text-amber-900 flex items-center gap-2">
        <Clock size={17} /> Forgot to clock out? ({shifts.length})
      </h2>
      <p className="m-0 mt-1 text-sm text-amber-900/80">
        These shifts have been open for over {MAX_HOURS} hours, so their hours are wrong. Set when each one really ended.
      </p>
      <ul className="m-0 mt-3 p-0 list-none flex flex-col gap-2">
        {shifts.map(s => {
          const inAt = new Date(s.clock_in_time);
          const max = new Date(Math.min(inAt.getTime() + MAX_HOURS * 3600e3, Date.now()));
          const open = editing?.id === s.id;
          return (
            <li key={s.id} className="bg-white border border-amber-200 rounded-xl p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="m-0 text-sm font-bold text-slate-900">{s.staff_name}</p>
                  <p className="m-0 text-xs text-slate-500">Clocked in {when(s.clock_in_time)}{s.booking_label ? ` · ${s.booking_label}` : ''}</p>
                </div>
                {!open && (
                  <button type="button" onClick={() => start(s)}
                    className="min-h-[44px] px-4 rounded-xl bg-slate-900 text-white text-sm font-bold border-none cursor-pointer">Close shift</button>
                )}
              </div>
              {open && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-2 items-end">
                  <label className="text-xs font-bold text-slate-600">Ended at
                    <input type="datetime-local" value={editing.end} min={toInput(inAt)} max={toInput(max)}
                      onChange={e => setEditing(v => ({ ...v, end: e.target.value }))}
                      className="block mt-1 w-full min-h-[44px] px-2 rounded-lg border border-slate-300 text-sm" />
                  </label>
                  <label className="text-xs font-bold text-slate-600">Note
                    <input value={editing.note} maxLength={200} onChange={e => setEditing(v => ({ ...v, note: e.target.value }))}
                      className="block mt-1 w-full min-h-[44px] px-2 rounded-lg border border-slate-300 text-sm" />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditing(null)}
                      className="min-h-[44px] px-3 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-600 cursor-pointer">Cancel</button>
                    <button type="button" onClick={() => save(s)} disabled={busy || !editing.end}
                      className="min-h-[44px] px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold border-none cursor-pointer disabled:opacity-60 inline-flex items-center gap-1.5">
                      {busy && <Loader2 size={15} className="animate-spin" />} Save
                    </button>
                  </div>
                  {error && <p role="alert" className="m-0 sm:col-span-3 text-xs font-semibold text-red-700">{error}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
