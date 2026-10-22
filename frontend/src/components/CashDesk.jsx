import { useCallback, useEffect, useState } from 'react';
import { Banknote, CheckCircle2, RefreshCw, History } from 'lucide-react';

/*
 * Staff → Cash. Cash on delivery money from the crew's pocket into the office.
 * Each crew member holding cash is one card: tick the orders the cash is for, type what you
 * actually counted, and record it. If the count differs, a note is required and the difference is
 * kept (Business overview + activity log), never quietly corrected.
 * Data: GET /api/cash/, POST /api/cash/receive/ (BACKEND apps/library/cash.py).
 */

const peso = (v) => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (iso) => new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const daysAgo = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

function CrewCash({ row, api, headers, toast, onDone }) {
  const [picked, setPicked] = useState(() => new Set(row.orders.map(o => o.id)));
  const expected = row.orders.filter(o => picked.has(o.id)).reduce((s, o) => s + Number(o.total_price), 0);
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Until the person types a count, it follows the ticked orders
  const countedValue = counted === '' ? expected.toFixed(2) : counted;
  const diff = Number(countedValue || 0) - expected;
  const mismatch = Math.abs(diff) >= 0.005;
  const oldest = daysAgo(row.oldest);

  const toggle = (id) => { setError(''); setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); };

  const save = async () => {
    setError('');
    if (!picked.size) return setError('Tick the orders this cash is for.');
    if (countedValue === '' || Number.isNaN(Number(countedValue)) || Number(countedValue) < 0) return setError('Enter the amount you counted.');
    if (mismatch && !note.trim()) return setError('The count is different from the orders. Add a note saying why.');
    setSaving(true);
    try {
      const r = await fetch(`${api}/cash/receive/`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ crew: row.crew_id, orders: [...picked], counted: countedValue, note: note.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'Could not record the cash. Try again.'); return; }
      toast(`Recorded ${peso(d.counted)} from ${row.name}.`);
      onDone();
    } catch { setError('No connection. Nothing was recorded; try again.'); }
    finally { setSaving(false); }
  };

  return (
    <li className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-start justify-between gap-3 px-4 md:px-5 py-4 border-b border-slate-100">
        <div className="min-w-0">
          <p className="m-0 font-bold text-slate-900 text-[15px]">{row.name}</p>
          <p className={`m-0 text-sm ${oldest >= 1 ? 'text-amber-700 font-semibold' : 'text-slate-500'}`}>
            {row.orders.length} deliver{row.orders.length === 1 ? 'y' : 'ies'} · {oldest >= 1 ? `oldest is ${oldest} day${oldest > 1 ? 's' : ''} old` : 'collected today'}
          </p>
        </div>
        <p className="m-0 text-xl font-extrabold text-slate-900 tabular-nums shrink-0">{peso(row.total)}</p>
      </div>

      <ul className="m-0 p-0 list-none divide-y divide-slate-100">
        {row.orders.map(o => (
          <li key={o.id}>
            <label className="flex items-center gap-3 px-4 md:px-5 py-2.5 min-h-[48px] cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={picked.has(o.id)} onChange={() => toggle(o.id)} className="w-5 h-5 accent-emerald-600 shrink-0" />
              <span className="flex-1 min-w-0 text-sm text-slate-700 truncate"><b className="text-slate-900">#{o.id}</b> {o.customer_name} · {when(o.delivered_at)}</span>
              <span className="text-sm font-bold text-slate-900 tabular-nums">{peso(o.total_price)}</span>
            </label>
          </li>
        ))}
      </ul>

      <div className="px-4 md:px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1">
            <span className="block text-xs font-bold text-slate-600 mb-1">Amount you counted (₱)</span>
            <input type="number" inputMode="decimal" min="0" step="0.01" value={countedValue}
              onChange={e => { setCounted(e.target.value); setError(''); }}
              className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-base tabular-nums" />
          </label>
          {mismatch && (
            <label className="flex-[2]">
              <span className="block text-xs font-bold text-slate-600 mb-1">
                Why is it {diff < 0 ? `short by ${peso(-diff)}` : `over by ${peso(diff)}`}? (required)
              </span>
              <input value={note} maxLength={300} onChange={e => { setNote(e.target.value); setError(''); }} placeholder="e.g. Customer will pay the ₱100 tomorrow"
                className="w-full h-11 px-3 rounded-xl border border-amber-300 bg-white text-slate-900 text-base" />
            </label>
          )}
        </div>
        {error && <p role="alert" className="m-0 text-sm font-semibold text-red-700">{error}</p>}
        <button type="button" onClick={save} disabled={saving}
          className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-[15px] border-none cursor-pointer flex items-center justify-center gap-2">
          <Banknote size={18} /> {saving ? 'Recording…' : `Received ${peso(countedValue)} from ${row.name.split(' ')[0]}`}
        </button>
      </div>
    </li>
  );
}

export default function CashDesk({ api, headers, toast, onCount }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const auth = headers.Authorization;  // headers itself is rebuilt on every parent render
  const load = useCallback(() => fetch(`${api}/cash/`, { headers: { Authorization: auth } })
    .then(r => (r.ok ? r.json() : Promise.reject()))
    .then(d => { setData(d); setError(''); onCount?.(d.crew.reduce((n, c) => n + c.orders.length, 0)); })
    .catch(() => setError('Could not load the cash list. Refresh to try again.')),
  [api, auth, onCount]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-extrabold text-slate-900">Cash from crew</h2>
          <p className="m-0 mt-0.5 text-sm text-slate-500">Cash on delivery money the crew collected. Count it, then record it here so nothing goes missing.</p>
        </div>
        <button type="button" onClick={load} aria-label="Refresh" className="w-11 h-11 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center cursor-pointer shrink-0">
          <RefreshCw size={18} />
        </button>
      </div>

      {error && <p role="alert" className="m-0 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

      {!data ? <div className="h-48 bg-white border border-slate-200 rounded-2xl animate-pulse" />
        : !data.crew.length ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-3">
            <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
            <p className="m-0 text-[15px] text-slate-700"><b className="text-slate-900">No cash waiting.</b> Every cash delivery has been handed in.</p>
          </div>
        ) : (
          <ul className="m-0 p-0 list-none flex flex-col gap-4">
            {/* key includes the order ids so a refreshed list starts with every order ticked again */}
            {data.crew.map(row => <CrewCash key={`${row.crew_id}-${row.orders.map(o => o.id).join('.')}`} row={row} api={api} headers={headers} toast={toast} onDone={load} />)}
          </ul>
        )}

      {data?.recent?.length > 0 && (
        <section aria-labelledby="cash-recent">
          <h3 id="cash-recent" className="m-0 mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><History size={14} /> Recently handed in</h3>
          <ul className="m-0 p-0 list-none bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {data.recent.map(h => {
              const diff = Number(h.difference);
              return (
                <li key={h.id} className="px-4 md:px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 text-sm text-slate-900"><b>{h.crew}</b> → {h.received_by}</p>
                    <p className="m-0 text-xs text-slate-500">{when(h.created_at)} · {h.orders.length} order{h.orders.length === 1 ? '' : 's'}{h.note ? ` · ${h.note}` : ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="m-0 text-sm font-bold text-slate-900 tabular-nums">{peso(h.counted)}</p>
                    {diff !== 0 && (
                      <span className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${diff < 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
                        {diff < 0 ? `Short ${peso(-diff)}` : `Over ${peso(diff)}`}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
