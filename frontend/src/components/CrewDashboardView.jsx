import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Sun, Briefcase, Truck, UserRound, X, ChevronRight, ChevronLeft, RefreshCw, Navigation, Phone, StickyNote,
  LogOut, CalendarCheck, Banknote, WifiOff,
} from 'lucide-react';
import ThreeGardenCanvas from './ThreeGardenCanvas';
import CrewJobCard, { JobShift, JobSteps, OnMyWay } from './CrewJobCard';
import CrewDeliveries from './CrewDeliveries';
import CrewMe from './CrewMe';
import PushAlertsCard from './PushAlertsCard';
import { SERVICE, TIME, TIME_SHORT, statusOf, dayLabel, clockTime, groupJobs, navUrl, telOf, todayIso } from '../data/crewJobs';
import { API_BASE_URL as API_ROOT } from '../config';

/*
 * Field crew app (phone first). Four tabs, all in the URL so links from notifications and the
 * phone's Back button work:  Today (?tab=home) · Jobs (?tab=projects) · Deliveries · Me (?tab=me);
 * a job opens as its own page (?tab=projects&job=<id>).
 *  Today: shift bar → "Up next" (the one job to do now: Navigate / Call / Start) → rest of today
 *         → deliveries → coming up.
 * Brand colours are the app's emerald/slate; status colours match the office queues.
 */

const TABS = [
  { key: 'home', label: 'Today', Icon: Sun },
  { key: 'projects', label: 'Jobs', Icon: Briefcase },
  { key: 'deliveries', label: 'Deliveries', Icon: Truck },
  { key: 'me', label: 'Me', Icon: UserRound },
];
const TAB_ALIASES = { attendance: 'me' };   // older links

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

function StatusChip({ status }) {
  const s = statusOf(status);
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${s.chip}`}>{s.label}</span>;
}

/* A job in a list: tap to open its page */
function JobRow({ booking, today, onOpen }) {
  return (
    <button type="button" onClick={() => onOpen(booking.id)}
      className="w-full text-left bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 min-h-[76px]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="m-0 text-[15px] font-bold text-slate-900 truncate">{booking.customer_name || 'Customer'}</p>
          <StatusChip status={booking.status} />
        </div>
        <p className="m-0 mt-0.5 text-sm text-slate-600 truncate">
          <b className="text-slate-800">{dayLabel(booking.scheduled_date, today)}</b> · {TIME_SHORT[booking.preferred_time] || 'Any time'} · {SERVICE[booking.service_type] || booking.service_type}
        </p>
        <p className="m-0 mt-0.5 text-sm text-slate-500 truncate">{booking.service_address || 'No address on file'}</p>
      </div>
      <ChevronRight size={20} className="text-slate-400 shrink-0" />
    </button>
  );
}

function Section({ title, count, children, action }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="m-0 text-xs font-extrabold tracking-wider uppercase text-slate-500">{title}{count != null ? ` (${count})` : ''}</h2>
        {action}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Empty({ icon: Icon, title, sub }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl py-10 px-6 text-center">
      <Icon size={32} strokeWidth={1.5} className="mx-auto text-slate-300 mb-2" />
      <p className="m-0 font-bold text-slate-800">{title}</p>
      {sub && <p className="m-0 mt-1 text-sm text-slate-500">{sub}</p>}
    </div>
  );
}

export default function CrewDashboardView({
  bookings, loading, activeAttendance, refreshActiveAttendance, authTokens, user, actionLoading, toast,
  updateBookingStatus, reloadBookings,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const API = API_ROOT;
  const token = authTokens?.access;
  const headers = { Authorization: `Bearer ${token}` };
  const today = todayIso();

  const params = new URLSearchParams(location.search);
  const rawTab = TAB_ALIASES[params.get('tab')] || params.get('tab');
  const activeTab = TABS.some(t => t.key === rawTab) ? rawTab : 'home';
  const jobId = Number(params.get('job')) || null;
  // Tabs replace the history entry (Back leaves the app, as on other phone apps); a job page adds one
  const goTab = (key) => navigate(`/staff-dashboard?tab=${key}`, { replace: true });
  const openJob = (id) => navigate(`/staff-dashboard?tab=projects&job=${id}`);
  const closeJob = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/staff-dashboard?tab=projects', { replace: true }));

  const [designModal, setDesignModal] = useState(null);
  const [modalArMode, setModalArMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Weak signal on site: say so plainly, and catch up by itself when the signal comes back
  const [online, setOnline] = useState(() => navigator.onLine !== false);

  /* Deliveries the office gave this crew member */
  const [deliveries, setDeliveries] = useState(null);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const fetchDeliveries = useCallback(() => (!token ? Promise.resolve() :
    fetch(`${API}/orders/my_deliveries/`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setDeliveries(d); })
      .catch(() => {})), [API, token]);
  const reloadDeliveries = () => {
    setDeliveriesLoading(true);
    fetchDeliveries().finally(() => setDeliveriesLoading(false));
  };
  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries, location.key]);
  const toDeliver = (deliveries?.active || []).filter(o => ['Shipped', 'Out for Delivery'].includes(o.status));
  const codToCollect = toDeliver.filter(o => o.payment_method === 'cod' && o.payment_status !== 'Paid')
    .reduce((s, o) => s + Number(o.total_price || 0), 0);

  const session = activeAttendance?.clocked_in ? activeAttendance.attendance : null;
  const groups = groupJobs(bookings, today, session?.booking ?? null);
  const job = jobId ? bookings.find(b => b.id === jobId) : null;

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.all([reloadBookings?.(), fetchDeliveries(), refreshActiveAttendance?.()]).catch(() => {});
    setRefreshing(false);
  };

  useEffect(() => {
    const goOffline = () => setOnline(false);
    const goOnline = () => {
      setOnline(true);
      toast('Back online. Updating your jobs.');
      Promise.all([reloadBookings?.(), fetchDeliveries(), refreshActiveAttendance?.()]).catch(() => {});
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, [toast, reloadBookings, fetchDeliveries, refreshActiveAttendance]);

  const handleDownloadJobSheet = async (bookingId) => {
    try {
      const r = await fetch(`${API}/bookings/${bookingId}/generate_pdf/`, { headers });
      if (!r.ok) { toast('Could not make the work order.', 'error'); return; }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `work-order-${bookingId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast('No connection: could not download the work order.', 'error');
    }
  };

  const toCanvasPlants = (placedItems = []) => placedItems.map(item => (item.plant_id !== undefined
    ? { plant_id: item.plant_id, x: item.x ?? 0, z: item.z ?? 0, rotation: item.rotation ?? 0 }
    : { plant_id: item.modelType || item.model_type || String(item.productId || ''), x: item.position?.x ?? 0, z: item.position?.z ?? 0, rotation: item.rotation?.y ?? 0 }));

  const clockOutNow = async () => {
    if (!window.confirm('Clock out now? Do this when you leave the site for the day.')) return;
    const r = await fetch(`${API}/attendance/clock_out/`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' }).catch(() => null);
    if (r?.ok) { toast('Clocked out. See you next time!'); await Promise.all([refreshActiveAttendance?.(), reloadBookings?.()]); }
    else toast('Could not clock out. Check your signal and try again.', 'error');
  };

  const shiftJob = session?.booking ? bookings.find(b => b.id === session.booking) : null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.first_name || user?.username || '';

  /* ── Today ── */
  const renderToday = () => {
    const [upNext, ...laterToday] = groups.today;
    const upNextIsShiftJob = upNext && session?.booking === upNext.id;
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="m-0 text-2xl font-extrabold text-slate-900 tracking-tight">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
            <p className="m-0 mt-0.5 text-sm text-slate-500">{new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
          <button type="button" onClick={refreshAll} aria-label="Refresh"
            className="w-11 h-11 rounded-xl bg-white border border-slate-200 text-slate-600 flex items-center justify-center cursor-pointer shrink-0">
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Shift bar: always visible while on shift, with the way out */}
        {session && (
          <div className="bg-emerald-600 text-white rounded-2xl p-4 flex items-center gap-3 shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-200 animate-pulse shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="m-0 text-base font-bold">On shift since {clockTime(session.clock_in_time)}</p>
              <p className="m-0 text-sm text-emerald-50 truncate">
                {shiftJob ? `#${shiftJob.id} · ${shiftJob.customer_name || 'Customer'}` : session.booking ? `Booking #${session.booking}` : 'No job selected'}
              </p>
            </div>
            <button type="button" onClick={clockOutNow}
              className="min-h-[44px] px-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-bold border border-white/30 cursor-pointer inline-flex items-center gap-1.5">
              <LogOut size={15} /> Clock out
            </button>
          </div>
        )}

        <PushAlertsCard onlyIfActionable />

        {/* Up next: the one job to do now */}
        {upNext ? (
          <section>
            <h2 className="m-0 mb-2 text-xs font-extrabold tracking-wider uppercase text-slate-500">{upNextIsShiftJob ? 'Your job now' : 'Up next'}</h2>
            <article className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className={`${statusOf(upNext.status).bar} h-1.5`} />
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="m-0 text-xl font-extrabold text-slate-900 leading-tight">{upNext.customer_name || 'Customer'}</p>
                    <p className="m-0 mt-0.5 text-sm text-slate-600">
                      {SERVICE[upNext.service_type] || upNext.service_type} · <b className="text-slate-800">{dayLabel(upNext.scheduled_date, today)}</b>, {TIME[upNext.preferred_time] || 'Any time'}
                    </p>
                  </div>
                  <StatusChip status={upNext.status} />
                </div>
                <p className="m-0 text-[15px] text-slate-800 leading-snug">{upNext.service_address || 'No address on file. Call the customer.'}</p>
                <div className="grid grid-cols-2 gap-2">
                  {navUrl(upNext) ? (
                    <a href={navUrl(upNext)} target="_blank" rel="noopener noreferrer"
                      className="min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold no-underline inline-flex items-center justify-center gap-2">
                      <Navigation size={16} /> Navigate
                    </a>
                  ) : <span />}
                  {telOf(upNext) ? (
                    <a href={`tel:${telOf(upNext)}`}
                      className="min-h-[48px] rounded-xl bg-white border border-slate-300 text-slate-900 text-sm font-bold no-underline inline-flex items-center justify-center gap-2">
                      <Phone size={16} /> Call
                    </a>
                  ) : <span />}
                </div>
                {!upNextIsShiftJob && (
                  <OnMyWay booking={upNext} todayIso={today} api={API} headers={headers} toast={toast} onChanged={reloadBookings} />
                )}
                {upNext.notes?.trim() && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="m-0 text-xs font-extrabold tracking-wider uppercase text-amber-800 flex items-center gap-1.5"><StickyNote size={13} /> Customer notes</p>
                    <p className="m-0 mt-1 text-[15px] text-amber-950 leading-snug line-clamp-3">{upNext.notes.trim()}</p>
                  </div>
                )}
                {!upNextIsShiftJob && ['Preparing', 'Installing'].includes(upNext.status) && (
                  <JobShift booking={upNext} todayIso={today} activeAttendance={activeAttendance} api={API} headers={headers}
                    toast={toast} onChanged={reloadBookings} refreshActiveAttendance={refreshActiveAttendance} />
                )}
                <button type="button" onClick={() => openJob(upNext.id)}
                  className={`min-h-[48px] rounded-xl text-sm font-bold cursor-pointer inline-flex items-center justify-center gap-1.5 ${upNextIsShiftJob
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-none' : 'bg-white border border-slate-300 text-slate-800 hover:bg-slate-50'}`}>
                  {upNextIsShiftJob ? 'Open job: stages & photos' : 'Job details'} <ChevronRight size={16} />
                </button>
              </div>
            </article>
          </section>
        ) : (
          <Empty icon={CalendarCheck} title="No jobs for today"
            sub={groups.upcoming[0] ? `Next: ${groups.upcoming[0].customer_name || 'a job'}, ${dayLabel(groups.upcoming[0].scheduled_date, today)}.` : 'New jobs from the office will show up here.'} />
        )}

        {laterToday.length > 0 && (
          <Section title="Also today" count={laterToday.length}>
            {laterToday.map(b => <JobRow key={b.id} booking={b} today={today} onOpen={openJob} />)}
          </Section>
        )}

        {toDeliver.length > 0 && (
          <button type="button" onClick={() => goTab('deliveries')}
            className="w-full text-left bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer min-h-[64px]">
            <span className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center shrink-0"><Truck size={19} /></span>
            <span className="flex-1 min-w-0">
              <span className="block text-[15px] font-bold text-slate-900">{toDeliver.length} {toDeliver.length === 1 ? 'delivery' : 'deliveries'} to make</span>
              {codToCollect > 0 && <span className="text-sm text-amber-800 font-semibold inline-flex items-center gap-1"><Banknote size={14} /> Collect {peso(codToCollect)} cash</span>}
            </span>
            <ChevronRight size={20} className="text-slate-400" />
          </button>
        )}

        {groups.upcoming.length > 0 && (
          <Section title="Coming up" count={groups.upcoming.length}
            action={<button type="button" onClick={() => goTab('projects')} className="min-h-[44px] px-2 bg-transparent border-none text-sm font-bold text-emerald-700 cursor-pointer">All jobs</button>}>
            {groups.upcoming.slice(0, 3).map(b => <JobRow key={b.id} booking={b} today={today} onOpen={openJob} />)}
          </Section>
        )}
      </div>
    );
  };

  /* ── Jobs ── */
  const renderJobs = () => {
    const none = !groups.today.length && !groups.upcoming.length && !groups.review.length && !groups.finished.length;
    return (
      <div className="flex flex-col gap-5">
        <h1 className="m-0 text-2xl font-extrabold text-slate-900 tracking-tight">Jobs</h1>
        {none && <Empty icon={Briefcase} title="No jobs yet" sub="The office assigns jobs to you. They show up here and you get an alert." />}
        {groups.today.length > 0 && <Section title="Today" count={groups.today.length}>{groups.today.map(b => <JobRow key={b.id} booking={b} today={today} onOpen={openJob} />)}</Section>}
        {groups.upcoming.length > 0 && <Section title="Coming up" count={groups.upcoming.length}>{groups.upcoming.map(b => <JobRow key={b.id} booking={b} today={today} onOpen={openJob} />)}</Section>}
        {groups.review.length > 0 && <Section title="Waiting for sign-off" count={groups.review.length}>{groups.review.map(b => <JobRow key={b.id} booking={b} today={today} onOpen={openJob} />)}</Section>}
        {groups.finished.length > 0 && <Section title="Recently finished">{groups.finished.map(b => <JobRow key={b.id} booking={b} today={today} onOpen={openJob} />)}</Section>}
      </div>
    );
  };

  /* ── One job, as its own page ── */
  const renderJob = () => (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button type="button" onClick={closeJob}
          className="min-h-[44px] pl-1 pr-3 rounded-xl bg-transparent border-none text-slate-700 text-sm font-bold cursor-pointer inline-flex items-center gap-1">
          <ChevronLeft size={20} /> Back
        </button>
        {job && <span className="ml-auto text-sm font-bold text-slate-400">Job #{job.id}</span>}
      </div>
      {!job ? (
        loading ? <div className="h-64 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          : <Empty icon={Briefcase} title="This job isn't on your list" sub="It may have been reassigned. Tap refresh on Today, or ask the office." />
      ) : (
        <>
          {['Preparing', 'Installing', 'For Review', 'Finished'].includes(job.status) && (
            <JobSteps booking={job} onTheJob={session?.booking === job.id} />
          )}
          <CrewJobCard booking={job} todayIso={today} activeAttendance={activeAttendance}
            refreshActiveAttendance={refreshActiveAttendance} api={API} headers={headers} toast={toast} user={user}
            submitting={actionLoading === job.id} onSubmit={(id) => updateBookingStatus(id, 'For Review')}
            onOpenDesign={(design, ar) => { setDesignModal(design); setModalArMode(ar); }}
            onWorkOrder={handleDownloadJobSheet} onChanged={reloadBookings} />
        </>
      )}
    </div>
  );

  const badges = { projects: groups.today.length || null, deliveries: toDeliver.length || null };

  return (
    <div className="min-h-screen bg-slate-50" style={{ paddingBottom: 'calc(84px + env(safe-area-inset-bottom))' }}>
      <div className="max-w-2xl mx-auto px-4 py-5">
        {!online && (
          <div role="status" className="sticky top-2 z-30 mb-4 flex items-start gap-3 bg-slate-900 text-white rounded-2xl p-3.5 shadow-lg">
            <WifiOff size={18} className="shrink-0 mt-0.5" />
            <p className="m-0 text-sm leading-snug"><b>No signal.</b> You can still read your jobs. Starting, photos and messages will work again when the signal is back.</p>
          </div>
        )}
        {loading && !bookings.length && activeTab !== 'me' && activeTab !== 'deliveries' ? (
          <div className="flex flex-col gap-3">{[0, 1, 2].map(i => <div key={i} className="h-28 bg-white border border-slate-200 rounded-2xl animate-pulse" />)}</div>
        ) : jobId && activeTab === 'projects' ? renderJob()
          : activeTab === 'home' ? renderToday()
          : activeTab === 'projects' ? renderJobs()
          : activeTab === 'deliveries' ? (
            <div className="flex flex-col gap-4">
              <h1 className="m-0 text-2xl font-extrabold text-slate-900 tracking-tight">Deliveries</h1>
              <CrewDeliveries api={API} authHeaders={headers} toast={toast} run={deliveries} loading={deliveriesLoading} reload={reloadDeliveries} />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <h1 className="m-0 text-2xl font-extrabold text-slate-900 tracking-tight">Me</h1>
              <CrewMe user={user} activeAttendance={activeAttendance} api={API} headers={headers} toast={toast}
                refreshActiveAttendance={refreshActiveAttendance} onChanged={reloadBookings} />
            </div>
          )}
      </div>

      {/* Bottom tab bar (phones and tablets alike: this is a field app) */}
      <nav aria-label="Crew" className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-2px_12px_rgba(15,23,42,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="max-w-2xl mx-auto flex">
          {TABS.map(({ key, label, Icon }) => {
            const on = activeTab === key;
            return (
              <button key={key} type="button" onClick={() => goTab(key)} aria-current={on ? 'page' : undefined}
                className={`flex-1 min-h-[64px] flex flex-col items-center justify-center gap-1 border-none cursor-pointer bg-transparent ${on ? 'text-emerald-700' : 'text-slate-500'}`}>
                <span className={`relative flex items-center justify-center w-14 h-8 rounded-full ${on ? 'bg-emerald-50' : ''}`}>
                  <Icon size={21} strokeWidth={on ? 2.4 : 2} />
                  {badges[key] && (
                    <span className="absolute -top-1 right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                      {badges[key]}
                    </span>
                  )}
                </span>
                <span className={`text-xs ${on ? 'font-extrabold' : 'font-semibold'}`}>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* 3D / AR design viewer */}
      {designModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" style={{ background: 'rgba(2,6,23,0.72)' }}
          onClick={() => setDesignModal(null)}>
          <div className="bg-white w-full sm:max-w-3xl rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
              <div className="min-w-0">
                <p className="m-0 font-extrabold text-slate-900 truncate">{designModal.name || 'Garden design'}</p>
                <p className="m-0 text-xs text-slate-500">{modalArMode ? 'AR photo overlay' : '3D layout'} · view only</p>
              </div>
              {(designModal.reference_image_url || designModal.image_url) && (
                <div className="flex bg-slate-100 rounded-lg p-1 gap-1 shrink-0">
                  {[{ ar: false, label: '3D' }, { ar: true, label: 'AR' }].map(({ ar, label }) => (
                    <button key={label} type="button" onClick={() => setModalArMode(ar)} aria-pressed={modalArMode === ar}
                      className={`min-h-[36px] px-3 rounded-md text-xs font-bold border-none cursor-pointer ${modalArMode === ar ? 'bg-white text-emerald-800 shadow-sm' : 'bg-transparent text-slate-500'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setDesignModal(null)} aria-label="Close"
                className="w-10 h-10 rounded-lg text-slate-500 hover:bg-slate-100 bg-transparent border-none cursor-pointer flex items-center justify-center shrink-0">
                <X size={20} />
              </button>
            </div>
            <div style={{ height: 'min(70vh, 480px)' }}>
              <ThreeGardenCanvas
                plants={toCanvasPlants(designModal.placed_items)}
                lotWidth={designModal.dimensions?.width || 10}
                lotLength={designModal.dimensions?.length || 15}
                backgroundImageUrl={designModal.reference_image_url || designModal.image_url || null}
                arMode={modalArMode} arGrid={modalArMode}
                horizonY={designModal.dimensions?.horizonY ?? 0.5}
                readOnly
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
