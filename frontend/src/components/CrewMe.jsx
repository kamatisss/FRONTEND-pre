import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, LogOut, ChevronRight, CalendarClock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PushAlertsCard from './PushAlertsCard';
import InstallAppCard from './InstallAppCard';
import { clockTime } from '../data/crewJobs';

/*
 * Crew "Me" tab: shift status and clock-out, hours this week, recent shifts, phone alerts, the
 * full attendance page (clock in without a job, complete history) and sign out.
 */

function weekStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // Monday
  return d;
}
const hoursBetween = (a, b) => Math.max(0, (new Date(b) - new Date(a)) / 36e5);
const fmtHours = (h) => (h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`);

export default function CrewMe({ user, activeAttendance, api, headers, toast, refreshActiveAttendance, onChanged }) {
  const { logoutUser } = useAuth();
  const [logs, setLogs] = useState(null);
  const [busy, setBusy] = useState(false);
  const token = headers?.Authorization;

  useEffect(() => {
    let alive = true;
    fetch(`${api}/attendance/`, { headers: { Authorization: token } })
      .then(r => (r.ok ? r.json() : []))
      .then(d => { if (alive) setLogs(Array.isArray(d) ? d : d.results || []); })
      .catch(() => alive && setLogs([]));
    return () => { alive = false; };
  }, [api, token, activeAttendance?.clocked_in]);

  const week = useMemo(() => {
    const from = weekStart();
    const mine = (logs || []).filter(l => new Date(l.clock_in_time) >= from);
    const hours = mine.reduce((sum, l) => sum + hoursBetween(l.clock_in_time, l.clock_out_time || new Date()), 0);
    return { hours, shifts: mine.length };
  }, [logs]);

  const session = activeAttendance?.clocked_in ? activeAttendance.attendance : null;

  const clockOut = async () => {
    if (!window.confirm('Clock out now? Do this when you leave the site for the day.')) return;
    setBusy(true);
    try {
      const r = await fetch(`${api}/attendance/clock_out/`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not clock out. Try again.');
      toast?.('Clocked out. See you next time!');
      await Promise.all([refreshActiveAttendance?.(), onChanged?.()]);
    } catch (e) {
      toast?.(e.message, 'error');
    }
    setBusy(false);
  };

  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || 'Crew member';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="w-12 h-12 rounded-full bg-emerald-600 text-white text-lg font-black flex items-center justify-center shrink-0">
          {name[0].toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="m-0 text-lg font-extrabold text-slate-900 truncate">{name}</p>
          <p className="m-0 text-sm text-slate-500">Field crew</p>
        </div>
      </div>

      {/* Shift */}
      <section className={`rounded-2xl border p-4 ${session ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
        <p className="m-0 text-xs font-extrabold tracking-wider uppercase text-slate-500">Shift</p>
        {session ? (
          <div className="mt-1.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="m-0 text-base font-bold text-emerald-900">On shift since {clockTime(session.clock_in_time)}</p>
              <p className="m-0 text-sm text-emerald-800 truncate">{session.booking_label || (session.booking ? `Booking #${session.booking}` : 'No job selected')}</p>
            </div>
            <button type="button" disabled={busy} onClick={clockOut}
              className="min-h-[48px] px-4 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-sm font-bold cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50">
              <LogOut size={15} /> Clock out
            </button>
          </div>
        ) : (
          <p className="m-0 mt-1.5 text-base text-slate-700">Not on shift. Start a job from <b>Today</b> to clock in.</p>
        )}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="m-0 text-xs text-slate-500 font-semibold">Hours this week</p>
            <p className="m-0 text-2xl font-extrabold text-slate-900">{logs ? fmtHours(week.hours) : '…'}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="m-0 text-xs text-slate-500 font-semibold">Shifts this week</p>
            <p className="m-0 text-2xl font-extrabold text-slate-900">{logs ? week.shifts : '…'}</p>
          </div>
        </div>
      </section>

      {/* Recent shifts */}
      <section className="bg-white rounded-2xl border border-slate-200 p-4">
        <p className="m-0 mb-2 text-xs font-extrabold tracking-wider uppercase text-slate-500">Recent shifts</p>
        {!logs ? (
          <p className="m-0 text-sm text-slate-500">Loading…</p>
        ) : logs.length === 0 ? (
          <p className="m-0 text-sm text-slate-500">No shifts yet.</p>
        ) : (
          <ul className="m-0 p-0 list-none divide-y divide-slate-100">
            {logs.slice(0, 6).map(l => (
              <li key={l.id} className="py-2.5 flex items-center gap-3">
                <Clock size={16} className="text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="m-0 text-sm font-semibold text-slate-800 truncate">{l.booking_label || (l.booking ? `Booking #${l.booking}` : 'General shift')}</p>
                  <p className="m-0 text-xs text-slate-500">
                    {new Date(l.clock_in_time).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })} · {clockTime(l.clock_in_time)}
                    {l.clock_out_time ? `–${clockTime(l.clock_out_time)}` : ' – now'}
                  </p>
                </div>
                <span className="text-sm font-bold text-slate-700 shrink-0">{fmtHours(hoursBetween(l.clock_in_time, l.clock_out_time || new Date()))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <InstallAppCard reason="Opens full-screen, loads faster on weak signal, and on iPhone it's needed for job alerts." />

      <PushAlertsCard />

      <Link to="/staff-attendance"
        className="flex items-center gap-3 min-h-[56px] px-4 bg-white rounded-2xl border border-slate-200 no-underline text-slate-800 hover:bg-slate-50">
        <CalendarClock size={18} className="text-emerald-600 shrink-0" />
        <span className="flex-1">
          <span className="block text-sm font-bold">Attendance page</span>
          <span className="block text-xs text-slate-500">Clock in without a job, full history</span>
        </span>
        <ChevronRight size={18} className="text-slate-400" />
      </Link>

      <button type="button" onClick={logoutUser}
        className="w-full min-h-[52px] rounded-2xl bg-white border border-slate-200 text-red-600 text-sm font-bold cursor-pointer inline-flex items-center justify-center gap-2 hover:bg-red-50">
        <LogOut size={16} /> Sign out
      </button>
    </div>
  );
}
