import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ScrollText, ChevronRight, Wallet, Package, Users, ClipboardList, Settings } from 'lucide-react';
import api from '../services/api';
import Pager from './ui/Pager';

/*
 * Owner: Activity log — who changed prices, stock, refunds, cash, roles and settings, and when.
 * Read-only; written by the backend (apps/library/activity.py). Filter and page live in the URL.
 */

const AREAS = [
  ['', 'Everything', ScrollText],
  ['money', 'Money', Wallet],
  ['stock', 'Prices & stock', Package],
  ['work', 'Orders & jobs', ClipboardList],
  ['people', 'People', Users],
  ['settings', 'Settings', Settings],
];
const AREA_ICON = Object.fromEntries(AREAS.map(([k, , Icon]) => [k, Icon]));
const TONE = {
  money: 'bg-amber-50 text-amber-800', stock: 'bg-blue-50 text-blue-700', work: 'bg-emerald-50 text-emerald-700',
  people: 'bg-violet-50 text-violet-700', settings: 'bg-slate-100 text-slate-700',
};

const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
};
const time = (iso) => new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

export default function ActivityLog() {
  const [params, setParams] = useSearchParams();
  const area = params.get('area') || '';
  const page = Number(params.get('page')) || 1;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api.get('/admin/activity/', { params: { area: area || undefined, page } })
      .then(r => { if (live) { setData(r.data); setError(''); } })
      .catch(() => { if (live) setError('Could not load the activity log. Refresh to try again.'); });
    return () => { live = false; };
  }, [area, page]);

  const go = (next) => setParams(Object.fromEntries(Object.entries({ area, page, ...next }).filter(([, v]) => v && v !== 1)));
  const loading = !data || data.page !== page;

  // Group rows under a heading per day
  const groups = [];
  for (const row of data?.results || []) {
    const label = dayLabel(row.created_at);
    if (groups.at(-1)?.label !== label) groups.push({ label, rows: [] });
    groups.at(-1).rows.push(row);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="flex items-start gap-3 mb-5">
        <span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><ScrollText size={22} /></span>
        <div>
          <h1 className="m-0 text-2xl font-extrabold text-slate-900 tracking-tight">Activity log</h1>
          <p className="m-0 mt-0.5 text-sm text-slate-500">Who changed prices, stock, money, roles and settings. Entries can't be edited or deleted.</p>
        </div>
      </div>

      <div role="group" aria-label="Show" className="flex gap-2 overflow-x-auto mb-5 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {AREAS.map(([key, label]) => (
          <button key={key || 'all'} type="button" aria-pressed={area === key} onClick={() => go({ area: key, page: 1 })}
            className={`h-10 px-4 rounded-full text-sm font-semibold border cursor-pointer whitespace-nowrap shrink-0
              ${area === key ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="m-0 mb-4 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

      {loading && !error ? <div className="h-80 bg-white border border-slate-200 rounded-2xl animate-pulse" />
        : !groups.length ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-500">
            Nothing recorded {area ? 'here ' : ''}yet. Changes appear here as your team works.
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map(g => (
              <section key={g.label}>
                <h2 className="m-0 mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">{g.label}</h2>
                <ul className="m-0 p-0 list-none bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                  {g.rows.map(row => {
                    const Icon = AREA_ICON[row.area] || ScrollText;
                    const body = (
                      <>
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${TONE[row.area] || TONE.settings}`}><Icon size={16} /></span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[15px] text-slate-900 leading-snug">{row.summary}</span>
                          <span className="block text-xs text-slate-500 mt-0.5">{row.actor} · {time(row.created_at)}</span>
                        </span>
                        {row.link && <ChevronRight size={18} className="text-slate-400 shrink-0 self-center" />}
                      </>
                    );
                    return (
                      <li key={row.id}>
                        {row.link
                          ? <Link to={row.link} className="flex items-start gap-3 px-4 py-3 no-underline hover:bg-slate-50">{body}</Link>
                          : <div className="flex items-start gap-3 px-4 py-3">{body}</div>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

      {data && <Pager meta={data} onPage={(n) => { go({ page: n }); window.scrollTo(0, 0); }} />}
    </div>
  );
}
