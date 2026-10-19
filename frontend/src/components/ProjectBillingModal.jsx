import { useEffect, useState } from 'react';
import { X, Wallet, History, Flag } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════
   PROJECT & BILLING — office-admin view of a booking's ProjectTracker
   ─────────────────────────────────────────────────────────────────────
   • Contract price (paid amount is preserved when the price changes)
   • Record payments → reduces the balance, logged in the audit history
   • Advance the project stage, with remarks
   • Immutable history log (stage changes, payments, price changes)
   ═══════════════════════════════════════════════════════════════════════ */

// Mirrors ProjectTracker.STATUS_CHOICES in the backend
export const PROJECT_STAGES = [
  ['PENDING', 'Pending'],
  ['CONSULTATION_SCHEDULED', 'Consultation Scheduled'],
  ['SITE_INSPECTION', 'Site Inspection'],
  ['QUOTATION_APPROVED', 'Quotation Approved'],
  ['DESIGN_PREPARATION', 'Design Preparation'],
  ['DESIGN_APPROVED', 'Design Approved'],
  ['PROJECT_SCHEDULED', 'Project Scheduled'],
  ['MATERIALS_PREPARATION', 'Materials Preparation'],
  ['PROJECT_STARTED', 'Project Started'],
  ['SITE_PREPARATION', 'Site Preparation'],
  ['PLANTING', 'Planting'],
  ['HARDSCAPE_INSTALLATION', 'Hardscape Installation'],
  ['LIGHTING_INSTALLATION', 'Lighting Installation'],
  ['DECORATION', 'Decoration'],
  ['FINAL_INSPECTION', 'Final Inspection'],
  ['COMPLETED', 'Completed'],
  ['CUSTOMER_FEEDBACK', 'Customer Feedback'],
];

const peso = (v) => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ProjectBillingModal({ booking, apiBase, headers, onClose, onChanged, toast }) {
  const trackerId = booking.tracker?.id;
  const [tracker, setTracker] = useState(null);
  const [loading, setLoading] = useState(!!trackerId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [priceInput, setPriceInput] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [stage, setStage] = useState('');
  const [stageNote, setStageNote] = useState('');

  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };
  const estimate = Number(booking.design_details?.total_cost || 0);

  const applyTracker = (t) => {
    setTracker(t);
    setPriceInput(String(Number(t.total_price)));
    setStage(t.status);
  };

  useEffect(() => {
    if (!trackerId) return;
    fetch(`${apiBase}/projects/${trackerId}/`, { headers })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(applyTracker)
      .catch(() => setError('Could not load the project tracker.'))
      .finally(() => setLoading(false));
  }, [trackerId]);

  // Runs a request; on success refreshes this view and the booking list
  const run = async (request, successMsg) => {
    setBusy(true);
    setError('');
    try {
      const res = await request();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || data.detail || data.remaining_balance?.[0] || data.non_field_errors?.[0]
          || Object.values(data)[0]?.[0] || 'Request failed.';
        setError(msg);
        return false;
      }
      const fresh = await fetch(`${apiBase}/projects/${data.id ?? tracker?.id}/`, { headers }).then((r) => r.json());
      applyTracker(fresh);
      toast?.(successMsg);
      onChanged?.();
      return true;
    } catch {
      setError('Network error — please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createTracker = () => run(
    () => fetch(`${apiBase}/projects/`, {
      method: 'POST', headers: jsonHeaders,
      body: JSON.stringify({ booking: booking.id, total_price: estimate, remaining_balance: estimate }),
    }),
    'Project tracker created.',
  );

  const savePrice = () => {
    const newTotal = Number(priceInput);
    if (!Number.isFinite(newTotal) || newTotal < 0) { setError('Enter a valid contract price.'); return; }
    const paid = Number(tracker.total_price) - Number(tracker.remaining_balance);
    if (newTotal < paid) { setError(`Price can't be lower than the ${peso(paid)} already paid.`); return; }
    // Keep what the customer already paid; the balance absorbs the change
    run(() => fetch(`${apiBase}/projects/${tracker.id}/`, {
      method: 'PATCH', headers: jsonHeaders,
      body: JSON.stringify({ total_price: newTotal.toFixed(2), remaining_balance: (newTotal - paid).toFixed(2) }),
    }), 'Contract price updated.');
  };

  const recordPayment = async () => {
    const ok = await run(() => fetch(`${apiBase}/projects/${tracker.id}/record-payment/`, {
      method: 'POST', headers: jsonHeaders, body: JSON.stringify({ amount: payAmount, remarks: payNote }),
    }), 'Payment recorded.');
    if (ok) { setPayAmount(''); setPayNote(''); }
  };

  const updateStage = async () => {
    const ok = await run(() => fetch(`${apiBase}/projects/${tracker.id}/update-status/`, {
      method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ status: stage, remarks: stageNote }),
    }), 'Project stage updated.');
    if (ok) setStageNote('');
  };

  const total = Number(tracker?.total_price || 0);
  const balance = Number(tracker?.remaining_balance || 0);
  const paid = total - balance;
  const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const completing = ['COMPLETED', 'CUSTOMER_FEEDBACK'].includes(stage) && stage !== tracker?.status;

  const input = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 bg-white';
  const btn = 'px-4 py-2 text-sm font-bold rounded-lg border-none cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-start justify-between gap-4 z-10">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800 m-0">Project & Billing</h3>
            <p className="text-xs text-slate-500 m-0 mt-0.5 capitalize">
              Booking #{booking.id} · {booking.service_type} · {booking.customer_name}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg bg-transparent border-none cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && <p className="text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 m-0">{error}</p>}
          {loading && <p className="text-sm text-slate-500">Loading project…</p>}

          {!loading && !tracker && (
            <div className="text-center py-6">
              <p className="text-sm text-slate-600 mb-1">This booking was created before project billing existed.</p>
              <p className="text-xs text-slate-400 mb-4">
                {estimate > 0 ? `It will start at the design estimate of ${peso(estimate)}; you can change it after.` : 'It will start at ₱0; set the contract price after.'}
              </p>
              <button onClick={createTracker} disabled={busy} className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white`}>
                {busy ? 'Creating…' : 'Set up project billing'}
              </button>
            </div>
          )}

          {tracker && (
            <>
              {/* Billing summary */}
              <section>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Wallet size={13} /> Billing</h4>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[['Contract price', total], ['Paid', paid], ['Balance', balance]].map(([label, v]) => (
                    <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide m-0">{label}</p>
                      <p className={`text-base font-extrabold m-0 mt-0.5 ${label === 'Balance' && v > 0 ? 'text-amber-700' : 'text-slate-800'}`}>{peso(v)}</p>
                    </div>
                  ))}
                </div>
                <div className="h-2 bg-emerald-100 rounded-full overflow-hidden mb-1" role="meter" aria-valuenow={paidPct} aria-valuemin={0} aria-valuemax={100} aria-label="Paid">
                  <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${paidPct}%` }} />
                </div>
                <p className="text-xs text-slate-500 m-0">{paidPct}% paid</p>

                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 block">Contract price (₱)</label>
                    <div className="flex gap-2">
                      <input type="number" min="0" step="0.01" value={priceInput} onChange={(e) => setPriceInput(e.target.value)} className={input} />
                      <button onClick={savePrice} disabled={busy || Number(priceInput) === total} className={`${btn} bg-slate-800 hover:bg-slate-900 text-white shrink-0`}>Save</button>
                    </div>
                    {estimate > 0 && <p className="text-[11px] text-slate-400 m-0">Design estimate: {peso(estimate)}</p>}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 block">Record a payment (₱)</label>
                    <input type="number" min="0" step="0.01" placeholder={balance > 0 ? `Up to ${peso(balance)}` : 'Fully paid'}
                      value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={input} disabled={balance <= 0} />
                    <div className="flex gap-2">
                      <input type="text" placeholder="Note (e.g. Downpayment, GCash ref)" value={payNote}
                        onChange={(e) => setPayNote(e.target.value)} className={input} disabled={balance <= 0} maxLength={120} />
                      <button onClick={recordPayment} disabled={busy || !(Number(payAmount) > 0)} className={`${btn} bg-emerald-600 hover:bg-emerald-700 text-white shrink-0`}>Record</button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Stage */}
              <section className="border-t border-slate-100 pt-5">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><Flag size={13} /> Project stage</h4>
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1">
                  <span>{tracker.status_display}</span><span>{tracker.progress_percentage}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${tracker.progress_percentage}%` }} />
                </div>
                <div className="grid sm:grid-cols-[1fr_1.2fr_auto] gap-2">
                  <select value={stage} onChange={(e) => setStage(e.target.value)} className={input}>
                    {PROJECT_STAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input type="text" placeholder="Remarks (optional)" value={stageNote} onChange={(e) => setStageNote(e.target.value)} className={input} maxLength={200} />
                  <button onClick={updateStage} disabled={busy || stage === tracker.status} className={`${btn} bg-blue-600 hover:bg-blue-700 text-white`}>Update</button>
                </div>
                {completing && (
                  <p className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 mt-2 mb-0">
                    Completing the project also signs off the booking as Finished and lets the customer leave a review.
                  </p>
                )}
              </section>

              {/* History */}
              <section className="border-t border-slate-100 pt-5">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5"><History size={13} /> History</h4>
                {tracker.history_logs?.length ? (
                  <ol className="m-0 p-0 list-none space-y-2.5">
                    {tracker.history_logs.map((log) => (
                      <li key={log.id} className="flex gap-3 text-xs">
                        <span className="w-2 h-2 rounded-full bg-slate-300 mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="m-0 font-semibold text-slate-700">{log.remarks || log.status_display}</p>
                          <p className="m-0 text-slate-400">
                            {log.status_display} · {log.trigger_user_name} · {new Date(log.timestamp).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : <p className="text-xs text-slate-400 m-0">No history yet.</p>}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
