import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, Clock, CheckCircle2, FileText,
  MapPin, LogIn, X, Layers, Eye,
} from 'lucide-react';
import ThreeGardenCanvas from './ThreeGardenCanvas';
import ProgressPhotos from './ProgressPhotos';

/* ─── Tiny shared helpers (crew-scoped, don't touch StaffDashboard versions) ── */
function SkeletonCard() {
  return (
    <div className="border border-slate-100 rounded-2xl bg-white p-5 shadow-sm animate-pulse">
      <div className="w-full h-36 bg-slate-100 rounded-xl mb-4" />
      <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
      <div className="h-3 bg-slate-100 rounded w-1/2 mb-4" />
      <div className="space-y-2">
        <div className="h-3 bg-slate-100 rounded" />
        <div className="h-3 bg-slate-100 rounded w-4/5" />
      </div>
      <div className="mt-5 h-9 bg-slate-100 rounded-xl" />
    </div>
  );
}

const CREW_STATUS_STYLES = {
  Pending:    'bg-amber-50   text-amber-700   border-amber-200',
  Preparing:  'bg-blue-50    text-blue-700    border-blue-200',
  Installing: 'bg-orange-50  text-orange-700  border-orange-200',
  'For Review': 'bg-violet-50 text-violet-700 border-violet-200',
  Finished:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled:  'bg-red-50     text-red-700     border-red-200',
};

// Jobs the crew has handed off: submitted for sign-off, signed off, or cancelled
const CREW_DONE_STATUSES = ['For Review', 'Finished', 'Cancelled'];

function CrewBadge({ label }) {
  const cls = CREW_STATUS_STYLES[label] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${cls}`}>
      {label}
    </span>
  );
}

function CrewStatCard({ icon: Icon, label, value, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center justify-between gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">{label}</p>
        <p className="text-3xl font-extrabold text-slate-800 leading-none">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${iconBg} shrink-0`}>
        <Icon size={22} className={iconColor} />
      </div>
    </div>
  );
}

function CrewEmptyState({ icon: Icon, title, sub }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center bg-white border border-slate-100 rounded-2xl">
      <div className="p-4 bg-slate-50 rounded-2xl mb-4">
        <Icon size={36} className="text-slate-300" strokeWidth={1.5} />
      </div>
      <p className="text-slate-700 font-semibold text-base">{title}</p>
      <p className="text-slate-400 text-sm mt-1">{sub}</p>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────────── */
export default function CrewDashboardView({
  bookings,
  loading,
  activeAttendance,
  refreshActiveAttendance,
  authTokens,
  user,
  actionLoading,
  setActionLoading,
  toast,
  updateBookingStatus,
}) {
  const navigate = useNavigate();
  const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  const headers = { Authorization: `Bearer ${authTokens?.access}` };

  const [activeTab,    setActiveTab]    = useState('home');
  const [crewViewMode, setCrewViewMode] = useState('today');
  const [designModal,  setDesignModal]  = useState(null);
  const [modalArMode,  setModalArMode]  = useState(false);

  useEffect(() => { setModalArMode(false); }, [designModal]);

  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const TABS = [
    { key: 'home',       label: 'Home',       Icon: LayoutDashboard, badge: null },
    { key: 'projects',   label: 'My Tasks',   Icon: Calendar,        badge: bookings.filter(b => ['Preparing', 'Installing'].includes(b.status)).length || null },
    { key: 'attendance', label: 'Attendance', Icon: Clock,           badge: null },
  ];

  const handleDownloadJobSheet = async (bookingId) => {
    try {
      const r = await fetch(`${API}/bookings/${bookingId}/generate_pdf/`, {
        headers: { Authorization: `Bearer ${authTokens?.access}` },
      });
      if (!r.ok) { toast('Failed to generate job sheet.', 'error'); return; }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job-sheet-${bookingId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast('Network error — could not download job sheet.', 'error');
    }
  };

  const toCanvasPlants = (placedItems = []) =>
    placedItems.map(item => {
      if (item.plant_id !== undefined) {
        return { plant_id: item.plant_id, x: item.x ?? 0, z: item.z ?? 0, rotation: item.rotation ?? 0 };
      }
      return {
        plant_id: item.modelType || item.model_type || String(item.productId || ''),
        x: item.position?.x ?? 0,
        z: item.position?.z ?? 0,
        rotation: item.rotation?.y ?? 0,
      };
    });

  /* ── Work Order Card — crew-specific with 3D / AR buttons ────────────── */
  const WorkOrderCard = (booking) => {
    const isAct    = actionLoading === booking.id;
    const isActive = ['Preparing', 'Installing'].includes(booking.status);
    const isToday  = booking.scheduled_date === today;
    const hasDesign = !!booking.design_details;
    const hasArImage = !!(booking.design_details?.reference_image_url || booking.design_details?.image_url);

    // Is this crew member currently clocked into THIS booking?
    const activeBookingId = activeAttendance?.attendance?.booking ?? null;
    const crewIsClocked   = !!activeAttendance?.clocked_in;
    // Installing bookings have already had at least one milestone completed (requires clock-in),
    // so treat them as always unlocked even if the attendance session has since ended.
    const clockedInHere   = (crewIsClocked && activeBookingId === booking.id) || booking.status === 'Installing';

    const STATUS_BAR = {
      Installing: { bg: 'bg-orange-500',  text: 'text-white', label: 'IN PROGRESS' },
      Preparing:  { bg: 'bg-blue-500',    text: 'text-white', label: 'PREPARING'   },
      Pending:    { bg: 'bg-amber-400',   text: 'text-white', label: 'SCHEDULED'   },
      'For Review': { bg: 'bg-violet-500', text: 'text-white', label: 'AWAITING SIGN-OFF' },
      Finished:   { bg: 'bg-emerald-500', text: 'text-white', label: 'FINISHED'    },
      Cancelled:  { bg: 'bg-red-400',     text: 'text-white', label: 'CANCELLED'   },
    };
    const bar = STATUS_BAR[booking.status] || { bg: 'bg-slate-400', text: 'text-white', label: booking.status };

    return (
      <div key={booking.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Status bar */}
        <div className={`${bar.bg} px-4 py-2 flex items-center justify-between`}>
          <span className={`${bar.text} text-xs font-black tracking-widest`}>{bar.label}</span>
          <div className="flex items-center gap-2">
            {isToday && <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">TODAY</span>}
            <span className={`${bar.text} text-xs opacity-70`}>#{booking.id}</span>
          </div>
        </div>

        <div className="p-4 flex flex-col flex-1 gap-3">
          {/* Primary CTA — download work order */}
          <button
            onClick={() => handleDownloadJobSheet(booking.id)}
            className="flex items-center justify-center gap-2 w-full py-3 bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold rounded-xl border-none cursor-pointer transition-colors"
          >
            <FileText size={15} /> Download Work Order
          </button>

          {/* 3D / AR view buttons */}
          {hasDesign && (
            <div className="flex gap-2">
              <button
                onClick={() => { setDesignModal(booking.design_details); setModalArMode(false); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 cursor-pointer transition-colors"
              >
                <Layers size={13} /> View 3D Design
              </button>
              {hasArImage && (
                <button
                  onClick={() => { setDesignModal(booking.design_details); setModalArMode(true); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl border border-blue-200 cursor-pointer transition-colors"
                >
                  <Eye size={13} /> View AR Mode
                </button>
              )}
            </div>
          )}

          {/* Site address */}
          <div className="bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
              <MapPin size={10} /> Site Address
            </p>
            <p className="text-sm font-semibold text-slate-800 leading-snug">
              {booking.service_address || 'No address on file'}
            </p>
          </div>

          {/* Date / Time / Contact */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar size={11} className="text-slate-400" />
              {booking.scheduled_date}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} className="text-slate-400" />
              {booking.preferred_time || 'Morning'}
            </span>
            {booking.contact_number && (
              <span className="font-semibold text-slate-700">{booking.contact_number}</span>
            )}
          </div>

          {/* Service chip */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full capitalize">
              {booking.service_type}
            </span>
          </div>

          {/* Active project: clock-in above the stepper, then the stepper itself */}
          {isActive && (
            <div className="border-t border-slate-100 pt-3 flex flex-col gap-3">
              {booking.status === 'Preparing' && (
                <GeofencedCheckIn
                  booking={booking}
                  apiBase={API}
                  headers={headers}
                  activeAttendance={activeAttendance}
                  onCheckedIn={refreshActiveAttendance}
                  onQuickClockIn={refreshActiveAttendance}
                  toast={toast}
                />
              )}
              <FieldMilestoneStepper
                booking={booking}
                apiBase={API}
                headers={headers}
                onUpdated={() => {}}
                isClocked={clockedInHere}
              />
            </div>
          )}

          {/* Before / during / after photos — feed the Project Hub portfolio */}
          {booking.status !== 'Cancelled' && (
            <ProgressPhotos
              booking={booking}
              user={user}
              toast={toast}
              canUpload={booking.status !== 'Finished'}
            />
          )}

          {booking.status === 'Installing' && (
            <button
              onClick={() => updateBookingStatus(booking.id, 'For Review')}
              disabled={isAct}
              className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer border-none disabled:opacity-50"
            >
              {isAct ? 'Submitting…' : '✓ Submit for Sign-off'}
            </button>
          )}

          {booking.status === 'For Review' && (
            <p className="text-xs text-violet-700 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5 m-0 leading-relaxed">
              Submitted as finished. An office admin will review and sign off the job.
            </p>
          )}
        </div>
      </div>
    );
  };

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 md:py-8">

        {/* Compact header — no duplicate profile, greeting in Home banner */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl shadow-sm shrink-0 bg-orange-500">
              <LayoutDashboard size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight leading-none mb-0.5">
                Field Crew Portal
              </h1>
              <p className="text-slate-500 text-xs md:text-sm">
                {greeting}, <span className="font-semibold text-slate-700">{user?.first_name || user?.username || 'Crew Member'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <CrewStatCard icon={Calendar}     label="Assigned Projects" value={bookings.length} iconBg="bg-orange-50" iconColor="text-orange-600" />
          <CrewStatCard icon={Clock}        label="Active Today"      value={bookings.filter(b => b.scheduled_date === today && !CREW_DONE_STATUSES.includes(b.status)).length} iconBg="bg-blue-50" iconColor="text-blue-600" />
          <CrewStatCard icon={CheckCircle2} label="Shift Status"      value={activeAttendance?.clocked_in ? 'On Shift' : 'Off Shift'} iconBg={activeAttendance?.clocked_in ? 'bg-emerald-50' : 'bg-slate-50'} iconColor={activeAttendance?.clocked_in ? 'text-emerald-600' : 'text-slate-400'} />
        </div>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Home tab ── */}
        {!loading && activeTab === 'home' && (() => {
          const todayActive = bookings.filter(b =>
            b.scheduled_date === today && ['Preparing', 'Installing'].includes(b.status)
          );
          const onShift = !!activeAttendance?.clocked_in;
          return (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-md">
                <p className="text-orange-100 text-sm font-medium mb-1">Welcome back,</p>
                <h2 className="text-2xl font-bold mb-4">{user?.full_name || user?.username || 'Crew Member'}</h2>
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${onShift ? 'bg-white/20 text-white' : 'bg-white/10 text-orange-100'}`}>
                    <span className={`w-2 h-2 rounded-full ${onShift ? 'bg-emerald-300' : 'bg-orange-200'}`} />
                    {onShift ? 'On Shift' : 'Off Shift'}
                  </span>
                  {todayActive.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 rounded-full text-xs font-bold">
                      <Calendar size={11} /> {todayActive.length} active today
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <CrewStatCard icon={Calendar}     label="Assigned"   value={bookings.length}                                              iconBg="bg-orange-50"   iconColor="text-orange-600" />
                <CrewStatCard icon={Clock}        label="Active Now" value={bookings.filter(b => b.status === 'Installing').length}       iconBg="bg-blue-50"     iconColor="text-blue-600" />
                <CrewStatCard icon={CheckCircle2} label="Done"       value={bookings.filter(b => ['For Review', 'Finished'].includes(b.status)).length} iconBg="bg-emerald-50"  iconColor="text-emerald-600" />
              </div>

              {todayActive.length > 0 ? (
                <div>
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Clock size={14} /> Today's Active Projects
                  </h3>
                  <div className="space-y-3">
                    {todayActive.map(b => (
                      <div key={b.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-4 py-3 shadow-sm">
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">#{b.id} — {b.service_type || 'Garden Project'}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{b.service_address || 'No address'}</p>
                        </div>
                        <CrewBadge label={b.status} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <CrewEmptyState icon={Calendar} title="No active projects today" sub="Check 'My Tasks' to see all your assigned projects." />
              )}
            </div>
          );
        })()}

        {/* ── My Tasks tab ── */}
        {!loading && activeTab === 'projects' && (() => {
          const myBookings    = bookings;
          const todayBookings = myBookings.filter(b => b.scheduled_date === today && !CREW_DONE_STATUSES.includes(b.status));
          const viewBookings  = crewViewMode === 'today' ? todayBookings : myBookings;
          const activeB       = viewBookings.filter(b => ['Preparing', 'Installing'].includes(b.status));
          const pendingB      = viewBookings.filter(b => b.status === 'Pending');
          const completedB    = crewViewMode === 'all' ? viewBookings.filter(b => CREW_DONE_STATUSES.includes(b.status)) : [];

          return (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-sm">
                  {[
                    { key: 'today', label: "Today's Schedule", count: todayBookings.length },
                    { key: 'all',   label: 'All Tasks',        count: myBookings.filter(b => !CREW_DONE_STATUSES.includes(b.status)).length },
                  ].map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => setCrewViewMode(key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer border-none
                        ${crewViewMode === key ? 'bg-orange-500 text-white shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                      {label}
                      {count > 0 && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${crewViewMode === key ? 'bg-white/25 text-white' : 'bg-orange-100 text-orange-700'}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 hidden sm:block">{today}</p>
              </div>

              {activeB.length > 0 && (
                <div>
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse inline-block" /> Active in Field ({activeB.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeB.map(b => WorkOrderCard(b))}
                  </div>
                </div>
              )}

              {pendingB.length > 0 && (
                <div>
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Clock size={13} /> Scheduled ({pendingB.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pendingB.map(b => WorkOrderCard(b))}
                  </div>
                </div>
              )}

              {completedB.length > 0 && (
                <div>
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <CheckCircle2 size={13} /> Completed ({completedB.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {completedB.map(b => WorkOrderCard(b))}
                  </div>
                </div>
              )}

              {activeB.length === 0 && pendingB.length === 0 && (
                <CrewEmptyState
                  icon={Calendar}
                  title={crewViewMode === 'today' ? 'No tasks scheduled for today' : 'No assigned projects'}
                  sub={crewViewMode === 'today'
                    ? 'Switch to "All Tasks" to see your full project list.'
                    : 'Your supervisor will assign projects to you from the office portal.'}
                />
              )}
            </div>
          );
        })()}

        {/* ── Attendance tab ── */}
        {!loading && activeTab === 'attendance' && (
          <div className="max-w-lg">
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <Clock size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Attendance Tracking</h3>
                  <p className="text-xs text-slate-400">Clock in, clock out, and submit photo proof</p>
                </div>
              </div>
              {activeAttendance?.clocked_in && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl mb-4 text-xs font-bold text-emerald-700">
                  <CheckCircle2 size={13} /> Active shift — Booking #{activeAttendance.attendance?.booking}
                </div>
              )}
              <button
                onClick={() => navigate('/staff-attendance')}
                className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer border-none"
              >
                <Clock size={15} /> Open Attendance Page
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── Mobile bottom tab bar (crew-only) ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex shadow-lg md:hidden">
        {TABS.map(({ key, label, Icon, badge }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 cursor-pointer border-none transition-colors
              ${activeTab === key ? 'text-orange-600 bg-orange-50' : 'text-slate-400 bg-white'}`}
          >
            <div className="relative">
              <Icon size={22} />
              {badge != null && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Desktop tab bar for crew (md+) ── */}
      <div className="hidden md:flex fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
        {TABS.map(({ key, label, Icon, badge }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-3 cursor-pointer border-none transition-colors text-sm font-semibold
              ${activeTab === key ? 'text-orange-600 bg-orange-50' : 'text-slate-400 bg-white hover:text-slate-700 hover:bg-slate-50'}`}
          >
            <div className="relative">
              <Icon size={18} />
              {badge != null && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[15px] h-[15px] px-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
            </div>
            {label}
          </button>
        ))}
      </div>

      {/* ── 3D / AR Design modal ── */}
      {designModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDesignModal(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden w-full shadow-2xl"
            style={{ maxWidth: '860px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="font-extrabold text-slate-900 text-base leading-none mb-0.5">
                  {designModal.name || 'Garden Design'}
                </p>
                <p className="text-slate-400 text-xs">
                  {modalArMode ? 'AR Photo Overlay · Read-only Preview' : '3D Garden Layout · Read-only Preview'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {(designModal.reference_image_url || designModal.image_url) && (
                  <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
                    {[{ key: false, label: '3D View' }, { key: true, label: 'AR Overlay' }].map(({ key, label }) => (
                      <button
                        key={String(key)}
                        type="button"
                        onClick={() => setModalArMode(key)}
                        style={{
                          padding: '4px 12px', borderRadius: '6px',
                          border: modalArMode === key ? '1.5px solid #059669' : '1.5px solid transparent',
                          cursor: 'pointer', fontSize: '0.71rem', fontWeight: 700,
                          background: modalArMode === key ? '#1E293B' : 'transparent',
                          color: modalArMode === key ? '#F8FAFC' : '#64748B',
                          transition: 'all 0.18s', whiteSpace: 'nowrap',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setDesignModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div style={{ height: '450px' }}>
              <ThreeGardenCanvas
                plants={toCanvasPlants(designModal.placed_items)}
                lotWidth={designModal.dimensions?.width || 10}
                lotLength={designModal.dimensions?.length || 15}
                backgroundImageUrl={designModal.reference_image_url || designModal.image_url || null}
                arMode={modalArMode}
                arGrid={modalArMode}
                horizonY={designModal.dimensions?.horizonY ?? 0.5}
                readOnly={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── GeofencedCheckIn — crew-only, moved from StaffDashboard ────────────── */
function GeofencedCheckIn({ booking, apiBase, headers, onCheckedIn, onQuickClockIn, toast, activeAttendance }) {
  const [siteLocating,  setSiteLocating]  = React.useState(false);
  const [siteCheckedIn, setSiteCheckedIn] = React.useState(false);
  const [siteError,     setSiteError]     = React.useState(null);
  const [quickLoading,  setQuickLoading]  = React.useState(false);
  const [quickError,    setQuickError]    = React.useState(null);

  const activeBookingId  = activeAttendance?.attendance?.booking ?? null;
  const isClocked        = !!activeAttendance?.clocked_in;
  const clockedInToThis  = isClocked && activeBookingId === booking.id;
  const clockedInToOther = isClocked && activeBookingId !== booking.id;

  const handleQuickClockIn = async () => {
    setQuickLoading(true);
    setQuickError(null);
    let lat = null, lng = null;
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 8000 })
      );
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
    } catch { /* GPS optional */ }

    try {
      const res = await fetch(`${apiBase}/attendance/clock_in/`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: booking.id, latitude: lat, longitude: lng }),
      });
      const data = await res.json();
      if (res.ok) {
        toast && toast(`Successfully clocked into Project #${booking.id}.`);
        onQuickClockIn && onQuickClockIn();
      } else {
        setQuickError(data.error || 'Clock-in failed. Please try again.');
      }
    } catch {
      setQuickError('Network error — please try again.');
    }
    setQuickLoading(false);
  };

  const handleSiteCheckIn = () => {
    if (!navigator.geolocation) { setSiteError('Geolocation is not supported by this browser.'); return; }
    setSiteLocating(true);
    setSiteError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`${apiBase}/bookings/${booking.id}/check_in_at_site/`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          });
          const data = await res.json();
          if (res.ok) {
            setSiteCheckedIn(true);
            toast && toast('Checked in at site — beginning installation.');
            onCheckedIn && onCheckedIn(data);
          } else {
            setSiteError(data.error || 'Check-in failed. Please try again.');
          }
        } catch {
          setSiteError('Network error during site check-in.');
        }
        setSiteLocating(false);
      },
      () => { setSiteError('Location access denied. Please enable GPS and try again.'); setSiteLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  if (siteCheckedIn) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', fontSize: '12px', fontWeight: 700, color: '#166534' }}>
        <MapPin size={13} /> Checked in at site
      </div>
    );
  }
  if (clockedInToOther) {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '8px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '11px', color: '#991b1b', fontWeight: 600 }}>
        <MapPin size={11} style={{ flexShrink: 0, marginTop: 1 }} />
        Active session is Booking #{activeBookingId}. Clock out there first, then quick clock-in here.
      </div>
    );
  }
  if (clockedInToThis) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#059669', fontWeight: 700, padding: '2px 8px', background: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0', alignSelf: 'flex-start', marginBottom: '2px' }}>
          ✓ Attendance session active
        </div>
        <button
          onClick={handleSiteCheckIn}
          disabled={siteLocating}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer border-none disabled:opacity-50"
        >
          <MapPin size={14} />
          {siteLocating ? 'Getting location…' : 'Geofenced Check-In / Photo Proof'}
        </button>
        {siteError && <p style={{ fontSize: '11px', color: '#dc2626', margin: 0, padding: '2px 4px' }}>{siteError}</p>}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <button
        onClick={handleQuickClockIn}
        disabled={quickLoading}
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer border-none disabled:opacity-50"
      >
        <LogIn size={14} />
        {quickLoading ? 'Clocking in…' : `Quick Clock-In (Project #${booking.id})`}
      </button>
      {quickError && <p style={{ fontSize: '11px', color: '#dc2626', margin: 0, padding: '2px 4px' }}>{quickError}</p>}
    </div>
  );
}

/* ─── FieldMilestoneStepper — 4-stage on-site pipeline for field crew ────── */
const FIELD_STAGES = [
  { key: 'design_contract',  label: 'Design Finalized & Contract Signed',              requiresPhoto: false },
  { key: 'site_prep',        label: 'Site Preparation Complete',                       requiresPhoto: true  },
  { key: 'installation',     label: 'Installation Service (Hardscape/Softscape) In-Progress', requiresPhoto: true  },
  { key: 'final_inspection', label: 'Final Inspection & Output Uploaded',              requiresPhoto: true  },
];
const FIELD_STAGE_SHORT = ['Design & Contract', 'Site Prep', 'Installation', 'Final Inspection'];

const LockIcon = () => (
  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

function FieldMilestoneStepper({ booking, apiBase, headers, onUpdated, isClocked }) {
  const buildMap = () => Object.fromEntries((booking.project_milestones || []).map(m => [m.phase, m]));

  const [milestoneMap, setMilestoneMap] = React.useState(buildMap);
  const [saving,       setSaving]       = React.useState(null);
  const [uploadFile,   setUploadFile]   = React.useState({});
  const [uploadError,  setUploadError]  = React.useState({});
  const [open,         setOpen]         = React.useState(false);

  const completedCount = FIELD_STAGES.filter(s => (milestoneMap[s.key]?.completion_pct || 0) === 100).length;
  const barPct   = Math.round((completedCount / FIELD_STAGES.length) * 100);
  const pctColor = completedCount === 4 ? '#059669' : completedCount > 0 ? '#d97706' : '#64748b';

  const callMilestone = async (phase, pct, proofUrl) => {
    const body = { phase, completion_pct: pct };
    if (proofUrl) body.proof_photo_url = proofUrl;
    const res = await fetch(`${apiBase}/bookings/${booking.id}/update_milestone/`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Server error');
    return res.json();
  };

  const markComplete = async (stage) => {
    setSaving(stage.key);
    setUploadError(prev => ({ ...prev, [stage.key]: null }));

    let proofUrl = '';

    if (stage.requiresPhoto) {
      const file = uploadFile[stage.key];
      if (!file) {
        setUploadError(prev => ({ ...prev, [stage.key]: 'Please select a photo first.' }));
        setSaving(null);
        return;
      }
      const form = new FormData();
      form.append('image', file);
      try {
        const r = await fetch(`${apiBase}/upload-design-image/`, {
          method: 'POST',
          headers: { Authorization: headers.Authorization },
          body: form,
        });
        if (!r.ok) throw new Error();
        const { url } = await r.json();
        proofUrl = url;
      } catch {
        setUploadError(prev => ({ ...prev, [stage.key]: 'Image upload failed. Try again.' }));
        setSaving(null);
        return;
      }
    }

    try {
      const data = await callMilestone(stage.key, 100, proofUrl);
      if (data.milestone) setMilestoneMap(prev => ({ ...prev, [stage.key]: data.milestone }));
      onUpdated && onUpdated(data);
    } catch { /* silent */ }
    setSaving(null);
  };

  const markIncomplete = async (stage) => {
    setSaving(stage.key);
    try {
      const data = await callMilestone(stage.key, 0, '');
      if (data.milestone) setMilestoneMap(prev => ({ ...prev, [stage.key]: data.milestone }));
      onUpdated && onUpdated(data);
    } catch { /* silent */ }
    setSaving(null);
  };

  return (
    <div>
      {/* Progress bar — always visible regardless of clock-in state */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Phase Progress · {completedCount}/4 Complete
        </span>
        <span style={{ fontSize: '11px', fontWeight: 800, color: pctColor }}>{barPct}%</span>
      </div>
      <div style={{ height: '5px', background: '#e5e7eb', borderRadius: '9999px', marginBottom: '12px' }}>
        <div style={{ height: '100%', background: pctColor, borderRadius: '9999px', width: `${barPct}%`, transition: 'width 0.35s ease' }} />
      </div>

      {!isClocked ? (
        /* ── Locked: read-only horizontal pipeline preview ─────────────── */
        <div>
          {/* Step nodes */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            {/* Connecting line behind the nodes */}
            <div style={{ position: 'absolute', top: '11px', left: '11px', right: '11px', height: '2px', background: '#e2e8f0', zIndex: 0 }} />

            {FIELD_STAGES.map((stage, idx) => {
              const isDone = (milestoneMap[stage.key]?.completion_pct || 0) === 100;
              return (
                <div key={stage.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flex: 1, position: 'relative', zIndex: 1 }}>
                  <div style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: isDone ? '#059669' : '#f1f5f9',
                    border: `2px solid ${isDone ? '#059669' : '#cbd5e1'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isDone ? '10px' : '8px', fontWeight: 900,
                    color: isDone ? 'white' : '#94a3b8',
                  }}>
                    {isDone ? '✓' : <LockIcon />}
                  </div>
                  <span style={{ fontSize: '8.5px', fontWeight: 700, color: isDone ? '#059669' : '#94a3b8', textAlign: 'center', lineHeight: 1.25, maxWidth: '54px' }}>
                    {FIELD_STAGE_SHORT[idx]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Lock hint */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginTop: '10px', padding: '7px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
            <span style={{ color: '#94a3b8', display: 'flex' }}><LockIcon /></span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>Clock in above to unlock stage controls</span>
          </div>
        </div>
      ) : (
        /* ── Unlocked: full interactive stage controls ─────────────────── */
        <div>
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              width: '100%', padding: '6px 0', marginBottom: open ? '10px' : 0,
              background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px',
              cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: '#475569',
            }}
          >
            {open ? '▲ Hide Stages' : '▼ Manage Stages'}
          </button>

          {open && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {FIELD_STAGES.map((stage, idx) => {
                const m        = milestoneMap[stage.key];
                const isDone   = (m?.completion_pct || 0) === 100;
                const isSaving = saving === stage.key;
                const err      = uploadError[stage.key];
                const file     = uploadFile[stage.key];

                return (
                  <div
                    key={stage.key}
                    style={{
                      background: isDone ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${isDone ? '#bbf7d0' : '#e2e8f0'}`,
                      borderRadius: '12px',
                      padding: '12px',
                    }}
                  >
                    {/* Stage header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: isDone ? '6px' : '10px' }}>
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
                        background: isDone ? '#059669' : '#e2e8f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '10px', fontWeight: 900, color: isDone ? 'white' : '#64748b',
                      }}>
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: isDone ? '#059669' : '#334155', flex: 1, lineHeight: '1.35' }}>
                        {stage.label}
                      </span>
                      {isDone && m?.proof_photo_url && (
                        <a
                          href={m.proof_photo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '10px', color: '#059669', fontWeight: 700, textDecoration: 'none', background: 'white', padding: '2px 7px', borderRadius: '6px', border: '1px solid #bbf7d0', flexShrink: 0, whiteSpace: 'nowrap' }}
                        >
                          📷 Proof
                        </a>
                      )}
                    </div>

                    {/* Incomplete — interactive controls */}
                    {!isDone && (
                      stage.requiresPhoto ? (
                        <div>
                          <label style={{ display: 'block', marginBottom: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '4px' }}>
                              Upload Phase Image Proof
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              disabled={isSaving}
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) setUploadFile(prev => ({ ...prev, [stage.key]: f }));
                              }}
                              style={{ width: '100%', fontSize: '11px', color: '#475569', padding: '5px 8px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', boxSizing: 'border-box', cursor: 'pointer' }}
                            />
                          </label>
                          {file && (
                            <p style={{ fontSize: '10px', color: '#059669', fontWeight: 600, marginBottom: '5px', marginTop: '-2px' }}>
                              ✓ {file.name}
                            </p>
                          )}
                          {err && (
                            <p style={{ fontSize: '10px', color: '#dc2626', fontWeight: 600, marginBottom: '5px' }}>{err}</p>
                          )}
                          <button
                            onClick={() => markComplete(stage)}
                            disabled={isSaving || !file}
                            style={{
                              width: '100%', padding: '7px 0',
                              background: isSaving || !file ? '#94a3b8' : '#0f172a',
                              color: 'white', fontSize: '11px', fontWeight: 700, borderRadius: '8px',
                              border: 'none', cursor: isSaving || !file ? 'not-allowed' : 'pointer', transition: 'background 0.15s',
                            }}
                          >
                            {isSaving ? 'Uploading & Saving…' : 'Mark Stage Complete'}
                          </button>
                        </div>
                      ) : (
                        /* Stage 1 — checkbox confirmation only */
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: isSaving ? 'not-allowed' : 'pointer' }}>
                          <input
                            type="checkbox"
                            disabled={isSaving}
                            onChange={e => e.target.checked && markComplete(stage)}
                            style={{ width: '15px', height: '15px', accentColor: '#059669', flexShrink: 0, marginTop: '1px', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600, lineHeight: '1.4' }}>
                            Crew leader confirms physical layout metrics verified with client
                          </span>
                        </label>
                      )
                    )}

                    {/* Complete — timestamp + undo */}
                    {isDone && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                          Complete{m?.updated_at ? ` · ${new Date(m.updated_at).toLocaleDateString()}` : ''}
                        </span>
                        <button
                          onClick={() => markIncomplete(stage)}
                          disabled={isSaving}
                          style={{ fontSize: '10px', color: '#94a3b8', background: 'none', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', textDecoration: 'underline', padding: 0, fontWeight: 600 }}
                        >
                          {isSaving ? '…' : 'Undo'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
