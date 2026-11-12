// Final design approval (backend design_review.py), one piece per person:
//   OfficeDesignApproval   — booking drawer: adjust in the Studio, send to the customer, record in-person approval
//   CustomerDesignApproval — My Bookings: see the final design in 3D, approve it or ask for changes
//   CrewDesignStatus       — crew job card: is the design they open the final one?
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Layers, Loader, MessageSquare, PenLine, Send, UserCheck, X } from 'lucide-react';
import { designReviewStep } from '../services/api';
import { useToast } from './ui/Toast';
import { toCanvasPlants, peso } from '../data/projectHub';
import {
  TONE_CLASSES, crewReviewText, customerReviewText, fmtReviewDate, officeReviewText,
} from '../data/designApproval';

const ThreeGardenCanvas = lazy(() => import('./ThreeGardenCanvas'));

const BTN = 'inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 rounded-lg text-xs font-bold border cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed';
const PRIMARY = `${BTN} bg-emerald-600 hover:bg-emerald-700 text-white border-transparent`;
const SECONDARY = `${BTN} bg-white hover:bg-slate-50 text-slate-700 border-slate-200`;

function StatusBox({ text, children }) {
  if (!text) return null;
  return (
    <div className={`rounded-xl border p-3 ${TONE_CLASSES[text.tone]}`}>
      <p className="m-0 text-sm font-extrabold">{text.label}</p>
      <p className="m-0 mt-0.5 text-xs leading-relaxed opacity-90">{text.help}</p>
      {children}
    </div>
  );
}

function NoteForm({ label, placeholder, required, busy, submitLabel, Icon, onSubmit, onCancel }) {
  const [note, setNote] = useState('');
  return (
    <form className="mt-2 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); onSubmit(note.trim()); }}>
      <label className="text-xs font-bold text-slate-600">
        {label}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000}
          placeholder={placeholder} required={required}
          className="mt-1 block w-full rounded-lg border border-slate-200 p-2 text-sm font-normal text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={PRIMARY} disabled={busy || (required && !note.trim())}>
          {busy ? <Loader size={14} className="animate-spin" /> : <Icon size={14} />} {submitLabel}
        </button>
        <button type="button" className={SECONDARY} onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

function StepsList({ steps }) {
  if (!steps?.length) return null;
  return (
    <details className="mt-2 text-xs text-slate-600">
      <summary className="cursor-pointer font-bold text-slate-500">History ({steps.length})</summary>
      <ol className="m-0 mt-1.5 pl-4 flex flex-col gap-1">
        {steps.map((s) => (
          <li key={s.id}>
            <span className="font-semibold text-slate-700">{s.label}</span> · version {s.revision} · {fmtReviewDate(s.at)}
            {s.by && ` · ${s.by}`}
            {s.note && <span className="block text-slate-500">“{s.note}”</span>}
          </li>
        ))}
      </ol>
    </details>
  );
}

/* ─── Office: booking drawer ─────────────────────────────────────────────── */
export function OfficeDesignApproval({ booking, onChanged }) {
  const toast = useToast();
  const [form, setForm] = useState(null);        // 'send' | 'approved_in_person'
  const [busy, setBusy] = useState(false);
  const review = booking?.design_review;
  const text = officeReviewText(review);
  if (!booking?.design_details || !text) return null;
  const open = !['Finished', 'Cancelled'].includes(booking.status);
  const lastChanges = review.state === 'changes' ? review.steps?.find(s => s.kind === 'changes') : null;

  const run = async (step, note) => {
    setBusy(true);
    try {
      const updated = await designReviewStep(booking.id, step, { note });
      toast({ type: 'success', title: step === 'send' ? 'Sent to the customer' : 'Approval recorded',
        message: step === 'send' ? 'They were notified to review and approve the design.' : 'The crew will see this design as final.' });
      setForm(null);
      onChanged?.(updated);
    } catch (e) {
      toast({ type: 'error', title: "Couldn't update the design approval", message: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <StatusBox text={text}>
        {lastChanges && <p className="m-0 mt-2 text-xs text-slate-800 bg-white/70 rounded-lg p-2">“{lastChanges.note}”</p>}
      </StatusBox>
      {open && !form && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Link to={`/studio?design_id=${booking.design_details.id}`} className={`${SECONDARY} no-underline`}>
            <PenLine size={14} /> Adjust in Studio
          </Link>
          {review.state !== 'sent' && review.state !== 'approved' && (
            <button type="button" className={PRIMARY} onClick={() => setForm('send')}><Send size={14} /> Send to customer</button>
          )}
          {review.state !== 'approved' && (
            <button type="button" className={SECONDARY} onClick={() => setForm('approved_in_person')}>
              <UserCheck size={14} /> Approved in person
            </button>
          )}
        </div>
      )}
      {form === 'send' && (
        <NoteForm label="What changed after the site visit? (the customer sees this)" Icon={Send} submitLabel="Send for approval"
          placeholder="e.g. Moved the palm 1 m from the wall: there's a water pipe there." busy={busy}
          onSubmit={(note) => run('send', note)} onCancel={() => setForm(null)} />
      )}
      {form === 'approved_in_person' && (
        <NoteForm label="How did the customer approve it?" required Icon={UserCheck} submitLabel="Record approval"
          placeholder="e.g. Signed the printed plan at the site visit, Nov 12." busy={busy}
          onSubmit={(note) => run('approved_in_person', note)} onCancel={() => setForm(null)} />
      )}
      <StepsList steps={review.steps} />
    </div>
  );
}

/* ─── Customer: My Bookings ──────────────────────────────────────────────── */
export function CustomerDesignApproval({ booking, initiallyOpen = false, onChanged }) {
  const [open, setOpen] = useState(initiallyOpen);
  const review = booking?.design_review;
  const text = customerReviewText(review);
  if (!booking?.design_details || !text) return null;
  const canView = ['sent', 'approved'].includes(review.state);
  return (
    <div className="mt-4">
      <StatusBox text={text}>
        {canView && (
          <button type="button" onClick={() => setOpen(true)} className={`${review.state === 'sent' ? PRIMARY : SECONDARY} mt-2`}>
            <Layers size={14} /> {review.state === 'sent' ? 'Review final design' : 'View final design'}
          </button>
        )}
      </StatusBox>
      {open && canView && <CustomerReviewModal booking={booking} onClose={() => setOpen(false)} onChanged={onChanged} />}
    </div>
  );
}

function CustomerReviewModal({ booking, onClose, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const design = booking.design_details;
  const review = booking.design_review;
  const dims = design.dimensions || {};
  const waiting = review.state === 'sent';
  const rows = (design.plant_breakdown || []).filter(r => r && r.quantity > 0);
  const canAskChanges = ['Pending', 'Preparing'].includes(booking.status);

  const run = async (step, opts) => {
    setBusy(true);
    try {
      const updated = await designReviewStep(booking.id, step, opts);
      toast({ type: 'success', title: step === 'approve' ? 'Design approved' : 'Sent to our designer',
        message: step === 'approve' ? 'Our crew will build this design.' : "We'll update the design and send it back to you." });
      onChanged?.(updated);
      onClose();
    } catch (e) {
      toast({ type: 'error', title: "Couldn't send your answer", message: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'rgba(2,6,23,0.72)' }}
      onClick={onClose} role="dialog" aria-modal="true" aria-label="Final garden design">
      <div className="bg-white w-full sm:max-w-3xl max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
          <div className="min-w-0">
            <p className="m-0 font-extrabold text-slate-900 truncate">{design.name || 'Your garden design'}</p>
            <p className="m-0 text-xs text-slate-500">Final design · version {design.revision}{dims.width ? ` · ${dims.width} m × ${dims.length} m` : ''}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-10 h-10 rounded-lg text-slate-500 hover:bg-slate-100 bg-transparent border-none cursor-pointer flex items-center justify-center shrink-0">
            <X size={20} />
          </button>
        </div>
        {review.sent_note && (
          <div className="mx-4 mt-3 rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-sm text-emerald-900">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-0.5">What we changed</span>
            {review.sent_note}
          </div>
        )}
        <div className="mt-3" style={{ height: 'min(55vh, 420px)' }}>
          <Suspense fallback={<div className="h-full flex items-center justify-center text-slate-400 text-sm"><Loader size={18} className="animate-spin mr-2" /> Loading 3D view…</div>}>
            <ThreeGardenCanvas
              plants={toCanvasPlants(design.placed_items, dims.width || 10, dims.length || 15)}
              lotWidth={dims.width || 10}
              lotLength={dims.length || 15}
              gardenPlan={dims.gardenPlan}
              survey={dims.siteSurvey}
              groundcover={dims.groundcover}
              readOnly
            />
          </Suspense>
        </div>
        <div className="p-4 flex flex-col gap-3">
          {rows.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-bold text-slate-700">What's in it ({rows.reduce((n, r) => n + r.quantity, 0)} items)</summary>
              <ul className="m-0 mt-2 pl-0 list-none grid gap-1 text-sm text-slate-700" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))' }}>
                {rows.map(r => <li key={r.plant_id}>{r.quantity} × {r.name}</li>)}
              </ul>
            </details>
          )}
          {design.total_cost > 0 && <p className="m-0 text-xs text-slate-500">Design estimate {peso(design.total_cost)}. Your project price is on your booking.</p>}
          {waiting && !asking && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={PRIMARY} disabled={busy}
                onClick={() => run('approve', { revision: design.revision })}>
                {busy ? <Loader size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Approve this design
              </button>
              {canAskChanges && (
                <button type="button" className={SECONDARY} disabled={busy} onClick={() => setAsking(true)}>
                  <MessageSquare size={14} /> Ask for changes
                </button>
              )}
            </div>
          )}
          {waiting && asking && (
            <NoteForm label="What would you like changed?" required Icon={Send} submitLabel="Send to our designer" busy={busy}
              placeholder="e.g. Could we keep two palms by the gate?"
              onSubmit={(note) => run('changes', { note })} onCancel={() => setAsking(false)} />
          )}
          {!waiting && (
            <p className="m-0 text-sm text-emerald-800 font-semibold flex items-center gap-1.5">
              <CheckCircle2 size={16} /> You approved this design on {fmtReviewDate(review.approved_at)}.
              {canAskChanges && (
                <button type="button" className="ml-1 text-xs font-bold text-slate-600 underline bg-transparent border-none cursor-pointer p-0"
                  onClick={() => setAsking(true)}>Need a change?</button>
              )}
            </p>
          )}
          {!waiting && asking && (
            <NoteForm label="What would you like changed?" required Icon={Send} submitLabel="Send to our designer" busy={busy}
              placeholder="Tell us what to change. We'll send you an updated design to approve."
              onSubmit={(note) => run('changes', { note })} onCancel={() => setAsking(false)} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Crew: job card ─────────────────────────────────────────────────────── */
export function CrewDesignStatus({ review }) {
  const text = crewReviewText(review);
  if (!text) return null;
  return (
    <p className={`m-0 mt-2 rounded-lg border px-2.5 py-1.5 text-xs ${TONE_CLASSES[text.tone]}`}>
      <span className="font-extrabold">{text.label}.</span> {text.help}
    </p>
  );
}
