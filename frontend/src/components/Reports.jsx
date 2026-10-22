import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BarChart3, Download, Wallet, Receipt, HardHat, Table2, ChevronRight } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { downloadWithAuth } from './ui/download';
import { API_BASE_URL as API_ROOT } from '../config';

/*
 * Owner: Reports — the numbers the business is run (and taxed) on. Three reports, each also a CSV:
 *   Money in   cash actually received in a period, by channel and by day, minus refunds
 *   Balances   who still owes us, aged by how long ago the job was done
 *   Crew       per field crew member: jobs, deliveries, cash collected, hours on shift
 * Income analytics on the Business overview shows work *earned*; Money in shows money *collected*.
 * Data: /api/reports/{money,balances,crew}/ (BACKEND apps/library/reports.py). Report and period live in the URL.
 */

const API = API_ROOT;
const REPORTS = [
  { key: 'money', label: 'Money in', Icon: Wallet },
  { key: 'balances', label: 'Balances', Icon: Receipt },
  { key: 'crew', label: 'Crew', Icon: HardHat },
];
const BAR = '#059669';        // one series, one hue (emerald-600): magnitude only, the title names it
const BAR_TRACK = '#d1fae5';

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtDate = (s, opts = { month: 'short', day: 'numeric' }) => new Date(`${s}T00:00:00`).toLocaleDateString('en-PH', opts);

function presets() {
  const t = new Date();
  const y = t.getFullYear(), m = t.getMonth();
  return [
    { key: 'month', label: 'This month', from: iso(new Date(y, m, 1)), to: iso(t) },
    { key: 'last', label: 'Last month', from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) },
    { key: '30', label: 'Last 30 days', from: iso(new Date(y, m, t.getDate() - 29)), to: iso(t) },
    { key: 'year', label: 'This year', from: iso(new Date(y, 0, 1)), to: iso(t) },
  ];
}

function Tile({ label, value, sub, tone }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5">
      <p className="m-0 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="m-0 mt-1.5 text-2xl md:text-[28px] font-extrabold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className={`m-0 mt-0.5 text-sm ${tone || 'text-slate-500'}`}>{sub}</p>}
    </div>
  );
}

/* Horizontal bars for a short labelled list (channels, aging). Labels and values in ink, not bar colour. */
function BarList({ rows, amountOf = r => r.amount, render = r => peso(r.amount), note }) {
  const max = Math.max(1, ...rows.map(amountOf));
  return (
    <ul className="m-0 p-0 list-none flex flex-col gap-3">
      {rows.map(r => (
        <li key={r.key || r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-slate-700 font-medium">{r.label}</span>
            <span className="text-slate-900 font-bold tabular-nums whitespace-nowrap">{render(r)}{note ? <span className="text-slate-500 font-medium"> · {note(r)}</span> : null}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full" style={{ background: BAR_TRACK }}>
            <div className="h-2 rounded-full" style={{ width: `${(amountOf(r) / max) * 100}%`, background: BAR, minWidth: amountOf(r) > 0 ? 4 : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* Money received per day (weeks for long periods): one series, hover/focus tooltip, table view. */
function DailyChart({ days, channels }) {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const buckets = useMemo(() => {
    if (days.length <= 62) return days.map(d => ({ ...d, label: fmtDate(d.date), short: String(Number(d.date.slice(8))) }));
    const weeks = [];
    days.forEach((d, i) => {
      if (i % 7 === 0) weeks.push({ date: d.date, total: 0, ...Object.fromEntries(channels.map(c => [c.key, 0])) });
      const w = weeks.at(-1);
      w.total += d.total;
      channels.forEach(c => { w[c.key] += d[c.key]; });
      w.end = d.date;
    });
    return weeks.map(w => ({ ...w, label: `${fmtDate(w.date)} – ${fmtDate(w.end)}`, short: fmtDate(w.date) }));
  }, [days, channels]);
  const max = Math.max(1, ...buckets.map(b => b.total));
  const labelEvery = Math.ceil(buckets.length / 10);
  const weekly = days.length > 62;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="m-0 text-[15px] font-extrabold text-slate-900">Money received per {weekly ? 'week' : 'day'}</h3>
          <p className="m-0 text-sm text-slate-500">All channels, before refunds. Highest: {peso(max === 1 ? 0 : max)}</p>
        </div>
        <button type="button" onClick={() => setAsTable(v => !v)} aria-pressed={asTable}
          className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-sm font-semibold cursor-pointer flex items-center gap-1.5 shrink-0">
          <Table2 size={15} /> {asTable ? 'Chart' : 'Table'}
        </button>
      </div>
      {asTable ? (
        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-bold">{weekly ? 'Week' : 'Day'}</th>
              {channels.map(c => <th key={c.key} className="py-2 px-3 font-bold text-right whitespace-nowrap">{c.label}</th>)}
              <th className="py-2 pl-3 font-bold text-right">Total</th>
            </tr></thead>
            <tbody>
              {buckets.map(b => (
                <tr key={b.date} className="border-t border-slate-100">
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-700">{b.label}</td>
                  {channels.map(c => <td key={c.key} className="py-2 px-3 text-right tabular-nums text-slate-700">{b[c.key] ? peso(b[c.key]) : '–'}</td>)}
                  <td className="py-2 pl-3 text-right tabular-nums font-bold text-slate-900">{peso(b.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-end gap-[2px] h-48 border-b border-slate-300" role="img"
            aria-label={`Money received per ${weekly ? 'week' : 'day'}; use Table for exact figures`}>
            {buckets.map((b, i) => (
              <button key={b.date} type="button" aria-label={`${b.label}: ${peso(b.total)}`}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                className="relative flex-1 h-full flex items-end p-0 border-none bg-transparent cursor-default min-w-0 group">
                <span className="block w-full rounded-t-[4px] transition-opacity"
                  style={{ height: `${(b.total / max) * 100}%`, minHeight: b.total > 0 ? 2 : 0, background: BAR, opacity: hover === null || hover === i ? 1 : 0.45 }} />
              </button>
            ))}
          </div>
          <div className="flex gap-[2px] mt-1.5" aria-hidden="true">
            {buckets.map((b, i) => (
              <span key={b.date} className="flex-1 min-w-0 text-[11px] text-slate-500 text-center overflow-visible whitespace-nowrap">
                {i % labelEvery === 0 ? b.short : ''}
              </span>
            ))}
          </div>
          {hover !== null && (
            <div className="absolute top-0 z-10 bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-sm pointer-events-none"
              style={{ left: `${Math.min(Math.max((hover + 0.5) / buckets.length * 100, 15), 85)}%`, transform: 'translateX(-50%)' }}>
              <p className="m-0 font-bold text-slate-900 whitespace-nowrap">{buckets[hover].label} · {peso(buckets[hover].total)}</p>
              {channels.filter(c => buckets[hover][c.key]).map(c => (
                <p key={c.key} className="m-0 text-slate-600 whitespace-nowrap">{c.label}: <b className="text-slate-900">{peso(buckets[hover][c.key])}</b></p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function MoneyReport({ data }) {
  const ch = data.channels;
  const change = data.change_pct;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
        <Tile label="Net money in" value={peso(data.net)}
          sub={change === null ? `Previous period: ${peso(data.previous_net)}` : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% vs the period before (${peso(data.previous_net)})`}
          tone={change === null ? undefined : change >= 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'} />
        <Tile label="Received" value={peso(data.received)} sub={`${ch.reduce((n, c) => n + c.count, 0)} payments`} />
        <Tile label="Refunded" value={peso(data.refunds.amount)} sub={data.refunds.count ? `${data.refunds.count} online order${data.refunds.count > 1 ? 's' : ''}` : 'No refunds'} />
      </div>
      <DailyChart days={data.days} channels={ch} />
      <div className="grid lg:grid-cols-2 gap-5">
        <section className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5">
          <h3 className="m-0 mb-4 text-[15px] font-extrabold text-slate-900">Where the money came from</h3>
          <BarList rows={ch} note={r => `${r.count} payment${r.count === 1 ? '' : 's'}`} />
        </section>
        <section className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 flex flex-col gap-4">
          <div>
            <h3 className="m-0 mb-1 text-[15px] font-extrabold text-slate-900">Project payments recorded by the office</h3>
            {data.office_methods.length ? <BarList rows={data.office_methods} note={r => `${r.count} payment${r.count === 1 ? '' : 's'}`} />
              : <p className="m-0 text-sm text-slate-500">None in this period.</p>}
          </div>
          <div className="border-t border-slate-100 pt-4">
            <h3 className="m-0 mb-1 text-[15px] font-extrabold text-slate-900">Cash handed in by crew</h3>
            <p className="m-0 text-sm text-slate-600">
              {data.cash_handovers.count} handover{data.cash_handovers.count === 1 ? '' : 's'}
              {data.cash_handovers.short ? <> · <b className="text-red-700">short {peso(data.cash_handovers.short)}</b></> : ' · nothing short'}
              {data.cash_handovers.over ? <> · over {peso(data.cash_handovers.over)}</> : ''}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function BalanceTable({ rows, finished }) {
  if (!rows.length) return <p className="m-0 text-sm text-slate-500 p-4">Nothing owed here.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[620px]">
        <thead><tr className="text-left text-xs text-slate-500">
          <th className="py-2 px-4 font-bold">Booking</th><th className="py-2 px-3 font-bold">Customer</th>
          <th className="py-2 px-3 font-bold">{finished ? 'Job done' : 'Job date'}</th>
          <th className="py-2 px-3 font-bold text-right">Paid</th><th className="py-2 px-3 font-bold text-right">Balance</th><th className="py-2 px-3" />
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.booking_id} className="border-t border-slate-100">
              <td className="py-2.5 px-4 whitespace-nowrap"><b className="text-slate-900">#{r.booking_id}</b> <span className="text-slate-500">{r.service}</span></td>
              <td className="py-2.5 px-3 text-slate-700">{r.customer}</td>
              <td className={`py-2.5 px-3 whitespace-nowrap ${finished && r.days_since_job > 60 ? 'text-red-700 font-semibold' : 'text-slate-600'}`}>
                {fmtDate(r.job_date, { month: 'short', day: 'numeric', year: 'numeric' })}{finished ? ` · ${r.days_since_job}d ago` : ` · ${r.status}`}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">{peso(r.paid)} <span className="text-slate-400">/ {peso(r.total)}</span></td>
              <td className="py-2.5 px-3 text-right tabular-nums font-bold text-slate-900">{peso(r.balance)}{r.requested ? <span className="block text-xs font-medium text-slate-500">{peso(r.requested)} requested</span> : null}</td>
              <td className="py-2.5 pr-4 text-right"><Link to={`/staff-dashboard?tab=bookings&queue=all&open=${r.booking_id}`} aria-label={`Open booking ${r.booking_id}`} className="text-slate-400 hover:text-emerald-700"><ChevronRight size={18} /></Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BalancesReport({ data }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
        <Tile label="Owed on finished jobs" value={peso(data.owed_total)} sub={`${data.owed_count} job${data.owed_count === 1 ? '' : 's'} · collect these now`} />
        <Tile label="Still to bill on open jobs" value={peso(data.open_total)} sub={`${data.open_count} job${data.open_count === 1 ? '' : 's'} in progress`} />
        <Tile label="Cash with crew" value={peso(data.cash_with_crew.amount)} sub={data.cash_with_crew.count ? `${data.cash_with_crew.count} deliveries not handed in` : 'All handed in'} />
      </div>
      <section className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5">
        <h3 className="m-0 text-[15px] font-extrabold text-slate-900">How long finished jobs have been unpaid</h3>
        <p className="m-0 mb-4 text-sm text-slate-500">Counted from the job date. The older a balance, the harder it is to collect.</p>
        <BarList rows={data.aging} note={r => `${r.count} job${r.count === 1 ? '' : 's'}`} />
      </section>
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <h3 className="m-0 px-4 md:px-5 pt-4 text-[15px] font-extrabold text-slate-900">Finished jobs with a balance</h3>
        <p className="m-0 px-4 md:px-5 pb-2 text-sm text-slate-500">Largest first{data.owed_count > data.owed.length ? `; showing ${data.owed.length} of ${data.owed_count} (download the CSV for all)` : ''}.</p>
        <BalanceTable rows={data.owed} finished />
      </section>
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <h3 className="m-0 px-4 md:px-5 pt-4 pb-2 text-[15px] font-extrabold text-slate-900">Jobs in progress</h3>
        <BalanceTable rows={data.open} finished={false} />
      </section>
    </div>
  );
}

function CrewReport({ data }) {
  if (!data.crew.length) return <p className="bg-white border border-slate-200 rounded-2xl p-6 text-slate-500 m-0">No field crew yet.</p>;
  return (
    <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead><tr className="text-left text-xs text-slate-500">
            <th className="py-3 px-4 font-bold">Crew member</th>
            <th className="py-3 px-3 font-bold text-right">Jobs finished</th><th className="py-3 px-3 font-bold text-right">Value</th>
            <th className="py-3 px-3 font-bold text-right">Open jobs</th><th className="py-3 px-3 font-bold text-right">Deliveries</th>
            <th className="py-3 px-3 font-bold text-right">Cash collected</th><th className="py-3 px-3 font-bold text-right">Cash short</th>
            <th className="py-3 px-4 font-bold text-right">Hours · days</th>
          </tr></thead>
          <tbody>
            {data.crew.map(r => (
              <tr key={r.crew_id} className="border-t border-slate-100">
                <td className="py-3 px-4 font-bold text-slate-900">{r.name}{!r.active && <span className="ml-1.5 text-xs font-semibold text-slate-400">(left)</span>}</td>
                <td className="py-3 px-3 text-right tabular-nums text-slate-900 font-bold">{r.jobs_finished}</td>
                <td className="py-3 px-3 text-right tabular-nums text-slate-600">{peso(r.jobs_value)}</td>
                <td className="py-3 px-3 text-right tabular-nums text-slate-600">{r.jobs_open}</td>
                <td className="py-3 px-3 text-right tabular-nums text-slate-900">{r.deliveries}</td>
                <td className="py-3 px-3 text-right tabular-nums text-slate-600">{peso(r.cash_collected)}</td>
                <td className={`py-3 px-3 text-right tabular-nums ${r.cash_short ? 'text-red-700 font-bold' : 'text-slate-400'}`}>{r.cash_short ? peso(r.cash_short) : '–'}</td>
                <td className="py-3 px-4 text-right tabular-nums text-slate-600 whitespace-nowrap">{r.hours} h · {r.days_worked} d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="m-0 px-4 py-3 text-xs text-slate-500 border-t border-slate-100">
        Jobs count by their scheduled date; a job worked by two crew members counts for both, with its full value.
        Hours come from clock-in and clock-out on the Attendance page.
      </p>
    </section>
  );
}

export default function Reports() {
  const { authTokens } = useAuth();
  const [params, setParams] = useSearchParams();
  const report = REPORTS.some(r => r.key === params.get('report')) ? params.get('report') : 'money';
  const PRESETS = useMemo(() => presets(), []);
  const from = params.get('from') || PRESETS[0].from;
  const to = params.get('to') || PRESETS[0].to;
  const activePreset = PRESETS.find(p => p.from === from && p.to === to)?.key || 'custom';
  const usesPeriod = report !== 'balances';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const query = usesPeriod ? `?from=${from}&to=${to}` : '';
  const requestKey = `${report}${query}`;

  useEffect(() => {
    let live = true;
    api.get(`/reports/${report}/${query}`)
      .then(r => { if (live) { setData({ key: requestKey, body: r.data }); setError(''); } })
      .catch(e => { if (live) setError(e.response?.data?.error || 'Could not load the report. Refresh to try again.'); });
    return () => { live = false; };
  }, [report, query, requestKey]);

  const set = (next) => setParams(Object.fromEntries(Object.entries({ report, from: params.get('from'), to: params.get('to'), ...next }).filter(([, v]) => v)));
  const ready = data?.key === requestKey ? data.body : null;

  const download = async () => {
    setDownloadError('');
    const sep = query ? '&' : '?';
    const err = await downloadWithAuth(`${API}/reports/${report}/${query}${sep}export=csv`, { Authorization: `Bearer ${authTokens?.access}` }, `${report}.csv`);
    if (err) setDownloadError(err);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><BarChart3 size={22} /></span>
          <div>
            <h1 className="m-0 text-2xl font-extrabold text-slate-900 tracking-tight">Reports</h1>
            <p className="m-0 mt-0.5 text-sm text-slate-500">Money actually received, who still owes you, and what each crew member did.</p>
          </div>
        </div>
        <button type="button" onClick={download}
          className="h-11 px-4 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-bold cursor-pointer flex items-center gap-2 shrink-0">
          <Download size={16} /> <span className="hidden sm:inline">Download CSV</span>
        </button>
      </div>
      {downloadError && <p role="alert" className="m-0 mb-4 text-sm font-semibold text-red-700">{downloadError}</p>}

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-5">
        <div role="tablist" aria-label="Report" className="flex bg-white border border-slate-200 rounded-2xl p-1 w-fit">
          {REPORTS.map(({ key, label, Icon }) => (
            <button key={key} role="tab" type="button" aria-selected={report === key} onClick={() => set({ report: key })}
              className={`h-10 px-4 rounded-xl text-sm font-semibold border-none cursor-pointer flex items-center gap-2 whitespace-nowrap
                ${report === key ? 'bg-emerald-600 text-white' : 'bg-transparent text-slate-600 hover:bg-slate-50'}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
        {usesPeriod ? (
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            {PRESETS.map(p => (
              <button key={p.key} type="button" aria-pressed={activePreset === p.key} onClick={() => set({ from: p.from, to: p.to })}
                className={`h-9 px-3 rounded-full text-sm font-semibold border cursor-pointer
                  ${activePreset === p.key ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                {p.label}
              </button>
            ))}
            <span className="flex items-center gap-1.5 text-sm text-slate-500">
              <input type="date" aria-label="From" value={from} max={to} onChange={e => e.target.value && set({ from: e.target.value })}
                className="h-9 px-2 rounded-lg border border-slate-200 bg-white text-slate-700" />
              –
              <input type="date" aria-label="To" value={to} min={from} onChange={e => e.target.value && set({ to: e.target.value })}
                className="h-9 px-2 rounded-lg border border-slate-200 bg-white text-slate-700" />
            </span>
          </div>
        ) : <p className="m-0 text-sm text-slate-500 lg:ml-auto">As of today</p>}
      </div>

      {error ? <p role="alert" className="m-0 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
        : !ready ? <div className="h-96 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          : report === 'money' ? <MoneyReport data={ready} />
            : report === 'balances' ? <BalancesReport data={ready} />
              : <CrewReport data={ready} />}
    </div>
  );
}
