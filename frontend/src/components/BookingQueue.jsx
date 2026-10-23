import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, X, Inbox, RefreshCw, AlertTriangle, Phone, Mail, MapPin, Layers, FileDown, UserCheck,
  CalendarCheck, Truck, HardHat, ClipboardCheck, Archive, List, CalendarDays, ChevronLeft, ChevronRight,
  CheckCircle2, Calendar, Download, Printer, SlidersHorizontal,
} from 'lucide-react';
import Pager from './ui/Pager';
import LiveBanner from './ui/LiveBanner';
import { useLiveCounts } from './ui/useLiveCounts';
import { downloadWithAuth } from './ui/download';
import { esc, openPrintWindow, printedAt } from './ui/printWindow';
import ProgressPhotos from './ProgressPhotos';

/* Staff bookings, organised as work queues plus a weekly dispatch calendar.
   Lists are paged by the server (BACKEND work_queues.py), so this stays fast at any volume.
   Flow: Pending → (office confirms) Preparing → (crew checks in on site) Installing
         → (crew submits) For Review → (office signs off) Finished. */

const PAGE_SIZE = 25;

const QUEUES = [
  { key: 'awaiting',  label: 'To confirm',   Icon: CalendarCheck,  hint: 'New requests. Check the details and design, then confirm. Soonest visit first.' },
  { key: 'dispatch',  label: 'Needs crew',   Icon: Truck,          hint: 'Confirmed jobs with nobody assigned. Pick a crew; the week view shows who is free.', alert: true },
  { key: 'active',    label: 'In the field', Icon: HardHat,        hint: 'Crew assigned and working. Progress updates as the crew completes stages.' },
  { key: 'review',    label: 'To sign off',  Icon: ClipboardCheck, hint: 'The crew marked these finished. Check the photos, then approve or send back.', alert: true },
  { key: 'completed', label: 'Completed',    Icon: Archive,        hint: 'Finished and cancelled bookings, newest first.' },
  { key: 'all',       label: 'All',          Icon: List,           hint: 'Every booking, newest visit first.' },
];

const SERVICES = { maintenance: 'Maintenance', consultation: 'Consultation', hardscaping: 'Full Hardscaping', Softscape: 'Softscape / Planting' };
const TIMES = { anytime: 'Anytime', morning: 'Morning (8AM–12PM)', afternoon: 'Afternoon (1PM–5PM)' };
const TIMES_SHORT = { anytime: 'Any', morning: 'AM', afternoon: 'PM' };

const STATUS_STYLES = {
  Pending:      'bg-amber-50 text-amber-700 border-amber-200',
  Preparing:    'bg-blue-50 text-blue-700 border-blue-200',
  Installing:   'bg-orange-50 text-orange-700 border-orange-200',
  'For Review': 'bg-violet-50 text-violet-700 border-violet-200',
  Finished:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled:    'bg-red-50 text-red-700 border-red-200',
};
const STATUS_LABEL = { 'For Review': 'Awaiting sign-off' };
const OPEN = ['Pending', 'Preparing', 'Installing', 'For Review'];

const peso = (v) => `₱${Number(v || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

/* ── Dates: scheduled_date is a plain YYYY-MM-DD, so stay in local time ── */
const parseDay = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); };
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDays(x, -((x.getDay() + 6) % 7)); }; // Monday
const daysFromToday = (s) => Math.round((parseDay(s) - new Date(new Date().toDateString())) / 86400000);
const fmtDay = (s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) => parseDay(s).toLocaleDateString('en-PH', opts);

const needsCrew = (b) => ['Preparing', 'Installing'].includes(b.status) && !(b.assigned_crew || []).length;

// The one thing the office should do next with this booking
function nextStep(b) {
  if (b.status === 'Pending') return { key: 'confirm', label: 'Confirm', cls: 'bg-blue-600 hover:bg-blue-700 text-white border-transparent' };
  if (needsCrew(b)) return { key: 'crew', label: 'Assign crew', cls: 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent' };
  if (b.status === 'For Review') return { key: 'review', label: 'Review', cls: 'bg-violet-600 hover:bg-violet-700 text-white border-transparent' };
  return { key: 'view', label: 'View', cls: 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200' };
}

function crewRecommendation(b) {
  if ((b.service_type || '').toLowerCase().startsWith('consultation')) return { count: 1, label: '1 estimator' };
  const d = b.design_details?.dimensions;
  const area = d?.width && d?.length ? parseFloat(d.width) * parseFloat(d.length) : 0;
  if (!area) return null;
  if (area < 100) return { count: 1, label: '1 crew member', area };
  if (area <= 200) return { count: 2, label: '2 crew members', area };
  return { count: 3, label: '3 or more crew members', area };
}

/* ─── Small pieces ───────────────────────────────────────────────────────── */
function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold border whitespace-nowrap ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function WhenTag({ booking }) {
  const n = daysFromToday(booking.scheduled_date);
  let text = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n > 1 ? `in ${n}d` : `${-n}d ago`;
  let cls = 'text-slate-400';
  if (booking.status === 'Pending' && n < 0) { text = `Overdue ${-n}d`; cls = 'text-red-600 font-bold'; }
  else if (OPEN.includes(booking.status) && n === 0) cls = 'text-emerald-700 font-bold';
  else if (OPEN.includes(booking.status) && n === 1) cls = 'text-amber-600 font-bold';
  return <span className={`text-xs whitespace-nowrap ${cls}`}>{text}</span>;
}

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');

function CrewChips({ booking }) {
  const names = booking.assigned_crew_names || [];
  if (!names.length) {
    return needsCrew(booking)
      ? <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700"><AlertTriangle size={12} /> Unassigned</span>
      : <span className="text-xs text-slate-300">—</span>;
  }
  return (
    <div className="flex items-center" title={names.join(', ')}>
      {names.slice(0, 3).map((n, i) => (
        <span key={n + i} className="w-7 h-7 -ml-1.5 first:ml-0 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center border-2 border-white">{initials(n)}</span>
      ))}
      {names.length > 3 && <span className="ml-1 text-xs text-slate-500 font-semibold">+{names.length - 3}</span>}
    </div>
  );
}

function BillingChip({ tracker }) {
  if (!tracker) return <span className="text-xs text-slate-300">—</span>;
  if (tracker.remaining_balance > 0) return <span className="text-xs font-bold text-amber-700 whitespace-nowrap">{peso(tracker.remaining_balance)} due</span>;
  if (tracker.total_price > 0) return <span className="text-xs font-bold text-emerald-700 whitespace-nowrap">Paid in full</span>;
  return <span className="text-xs font-bold text-slate-400 whitespace-nowrap">No price set</span>;
}

function ProgressBar({ pct }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, pct || 0)}%` }} />
      </div>
      <span className="text-[11px] font-bold text-slate-500 w-8 text-right">{pct || 0}%</span>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────────────────── */
export default function BookingQueue({ api, headers, toast, onCounts, onOpenDesign, onOpenBilling, reloadKey = 0 }) {
  const [params, setParams] = useSearchParams();
  const queue   = QUEUES.some(x => x.key === params.get('queue')) ? params.get('queue') : 'awaiting';
  const view    = params.get('view') === 'week' ? 'week' : 'list';
  const q       = params.get('q') || '';
  const service = SERVICES[params.get('service')] ? params.get('service') : '';
  const from    = params.get('from') || '';
  const to      = params.get('to') || '';
  const page    = Math.max(1, Number(params.get('page')) || 1);

  const token = headers?.Authorization;
  const authHeaders = useMemo(() => ({ Authorization: token }), [token]);

  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');
  const [busy, setBusy]     = useState(false);
  const [search, setSearch] = useState(q);
  // Phones: the search box shows; service and dates fold behind "Filters" (open when one is in use)
  const [showFilters, setShowFilters] = useState(() => !!(params.get('service') || params.get('from') || params.get('to')));
  const [stamp, setStamp]   = useState(0);
  const [open, setOpen]     = useState(null);   // { id, focus } — booking shown in the side panel
  // ?open=<id> (a notification link) opens that booking once
  const urlOpen = Number(params.get('open')) || null;
  const [seenOpen, setSeenOpen] = useState(null);
  if (urlOpen !== seenOpen) {
    setSeenOpen(urlOpen);
    if (urlOpen) setOpen({ id: urlOpen });
  }

  const update = useCallback((patch) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'bookings');
      Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, String(v)) : next.delete(k)));
      if (!('page' in patch)) next.delete('page');
      return next;
    }, { replace: true });
  }, [setParams]);

  useEffect(() => { setSearch(q); }, [q]);
  useEffect(() => {
    if (search === q) return undefined;
    const t = setTimeout(() => update({ q: search.trim() }), 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = () => setStamp(s => s + 1);
  const allStamp = stamp + reloadKey;   // the billing modal (owned by the dashboard) can ask for a reload too

  // Badges stay live; new bookings are announced, never pushed into the list unasked
  const { counts, fresh } = useLiveCounts({ url: `${api}/bookings/counts/`, authHeaders, stamp: allStamp, onCounts });

  useEffect(() => {
    if (view !== 'list') return undefined;
    let cancelled = false;
    const qs = new URLSearchParams({ page, page_size: PAGE_SIZE });
    if (queue !== 'all') qs.set('queue', queue);
    if (q) qs.set('q', q);
    if (service) qs.set('service', service);
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    setLoading(true);
    setError('');
    fetch(`${api}/bookings/?${qs}`, { headers: authHeaders })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => {
        if (cancelled) return;
        setData(d);
        if (d.page !== page) update({ page: d.page > 1 ? d.page : '' });
      })
      .catch(() => { if (!cancelled) setError('Could not load bookings. Check your connection and try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, authHeaders, view, queue, q, service, from, to, page, allStamp]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Actions (shared by rows and the side panel) ── */
  const setStatus = async (booking, status) => {
    const paid = booking.tracker ? booking.tracker.amount_paid : 0;
    const ask = {
      Cancelled: paid > 0
        ? `Cancel booking #${booking.id}? The customer has paid ${peso(paid)}; refund it in PayMongo.`
        : `Cancel booking #${booking.id}? The customer will see it as cancelled.`,
      Finished: booking.tracker?.remaining_balance > 0
        ? `${peso(booking.tracker.remaining_balance)} is still unpaid. Approve and close booking #${booking.id} anyway?`
        : null,
    }[status];
    if (ask && !window.confirm(ask)) return false;
    let note = '';
    if (status === 'Installing') {
      const reply = window.prompt(`Send booking #${booking.id} back to the crew. What still needs doing? (They get this in their notification and email.)`, '');
      if (reply === null) return false;
      note = reply.trim();
    }
    setBusy(true);
    try {
      const r = await fetch(`${api}/bookings/${booking.id}/update_status/`, {
        method: 'PATCH', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ status, note }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        toast({
          Preparing: `Booking #${booking.id} confirmed. Next: assign a crew.`,
          Finished: `Booking #${booking.id} signed off. The customer can now leave a review.`,
          Installing: `Booking #${booking.id} sent back to the crew.`,
          Cancelled: `Booking #${booking.id} cancelled.`,
        }[status] || `Booking #${booking.id}: ${status}.`);
        reload();
        setBusy(false);
        return true;
      }
      toast(d.error || d.detail || 'Could not update the booking.', 'error');
    } catch {
      toast('Network error. Please try again.', 'error');
    }
    setBusy(false);
    return false;
  };

  const onRowStep = (b) => {
    const step = nextStep(b);
    if (step.key === 'confirm') setStatus(b, 'Preparing');
    else setOpen({ id: b.id, initial: b, focus: step.key === 'crew' ? 'crew' : null });
  };

  const rows = data?.results || [];
  const meta = QUEUES.find(x => x.key === queue);
  const filtersOn = q || service || from || to;
  const queueCount = counts?.[queue];
  // Someone else moved bookings in or out of this queue since it loaded
  const stale = !filtersOn && data && queueCount != null && queueCount !== data.count;

  const exportCsv = async () => {
    const qs = new URLSearchParams({ ...(queue !== 'all' && { queue }), ...(q && { q }), ...(service && { service }), ...(from && { from }), ...(to && { to }) });
    setBusy(true);
    const err = await downloadWithAuth(`${api}/bookings/export/?${qs}`, authHeaders, 'bookings.csv');
    if (err) toast(err, 'error');
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      {/* Queue tabs + view switch */}
      <div className="flex flex-wrap items-center gap-2">
        {view === 'list' ? (
          <div className="order-2 sm:order-1 basis-full sm:basis-0 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 flex-1 min-w-0" role="tablist" aria-label="Booking queues">
            {QUEUES.map(({ key, label, Icon, alert }) => {
              const n = counts?.[key];
              const on = queue === key;
              const hot = alert && n > 0;
              return (
                <button key={key} role="tab" aria-selected={on} onClick={() => update({ queue: key })}
                  className={`shrink-0 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border cursor-pointer transition-colors
                    ${on ? 'bg-slate-900 border-slate-900 text-white' : hot ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <Icon size={15} />
                  {label}
                  {n != null && !['completed', 'all'].includes(key) && (
                    <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold inline-flex items-center justify-center
                      ${on ? 'bg-white/20 text-white' : hot ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>{n > 999 ? '999+' : n}</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="order-2 sm:order-1 basis-full sm:basis-0 flex-1 text-sm text-slate-500">Who is working where this week. Click a job to open it; amber cells mean a crew member has more than one job that day.</p>
        )}
        <div className="order-1 sm:order-2 ml-auto inline-flex h-10 p-1 bg-white border border-slate-200 rounded-xl shrink-0" role="group" aria-label="View">
          {[['list', 'List', List], ['week', 'Week', CalendarDays]].map(([v, l, Icon]) => (
            <button key={v} onClick={() => update({ view: v === 'list' ? '' : v })} aria-pressed={view === v}
              className={`inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-bold border-none cursor-pointer ${view === v ? 'bg-slate-900 text-white' : 'bg-transparent text-slate-500 hover:text-slate-800'}`}>
              <Icon size={14} /> {l}
            </button>
          ))}
        </div>
      </div>

      {view === 'week' ? (
        <WeekSchedule api={api} authHeaders={authHeaders} weekParam={params.get('week')} stamp={allStamp} toast={toast}
          banner={<LiveBanner fresh={fresh} noun="booking" onShow={reload} />}
          onWeek={(w) => update({ week: w })} onOpen={(id) => setOpen({ id })} />
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          {/* Toolbar */}
          <div className="p-3 md:p-4 border-b border-slate-100 space-y-3">
            <p className="text-xs text-slate-500 flex items-start gap-1.5"><meta.Icon size={14} className="shrink-0 mt-px text-slate-400" />{meta.hint}</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative flex-1 min-w-0 sm:min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <span className="sr-only">Search bookings</span>
                <input type="search" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Booking #, customer, phone, address"
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
              </label>
              <button onClick={() => setShowFilters(o => !o)} aria-expanded={showFilters}
                className={`sm:hidden h-10 px-3 inline-flex items-center gap-1.5 rounded-xl border text-sm font-semibold cursor-pointer
                  ${showFilters || service || from || to ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700'}`}>
                <SlidersHorizontal size={15} /> Filters{[service, from || to].filter(Boolean).length ? ` · ${[service, from || to].filter(Boolean).length}` : ''}
              </button>
              <div className={`${showFilters ? 'flex' : 'hidden'} sm:contents w-full flex-wrap items-center gap-2`}>
              <select value={service} onChange={e => update({ service: e.target.value })} aria-label="Service"
                className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-600 cursor-pointer">
                <option value="">All services</option>
                {Object.entries(SERVICES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <input type="date" value={from} max={to || undefined} onChange={e => update({ from: e.target.value })} aria-label="Visit from"
                  className="flex-1 min-w-0 sm:flex-none h-10 px-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-600" />
                <span className="text-slate-400 text-xs">to</span>
                <input type="date" value={to} min={from || undefined} onChange={e => update({ to: e.target.value })} aria-label="Visit until"
                  className="flex-1 min-w-0 sm:flex-none h-10 px-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-600" />
              </div>
              {filtersOn && (
                <button onClick={() => { setSearch(''); update({ q: '', service: '', from: '', to: '' }); }}
                  className="h-10 px-3 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 bg-transparent border-none cursor-pointer">Clear filters</button>
              )}
              <button onClick={exportCsv} disabled={busy || !data?.count} title="Download these bookings as a spreadsheet (CSV)"
                className="ml-auto h-10 px-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                <Download size={15} /> Export
              </button>
              </div>
              <button onClick={reload} title="Refresh" aria-label="Refresh bookings"
                className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 cursor-pointer">
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <LiveBanner fresh={fresh} stale={stale} noun="booking" onShow={reload} />

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
                <p className="font-bold text-slate-700">{filtersOn ? 'No bookings match these filters' : {
                  awaiting: 'No new requests to confirm', dispatch: 'Every confirmed job has a crew', active: 'No jobs in the field right now',
                  review: 'Nothing waiting for sign-off',
                }[queue] || 'No bookings here'}</p>
                <p className="text-sm text-slate-400 mt-1">{filtersOn ? 'Try a different search or clear the filters.' : 'New bookings will appear here automatically.'}</p>
              </div>
            ) : (
              <>
                {/* Laptop / desktop: one row per booking */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                        <th className="px-4 py-3 font-bold">Booking</th>
                        <th className="px-3 py-3 font-bold">Visit</th>
                        <th className="px-3 py-3 font-bold">Customer</th>
                        <th className="px-3 py-3 font-bold">Crew</th>
                        <th className="px-3 py-3 font-bold hidden xl:table-cell">Billing</th>
                        <th className="px-3 py-3 font-bold hidden xl:table-cell">Status</th>
                        <th className="px-4 py-3 font-bold text-right">Next step</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map(b => {
                        const step = nextStep(b);
                        return (
                          <tr key={b.id} onClick={() => setOpen({ id: b.id, initial: b })} className="cursor-pointer hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <div className="font-bold text-slate-900">#{b.id}</div>
                              <div className="text-xs text-slate-500 whitespace-nowrap">{SERVICES[b.service_type] || b.service_type}</div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="font-semibold text-slate-800 whitespace-nowrap">{fmtDay(b.scheduled_date)}</div>
                              <div className="flex items-center gap-2"><span className="text-xs text-slate-400">{TIMES_SHORT[b.preferred_time] || b.preferred_time || ''}</span><WhenTag booking={b} /></div>
                            </td>
                            <td className="px-3 py-3 max-w-[220px]">
                              <div className="font-semibold text-slate-800 truncate">{b.customer_name}</div>
                              <div className="text-xs text-slate-400 truncate">{b.service_address || b.contact_number || '—'}</div>
                            </td>
                            <td className="px-3 py-3">
                              <CrewChips booking={b} />
                              {['Preparing', 'Installing'].includes(b.status) && (b.assigned_crew || []).length > 0 && (
                                <div className="w-28 mt-1.5"><ProgressBar pct={b.progress_pct} /></div>
                              )}
                            </td>
                            <td className="px-3 py-3 hidden xl:table-cell"><BillingChip tracker={b.tracker} /></td>
                            <td className="px-3 py-3 hidden xl:table-cell"><StatusPill status={b.status} /></td>
                            <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                              <button onClick={() => onRowStep(b)} disabled={busy}
                                className={`h-8 px-3 rounded-lg text-xs font-bold border cursor-pointer disabled:opacity-50 whitespace-nowrap ${step.cls}`}>{step.label}</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Phones and tablets: compact cards */}
                <ul className="lg:hidden divide-y divide-slate-100">
                  {rows.map(b => {
                    const step = nextStep(b);
                    return (
                      <li key={b.id} className="p-3 flex items-start gap-3">
                        <button onClick={() => setOpen({ id: b.id, initial: b })} className="flex-1 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer">
                          <p className="m-0 font-bold text-slate-900 truncate">#{b.id} <span className="font-semibold text-slate-700">· {b.customer_name}</span></p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 min-w-0">
                            <span className="font-semibold text-slate-700 shrink-0">{fmtDay(b.scheduled_date)}</span>
                            <span className="shrink-0">{TIMES_SHORT[b.preferred_time] || ''}</span>
                            <WhenTag booking={b} />
                          </div>
                          <p className="m-0 text-xs text-slate-400 truncate mt-0.5">{SERVICES[b.service_type] || b.service_type}{b.service_address ? ` · ${b.service_address}` : ''}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <StatusPill status={b.status} />
                            <CrewChips booking={b} />
                            <BillingChip tracker={b.tracker} />
                          </div>
                        </button>
                        {step.key !== 'view' && (
                          <button onClick={() => onRowStep(b)} disabled={busy}
                            className={`shrink-0 h-11 px-3.5 rounded-xl text-sm font-bold border cursor-pointer disabled:opacity-50 ${step.cls}`}>{step.label}</button>
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
      )}

      {open && (
        <BookingDrawer key={open.id} api={api} authHeaders={authHeaders} toast={toast} open={open} busy={busy} stamp={allStamp}
          onClose={() => { setOpen(null); if (urlOpen) update({ open: '' }); }} onStatus={setStatus} onChanged={reload}
          onOpenDesign={onOpenDesign} onOpenBilling={onOpenBilling} />
      )}
    </div>
  );
}

/* ─── Booking detail panel ───────────────────────────────────────────────── */
function BookingDrawer({ api, authHeaders, toast, open, busy, stamp, onClose, onStatus, onChanged, onOpenDesign, onOpenBilling }) {
  const [booking, setBooking] = useState(open.initial || null);
  const [failed, setFailed]   = useState(false);
  const closeRef = useRef(null);
  const crewRef  = useRef(null);

  // Always show the freshest copy (it may have changed since the list loaded)
  useEffect(() => {
    let cancelled = false;
    fetch(`${api}/bookings/${open.id}/`, { headers: authHeaders })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(b => { if (!cancelled) setBooking(b); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [api, authHeaders, open.id, stamp]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (open.focus === 'crew' && booking && crewRef.current) crewRef.current.scrollIntoView({ block: 'start' });
  }, [open.focus, booking?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (status) => { if (await onStatus(booking, status) && ['Cancelled', 'Finished'].includes(status)) onClose(); };

  const downloadJobSheet = async () => {
    const err = await downloadWithAuth(`${api}/bookings/${booking.id}/generate_pdf/`, authHeaders, `job-sheet-${booking.id}.pdf`);
    if (err) toast(err, 'error');
  };

  const b = booking;
  const mapUrl = b && (b.site_lat && b.site_lng
    ? `https://www.google.com/maps/search/?api=1&query=${b.site_lat},${b.site_lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.service_address || '')}`);
  const design = b?.design_details;
  const showCrew = b && OPEN.includes(b.status) && b.status !== 'For Review';

  return (
    <div className="fixed inset-0 z-[150] flex justify-end" role="dialog" aria-modal="true" aria-label={`Booking ${open.id}`}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg h-full bg-white shadow-2xl flex flex-col">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-100">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900 truncate">{b ? `${SERVICES[b.service_type] || b.service_type}` : 'Booking'} <span className="text-slate-400">#{open.id}</span></h2>
            {b && (
              <>
                <p className="text-sm text-slate-600 font-semibold">{fmtDay(b.scheduled_date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · {TIMES[b.preferred_time] || b.preferred_time || 'Any time'}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2"><StatusPill status={b.status} /><WhenTag booking={b} /></div>
              </>
            )}
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 bg-transparent border-none cursor-pointer"><X size={18} /></button>
        </div>

        {!b ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-500 p-6">
            {failed ? 'Could not load this booking.' : <RefreshCw size={20} className="animate-spin text-slate-400" />}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {b.status === 'For Review' && (
              <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 text-sm text-violet-800">
                <b>The crew marked this job finished.</b> Check the progress photos below, then approve it or send it back.
                {b.tracker?.remaining_balance > 0 && <span className="block mt-1 text-amber-800 font-semibold">{peso(b.tracker.remaining_balance)} of the project is still unpaid.</span>}
              </div>
            )}
            {b.status === 'Pending' && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
                New request. Check the address, date and design, then confirm it so it can be assigned to a crew.
              </div>
            )}

            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Customer</h3>
              <p className="font-bold text-slate-800">{b.customer_name}</p>
              <div className="mt-2 space-y-1.5 text-sm">
                {b.contact_number && <a href={`tel:${b.contact_number}`} className="flex items-center gap-2 text-emerald-700 font-semibold no-underline"><Phone size={14} />{b.contact_number}</a>}
                {b.customer_email && <a href={`mailto:${b.customer_email}`} className="flex items-center gap-2 text-slate-600 no-underline break-all"><Mail size={14} className="shrink-0" />{b.customer_email}</a>}
                {b.service_address && (
                  <a href={mapUrl} target="_blank" rel="noreferrer" className="flex items-start gap-2 text-slate-600 no-underline">
                    <MapPin size={14} className="shrink-0 mt-0.5" /><span>{b.service_address} <span className="text-emerald-700 font-semibold whitespace-nowrap">Open map</span></span>
                  </a>
                )}
              </div>
              {b.notes && <p className="mt-3 text-sm text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3 whitespace-pre-line"><span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Customer notes</span>{b.notes}</p>}
            </section>

            {design && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Design</h3>
                <div className="flex gap-3">
                  {design.image_url
                    ? <img src={design.image_url} alt="" className="w-24 h-20 rounded-xl object-cover bg-slate-100 shrink-0" />
                    : <div className="w-24 h-20 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0"><Layers size={24} className="text-emerald-300" /></div>}
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-slate-800 truncate">{design.name || 'Garden design'}</p>
                    {design.dimensions?.width && <p className="text-xs text-slate-500">{design.dimensions.width}m × {design.dimensions.length}m lot ({design.dimensions.terrainType || 'flat'})</p>}
                    {design.total_cost > 0 && <p className="text-xs font-bold text-emerald-700">Estimate {peso(design.total_cost)}</p>}
                    <button onClick={() => onOpenDesign(design)} className="mt-1.5 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-none cursor-pointer">
                      <Layers size={13} /> Preview 3D
                    </button>
                  </div>
                </div>
                <PlantBOM breakdown={design.plant_breakdown} />
              </section>
            )}

            {showCrew && <div ref={crewRef}><CrewPicker api={api} authHeaders={authHeaders} toast={toast} booking={b} onSaved={(nb) => { setBooking(nb); onChanged(); }} /></div>}
            {!showCrew && (b.assigned_crew_names || []).length > 0 && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Crew</h3>
                <p className="text-sm text-slate-700 flex items-center gap-2"><UserCheck size={14} className="text-emerald-600" />{b.assigned_crew_names.join(', ')}</p>
              </section>
            )}

            {['Preparing', 'Installing', 'For Review', 'Finished'].includes(b.status) && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Progress</h3>
                <ProgressBar pct={b.progress_pct} />
                <div className="mt-3"><ProgressPhotos booking={b} toast={toast} canUpload={false} /></div>
              </section>
            )}

            {b.status !== 'Cancelled' && (
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Project &amp; billing</h3>
                <button onClick={() => onOpenBilling(b)}
                  className="w-full text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 cursor-pointer">
                  {b.tracker ? (
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="text-slate-600"><b className="text-slate-800">{peso(b.tracker.amount_paid)}</b> of {peso(b.tracker.total_price)} paid</span>
                      <BillingChip tracker={b.tracker} />
                    </div>
                  ) : <span className="text-sm font-semibold text-slate-600">+ Set up project billing</span>}
                </button>
              </section>
            )}
          </div>
        )}

        {b && (
          <div className="p-4 border-t border-slate-100 space-y-2 bg-slate-50">
            {b.status === 'Pending' && (
              <button onClick={() => act('Preparing')} disabled={busy}
                className="w-full h-11 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white border-none cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2">
                <CheckCircle2 size={16} /> Confirm booking
              </button>
            )}
            {b.status === 'For Review' && (
              <div className="flex gap-2">
                <button onClick={() => act('Installing')} disabled={busy}
                  className="flex-1 h-11 rounded-xl text-sm font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 cursor-pointer disabled:opacity-50">Send back to crew</button>
                <button onClick={() => act('Finished')} disabled={busy}
                  className="flex-1 h-11 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-none cursor-pointer disabled:opacity-50">Approve &amp; close</button>
              </div>
            )}
            <div className="flex gap-2">
              {b.status !== 'Cancelled' && (
                <button onClick={downloadJobSheet}
                  className="flex-1 h-10 rounded-xl text-sm font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 cursor-pointer inline-flex items-center justify-center gap-2">
                  <FileDown size={15} /> Job sheet
                </button>
              )}
              {OPEN.includes(b.status) && (
                <button onClick={() => act('Cancelled')} disabled={busy}
                  className="flex-1 h-10 rounded-xl text-sm font-bold bg-white hover:bg-red-50 text-red-600 border border-red-200 cursor-pointer disabled:opacity-50">Cancel booking</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Crew assignment, with each person's load that day ──────────────────── */
function CrewPicker({ api, authHeaders, toast, booking, onSaved }) {
  const [day, setDay]       = useState(null);   // schedule for this booking's date
  const [chosen, setChosen] = useState(() => new Set(booking.assigned_crew || []));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = booking.scheduled_date;
    fetch(`${api}/bookings/schedule/?from=${d}&to=${d}`, { headers: authHeaders })
      .then(r => (r.ok ? r.json() : null)).then(setDay).catch(() => setDay(null));
  }, [api, authHeaders, booking.scheduled_date]);

  const load = (crewId) => (day?.bookings || []).filter(x => x.id !== booking.id && x.crew.includes(crewId) && OPEN.includes(x.status));
  const rec = crewRecommendation(booking);
  const dirty = chosen.size !== (booking.assigned_crew || []).length || [...chosen].some(id => !(booking.assigned_crew || []).includes(id));
  const toggle = (id) => setChosen(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${api}/bookings/${booking.id}/assign_crew/`, {
        method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ crew_ids: [...chosen] }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { toast(chosen.size ? `Crew saved for booking #${booking.id}. They have been notified.` : 'Crew removed.'); onSaved(d); }
      else toast(d.error || d.detail || 'Could not save the crew.', 'error');
    } catch {
      toast('Network error. Please try again.', 'error');
    }
    setSaving(false);
  };

  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5"><UserCheck size={12} /> Crew for {fmtDay(booking.scheduled_date)}</h3>
      {rec && (
        <p className={`text-xs rounded-lg px-3 py-2 mb-2 border ${chosen.size && chosen.size < rec.count ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
          Suggested: <b>{rec.label}</b>{rec.area ? ` for a ${Math.round(rec.area)} sqm lot` : ''}.
          {chosen.size > 0 && chosen.size < rec.count && ` Only ${chosen.size} picked.`}
        </p>
      )}
      {!day ? (
        <p className="text-sm text-slate-400">Loading crew…</p>
      ) : day.crew.length === 0 ? (
        <p className="text-sm text-slate-500">No field crew accounts yet. Add them under User Accounts.</p>
      ) : (
        <ul className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
          {day.crew.map(c => {
            const jobs = load(c.id);
            return (
              <li key={c.id}>
                <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${chosen.has(c.id) ? 'bg-emerald-50' : 'bg-white hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={chosen.has(c.id)} onChange={() => toggle(c.id)} className="w-4 h-4 accent-emerald-600 shrink-0" />
                  <span className="flex-1 text-sm font-semibold text-slate-800">{c.name}</span>
                  <span className={`text-xs font-semibold ${jobs.length ? 'text-amber-700' : 'text-emerald-700'}`}
                    title={jobs.map(j => `#${j.id} ${j.service_label} (${TIMES_SHORT[j.time] || j.time || 'any time'})`).join('\n')}>
                    {jobs.length ? `${jobs.length} other job${jobs.length > 1 ? 's' : ''} that day` : 'Free that day'}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {dirty && (
        <button onClick={save} disabled={saving}
          className="mt-2 w-full h-10 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-none cursor-pointer disabled:opacity-50">
          {saving ? 'Saving…' : chosen.size ? `Assign ${chosen.size} crew member${chosen.size > 1 ? 's' : ''}` : 'Remove all crew'}
        </button>
      )}
    </section>
  );
}

/* ─── Plant list from the design (what to source for the job) ───────────── */
function PlantBOM({ breakdown }) {
  const [open, setOpen] = useState(false);
  if (!breakdown?.length) return null;
  const total = breakdown.reduce((s, r) => s + (Number(r.subtotal) || 0), 0);
  return (
    <div className="mt-3 border border-slate-200 rounded-xl">
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-transparent border-none cursor-pointer text-xs font-bold text-slate-600">
        <span>Plant list · {breakdown.length} item{breakdown.length > 1 ? 's' : ''}</span>
        <span className="text-emerald-700">{peso(total)} {open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <table className="w-full text-xs border-t border-slate-100">
          <tbody>
            {breakdown.map((r, i) => (
              <tr key={i} className="border-b border-slate-50 last:border-0">
                <td className="px-3 py-1.5 font-semibold text-slate-700">{r.name}</td>
                <td className="px-2 py-1.5 text-right font-bold text-emerald-700">×{r.quantity}</td>
                <td className="px-3 py-1.5 text-right text-slate-600">{peso(r.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ─── Week dispatch calendar: crew × day ─────────────────────────────────── */
const CHIP = {
  Pending:      'bg-amber-50 border-amber-200 text-amber-800',
  Preparing:    'bg-blue-50 border-blue-200 text-blue-800',
  Installing:   'bg-orange-50 border-orange-200 text-orange-800',
  'For Review': 'bg-violet-50 border-violet-200 text-violet-800',
  Finished:     'bg-slate-50 border-slate-200 text-slate-400 line-through',
};

// One page per crew member: that day's jobs in visit order, for the crew to take on the road
const TIME_ORDER = { morning: 0, afternoon: 1 };
function printRunSheet(day, data) {
  const jobs = data.bookings.filter(b => b.date === day && OPEN.includes(b.status))
    .sort((a, b) => (TIME_ORDER[a.time] ?? 2) - (TIME_ORDER[b.time] ?? 2) || a.id - b.id);
  const when = fmtDay(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const rows = (list) => list.map(j => `
    <tr><td class="box"></td>
      <td><b>#${j.id}</b><br><span class="muted">${esc(TIMES[j.time] || j.time || 'Any time')}</span></td>
      <td><b>${esc(j.service_label)}</b><br>${esc(j.customer_name)} · ${esc(j.contact || '')}</td>
      <td>${esc(j.address || '')}${j.notes ? `<br><span class="muted">Note: ${esc(j.notes)}</span>` : ''}</td></tr>`).join('');
  const table = (list) => `<table><thead><tr><th class="box"></th><th>Job</th><th>Service &amp; customer</th><th>Address</th></tr></thead><tbody>${rows(list)}</tbody></table>`;
  const pages = data.crew.map(c => ({ c, list: jobs.filter(j => j.crew.includes(c.id)) })).filter(x => x.list.length)
    .map(({ c, list }, i) => `<section class="${i ? 'page' : ''}">
      <h1>${esc(c.name)}: ${list.length} job${list.length > 1 ? 's' : ''}</h1>
      <p class="muted">${esc(when)} · printed ${esc(printedAt())}. Tick each job when done.</p>
      ${table(list)}
      <p class="sign">Crew signature: ____________________ &nbsp; Time back: __________</p></section>`).join('');
  const unassigned = jobs.filter(j => !j.crew.length);
  const warning = unassigned.length ? `<section class="${pages ? 'page' : ''}"><h1>No crew assigned yet: ${unassigned.length} job${unassigned.length > 1 ? 's' : ''}</h1>
    <p class="muted">${esc(when)}. Assign these before the crew leaves.</p>${table(unassigned)}</section>` : '';
  return openPrintWindow(`Run sheet ${day}`, pages + warning || `<h1>No open jobs on ${esc(when)}</h1>`);
}

function WeekSchedule({ api, authHeaders, weekParam, stamp, toast, banner, onWeek, onOpen }) {
  const monday = useMemo(() => startOfWeek(weekParam ? parseDay(weekParam) : new Date()), [weekParam]);
  const days = useMemo(() => [...Array(7)].map((_, i) => isoDay(addDays(monday, i))), [monday]);
  const [data, setData]   = useState(null);
  const [error, setError] = useState(false);
  const today = isoDay(new Date());

  useEffect(() => {
    let cancelled = false;
    fetch(`${api}/bookings/schedule/?from=${days[0]}&to=${days[6]}`, { headers: authHeaders })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => { if (!cancelled) { setData(d); setError(false); } })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [api, authHeaders, days, stamp]);

  const rows = useMemo(() => {
    if (!data) return [];
    const cell = (pred) => Object.fromEntries(days.map(d => [d, data.bookings.filter(b => b.date === d && pred(b))]));
    return [
      { id: 'none', name: 'No crew yet', cells: cell(b => !b.crew.length), unassigned: true },
      ...data.crew.map(c => ({ id: c.id, name: c.name, cells: cell(b => b.crew.includes(c.id)) })),
    ];
  }, [data, days]);

  const shift = (n) => onWeek(isoDay(addDays(monday, 7 * n)));
  const thisWeek = isoDay(startOfWeek(new Date())) === days[0];
  const label = `${fmtDay(days[0], { month: 'short', day: 'numeric' })} – ${fmtDay(days[6], { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="flex flex-wrap items-center gap-2 p-3 md:p-4 border-b border-slate-100">
        <button onClick={() => shift(-1)} aria-label="Previous week" className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"><ChevronLeft size={16} /></button>
        <button onClick={() => shift(1)} aria-label="Next week" className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"><ChevronRight size={16} /></button>
        <h3 className="font-bold text-slate-800 text-sm md:text-base">{label}</h3>
        {!thisWeek && <button onClick={() => onWeek('')} className="h-9 px-3 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer">This week</button>}
        <div className="ml-auto hidden md:flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          {Object.entries({ Pending: 'To confirm', Preparing: 'Confirmed', Installing: 'Installing', 'For Review': 'To sign off' }).map(([s, l]) => (
            <span key={s} className={`px-2 py-0.5 rounded-md border font-semibold ${CHIP[s]}`}>{l}</span>
          ))}
        </div>
      </div>

      {banner}
      {error ? (
        <p className="p-8 text-center text-sm text-slate-600">Could not load the schedule. Try again in a moment.</p>
      ) : !data ? (
        <div className="p-8 flex justify-center"><RefreshCw size={20} className="animate-spin text-slate-400" /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-xs border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white w-36 px-3 py-2 text-left text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-100">Crew</th>
                {days.map(d => {
                  const n = data.bookings.filter(b => b.date === d).length;
                  return (
                    <th key={d} className={`px-2 py-2 text-left font-bold border-b border-l border-slate-100 ${d === today ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600'}`}>
                      {fmtDay(d, { weekday: 'short' })} <span className="text-slate-400 font-semibold">{parseDay(d).getDate()}</span>
                      {n > 0 && <span className="ml-1 text-[10px] text-slate-400 font-semibold">· {n}</span>}
                      {n > 0 && (
                        <button onClick={() => { if (!printRunSheet(d, data)) toast('Allow pop-ups for this site to print the run sheet.', 'error'); }}
                          title={`Print run sheets for ${fmtDay(d)}`} aria-label={`Print run sheets for ${fmtDay(d)}`}
                          className="ml-1 align-middle p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-white bg-transparent border-none cursor-pointer"><Printer size={13} /></button>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="align-top">
                  <th className={`sticky left-0 z-10 px-3 py-2 text-left font-semibold border-b border-slate-100 ${row.unassigned ? 'bg-amber-50 text-amber-800' : 'bg-white text-slate-700'}`}>
                    {row.unassigned ? <span className="inline-flex items-center gap-1"><AlertTriangle size={12} /> {row.name}</span> : row.name}
                  </th>
                  {days.map(d => {
                    const jobs = row.cells[d];
                    const busyDay = !row.unassigned && jobs.filter(j => OPEN.includes(j.status)).length > 1;
                    return (
                      <td key={d} className={`px-1.5 py-1.5 border-b border-l border-slate-100 h-14 ${busyDay ? 'bg-amber-50' : d === today ? 'bg-emerald-50/40' : ''}`}>
                        {busyDay && <p className="text-[10px] font-bold text-amber-700 mb-1">{jobs.length} jobs</p>}
                        <div className="space-y-1">
                          {jobs.map(j => (
                            <button key={j.id} onClick={() => onOpen(j.id)} title={`${j.customer_name} · ${j.address || ''}`}
                              className={`w-full text-left px-1.5 py-1 rounded-md border cursor-pointer hover:brightness-95 ${CHIP[j.status] || 'bg-white border-slate-200'}`}>
                              <span className="font-bold">#{j.id}</span> {TIMES_SHORT[j.time] || ''}
                              <span className="block truncate font-medium">{j.customer_name}</span>
                            </button>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.bookings.length === 0 && <p className="px-4 pb-4 pt-2 text-sm text-slate-400 flex items-center gap-2"><Calendar size={14} /> No bookings this week.</p>}
    </div>
  );
}
