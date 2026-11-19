import { useEffect, useState } from 'react';
import { Check, CalendarClock, History } from 'lucide-react';

/* Project progress in the office's job panel (BookingQueue drawer).
   Two measures, shown side by side and never merged (BACKEND project_board.py):
     • Office stage: the project tracker's pipeline status and its %, moved by the office;
     • Crew stages: site preparation, installation, final inspection, completed by the crew.
   Plus the target end date (drives the "Overdue" flag on the Projects page) and the project history. */

const CREW_STAGES = [
  ['site_prep', 'Site preparation'],
  ['installation', 'Installation'],
  ['final_inspection', 'Final inspection'],
];
const OPEN = ['Pending', 'Preparing', 'Installing', 'For Review'];
const SHOWN = 5;

const when = (iso) => new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });

export function Bar({ pct, tone = 'bg-blue-600' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : tone}`} style={{ width: `${Math.min(100, pct || 0)}%` }} />
      </div>
      <span className="text-[11px] font-bold text-slate-500 w-8 text-right">{pct || 0}%</span>
    </div>
  );
}

export default function ProjectTimeline({ api, authHeaders, toast, booking, onChanged }) {
  const t = booking.tracker;
  const [detail, setDetail] = useState(null);
  const [end, setEnd] = useState(t?.estimated_end_date || '');
  const [saving, setSaving] = useState(false);
  const [all, setAll] = useState(false);

  // A fresh copy of the booking resets the box to the saved date
  const saved = t?.estimated_end_date || '';
  const [seenSaved, setSeenSaved] = useState(saved);
  if (saved !== seenSaved) { setSeenSaved(saved); setEnd(saved); }

  // History lives on the tracker detail only (the booking carries a summary)
  useEffect(() => {
    if (!t?.id) return undefined;
    let live = true;
    fetch(`${api}/projects/${t.id}/`, { headers: authHeaders })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => { if (live) setDetail(d); })
      .catch(() => { if (live) setDetail({ failed: true }); });
    return () => { live = false; };
  }, [api, authHeaders, t?.id, t?.status, t?.estimated_end_date]);

  const done = new Set((booking.project_milestones || []).filter(m => m.completion_pct >= 100).map(m => m.phase));
  const crewDone = CREW_STAGES.filter(([id]) => done.has(id)).length;
  const editable = t && OPEN.includes(booking.status);

  const saveEnd = async () => {
    if ((end || null) === (t.estimated_end_date || null)) return;
    setSaving(true);
    try {
      const r = await fetch(`${api}/projects/${t.id}/`, {
        method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ estimated_end_date: end || null }),
      });
      if (!r.ok) throw new Error();
      toast(end ? 'Target end date saved.' : 'Target end date cleared.');
      onChanged?.();
    } catch {
      toast('Could not save the target end date.', 'error');
      setEnd(t.estimated_end_date || '');
    } finally {
      setSaving(false);
    }
  };

  const logs = detail?.history_logs || [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-slate-400">Office stage</p>
          {t ? (
            <>
              <p className="m-0 mt-1 mb-2 text-sm font-bold text-slate-800">{t.status_display}</p>
              <Bar pct={t.progress_percentage} />
            </>
          ) : <p className="m-0 mt-1 text-sm text-slate-500">No project set up yet.</p>}
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="m-0 text-[11px] font-bold uppercase tracking-wider text-slate-400">Crew stages · {crewDone}/{CREW_STAGES.length}</p>
          <ul className="m-0 mt-1.5 p-0 list-none space-y-1">
            {CREW_STAGES.map(([id, label]) => (
              <li key={id} className={`flex items-center gap-2 text-sm ${done.has(id) ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${done.has(id) ? 'bg-emerald-500 text-white' : 'border border-slate-300'}`}>
                  {done.has(id) && <Check size={11} strokeWidth={3} />}
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {t && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[180px]">
            <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1"><CalendarClock size={12} /> Target end date</span>
            <input type="date" value={end || ''} disabled={!editable || saving} onChange={e => setEnd(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm text-slate-800 bg-white disabled:bg-slate-50 disabled:text-slate-500" />
          </label>
          {editable && (end || '') !== (t.estimated_end_date || '') && (
            <button type="button" onClick={saveEnd} disabled={saving}
              className="h-10 px-4 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-none cursor-pointer disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
          <p className="basis-full m-0 text-xs text-slate-500">A job past this date shows as overdue on the Projects page. With no date, the visit date counts.</p>
        </div>
      )}

      {t && (
        <div>
          <p className="m-0 mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400"><History size={12} /> Project history</p>
          {!detail ? <div className="h-12 rounded-xl bg-slate-50 animate-pulse" />
            : detail.failed ? <p className="m-0 text-xs text-slate-500">Could not load the history.</p>
            : !logs.length ? <p className="m-0 text-xs text-slate-500">No changes recorded yet.</p>
            : (
              <>
                <ol className="m-0 p-0 list-none space-y-2.5">
                  {(all ? logs : logs.slice(0, SHOWN)).map(log => (
                    <li key={log.id} className="flex gap-3 text-xs">
                      <span className="w-2 h-2 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="m-0 font-semibold text-slate-700">{log.remarks || log.status_display}</p>
                        <p className="m-0 text-slate-500">{log.status_display} · {log.trigger_user_name || 'System'} · {when(log.timestamp)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                {logs.length > SHOWN && (
                  <button type="button" onClick={() => setAll(v => !v)}
                    className="mt-2 text-xs font-bold text-emerald-700 bg-transparent border-none p-0 cursor-pointer">
                    {all ? 'Show less' : `Show all ${logs.length}`}
                  </button>
                )}
              </>
            )}
        </div>
      )}
    </div>
  );
}
