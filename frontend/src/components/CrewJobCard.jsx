import { useRef, useState } from 'react';
import {
  Navigation, Phone, StickyNote, Play, LogOut, Camera, Check, Lock, Layers, Eye, FileText, Loader2, AlertTriangle,
  Car, PackageCheck, ChevronDown, ChevronUp, RotateCcw, Flag,
} from 'lucide-react';
import ProgressPhotos from './ProgressPhotos';
import ProblemSheet from './ui/ProblemSheet';
import { uploadProgressPhoto } from '../services/api';
import { SERVICE, TIME, statusOf, dayLabel, clockTime, navUrl as mapsUrl, telOf } from '../data/crewJobs';
import { productImage } from '../data/productImage';
import { sendAction } from '../crew/outbox';

/*
 * One crew job, phone-first. Top to bottom: who and when → where (Navigate / Call) → the customer's
 * notes → start or end the shift on this job → the crew's three stages (one photo each) → photos →
 * submit for sign-off (with what's still missing) → design and work order as secondary actions.
 * The rules mirror BACKEND apps/library/field_work.py.
 */

const STAGES = [
  { key: 'site_prep',        label: 'Site prep',        hint: 'Photo of the cleared, prepared site', phase: 'DURING' },
  { key: 'installation',     label: 'Installation',     hint: 'Photo of the planting or hardscape in place', phase: 'DURING' },
  { key: 'final_inspection', label: 'Final inspection', hint: 'Photo of the finished garden', phase: 'AFTER' },
];
function locate(timeout = 10000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve(null), { enableHighAccuracy: true, timeout, maximumAge: 30000 });
  });
}

/* ── Start the job / on the job / clock out ─────────────────────────────── */
export function JobShift({ booking, todayIso, activeAttendance, toast, onChanged, refreshActiveAttendance }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const session = activeAttendance?.clocked_in ? activeAttendance.attendance : null;
  const here = session && session.booking === booking.id;
  const elsewhere = session && session.booking !== booking.id;

  const run = async (fn) => {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const start = () => run(async () => {
    const pos = await locate();
    if (!pos && booking.site_lat != null) throw new Error('Turn on location (GPS): this job checks that you are at the site.');
    const res = await sendAction({ label: `Start job #${booking.id}`, path: '/attendance/clock_in/', kind: 'clock_in',
      body: { booking_id: booking.id, ...(pos || {}) }, ref: { bookingId: booking.id } });
    if (res.queued) { toast?.(`No signal: job #${booking.id} start saved with the time and place you tapped. It will be sent when you have signal.`); return; }
    toast?.(`Job #${booking.id} started. You are clocked in.`);
    await Promise.all([refreshActiveAttendance?.(), onChanged?.()]);
  });

  const clockOut = (id) => run(async () => {
    if (!window.confirm(`Clock out of booking #${id}? Do this when you leave the site for the day.`)) return;
    const pos = await locate(6000);
    const res = await sendAction({ label: `Clock out of job #${id}`, path: '/attendance/clock_out/', kind: 'clock_out', body: pos || {} });
    if (res.queued) { toast?.('No signal: clock-out saved with the time you tapped. It will be sent when you have signal.'); return; }
    toast?.('Clocked out. See you next time!');
    await Promise.all([refreshActiveAttendance?.(), onChanged?.()]);
  });

  let body;
  if (here) {
    body = (
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
        <p className="flex-1 m-0 text-sm text-emerald-900"><b>On the job</b> since {clockTime(session.clock_in_time)}{session.pending && <span className="block text-xs text-amber-800 font-semibold">Waiting for signal to send</span>}</p>
        <button type="button" disabled={busy} onClick={() => clockOut(booking.id)}
          className="min-h-[44px] px-4 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-sm font-bold cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50">
          <LogOut size={15} /> Clock out
        </button>
      </div>
    );
  } else if (booking.status === 'Pending') {
    // The job's own state comes first: being clocked in elsewhere only matters for a job you could start now
    body = <p className="m-0 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">Waiting for the office to confirm this booking.</p>;
  } else if (booking.status === 'Preparing' && booking.scheduled_date > todayIso) {
    body = <p className="m-0 text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">Starts {dayLabel(booking.scheduled_date, todayIso)}. You can start it that day.</p>;
  } else if (elsewhere) {
    body = (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <p className="m-0 text-sm text-amber-900">You are clocked in to <b>booking #{session.booking}</b>. Clock out there before starting this one.</p>
        <button type="button" disabled={busy} onClick={() => clockOut(session.booking)}
          className="mt-2 min-h-[44px] px-4 rounded-xl bg-white border border-amber-300 text-amber-900 text-sm font-bold cursor-pointer disabled:opacity-50">
          Clock out of #{session.booking}
        </button>
      </div>
    );
  } else {
    body = (
      <button type="button" disabled={busy} onClick={start}
        className="w-full min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-extrabold border-none cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
        {busy ? 'Checking your location…' : booking.status === 'Installing' ? 'Continue job (clock in)' : 'Start job (clock in)'}
      </button>
    );
  }
  return (
    <div>
      {body}
      {error && <p className="text-sm text-red-700 font-semibold mt-2 mb-0" role="alert">{error}</p>}
    </div>
  );
}

/* ── The crew's three stages: one photo each ────────────────────────────── */
function FieldStages({ booking, api, headers, onChanged, onTheJob }) {
  const [milestones, setMilestones] = useState(() => Object.fromEntries((booking.project_milestones || []).map(m => [m.phase, m])));
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState({});
  const [failed, setFailed] = useState({});   // stage → the photo that didn't upload (retry without retaking)
  const inputs = useRef({});
  const office = milestones.design_contract?.completion_pct === 100;
  const done = STAGES.filter(s => milestones[s.key]?.completion_pct === 100).length;

  const save = async (stage, pct, proof = '') => {
    const r = await fetch(`${api}/bookings/${booking.id}/update_milestone/`, {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: stage.key, completion_pct: pct, proof_photo_url: proof }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Could not save. Check your signal and try again.');
    if (data.milestone) setMilestones(prev => ({ ...prev, [stage.key]: data.milestone }));
    onChanged?.();
  };

  const finishWithPhoto = async (stage, file) => {
    if (!file) return;
    setBusy(stage.key); setError(e => ({ ...e, [stage.key]: '' }));
    try {
      // The proof is saved as a progress photo too (cleaned of GPS data, shown to the office)
      const photo = await uploadProgressPhoto(booking.id, { file, phase: stage.phase, description: `${stage.label} done` });
      await save(stage, 100, photo.file_url);
      setFailed(prev => ({ ...prev, [stage.key]: null }));
    } catch (e) {
      setFailed(prev => ({ ...prev, [stage.key]: file }));
      setError(prev => ({ ...prev, [stage.key]: navigator.onLine === false
        ? 'No signal. Your photo is kept: tap Retry upload when you have signal.'
        : `${e.message || 'Upload failed.'} Your photo is kept: tap Retry upload.` }));
    }
    setBusy(null);
  };

  const undo = async (stage) => {
    setBusy(stage.key);
    try { await save(stage, 0); } catch (e) { setError(prev => ({ ...prev, [stage.key]: e.message })); }
    setBusy(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="m-0 text-xs font-extrabold tracking-wider uppercase text-slate-500">Your stages</p>
        <p className="m-0 text-sm font-bold text-slate-700">{done} of {STAGES.length} done</p>
      </div>
      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(done / STAGES.length) * 100}%` }} />
      </div>
      <p className="m-0 text-xs text-slate-500 flex items-center gap-1.5">
        {office ? <Check size={13} className="text-emerald-600" /> : <Lock size={12} />}
        Design & contract {office ? 'confirmed by the office' : 'not yet confirmed by the office'}
      </p>
      {STAGES.map((stage, i) => {
        const m = milestones[stage.key];
        const isDone = m?.completion_pct === 100;
        const saving = busy === stage.key;
        return (
          <div key={stage.key} className={`rounded-xl border p-3 ${isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center gap-3">
              <span className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm font-black ${isDone ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {isDone ? <Check size={15} strokeWidth={3} /> : i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`m-0 text-[15px] font-bold ${isDone ? 'text-emerald-900' : 'text-slate-900'}`}>{stage.label}</p>
                {!isDone && <p className="m-0 text-xs text-slate-500">{stage.hint}</p>}
              </div>
              {isDone && onTheJob && (
                <button type="button" disabled={saving} onClick={() => undo(stage)}
                  className="min-h-[40px] px-2 bg-transparent border-none text-xs font-semibold text-slate-500 underline cursor-pointer">
                  {saving ? 'Saving…' : 'Undo'}
                </button>
              )}
              {isDone && m?.proof_photo_url && (
                <a href={m.proof_photo_url} target="_blank" rel="noopener noreferrer"
                  className="min-h-[40px] px-3 inline-flex items-center gap-1 rounded-lg bg-white border border-emerald-200 text-emerald-800 text-xs font-bold no-underline">
                  <Camera size={13} /> Photo
                </a>
              )}
            </div>
            {!isDone && onTheJob && (
              <>
                <input ref={el => { inputs.current[stage.key] = el; }} type="file" accept="image/*" capture="environment" hidden
                  onChange={e => { finishWithPhoto(stage, e.target.files?.[0]); e.target.value = ''; }} />
                <button type="button" disabled={saving} onClick={() => inputs.current[stage.key]?.click()}
                  className="mt-3 w-full min-h-[48px] rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold border-none cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <><Loader2 size={16} className="animate-spin" /> Uploading photo…</> : <><Camera size={16} /> Take photo &amp; finish</>}
                </button>
              </>
            )}
            {!isDone && !onTheJob && (
              <p className="m-0 mt-2 text-xs text-slate-500 flex items-center gap-1.5"><Lock size={12} /> Start the job to finish this stage</p>
            )}
            {error[stage.key] && <p className="m-0 mt-2 text-sm text-red-700 font-semibold" role="alert">{error[stage.key]}</p>}
            {failed[stage.key] && !isDone && onTheJob && (
              <button type="button" disabled={saving} onClick={() => finishWithPhoto(stage, failed[stage.key])}
                className="mt-2 w-full min-h-[48px] rounded-xl bg-white border border-slate-300 text-slate-900 text-sm font-bold cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60">
                <RotateCcw size={15} /> Retry upload
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Where this job stands, for the top of the job page ───────────────────── */
export function JobSteps({ booking, onTheJob }) {
  const done = Object.fromEntries((booking.project_milestones || []).map(m => [m.phase, m.completion_pct === 100]));
  const started = onTheJob || ['Installing', 'For Review', 'Finished'].includes(booking.status);
  const steps = [
    { label: 'Start', ok: started },
    ...STAGES.map(st => ({ label: st.label.replace('Final inspection', 'Final'), ok: !!done[st.key] })),
    { label: 'Submit', ok: ['For Review', 'Finished'].includes(booking.status) },
  ];
  const current = steps.findIndex(st => !st.ok);
  return (
    <ol className="flex items-start gap-1 m-0 p-0 list-none" aria-label="Job progress">
      {steps.map((st, i) => (
        <li key={st.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <span className={`w-full h-1.5 rounded-full ${st.ok ? 'bg-emerald-500' : i === current ? 'bg-emerald-200' : 'bg-slate-200'}`} />
          <span className={`text-xs font-bold truncate max-w-full ${st.ok ? 'text-emerald-700' : i === current ? 'text-slate-900' : 'text-slate-400'}`}>
            {st.ok ? '✓ ' : ''}{st.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

/* ── "On my way": tell the customer we're coming ───────────────────────────── */
const ETAS = [15, 30, 45, 60];
export function OnMyWay({ booking, todayIso, api, headers, toast, onChanged }) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState(booking.crew_on_way_at || null);
  const startable = booking.status === 'Installing' || (booking.status === 'Preparing' && booking.scheduled_date <= todayIso);
  if (!startable || !booking.customer_name) return null;
  const toldToday = sentAt && new Date(sentAt).toDateString() === new Date().toDateString();

  const send = async (eta) => {
    setBusy(true);
    try {
      const r = await fetch(`${api}/bookings/${booking.id}/on_my_way/`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ eta_minutes: eta }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not tell the customer.');
      setSentAt(d.crew_on_way_at); setPicking(false);
      toast?.(`${booking.customer_name} has been told you arrive in about ${eta} minutes.`);
      onChanged?.();
    } catch (e) {
      toast?.(navigator.onLine === false ? 'No signal. Try again when you have signal.' : e.message, 'error');
    }
    setBusy(false);
  };

  if (picking) {
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
        <p className="m-0 text-sm font-bold text-sky-900">You arrive in about…</p>
        <div className="grid grid-cols-4 gap-2 mt-2">
          {ETAS.map(m => (
            <button key={m} type="button" disabled={busy} onClick={() => send(m)}
              className="min-h-[48px] rounded-xl bg-white border border-sky-300 text-sky-900 text-sm font-extrabold cursor-pointer disabled:opacity-50">
              {m} min
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setPicking(false)} className="mt-1 min-h-[40px] px-1 bg-transparent border-none text-sm font-semibold text-slate-600 cursor-pointer">Cancel</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => setPicking(true)}
        className="flex-1 min-h-[48px] rounded-xl bg-white border border-sky-300 text-sky-800 text-sm font-bold cursor-pointer inline-flex items-center justify-center gap-2 hover:bg-sky-50">
        <Car size={16} /> {toldToday ? 'Tell again' : "I'm on my way"}
      </button>
      {toldToday && <p className="m-0 text-sm text-slate-600 shrink-0">Customer told at <b>{clockTime(sentAt)}</b></p>}
    </div>
  );
}

/* ── What to bring: tick items off while loading the truck (remembered on this phone) ── */
function WhatToBring({ booking }) {
  const items = booking.materials || [];
  const key = `crew-bring-${booking.id}`;
  const [open, setOpen] = useState(booking.status !== 'Installing');
  const [packed, setPacked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
  });
  if (!items.length) return null;
  const count = items.filter(i => packed[i.product_id]).length;
  const toggle = (id) => setPacked(prev => {
    const next = { ...prev, [id]: !prev[id] };
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage full or blocked: ticks just aren't kept */ }
    return next;
  });
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full min-h-[48px] flex items-center justify-between gap-2 px-3 bg-white border-none cursor-pointer text-left">
        <span className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <PackageCheck size={16} className="text-emerald-600" /> What to bring
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${count === items.length ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
            {count} of {items.length} packed
          </span>
        </span>
        {open ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
      </button>
      {open && (
        <ul className="m-0 p-0 list-none border-t border-slate-100 divide-y divide-slate-100">
          {items.map(i => {
            const img = productImage(i);
            return (
              <li key={i.product_id}>
                <label className="flex items-center gap-3 px-3 min-h-[56px] cursor-pointer">
                  <input type="checkbox" checked={!!packed[i.product_id]} onChange={() => toggle(i.product_id)} className="w-5 h-5 accent-emerald-600 shrink-0" />
                  {img ? <img src={img} alt="" className="w-10 h-10 rounded-lg object-cover bg-slate-100 shrink-0" loading="lazy" />
                    : <span className="w-10 h-10 rounded-lg bg-emerald-50 shrink-0" />}
                  <span className={`flex-1 text-[15px] ${packed[i.product_id] ? 'text-slate-400 line-through' : 'text-slate-900 font-semibold'}`}>{i.name}</span>
                  <span className="text-[15px] font-extrabold text-slate-900 shrink-0">× {i.quantity}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// Same reasons as the server (field_work.JOB_PROBLEMS)
const JOB_PROBLEMS = ['Customer not home', 'Weather (rain or storm)', 'Missing plants or materials',
  'Site is different from the plan', 'Safety concern', 'Other'];

const SECONDARY = 'flex-1 min-h-[44px] rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 hover:bg-slate-50';

/* ── The card ────────────────────────────────────────────────────────────── */
export default function CrewJobCard({
  booking, todayIso, activeAttendance, refreshActiveAttendance, api, headers, toast, user,
  submitting, onSubmit, onOpenDesign, onWorkOrder, onChanged,
}) {
  const bar = statusOf(booking.status);
  const active = ['Preparing', 'Installing'].includes(booking.status);
  const session = activeAttendance?.clocked_in ? activeAttendance.attendance : null;
  const onTheJob = !!session && session.booking === booking.id;
  const navUrl = mapsUrl(booking);
  const phone = telOf(booking);
  const blockers = booking.sign_off_blockers || [];
  const design = booking.design_details;
  const [problem, setProblem] = useState(false);
  const hasAr = !!(design?.reference_image_url || design?.image_url);

  return (
    <article className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className={`${bar.bar} px-4 py-2 flex items-center justify-between text-white`}>
        <span className="text-xs font-black tracking-widest uppercase">{bar.label}</span>
        <span className="text-xs font-bold opacity-80">#{booking.id}</span>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Who and when */}
        <div>
          <p className="m-0 text-lg font-extrabold text-slate-900 leading-tight">{booking.customer_name || 'Customer'}</p>
          <p className="m-0 mt-0.5 text-sm text-slate-600">
            {SERVICE[booking.service_type] || booking.service_type} · <b className="text-slate-800">{dayLabel(booking.scheduled_date, todayIso)}</b>, {TIME[booking.preferred_time] || booking.preferred_time || 'Any time'}
          </p>
        </div>

        {/* Where: one tap to directions or a call */}
        <div className="flex flex-col gap-2">
          <p className="m-0 text-[15px] text-slate-800 leading-snug">{booking.service_address || 'No address on file. Call the customer.'}</p>
          <div className="grid grid-cols-2 gap-2">
            {navUrl ? (
              <a href={navUrl} target="_blank" rel="noopener noreferrer"
                className="min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold no-underline inline-flex items-center justify-center gap-2">
                <Navigation size={16} /> Navigate
              </a>
            ) : <span />}
            {phone ? (
              <a href={`tel:${phone}`}
                className="min-h-[48px] rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-900 text-sm font-bold no-underline inline-flex items-center justify-center gap-2">
                <Phone size={16} /> Call
              </a>
            ) : <span />}
          </div>
        </div>

        {!onTheJob && <OnMyWay booking={booking} todayIso={todayIso} api={api} headers={headers} toast={toast} onChanged={onChanged} />}

        {booking.notes?.trim() && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="m-0 text-xs font-extrabold tracking-wider uppercase text-amber-800 flex items-center gap-1.5"><StickyNote size={13} /> Customer notes</p>
            <p className="m-0 mt-1 text-[15px] text-amber-950 leading-snug whitespace-pre-line">{booking.notes.trim()}</p>
          </div>
        )}

        {booking.status !== 'Cancelled' && booking.status !== 'Finished' && <WhatToBring booking={booking} />}

        {(active || booking.status === 'Pending') && (
          <JobShift booking={booking} todayIso={todayIso} activeAttendance={activeAttendance} api={api} headers={headers}
            toast={toast} onChanged={onChanged} refreshActiveAttendance={refreshActiveAttendance} />
        )}

        {(booking.status === 'Installing' || onTheJob) && (
          <FieldStages booking={booking} api={api} headers={headers} onChanged={onChanged} onTheJob={onTheJob} />
        )}

        {booking.status !== 'Cancelled' && (
          <ProgressPhotos booking={booking} user={user} toast={toast} canUpload={booking.status !== 'Finished'} onUploaded={onChanged} />
        )}

        {booking.status === 'Installing' && (
          blockers.length ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="m-0 text-sm font-bold text-slate-800 flex items-center gap-1.5"><AlertTriangle size={15} className="text-amber-600" /> Before you can submit for sign-off</p>
              <ul className="m-0 mt-1.5 pl-5 text-sm text-slate-700">{blockers.map(b => <li key={b}>{b}</li>)}</ul>
            </div>
          ) : (
            <button type="button" disabled={submitting}
              onClick={() => window.confirm(`Submit booking #${booking.id} as finished? The office will check it and sign it off.`) && onSubmit(booking.id)}
              className="w-full min-h-[52px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-extrabold border-none cursor-pointer inline-flex items-center justify-center gap-2 disabled:opacity-60">
              <Check size={18} strokeWidth={3} /> {submitting ? 'Submitting…' : 'Submit for sign-off'}
            </button>
          )
        )}
        {booking.status === 'For Review' && (
          <p className="m-0 text-sm text-violet-800 bg-violet-50 border border-violet-200 rounded-xl p-3">Submitted. The office will check the work and sign it off.</p>
        )}

        {/* Secondary: the plan and the paperwork (only what this job has, sharing the row evenly) */}
        <div className="flex gap-2 pt-3 border-t border-slate-100">
          {design && (
            <button type="button" onClick={() => onOpenDesign(design, false)} className={SECONDARY}>
              <Layers size={15} /> 3D plan
            </button>
          )}
          {design && hasAr && (
            <button type="button" onClick={() => onOpenDesign(design, true)} className={SECONDARY}>
              <Eye size={15} /> AR view
            </button>
          )}
          <button type="button" onClick={() => onWorkOrder(booking.id)} className={SECONDARY}>
            <FileText size={15} /> Work order
          </button>
        </div>

        {['Pending', 'Preparing', 'Installing'].includes(booking.status) && (
          <button type="button" onClick={() => setProblem(true)}
            className="min-h-[44px] rounded-xl bg-transparent border border-red-200 text-red-700 text-sm font-bold cursor-pointer inline-flex items-center justify-center gap-2 hover:bg-red-50">
            <Flag size={15} /> Report a problem
          </button>
        )}
        {problem && (
          <ProblemSheet subtitle={`Booking #${booking.id} · ${booking.customer_name || 'Customer'}`} reasons={JOB_PROBLEMS}
            url={`${api}/bookings/${booking.id}/report_problem/`} authHeaders={headers} toast={toast}
            successMessage="The office has been told. They will call you or the customer." onClose={() => setProblem(false)} />
        )}
      </div>
    </article>
  );
}
