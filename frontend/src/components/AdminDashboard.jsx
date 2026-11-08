import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useIsPhone } from './ui/useMediaQuery';
import TodayAttention from './TodayAttention';
import IncomeAnalytics from './IncomeAnalytics';
import StudioFunnelCard from './StudioFunnelCard';
import AIDesignerHealthCard from './AIDesignerHealthCard';

/*
 * Business overview (the owner's home). Answers two questions at a glance:
 *   Today          — orders placed, money received, today's visits, crew on shift.
 *   Needs attention — every queue with something waiting, linked to that exact queue in the
 *                     staff screens (the owner works the same Orders/Bookings screens as the office).
 * (both: TodayAttention, shared with the office's Overview). Then the longer view: income, the
 * free-Studio funnel and the AI Designer's health — on phones folded away (and not loaded) until opened:
 * it was four screens of charts before anything else, and Reports has the numbers in full.
 */
export default function AdminDashboard() {
  const { user } = useAuth();
  const phone = useIsPhone();
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const refresh = () => {
    setRefreshing(true);
    setReloadKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 600);
  };
  const longerView = !phone || showMore;

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

      <TodayAttention reloadKey={reloadKey} />

      {/* The longer view */}
      {phone && (
        <button type="button" onClick={() => setShowMore(v => !v)} aria-expanded={showMore} aria-controls="ov-growth"
          className="w-full min-h-[52px] px-4 rounded-2xl bg-white border border-slate-200 text-slate-800 text-sm font-bold cursor-pointer flex items-center gap-2">
          <BarChart3 size={17} className="text-emerald-600" />
          <span className="flex-1 text-left">Income, Studio visitors and AI Designer</span>
          {showMore ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      )}
      {longerView && (
        <section id="ov-growth" aria-label="Income and growth" className="flex flex-col gap-6">
          <IncomeAnalytics />
          <StudioFunnelCard />
          <AIDesignerHealthCard />
        </section>
      )}
      {phone && !showMore && (
        <p className="m-0 -mt-3 text-xs text-slate-500">Money in, balances and crew output are in <Link to="/admin-reports" className="text-emerald-700 font-semibold">Reports</Link>.</p>
      )}
    </div>
  );
}
