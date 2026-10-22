import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RefreshCw, ChevronRight, ShoppingBag, Wallet, CalendarCheck, HardHat, CheckCircle2, RotateCcw, Users,
  Package, PenTool, Receipt, ClipboardCheck, Banknote,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import IncomeAnalytics from './IncomeAnalytics';
import StudioFunnelCard from './StudioFunnelCard';
import AIDesignerHealthCard from './AIDesignerHealthCard';

/*
 * Business overview (the owner's home). Answers two questions at a glance:
 *   Today          — orders placed, money received, today's visits, crew on shift.
 *   Needs attention — every queue with something waiting, linked to that exact queue in the
 *                     staff screens (the owner works the same Orders/Bookings screens as the office).
 * Then the longer view: income, the free-Studio funnel and the AI Designer's health.
 * Data: GET /api/admin/overview/ (BACKEND apps/library/overview.py), refreshed every minute while visible.
 */

const TONE = {
  red: 'bg-red-50 text-red-700',
  violet: 'bg-violet-50 text-violet-700',
  amber: 'bg-amber-50 text-amber-800',
  blue: 'bg-blue-50 text-blue-700',
};
const ICON = {
  needs_refund: RotateCcw, review: ClipboardCheck, awaiting: CalendarCheck, dispatch: HardHat,
  to_pack: Package, designs: PenTool, low_stock: Package, unpaid: Receipt, cash: Banknote,
};
const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

function Tile({ icon: Icon, label, value, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><Icon size={17} /></span>
      </div>
      <p className="m-0 mt-2 text-2xl md:text-3xl font-extrabold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="m-0 mt-0.5 text-sm text-slate-500">{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api.get('/admin/overview/')
    .then(r => { setData(r.data); setError(''); })
    .catch(() => setError('Could not load the overview. Check the connection and refresh.')), []);

  useEffect(() => {
    load();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const t = data?.today;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 flex flex-col gap-6" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="m-0 text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">{greeting}{user?.first_name ? `, ${user.first_name}` : ''}</h1>
          <p className="m-0 mt-0.5 text-sm text-slate-500">{new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · business overview</p>
        </div>
        <button type="button" onClick={refresh} aria-label="Refresh"
          className="w-11 h-11 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center cursor-pointer shrink-0">
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <p role="alert" className="m-0 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>}

      {/* Today */}
      <section aria-labelledby="ov-today">
        <h2 id="ov-today" className="m-0 mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">Today</h2>
        {!t ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse" />)}</div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile icon={Wallet} label="Money received" value={peso(t.money_received)} sub="Online, cash on delivery, project payments" />
            <Tile icon={ShoppingBag} label="Orders placed" value={t.orders} sub={t.orders ? `${peso(t.orders_value)} total` : 'None yet today'} />
            <Tile icon={CalendarCheck} label="Visits today" value={t.visits} sub="Bookings scheduled today" />
            <Tile icon={Users} label="Crew on shift" value={t.crew_on_shift} sub="Clocked in right now" />
          </div>
        )}
      </section>

      {/* Needs attention */}
      <section aria-labelledby="ov-attention">
        <h2 id="ov-attention" className="m-0 mb-3 text-xs font-extrabold uppercase tracking-wider text-slate-500">Needs attention</h2>
        {!data ? <div className="h-40 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          : !data.attention.length ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex items-center gap-3">
              <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
              <p className="m-0 text-[15px] text-slate-700"><b className="text-slate-900">All clear.</b> Nothing is waiting on anyone right now.</p>
            </div>
          ) : (
            <ul className="m-0 p-0 list-none bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
              {data.attention.map(a => {
                const Icon = ICON[a.key] || Package;
                return (
                  <li key={a.key}>
                    <Link to={a.link} className="flex items-center gap-3 px-4 py-3 min-h-[64px] no-underline hover:bg-slate-50">
                      <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${TONE[a.tone] || TONE.blue}`}><Icon size={18} /></span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15px] font-bold text-slate-900">{a.label}</span>
                        <span className="block text-sm text-slate-500 truncate">{a.hint}</span>
                      </span>
                      <span className="text-xl font-extrabold text-slate-900 tabular-nums">{a.count}</span>
                      <ChevronRight size={18} className="text-slate-400 shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
      </section>

      {/* The longer view */}
      <section aria-label="Income and growth" className="flex flex-col gap-6">
        <IncomeAnalytics />
        <StudioFunnelCard />
        <AIDesignerHealthCard />
      </section>
    </div>
  );
}
