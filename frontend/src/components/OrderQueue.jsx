import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Printer, X, Package, Truck, Banknote, RotateCcw, Clock, Archive, Inbox,
  Phone, Mail, MapPin, RefreshCw, CheckCircle2, AlertTriangle, ShoppingBag, Download,
} from 'lucide-react';
import Pager from './ui/Pager';
import LiveBanner from './ui/LiveBanner';
import { useLiveCounts } from './ui/useLiveCounts';
import { downloadWithAuth } from './ui/download';
import { esc, openPrintWindow, printedAt } from './ui/printWindow';

/* Staff order fulfilment, organised as work queues (rules live in BACKEND work_queues.py).
   Lists come from the server one page at a time, so this stays fast however many orders arrive. */

const PAGE_SIZE = 25;

const QUEUES = [
  { key: 'to_pack',          label: 'To pack',          Icon: Package,   hint: 'Paid online or Cash on Delivery. Pack and ship, oldest first.' },
  { key: 'in_transit',       label: 'In transit',       Icon: Truck,     hint: 'Shipped or out with our crew. Mark delivered when they arrive.' },
  { key: 'cod_to_collect',   label: 'COD to collect',   Icon: Banknote,  hint: 'Cash on Delivery orders on the road. The crew collects the cash on delivery.' },
  { key: 'awaiting_payment', label: 'Awaiting payment', Icon: Clock,     hint: 'Online checkout started but not paid yet. Nothing to do: unpaid orders expire on their own.' },
  { key: 'needs_refund',     label: 'Refunds owed',     Icon: RotateCcw, hint: 'Paid online, then cancelled. Refund the customer in the PayMongo dashboard, then mark it refunded.', alert: true },
  { key: 'history',          label: 'History',          Icon: Archive,   hint: 'Delivered and cancelled orders, newest first.' },
];

// Buttons keyed by the status they move the order to
const ACTIONS = {
  Shipped:            { label: 'Ship',             cls: 'bg-blue-600 hover:bg-blue-700 text-white border-transparent' },
  'Out for Delivery': { label: 'Out for delivery', cls: 'bg-sky-600 hover:bg-sky-700 text-white border-transparent' },
  Delivered:          { label: 'Mark delivered',   cls: 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent' },
  Cancelled:          { label: 'Cancel order',     cls: 'bg-white hover:bg-red-50 text-red-600 border-red-200' },
};

const STATUS_STYLES = {
  Pending:            'bg-amber-50 text-amber-700 border-amber-200',
  Paid:               'bg-emerald-50 text-emerald-700 border-emerald-200',
  Shipped:            'bg-blue-50 text-blue-700 border-blue-200',
  'Out for Delivery': 'bg-sky-50 text-sky-700 border-sky-200',
  Delivered:          'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled:          'bg-red-50 text-red-700 border-red-200',
};

const peso = (v) => `₱${Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const isCod = (o) => o.payment_method === 'cod';

// The next step staff would normally take (Cancel is never the default)
const primaryAction = (o) => (o.next_statuses || []).find(s => s !== 'Cancelled') || null;

const actionLabel = (o, status) =>
  status === 'Delivered' && isCod(o) ? 'Delivered · cash collected' : ACTIONS[status]?.label || status;

function age(iso) {
  const mins = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return { text: `${Math.round(mins)}m`, days: 0 };
  if (mins < 1440) return { text: `${Math.round(mins / 60)}h`, days: 0 };
  const days = Math.floor(mins / 1440);
  return { text: `${days}d`, days };
}

function itemSummary(o) {
  const items = o.items || [];
  if (!items.length) return 'No items';
  const first = `${items[0].quantity}× ${items[0].item_name || 'Item'}`;
  return items.length > 1 ? `${first} +${items.length - 1} more` : first;
}

/* ─── Small pieces ───────────────────────────────────────────────────────── */
function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold border whitespace-nowrap ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {status}
    </span>
  );
}

// What the money situation is, at a glance: the thing staff most often get wrong
function PaymentChip({ order }) {
  let cls = 'bg-slate-100 text-slate-600 border-slate-200';
  let text;
  if (order.needs_refund) { cls = 'bg-red-50 text-red-700 border-red-200'; text = 'Refund owed'; }
  else if (order.payment_status === 'Refunded') text = 'Refunded';
  else if (order.payment_status === 'Expired') text = 'Expired unpaid';
  else if (isCod(order)) {
    if (order.payment_status === 'Paid') { cls = 'bg-emerald-50 text-emerald-700 border-emerald-200'; text = 'COD · cash collected'; }
    else if (order.status === 'Cancelled') text = 'COD · not collected';
    else { cls = 'bg-orange-50 text-orange-700 border-orange-200'; text = `COD · collect ${peso(order.total_price)}`; }
  } else if (order.payment_status === 'Paid') { cls = 'bg-emerald-50 text-emerald-700 border-emerald-200'; text = 'Paid online'; }
  else { cls = 'bg-amber-50 text-amber-700 border-amber-200'; text = 'Awaiting payment'; }
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold border whitespace-nowrap ${cls}`}>{text}</span>;
}

function AgeTag({ order, queue }) {
  const a = age(order.created_at);
  // Waiting time only matters while the order is still in our hands
  const late = ['to_pack', 'in_transit', 'cod_to_collect', 'needs_refund'].includes(queue);
  const cls = late && a.days >= 4 ? 'text-red-600 font-bold' : late && a.days >= 2 ? 'text-amber-600 font-bold' : 'text-slate-400';
  return <span className={`text-xs whitespace-nowrap ${cls}`} title={new Date(order.created_at).toLocaleString()}>{a.text} ago</span>;
}

// Who has the order on the road (only matters once it has left the shop)
function DriverTag({ order }) {
  if (!['Shipped', 'Out for Delivery'].includes(order.status)) return null;
  return order.delivery_crew_name
    ? <span className="block mt-1 text-[11px] text-slate-500 whitespace-nowrap"><Truck size={11} className="inline -mt-0.5" /> {order.delivery_crew_name}</span>
    : <span className="block mt-1 text-[11px] font-bold text-amber-700 whitespace-nowrap">No driver</span>;
}

function Thumb({ src, size = 'w-10 h-10' }) {
  const [broken, setBroken] = useState(false);  // product photo deleted or moved
  return src && !broken
    ? <img src={src} alt="" onError={() => setBroken(true)} className={`${size} rounded-lg object-cover bg-slate-100 shrink-0`} loading="lazy" />
    : <div className={`${size} rounded-lg bg-slate-100 text-slate-300 flex items-center justify-center shrink-0`}><ShoppingBag size={16} /></div>;
}

/* ─── Main ───────────────────────────────────────────────────────────────── */
export default function OrderQueue({ api, headers, toast, onCounts }) {
  const [params, setParams] = useSearchParams();
  const queue   = QUEUES.some(q => q.key === params.get('queue')) ? params.get('queue') : 'to_pack';
  const q       = params.get('q') || '';
  const payment = params.get('payment') || '';
  const from    = params.get('from') || '';
  const to      = params.get('to') || '';
  const page    = Math.max(1, Number(params.get('page')) || 1);

  const [data, setData]         = useState(null);   // { count, page, pages, page_size, results }
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [busy, setBusy]         = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [openId, setOpenId]     = useState(null);
  // ?open=<id> (a notification link) opens that order's drawer once
  const urlOpen = Number(params.get('open')) || null;
  const [seenOpen, setSeenOpen] = useState(null);
  if (urlOpen !== seenOpen) {
    setSeenOpen(urlOpen);
    if (urlOpen) setOpenId(urlOpen);
  }
  const [pick, setPick]         = useState(null);   // pick list response, shown in a preview
  const [crew, setCrew]         = useState([]);     // field crew who can deliver
  const [bulkCrew, setBulkCrew] = useState('');     // "ship these with …"
  const [search, setSearch]     = useState(q);
  const [stamp, setStamp]       = useState(0);      // bump to reload
  // The parent rebuilds `headers` every render; key on the token so fetches don't re-run for nothing
  const token = headers?.Authorization;
  const authHeaders = useMemo(() => ({ Authorization: token }), [token]);

  // Filters live in the URL, so refresh/back/shared links keep the staff member's place
  const update = useCallback((patch, { keepPage = false } = {}) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'orders');
      Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, String(v)) : next.delete(k)));
      if (!keepPage && !('page' in patch)) next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams]);

  // Debounced search box
  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => {
    if (search === q) return undefined;
    const t = setTimeout(() => update({ q: search.trim() }), 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(`${api}/bookings/field_crew_members/`, { headers: authHeaders })
      .then(r => (r.ok ? r.json() : [])).then(setCrew).catch(() => {});
  }, [api, authHeaders]);

  // Badges stay live; new orders are announced, never pushed into the list unasked
  const { counts, fresh } = useLiveCounts({ url: `${api}/orders/counts/`, authHeaders, stamp, onCounts });

  useEffect(() => {
    let cancelled = false;
    const qs = new URLSearchParams({ queue, page, page_size: PAGE_SIZE });
    if (q) qs.set('q', q);
    if (payment) qs.set('payment', payment);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    setLoading(true);
    setError('');
    fetch(`${api}/orders/?${qs}`, { headers: authHeaders })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => {
        if (cancelled) return;
        setData(d);
        // A filter or page change can leave the page number past the end
        if (d.page !== page) update({ page: d.page > 1 ? d.page : '' }, { keepPage: true });
      })
      .catch(() => { if (!cancelled) setError('Could not load orders. Check your connection and try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, authHeaders, queue, q, payment, from, to, page, stamp]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selection belongs to what's on screen
  useEffect(() => { setSelected(new Set()); }, [queue, q, payment, from, to, page]);

  const reload = () => setStamp(s => s + 1);
  const rows = data?.results || [];
  const openOrder = rows.find(o => o.id === openId) || null;
  const meta = QUEUES.find(x => x.key === queue);

  /* ── Actions ── */
  const confirmText = (order, status) => {
    if (status === 'Cancelled') {
      return order.payment_status === 'Paid' && !isCod(order)
        ? `Cancel order #${order.id}? It was paid online, so you must refund ${peso(order.total_price)} in PayMongo.`
        : `Cancel order #${order.id}? Its items go back on sale. This can't be undone.`;
    }
    if (status === 'Delivered' && isCod(order)) return `Confirm order #${order.id} was delivered and the crew collected ${peso(order.total_price)} cash?`;
    return null;
  };

  const setStatus = async (order, body) => {
    const ask = body.status ? confirmText(order, body.status)
      : `Mark order #${order.id} as refunded? Only do this after sending ${peso(order.total_price)} back in PayMongo.`;
    if (ask && !window.confirm(ask)) return;
    setBusy(true);
    try {
      const r = await fetch(`${api}/orders/${order.id}/update_status/`, {
        method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        toast(body.status ? `Order #${order.id}: ${body.status}.` : `Order #${order.id} marked refunded.`);
        if (body.status === 'Cancelled' && d.needs_refund) toast(`Refund ${peso(order.total_price)} in PayMongo, then mark it refunded under "Refunds owed".`, 'error');
        // The order usually leaves this queue, so close its panel
        setOpenId(null);
        reload();
      } else {
        toast(d.error || 'Could not update the order.', 'error');
      }
    } catch {
      toast('Network error. Please try again.', 'error');
    }
    setBusy(false);
  };

  const selectedRows = rows.filter(o => selected.has(o.id));
  // Bulk buttons: only steps every selected order can take
  const bulkSteps = selectedRows.length
    ? (selectedRows[0].next_statuses || []).filter(s => s !== 'Cancelled' && selectedRows.every(o => (o.next_statuses || []).includes(s)))
    : [];

  const bulk = async (status) => {
    const n = selectedRows.length;
    const codCash = selectedRows.filter(isCod).reduce((sum, o) => sum + Number(o.total_price), 0);
    const ask = status === 'Delivered' && codCash > 0
      ? `Mark ${n} order${n > 1 ? 's' : ''} delivered? The crew should have collected ${peso(codCash)} in COD cash.`
      : `Move ${n} order${n > 1 ? 's' : ''} to ${status}?`;
    if (!window.confirm(ask)) return;
    setBusy(true);
    try {
      const r = await fetch(`${api}/orders/bulk_status/`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedRows.map(o => o.id), status, ...(status === 'Shipped' && bulkCrew && { delivery_crew: Number(bulkCrew) }) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) toast(d.error || 'Could not update the orders.', 'error');
      else {
        const who = status === 'Shipped' && bulkCrew ? ` with ${crew.find(c => String(c.id) === bulkCrew)?.name}` : '';
        if (d.updated?.length) toast(`${d.updated.length} order${d.updated.length > 1 ? 's' : ''} moved to ${status}${who}.`);
        if (d.failed?.length) toast(`${d.failed.length} skipped: ${d.failed[0].error}`, 'error');
        reload();
      }
    } catch {
      toast('Network error. Please try again.', 'error');
    }
    setBusy(false);
  };

  const assignDelivery = async (order, crewId) => {
    setBusy(true);
    try {
      const r = await fetch(`${api}/orders/${order.id}/assign_delivery/`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ crew_id: crewId || null }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { toast(crewId ? `${d.delivery_crew_name} will deliver order #${order.id}. They have been notified.` : `Order #${order.id} has no driver now.`); reload(); }
      else toast(d.error || 'Could not change the delivery crew.', 'error');
    } catch {
      toast('Network error. Please try again.', 'error');
    }
    setBusy(false);
  };

  const openPickList = async () => {
    const qs = selectedRows.length
      ? new URLSearchParams({ ids: selectedRows.map(o => o.id).join(',') })
      : filterParams();
    setBusy(true);
    try {
      const r = await fetch(`${api}/orders/pick_list/?${qs}`, { headers: authHeaders });
      if (r.ok) setPick(await r.json());
      else toast('Could not build the pick list.', 'error');
    } catch {
      toast('Network error. Please try again.', 'error');
    }
    setBusy(false);
  };

  const toggle = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOnPage = rows.length > 0 && rows.every(o => selected.has(o.id));
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(rows.map(o => o.id)));
  const canSelect = queue !== 'history' && queue !== 'awaiting_payment';
  const filtersOn = q || payment || from || to;
  const filterParams = () => new URLSearchParams({ queue, ...(q && { q }), ...(payment && { payment }), ...(from && { from }), ...(to && { to }) });
  // Someone else moved orders in or out of this queue since it loaded
  const stale = !filtersOn && data && counts && counts[queue] != null && counts[queue] !== data.count;

  const exportCsv = async () => {
    setBusy(true);
    const err = await downloadWithAuth(`${api}/orders/export/?${filterParams()}`, authHeaders, 'orders.csv');
    if (err) toast(err, 'error');
    setBusy(false);
  };

  /* ── Render ── */
  return (
    <div className="space-y-4">
      {/* Queue tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Order queues">
        {QUEUES.map(({ key, label, Icon, alert }) => {
          const n = counts?.[key];
          const on = queue === key;
          const red = alert && n > 0;
          return (
            <button key={key} role="tab" aria-selected={on} onClick={() => update({ queue: key })}
              className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border cursor-pointer transition-colors
                ${on ? 'bg-slate-900 border-slate-900 text-white' : red ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Icon size={15} />
              {label}
              {n != null && key !== 'history' && (
                <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold inline-flex items-center justify-center
                  ${on ? 'bg-white/20 text-white' : red ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{n > 999 ? '999+' : n}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        {/* Toolbar */}
        <div className="p-3 md:p-4 border-b border-slate-100 space-y-3">
          <p className="text-xs text-slate-500 flex items-start gap-1.5"><meta.Icon size={14} className="shrink-0 mt-px text-slate-400" />{meta.hint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <span className="sr-only">Search orders</span>
              <input type="search" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Order #, customer, email, phone, address"
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
            </label>
            {!['cod_to_collect', 'needs_refund', 'awaiting_payment'].includes(queue) && (
              <div className="inline-flex h-10 p-1 bg-slate-100 rounded-xl" role="group" aria-label="Payment method">
                {[['', 'All'], ['online', 'Online'], ['cod', 'COD']].map(([v, l]) => (
                  <button key={l} onClick={() => update({ payment: v })} aria-pressed={payment === v}
                    className={`px-3 rounded-lg text-xs font-bold border-none cursor-pointer ${payment === v ? 'bg-white text-slate-900 shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-800'}`}>{l}</button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <input type="date" value={from} max={to || undefined} onChange={e => update({ from: e.target.value })} aria-label="Placed from"
                className="flex-1 min-w-0 sm:flex-none h-10 px-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-600" />
              <span className="text-slate-400 text-xs">to</span>
              <input type="date" value={to} min={from || undefined} onChange={e => update({ to: e.target.value })} aria-label="Placed until"
                className="flex-1 min-w-0 sm:flex-none h-10 px-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-600" />
            </div>
            {filtersOn && (
              <button onClick={() => { setSearch(''); update({ q: '', payment: '', from: '', to: '' }); }}
                className="h-10 px-3 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 bg-transparent border-none cursor-pointer">Clear filters</button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              {queue === 'to_pack' && data?.count > 0 && !selected.size && (
                <button onClick={openPickList} disabled={busy}
                  className="h-10 px-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                  <Printer size={15} /> Pick list
                </button>
              )}
              <button onClick={exportCsv} disabled={busy || !data?.count} title="Download these orders as a spreadsheet (CSV)"
                className="h-10 px-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                <Download size={15} /> <span className="hidden sm:inline">Export</span>
              </button>
              <button onClick={reload} title="Refresh" aria-label="Refresh orders"
                className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 cursor-pointer">
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>

        <LiveBanner fresh={fresh} stale={stale} noun="order" onShow={reload} />

        {/* Bulk bar */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-3 md:px-4 py-2.5 bg-emerald-50 border-b border-emerald-100">
            <span className="text-sm font-bold text-emerald-800 mr-1">{selected.size} selected</span>
            {bulkSteps.includes('Shipped') && crew.length > 0 && (
              <select value={bulkCrew} onChange={e => setBulkCrew(e.target.value)} aria-label="Delivery crew for these orders"
                className="h-9 px-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 cursor-pointer">
                <option value="">Deliver with… (choose later)</option>
                {crew.map(c => <option key={c.id} value={c.id}>Deliver with {c.name}</option>)}
              </select>
            )}
            {bulkSteps.map(s => (
              <button key={s} onClick={() => bulk(s)} disabled={busy}
                className={`h-9 px-3 rounded-lg text-sm font-bold border cursor-pointer disabled:opacity-50 ${ACTIONS[s]?.cls}`}>
                {ACTIONS[s]?.label} {selected.size}
              </button>
            ))}
            <button onClick={openPickList} disabled={busy}
              className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50">
              <Printer size={14} /> Pick list
            </button>
            <button onClick={() => setSelected(new Set())} className="h-9 px-2 text-sm font-semibold text-slate-500 hover:text-slate-800 bg-transparent border-none cursor-pointer ml-auto">Clear</button>
          </div>
        )}

        {/* List */}
        <div className={`transition-opacity ${loading && data ? 'opacity-60' : ''}`}>
          {error ? (
            <div className="p-8 text-center">
              <AlertTriangle size={28} className="mx-auto text-amber-500 mb-2" />
              <p className="text-sm text-slate-600 mb-3">{error}</p>
              <button onClick={reload} className="h-9 px-4 rounded-lg bg-slate-900 text-white text-sm font-bold border-none cursor-pointer">Try again</button>
            </div>
          ) : !data ? (
            <div className="divide-y divide-slate-100">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-4 animate-pulse">
                  <div className="w-10 h-10 rounded-lg bg-slate-100" />
                  <div className="flex-1 space-y-2"><div className="h-3 w-1/3 bg-slate-100 rounded" /><div className="h-3 w-1/2 bg-slate-100 rounded" /></div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <Inbox size={34} strokeWidth={1.5} className="mx-auto text-slate-300 mb-3" />
              <p className="font-bold text-slate-700">{filtersOn ? 'No orders match these filters' : queue === 'needs_refund' ? 'No refunds owed' : queue === 'to_pack' ? 'Nothing to pack' : 'Nothing here right now'}</p>
              <p className="text-sm text-slate-400 mt-1">{filtersOn ? 'Try a different search or clear the filters.' : 'New orders will appear here automatically.'}</p>
            </div>
          ) : (
            <>
              {/* Laptop / desktop: one row per order */}
              <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                    {canSelect && (
                      <th className="pl-4 py-3 w-8"><input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all on this page" className="w-4 h-4 accent-emerald-600 cursor-pointer" /></th>
                    )}
                    <th className="px-3 py-3 font-bold">Order</th>
                    <th className="px-3 py-3 font-bold">Customer</th>
                    <th className="px-3 py-3 font-bold hidden xl:table-cell">Items</th>
                    <th className="px-3 py-3 font-bold">Payment</th>
                    <th className="px-3 py-3 font-bold text-right">Total</th>
                    <th className="px-3 py-3 font-bold hidden xl:table-cell">Status</th>
                    <th className="px-4 py-3 font-bold text-right">Next step</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(o => {
                    const next = primaryAction(o);
                    return (
                      <tr key={o.id} onClick={() => setOpenId(o.id)}
                        className={`cursor-pointer hover:bg-slate-50 ${selected.has(o.id) ? 'bg-emerald-50/50' : ''}`}>
                        {canSelect && (
                          <td className="pl-4 py-3" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} aria-label={`Select order ${o.id}`} className="w-4 h-4 accent-emerald-600 cursor-pointer" />
                          </td>
                        )}
                        <td className="px-3 py-3">
                          <div className="font-bold text-slate-900">#{o.id}</div>
                          <AgeTag order={o} queue={queue} />
                        </td>
                        <td className="px-3 py-3 max-w-[200px]">
                          <div className="font-semibold text-slate-800 truncate">{o.customer_name}</div>
                          <div className="text-xs text-slate-400 truncate">{o.customer_phone || o.customer_email}</div>
                        </td>
                        <td className="px-3 py-3 hidden xl:table-cell max-w-[220px]">
                          <div className="flex items-center gap-2 min-w-0">
                            <Thumb src={o.items?.[0]?.item_image} size="w-8 h-8" />
                            <span className="text-slate-600 truncate">{itemSummary(o)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3"><PaymentChip order={o} /></td>
                        <td className="px-3 py-3 text-right font-bold text-slate-800 whitespace-nowrap">{peso(o.total_price)}</td>
                        <td className="px-3 py-3 hidden xl:table-cell"><StatusPill status={o.status} /></td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          {o.needs_refund ? (
                            <button onClick={() => setStatus(o, { payment_status: 'Refunded' })} disabled={busy}
                              className="h-8 px-3 rounded-lg text-xs font-bold border border-red-200 bg-white text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-50 whitespace-nowrap">Mark refunded</button>
                          ) : next ? (
                            <button onClick={() => setStatus(o, { status: next })} disabled={busy}
                              className={`h-8 px-3 rounded-lg text-xs font-bold border cursor-pointer disabled:opacity-50 whitespace-nowrap ${ACTIONS[next]?.cls}`}>{actionLabel(o, next)}</button>
                          ) : (
                            <button onClick={() => setOpenId(o.id)} className="h-8 px-3 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 bg-transparent border border-slate-200 cursor-pointer">View</button>
                          )}
                          <DriverTag order={o} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>

              {/* Phones and tablets: compact cards */}
              <ul className="lg:hidden divide-y divide-slate-100">
                {rows.map(o => {
                  const next = primaryAction(o);
                  return (
                    <li key={o.id} className={`p-3 ${selected.has(o.id) ? 'bg-emerald-50/50' : ''}`}>
                      <div className="flex items-start gap-3">
                        {canSelect && (
                          <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} aria-label={`Select order ${o.id}`}
                            className="mt-1 w-5 h-5 accent-emerald-600 shrink-0" />
                        )}
                        <button onClick={() => setOpenId(o.id)} className="flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-900">#{o.id} <span className="font-semibold text-slate-700">· {o.customer_name}</span></span>
                            <AgeTag order={o} queue={queue} />
                          </div>
                          <div className="text-xs text-slate-500 truncate mt-0.5">{itemSummary(o)}</div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <PaymentChip order={o} />
                            <StatusPill status={o.status} />
                            <DriverTag order={o} />
                            <span className="ml-auto font-bold text-slate-800 text-sm">{peso(o.total_price)}</span>
                          </div>
                        </button>
                      </div>
                      {(o.needs_refund || next) && (
                        <button onClick={() => (o.needs_refund ? setStatus(o, { payment_status: 'Refunded' }) : setStatus(o, { status: next }))} disabled={busy}
                          className={`mt-3 w-full h-10 rounded-xl text-sm font-bold border cursor-pointer disabled:opacity-50 ${o.needs_refund ? 'border-red-200 bg-white text-red-600' : ACTIONS[next]?.cls}`}>
                          {o.needs_refund ? 'Mark refunded' : actionLabel(o, next)}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        <div className="px-3 md:px-4 pb-4"><Pager meta={data} onPage={(p) => update({ page: p > 1 ? p : '' })} /></div>
      </div>

      {openOrder && <OrderDrawer order={openOrder} busy={busy} crew={crew} onClose={() => { setOpenId(null); if (urlOpen) update({ open: '' }, { keepPage: true }); }} onStatus={setStatus}
        onAssign={(crewId) => assignDelivery(openOrder, crewId)} />}
      {pick && <PickListModal data={pick} onClose={() => setPick(null)} />}
    </div>
  );
}

/* ─── Order detail panel ─────────────────────────────────────────────────── */
function OrderDrawer({ order, busy, crew, onClose, onStatus, onAssign }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const steps = (order.next_statuses || []).filter(s => s !== 'Cancelled');
  const canCancel = (order.next_statuses || []).includes('Cancelled');
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer_address || '')}`;
  const subtotal = (order.items || []).reduce((s, i) => s + Number(i.price_at_booking) * i.quantity, 0);

  return (
    <div className="fixed inset-0 z-[150] flex justify-end" role="dialog" aria-modal="true" aria-label={`Order ${order.id}`}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Order #{order.id}</h2>
            <p className="text-xs text-slate-400">Placed {new Date(order.created_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            <div className="flex flex-wrap gap-1.5 mt-2"><StatusPill status={order.status} /><PaymentChip order={order} /></div>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 bg-transparent border-none cursor-pointer"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {order.needs_refund && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              <b>Refund owed: {peso(order.total_price)}.</b> This order was paid online and then cancelled. Send the refund from the PayMongo dashboard, then mark it refunded below.
            </div>
          )}
          {order.payment_method === 'online' && order.payment_status === 'Pending' && order.status !== 'Cancelled' && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
              Waiting for the customer to pay online. It can be shipped once paid; unpaid orders expire on their own.
            </div>
          )}

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Customer</h3>
            <p className="font-bold text-slate-800">{order.customer_name}</p>
            <div className="mt-2 space-y-1.5 text-sm">
              {order.customer_phone && <a href={`tel:${order.customer_phone}`} className="flex items-center gap-2 text-emerald-700 font-semibold no-underline"><Phone size={14} />{order.customer_phone}</a>}
              {order.customer_email && <a href={`mailto:${order.customer_email}`} className="flex items-center gap-2 text-slate-600 no-underline break-all"><Mail size={14} className="shrink-0" />{order.customer_email}</a>}
              {order.customer_address && (
                <a href={mapUrl} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-slate-600 no-underline">
                  <MapPin size={14} className="shrink-0 mt-0.5" /><span>{order.customer_address} <span className="text-emerald-700 font-semibold whitespace-nowrap">Open map</span></span>
                </a>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Delivery</h3>
            {order.status === 'Delivered' ? (
              <p className="text-sm text-slate-700 flex items-center gap-2"><Truck size={14} className="text-emerald-600" />
                Delivered{order.delivered_by_name ? ` by ${order.delivered_by_name}` : ''}
                {order.delivered_at ? `, ${new Date(order.delivered_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
              </p>
            ) : order.status === 'Cancelled' ? (
              <p className="text-sm text-slate-400">Not delivered (cancelled).</p>
            ) : (
              <label className="block">
                <span className="sr-only">Delivery crew</span>
                <select value={order.delivery_crew || ''} onChange={e => onAssign(e.target.value ? Number(e.target.value) : null)} disabled={busy}
                  className={`w-full h-11 px-3 rounded-xl border text-sm cursor-pointer ${order.delivery_crew ? 'border-slate-200 bg-white text-slate-800' : 'border-amber-300 bg-amber-50 text-amber-800 font-semibold'}`}>
                  <option value="">{['Shipped', 'Out for Delivery'].includes(order.status) ? 'No driver yet: choose who delivers' : 'Choose who delivers (optional for now)'}</option>
                  {crew.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <span className="block text-xs text-slate-400 mt-1">They see it in their Deliveries tab{isCod(order) ? ' with the cash amount to collect' : ''}.</span>
              </label>
            )}
          </section>

          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Items</h3>
            <ul className="space-y-2">
              {(order.items || []).map(it => (
                <li key={it.id} className="flex items-center gap-3">
                  <Thumb src={it.item_image} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{it.item_name || 'Deleted item'}</p>
                    <p className="text-xs text-slate-400">{it.quantity} × {peso(it.price_at_booking)}</p>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{peso(Number(it.price_at_booking) * it.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-sm">
              {Math.abs(subtotal - Number(order.total_price)) > 0.009 && (
                <div className="flex justify-between text-slate-500"><span>Items</span><span>{peso(subtotal)}</span></div>
              )}
              <div className="flex justify-between font-extrabold text-slate-900"><span>Total</span><span>{peso(order.total_price)}</span></div>
              <div className="flex justify-between text-slate-500"><span>Payment</span><span>{isCod(order) ? 'Cash on Delivery' : 'Online (QR Ph / GCash / Maya / Card)'}</span></div>
            </div>
          </section>
        </div>

        {(steps.length > 0 || canCancel || order.needs_refund) && (
          <div className="p-4 border-t border-slate-100 space-y-2 bg-slate-50">
            {order.needs_refund && (
              <button onClick={() => onStatus(order, { payment_status: 'Refunded' })} disabled={busy}
                className="w-full h-11 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white border-none cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2">
                <CheckCircle2 size={16} /> I've refunded it in PayMongo
              </button>
            )}
            {steps.map(s => (
              <button key={s} onClick={() => onStatus(order, { status: s })} disabled={busy}
                className={`w-full h-11 rounded-xl text-sm font-bold border cursor-pointer disabled:opacity-50 ${ACTIONS[s]?.cls}`}>
                {actionLabel(order, s)}
              </button>
            ))}
            {canCancel && (
              <button onClick={() => onStatus(order, { status: 'Cancelled' })} disabled={busy}
                className={`w-full h-10 rounded-xl text-sm font-bold border cursor-pointer disabled:opacity-50 ${ACTIONS.Cancelled.cls}`}>
                Cancel order
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Pick list + packing slips ──────────────────────────────────────────── */
function printPickList(data) {
  const itemRows = data.items.map(i => `<tr><td class="box"></td><td><b>${esc(i.name)}</b></td><td class="num">${i.quantity}</td><td class="muted">${i.orders.map(id => '#' + id).join(', ')}</td></tr>`).join('');
  const slips = data.orders.map(o => `
    <section class="page">
      <h2>Order #${o.id} <span class="tag">${o.payment_method === 'cod' ? `COD: collect ₱${esc(Number(o.total_price).toLocaleString('en-PH', { minimumFractionDigits: 2 }))}` : 'Paid online'}</span></h2>
      <p><b>${esc(o.customer_name)}</b> · ${esc(o.customer_phone)}<br>${esc(o.customer_address)}</p>
      <table><thead><tr><th class="box"></th><th>Item</th><th class="num">Qty</th></tr></thead>
      <tbody>${o.items.map(l => `<tr><td class="box"></td><td>${esc(l.name)}</td><td class="num">${l.quantity}</td></tr>`).join('')}</tbody></table>
      <p class="sign">Received by: ____________________ &nbsp; Date: __________</p>
    </section>`).join('');
  const ok = openPrintWindow('Pick list', `
    <h1>Pick list: ${data.order_count} order${data.order_count === 1 ? '' : 's'}</h1>
    <p class="muted">Printed ${esc(printedAt())}. Tick each item as you take it from the shelf.</p>
    <table><thead><tr><th class="box"></th><th>Item</th><th class="num">Qty</th><th>For orders</th></tr></thead><tbody>${itemRows}</tbody></table>
    ${slips}`);
  if (!ok) alert('Allow pop-ups for this site to print the pick list.');
}

function PickListModal({ data, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const units = data.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Pick list">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[90vh] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-start justify-between p-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Pick list</h2>
            <p className="text-xs text-slate-500">{data.order_count} order{data.order_count === 1 ? '' : 's'} · {units} item{units === 1 ? '' : 's'} to gather</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 bg-transparent border-none cursor-pointer"><X size={18} /></button>
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-slate-100 px-4">
          {data.items.map(i => (
            <li key={`${i.item_id}-${i.name}`} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{i.name}</p>
                <p className="text-xs text-slate-400 truncate">For {i.orders.map(id => `#${id}`).join(', ')}</p>
              </div>
              <span className="text-lg font-extrabold text-slate-900 shrink-0">×{i.quantity}</span>
            </li>
          ))}
        </ul>
        <div className="p-4 border-t border-slate-100 flex gap-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-xl text-sm font-bold border border-slate-200 bg-white text-slate-700 cursor-pointer">Close</button>
          <button onClick={() => printPickList(data)} className="flex-1 h-11 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-700 text-white border-none cursor-pointer inline-flex items-center justify-center gap-2">
            <Printer size={16} /> Print with packing slips
          </button>
        </div>
      </div>
    </div>
  );
}
