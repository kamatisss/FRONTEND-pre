import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  FolderKanban, Download, Search, X, AlertTriangle, HardHat, UserX, ClipboardCheck, Wallet, Briefcase, ChevronRight,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { downloadWithAuth } from './ui/download';
import Pager from './ui/Pager';
import { API_BASE_URL } from '../config';
import { Bar } from './ProjectTimeline';

/*
 * Office & owner: every landscaping project on one screen (BACKEND project_board.py).
 * Shows both progress measures side by side: the office stage (project tracker) and the crew stages.
 * Delays (overdue, no crew update, waiting for sign-off) are worked out by the server.
 * Filters and page live in the URL; a row opens the job in Bookings.
 */

const SCOPES = [['open', 'Open'], ['finished', 'Finished'], ['cancelled', 'Cancelled'], ['all', 'All']];
const SERVICES = [['', 'All services'], ['maintenance', 'Maintenance'], ['consultation', 'Consultation'],
  ['hardscaping', 'Full Hardscaping'], ['Softscape', 'Softscape / Planting']];
const STATUS_TONE = {
  Pending: 'bg-amber-50 text-amber-800 border-amber-200',
  Preparing: 'bg-blue-50 text-blue-700 border-blue-200',
  Installing: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'For Review': 'bg-violet-50 text-violet-700 border-violet-200',
  Finished: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};
const FILTER_KEYS = ['scope', 'delayed', 'owing', 'crew', 'service', 'q', 'page'];

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;
const day = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
const ago = (iso) => {
  if (!iso) return 'No crew activity yet';
  const days = Math.floor((Date.now() - new Date(iso)) / 86400000);
  return days <= 0 ? 'Crew active today' : days === 1 ? 'Crew active yesterday' : `Crew active ${days} days ago`;
};

function StatusPill({ row }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${STATUS_TONE[row.status] || STATUS_TONE.Cancelled}`}>{row.status_label}</span>;
}

function Delays({ row }) {
  if (!row.delay_labels.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {row.delay_labels.map((label, i) => (
        <span key={label} className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 text-[11px] font-bold whitespace-nowrap">
          <AlertTriangle size={11} />{label}{row.delays[i] === 'overdue' && row.days_late ? ` · ${row.days_late}d` : ''}
        </span>
      ))}
    </div>
  );
}

function OfficeStage({ row }) {
  if (!row.office_stage) return <span className="text-xs text-slate-400">Not set up</span>;
  return (
    <div className="min-w-[140px]">
      <p className="m-0 mb-1 text-xs font-semibold text-slate-700 truncate">{row.office_stage_label}</p>
      <Bar pct={row.office_pct} />
    </div>
  );
}

function CrewStages({ row }) {
  const all = row.crew_stages_done >= row.crew_stages_total;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${all ? 'text-emerald-700' : row.crew_stages_done ? 'text-slate-700' : 'text-slate-400'}`}
      title="Site preparation, installation, final inspection">
      <span className="flex gap-0.5" aria-hidden="true">
        {Array.from({ length: row.crew_stages_total }, (_, i) => (
          <span key={i} className={`w-2.5 h-2.5 rounded-sm ${i < row.crew_stages_done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
        ))}
      </span>
      {row.crew_stages_done}/{row.crew_stages_total}
    </span>
  );
}

function Crew({ row }) {
  if (!row.crew.length) {
    return ['Preparing', 'Installing'].includes(row.status)
      ? <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700"><UserX size={12} /> Needs crew</span>
      : <span className="text-xs text-slate-400">—</span>;
  }
  return <span className="text-xs text-slate-700">{row.crew.map(c => c.name).join(', ')}</span>;
}

function Tile({ icon: Icon, label, value, tone, active, onClick, sub }) {
  const body = (
    <>
      <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${tone}`}><Icon size={17} /></span>
      <span className="min-w-0 text-left">
        <span className="block text-xl font-extrabold text-slate-900 leading-tight">{value}</span>
        <span className="block text-xs text-slate-500 font-semibold">{label}</span>
        {sub && <span className="block text-[11px] text-slate-400">{sub}</span>}
      </span>
    </>
  );
  const cls = `flex items-center gap-3 p-3 rounded-2xl border bg-white ${active ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200'}`;
  return onClick
    ? <button type="button" onClick={onClick} aria-pressed={!!active} className={`${cls} cursor-pointer hover:bg-slate-50 w-full`}>{body}</button>
    : <div className={cls}>{body}</div>;
}

export default function ProjectsBoard() {
  const navigate = useNavigate();
  const { authTokens, user } = useAuth();
  const [params, setParams] = useSearchParams();
  const f = Object.fromEntries(FILTER_KEYS.map(k => [k, params.get(k) || '']));
  const scope = SCOPES.some(([k]) => k === f.scope) ? f.scope : 'open';
  const page = Number(f.page) || 1;
  const [search, setSearch] = useState(f.q);
  const [crewList, setCrewList] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [downloadError, setDownloadError] = useState('');

  const query = { scope, delayed: f.delayed || undefined, owing: f.owing || undefined, crew: f.crew || undefined,
    service: f.service || undefined, q: f.q || undefined };
  const key = JSON.stringify({ ...query, page });

  // Keep the box in step when the URL's search changes (back button, "Clear filters")
  const [seenQ, setSeenQ] = useState(f.q);
  if (f.q !== seenQ) { setSeenQ(f.q); setSearch(f.q); }

  useEffect(() => {
    api.get('/projects/supervisor-options/').then(r => setCrewList(r.data)).catch(() => setCrewList([]));
  }, []);

  useEffect(() => {
    let live = true;
    api.get('/projects/board/', { params: { ...JSON.parse(key) } })
      .then(r => { if (live) { setData({ key, body: r.data }); setError(''); } })
      .catch(() => { if (live) setError('Could not load the projects. Refresh to try again.'); });
    return () => { live = false; };
  }, [key]);

  const go = (next) => {
    const merged = { ...f, scope, page: 1, ...next };
    setParams(Object.fromEntries(Object.entries(merged).filter(([k, v]) => v && !(k === 'scope' && v === 'open') && !(k === 'page' && Number(v) === 1))));
  };
  const toggle = (k) => go({ [k]: f[k] ? '' : '1' });
  const ready = data?.key === key ? data.body : null;
  const t = (ready || data?.body)?.totals;
  const rows = ready?.results || [];
  const filtered = f.delayed || f.owing || f.crew || f.service || f.q;
  const open = (row) => navigate(`/staff-dashboard?tab=bookings&queue=all&open=${row.id}`);

  const download = async () => {
    setDownloadError('');
    const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v)).toString();
    const err = await downloadWithAuth(`${API_BASE_URL}/projects/board/export/?${qs}`,
      { Authorization: `Bearer ${authTokens?.access}` }, 'projects.csv');
    if (err) setDownloadError(err);
  };

  // Field crew pass the staff route guard but have their own screens (the API refuses them too)
  if (user?.staff_role === 'FIELD_CREW') return <Navigate to="/staff-dashboard" replace />;

  const chip = (on) => `h-9 px-3.5 rounded-full text-sm font-semibold border cursor-pointer whitespace-nowrap shrink-0 ${on
    ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`;
  const select = 'h-9 px-3 rounded-full text-sm font-semibold border border-slate-200 bg-white text-slate-700 cursor-pointer max-w-[200px]';

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><FolderKanban size={22} /></span>
          <div>
            <h1 className="m-0 text-2xl font-extrabold text-slate-900 tracking-tight">Projects</h1>
            <p className="m-0 mt-0.5 text-sm text-slate-500">Every landscaping project: stage, crew, dates, money and what's running late.</p>
          </div>
        </div>
        <button type="button" onClick={download}
          className="h-10 px-4 rounded-xl text-sm font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 cursor-pointer inline-flex items-center gap-2">
          <Download size={16} /> Download CSV
        </button>
      </div>
      {downloadError && <p role="alert" className="m-0 mb-4 text-sm font-semibold text-red-700">{downloadError}</p>}

      {/* Totals: the whole business, whatever the filters */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        {t ? (
          <>
            <Tile icon={Briefcase} label="Open projects" value={t.open} tone="bg-slate-100 text-slate-700"
              active={scope === 'open' && !filtered} onClick={() => go({ scope: 'open', delayed: '', owing: '', crew: '', service: '', q: '' })} />
            <Tile icon={AlertTriangle} label="Delayed" value={t.delayed} tone={t.delayed ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-500'}
              sub={t.delayed ? `${t.overdue} overdue · ${t.stalled} no update` : null}
              active={!!f.delayed} onClick={() => go({ scope: 'open', delayed: f.delayed ? '' : '1' })} />
            <Tile icon={HardHat} label="In the field" value={t.in_field} tone="bg-indigo-50 text-indigo-700" />
            <Tile icon={UserX} label="Needs crew" value={t.needs_crew} tone={t.needs_crew ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'} />
            <Tile icon={ClipboardCheck} label="Awaiting sign-off" value={t.review} tone="bg-violet-50 text-violet-700" />
            <Tile icon={Wallet} label="Balance owed" value={peso(t.balance_owed)} tone="bg-emerald-50 text-emerald-700"
              active={!!f.owing} onClick={() => toggle('owing')} sub="All projects, not cancelled" />
          </>
        ) : Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[74px] rounded-2xl bg-white border border-slate-200 animate-pulse" />)}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-4">
        <div role="group" aria-label="Show" className="flex gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SCOPES.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={scope === k} onClick={() => go({ scope: k, delayed: k === 'open' ? f.delayed : '' })} className={chip(scope === k)}>{label}</button>
          ))}
          <span className="w-px bg-slate-200 mx-1 shrink-0" />
          <button type="button" aria-pressed={!!f.delayed} onClick={() => go({ scope: 'open', delayed: f.delayed ? '' : '1' })} className={chip(!!f.delayed)}>Delayed only</button>
          <button type="button" aria-pressed={!!f.owing} onClick={() => toggle('owing')} className={chip(!!f.owing)}>Balance owing</button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <form className="relative flex-1 min-w-[200px] max-w-md" role="search" onSubmit={(e) => { e.preventDefault(); go({ q: search.trim() }); }}>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Customer, address, booking # or phone"
              aria-label="Search projects" className="w-full h-9 pl-9 pr-3 rounded-full border border-slate-200 text-sm bg-white" />
          </form>
          <select aria-label="Service" value={f.service} onChange={e => go({ service: e.target.value })} className={select}>
            {SERVICES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select aria-label="Crew member" value={f.crew} onChange={e => go({ crew: e.target.value })} className={select}>
            <option value="">All crew</option>
            {crewList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {filtered && (
            <button type="button" onClick={() => go({ delayed: '', owing: '', crew: '', service: '', q: '' })}
              className="h-9 px-3 rounded-full text-sm font-semibold text-slate-500 hover:text-slate-800 bg-transparent border-none cursor-pointer inline-flex items-center gap-1">
              <X size={14} /> Clear filters
            </button>
          )}
        </div>
      </div>

      {error && <p role="alert" className="m-0 mb-4 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

      {!ready && !error ? <div className="h-96 bg-white border border-slate-200 rounded-2xl animate-pulse" />
        : ready && !rows.length ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
            {f.delayed ? 'Nothing is running late. 🎉' : filtered ? 'No projects match these filters.' : 'No projects here yet.'}
          </div>
        ) : ready && (
          <>
            {/* Desktop: table */}
            <div className="hidden lg:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 text-left">
                  <tr>
                    <th className="px-4 py-3 font-bold">Project</th>
                    <th className="px-3 py-3 font-bold">Status</th>
                    <th className="px-3 py-3 font-bold">Office stage</th>
                    <th className="px-3 py-3 font-bold">Crew stages</th>
                    <th className="px-3 py-3 font-bold">Crew</th>
                    <th className="px-3 py-3 font-bold">Due</th>
                    <th className="px-3 py-3 font-bold text-right">Balance</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map(row => (
                    <tr key={row.id} onClick={() => open(row)} className={`cursor-pointer hover:bg-slate-50 ${row.delays.length ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 align-top">
                        <p className="m-0 font-bold text-slate-900">{row.customer} <span className="text-slate-400 font-semibold">#{row.id}</span></p>
                        <p className="m-0 text-xs text-slate-500">{row.service_label}</p>
                        <div className="mt-1.5"><Delays row={row} /></div>
                      </td>
                      <td className="px-3 py-3 align-top"><StatusPill row={row} /></td>
                      <td className="px-3 py-3 align-top"><OfficeStage row={row} /></td>
                      <td className="px-3 py-3 align-top">
                        <CrewStages row={row} />
                        {['Preparing', 'Installing', 'For Review'].includes(row.status) && row.crew.length > 0 &&
                          <p className="m-0 mt-1 text-[11px] text-slate-400 whitespace-nowrap">{ago(row.last_crew_activity)}</p>}
                      </td>
                      <td className="px-3 py-3 align-top max-w-[180px]"><Crew row={row} /></td>
                      <td className="px-3 py-3 align-top whitespace-nowrap">
                        <p className={`m-0 text-xs font-semibold ${row.delays.includes('overdue') ? 'text-red-700' : 'text-slate-700'}`}>{day(row.due_date)}</p>
                        <p className="m-0 text-[11px] text-slate-400">{row.target_end_date ? `Visit ${day(row.scheduled_date)}` : 'Visit date (no target set)'}</p>
                      </td>
                      <td className="px-3 py-3 align-top text-right whitespace-nowrap">
                        {row.balance == null ? <span className="text-xs text-slate-400">—</span>
                          : row.balance > 0 ? <span className="text-xs font-bold text-amber-700">{peso(row.balance)}</span>
                          : <span className="text-xs font-bold text-emerald-700">Paid</span>}
                        {row.total_price > 0 && <p className="m-0 text-[11px] text-slate-400">of {peso(row.total_price)}</p>}
                      </td>
                      <td className="pr-3 py-3 align-middle"><ChevronRight size={16} className="text-slate-300" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phones and tablets: cards */}
            <ul className="lg:hidden m-0 p-0 list-none flex flex-col gap-3">
              {rows.map(row => (
                <li key={row.id}>
                  <button type="button" onClick={() => open(row)}
                    className={`w-full text-left bg-white border rounded-2xl p-4 cursor-pointer hover:bg-slate-50 ${row.delays.length ? 'border-red-200' : 'border-slate-200'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="m-0 font-bold text-slate-900 truncate">{row.customer} <span className="text-slate-400 font-semibold">#{row.id}</span></p>
                        <p className="m-0 text-xs text-slate-500">{row.service_label} · Due {day(row.due_date)}</p>
                      </div>
                      <StatusPill row={row} />
                    </div>
                    {row.delays.length > 0 && <div className="mt-2"><Delays row={row} /></div>}
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <OfficeStage row={row} />
                      <div>
                        <p className="m-0 mb-1 text-xs font-semibold text-slate-700">Crew stages</p>
                        <CrewStages row={row} />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <Crew row={row} />
                      {row.balance > 0 && <span className="text-xs font-bold text-amber-700 whitespace-nowrap">{peso(row.balance)} due</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

      {ready && <Pager meta={ready} onPage={(n) => { go({ ...f, scope, page: n }); window.scrollTo(0, 0); }} />}

      {ready?.rules && (
        <p className="mt-5 text-xs text-slate-500 leading-relaxed">
          <b className="text-slate-600">How delays are flagged:</b> <i>Overdue</i> is an open project past its target end date (or its visit date
          when no target is set). <i>No crew update</i> means a crew is assigned but has logged no stage, clock-in or photo
          for {ready.rules.stall_days} days. <i>Waiting for sign-off</i> means the crew finished more than {ready.rules.review_days} days ago.
          The <i>office stage</i> is moved by the office; the <i>crew stages</i> are completed by the crew on site.
        </p>
      )}
    </div>
  );
}
