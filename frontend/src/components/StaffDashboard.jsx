import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDesign } from '../context/DesignContext';
import { loadDesign } from '../services/api';
import CrewDashboardView from './CrewDashboardView';
import {
  LayoutDashboard, Shield, Eye, CheckCircle2,
  Calendar, FileText, AlertTriangle,
  X, Package, Star, ArrowRight, Clock,
  CheckCircle, XCircle, Banknote,
} from 'lucide-react';
import ThreeGardenCanvas from './ThreeGardenCanvas';
import ProjectBillingModal from './ProjectBillingModal';
import OrderQueue from './OrderQueue';
import BookingQueue from './BookingQueue';
import CashDesk from './CashDesk';
import { cachedGet } from '../crew/outbox';
import { DEFAULT_TIME_OF_DAY } from '../data/studioLight';
import { API_BASE_URL as API_ROOT } from '../config';

/* ─── Toast notification system ─────────────────────────────────────────── */
function useToast() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }, []);
  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);
  return { toasts, push, dismiss };
}

function ToastStack({ toasts, dismiss }) {
  if (!toasts.length) return null;
  return (
    // Phones: top of the screen, so toasts never cover bottom bars or sheet buttons
    <div className="fixed top-20 left-4 right-4 sm:top-auto sm:left-auto sm:bottom-6 sm:right-6 z-[300] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold min-w-[260px] max-w-sm border transition-all
            ${t.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}
        >
          {t.type === 'success'
            ? <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            : <AlertTriangle size={16} className="shrink-0 text-red-500" />}
          <span className="flex-1">{t.msg}</span>
          <button onClick={() => dismiss(t.id)} className="shrink-0 opacity-50 hover:opacity-100 cursor-pointer bg-transparent border-none p-0">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ─── Skeleton loader ────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="border border-slate-100 rounded-2xl bg-white p-5 shadow-sm animate-pulse">
      <div className="w-full h-36 bg-slate-100 rounded-xl mb-4" />
      <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
      <div className="h-3 bg-slate-100 rounded w-1/2 mb-4" />
      <div className="space-y-2">
        <div className="h-3 bg-slate-100 rounded" />
        <div className="h-3 bg-slate-100 rounded" />
        <div className="h-3 bg-slate-100 rounded w-4/5" />
      </div>
      <div className="mt-5 h-9 bg-slate-100 rounded-xl" />
    </div>
  );
}

/* ─── Status badge ───────────────────────────────────────────────────────── */
const STATUS_STYLES = {
  Pending:          'bg-amber-50   text-amber-700   border-amber-200',
  Preparing:        'bg-blue-50    text-blue-700    border-blue-200',
  Installing:       'bg-orange-50  text-orange-700  border-orange-200',
  'For Review':     'bg-violet-50  text-violet-700  border-violet-200',
  Finished:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  Paid:            'bg-emerald-50 text-emerald-700 border-emerald-200',
  Shipped:          'bg-blue-50    text-blue-700    border-blue-200',
  'Out for Delivery':'bg-sky-50    text-sky-700     border-sky-200',
  Delivered:        'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelled:        'bg-red-50     text-red-700     border-red-200',
  Confirmed:        'bg-blue-50    text-blue-700    border-blue-200',
  'In Progress':    'bg-amber-50   text-amber-700   border-amber-200',
  'Awaiting Review':'bg-purple-50  text-purple-700  border-purple-200',
};

function Badge({ label }) {
  const cls = STATUS_STYLES[label] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${cls}`}>
      {label}
    </span>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────────── */
function EmptyState({ icon: Icon, title, sub }) {
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

/* ─── Stat card ──────────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, label, value, iconBg, iconColor, border }) {
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border flex items-center justify-between gap-4 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 ${border}`}>
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

/* ─── Main component ─────────────────────────────────────────────────────── */
const StaffDashboard = () => {
  const { authTokens, user } = useAuth();
  const { dispatch } = useDesign();
  const navigate = useNavigate();
  const location = useLocation();
  const { toasts, push: toast, dismiss } = useToast();

  const [designs,          setDesigns]          = useState([]);
  const [orderCounts,      setOrderCounts]      = useState(null); // queue badges; the list itself is paged (OrderQueue)
  const [bookings,         setBookings]         = useState([]);   // field crew only: their own jobs
  const [crewSavedAt,      setCrewSavedAt]      = useState(null); // crew: showing the copy saved on the phone (no signal)
  const [cashOrders,       setCashOrders]       = useState(0);    // office: COD deliveries whose cash isn't handed in
  const [bookingCounts,    setBookingCounts]    = useState(null); // office: queue badges (BookingQueue pages the list)
  const [bookingReload,    setBookingReload]    = useState(0);
  const [inventoryItems,   setInventoryItems]   = useState([]);
  const [activeAttendance, setActiveAttendance] = useState(null);
  const [loading,          setLoading]          = useState(true);
  const isFieldCrew = user?.staff_role === 'FIELD_CREW';
  const [activeTab,        setActiveTab]        = useState(() => user?.staff_role === 'FIELD_CREW' ? 'home' : 'overview');
  const [actionLoading,    setActionLoading]    = useState(null);
  const [designModal,      setDesignModal]      = useState(null);
  const [modalArMode,      setModalArMode]      = useState(false);
  const [crewViewMode,       setCrewViewMode]       = useState('today'); // 'today' | 'all'
  const [billingBooking,     setBillingBooking]     = useState(null);    // booking open in Project & Billing

  const API = API_ROOT;

  /* Sync tab with ?tab= URL param */
  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    const validTabs = isFieldCrew
      ? ['home', 'projects', 'attendance']
      : ['overview', 'designs', 'bookings', 'orders', 'cash'];
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  /* Reset AR mode whenever a new design is opened in the modal */
  useEffect(() => { setModalArMode(false); }, [designModal]);

  const headers = { Authorization: `Bearer ${authTokens?.access}` };

  const refreshActiveAttendance = async () => {
    if (isFieldCrew) {
      const { data } = await cachedGet('/attendance/current/', 'attendance');
      if (data) setActiveAttendance(data);
      return;
    }
    try {
      const r = await fetch(`${API}/attendance/current/`, { headers });
      if (r.ok) setActiveAttendance(await r.json());
    } catch { /* silent */ }
  };

  // Crew: fresh jobs, or the copy saved on the phone when there's no signal
  const applyCrewBookings = ({ data, savedAt }) => {
    if (data) setBookings(data);
    setCrewSavedAt(savedAt);
  };
  const loadCrewBookings = () => cachedGet('/bookings/', 'bookings').then(applyCrewBookings);

  useEffect(() => {
    if (!authTokens) return;
    const get = (url) => fetch(`${API}${url}`, { headers }).then(r => r.ok ? r.json() : Promise.reject());
    const fetches = [
      refreshActiveAttendance(),
    ];
    if (isFieldCrew) {
      fetches.push(loadCrewBookings());
    } else {
      fetches.push(
        get('/bookings/counts/').then(setBookingCounts).catch(() => {}),
        get('/designs/submitted_designs/').then(setDesigns).catch(() => {}),
        get('/orders/counts/').then(setOrderCounts).catch(() => {}),
        get('/cash/').then(d => setCashOrders(d.crew.reduce((n, c) => n + c.orders.length, 0))).catch(() => {}),
        get('/inventory/').then(setInventoryItems).catch(() => {}),
      );
    }
    Promise.all(fetches).finally(() => setLoading(false));
  }, [authTokens]);

  // Crew: a notification link (new job, date change…) brings a fresh job list
  const firstVisit = useRef(true);
  useEffect(() => {
    if (firstVisit.current) { firstVisit.current = false; return; }
    if (!isFieldCrew || !authTokens) return;
    cachedGet('/bookings/', 'bookings').then(applyCrewBookings);
  }, [location.key]); // eslint-disable-line react-hooks/exhaustive-deps -- refetch per navigation only

  /* ── Derived counts ── */
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const pendingDesigns   = designs.length;
  const todaysBookings   = isFieldCrew ? bookings.filter(b => b.scheduled_date === today).length : (bookingCounts?.today || 0);
  const ordersToPack     = orderCounts?.to_pack || 0;
  const refundsOwed      = orderCounts?.needs_refund || 0;
  // Each item has its own low-stock level (Inventory → Low stock at)
  const lowStock         = inventoryItems.filter(i => i.is_low_stock ?? Number(i.stock_quantity || 0) < 10).length;

  // Switching tabs starts from a clean URL so one tab's filters don't leak into the next
  const goTab = (key) => navigate(`${location.pathname}?tab=${key}`);

  /* ── Tab definitions ── */
  const TABS = isFieldCrew ? [
    { key: 'home',       label: 'Home',        Icon: LayoutDashboard, badge: null },
    { key: 'projects',   label: 'My Tasks',    Icon: Calendar, badge: bookings.filter(b => ['Preparing', 'Installing'].includes(b.status)).length || null },
    { key: 'attendance', label: 'Attendance',  Icon: Clock,    badge: null },
  ] : [
    { key: 'overview',  label: 'Overview',  Icon: LayoutDashboard, badge: null },
    { key: 'designs',   label: 'Designs',   Icon: Star,            badge: pendingDesigns || null },
    { key: 'bookings',  label: 'Bookings',  Icon: Calendar,        badge: ((bookingCounts?.awaiting || 0) + (bookingCounts?.dispatch || 0) + (bookingCounts?.review || 0)) || null },
    { key: 'orders',    label: 'Orders',    Icon: Package,         badge: (ordersToPack + refundsOwed) || null },
    { key: 'cash',      label: 'Cash',      Icon: Banknote,        badge: cashOrders || null },
  ];

  /* ── API actions ── */
  const updateDesignStatus = async (id, status) => {
    setActionLoading(id);
    try {
      const r = await fetch(`${API}/designs/${id}/update_status/`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (r.ok) {
        setDesigns(d => d.filter(x => x.id !== id));
        toast(`Design ${status === 'approved' ? 'approved' : 'rejected'} successfully.`);
      } else {
        toast('Failed to update design status.', 'error');
      }
    } catch {
      toast('Network error — please try again.', 'error');
    }
    setActionLoading(null);
  };

  const refreshBookings = async () => {
    if (isFieldCrew) return loadCrewBookings();
    const r = await fetch(`${API}/bookings/`, { headers });
    if (r.ok) setBookings(await r.json());
  };

  const updateBookingStatus = async (id, status) => {
    setActionLoading(id);
    try {
      const r = await fetch(`${API}/bookings/${id}/update_status/`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const messages = {
        Finished: 'Job signed off — the customer can now leave a review.',
        Installing: 'Sent back to the crew for more work.',
      };
      if (r.ok) { await refreshBookings(); toast(messages[status] || `Booking updated to ${status}.`); }
      else {
        const d = await r.json().catch(() => ({}));
        toast(d.error || d.detail || 'Failed to update booking.', 'error');
      }
    } catch {
      toast('Network error — please try again.', 'error');
    }
    setActionLoading(null);
  };


  const handleViewDesign = async (id) => {
    try {
      const design = await loadDesign(id);
      dispatch({
        type: 'LOAD_DESIGN',
        payload: {
          designId: design.id,
          designName: design.name,
          depthData: design.depth_data,
          placedItems: (design.placed_items || []).map((item, idx) => ({
            id: Date.now() + idx,
            productId: item.product_id,
            name: item.name,
            modelType: item.model_type,
            price: item.price,
            position: item.position,
            rotation: item.rotation,
            scale: item.scale,
          })),
          dimensions: design.dimensions || { width: 10, length: 15, terrainType: 'flat' },
          terrainHeight: design.terrain_height || 1.5,
          timeOfDay: design.time_of_day ?? DEFAULT_TIME_OF_DAY,
        },
      });
      navigate('/studio');
    } catch {
      toast('Could not load the design for preview.', 'error');
    }
  };

  /* ── Transform placed_items → ThreeGardenCanvas plant format ── */
  const toCanvasPlants = (placedItems = []) =>
    placedItems.map(item => {
      // AI designer flat format: { plant_id, x, z, rotation }
      if (item.plant_id !== undefined) {
        return { plant_id: item.plant_id, x: item.x ?? 0, z: item.z ?? 0, rotation: item.rotation ?? 0 };
      }
      // Studio format: { productId/modelType, position: {x,z}, rotation: {y} }
      return {
        plant_id: item.modelType || item.model_type || String(item.productId || ''),
        x: item.position?.x ?? 0,
        z: item.position?.z ?? 0,
        rotation: item.rotation?.y ?? 0,
      };
    });

  /* ── Greeting ── */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  /* ────────────────────────────── RENDER ────────────────────────────────── */
  if (isFieldCrew) {
    return (
      <>
        <CrewDashboardView
          bookings={bookings}
          loading={loading}
          serverAttendance={activeAttendance}
          refreshActiveAttendance={refreshActiveAttendance}
          savedAt={crewSavedAt}
          authTokens={authTokens}
          user={user}
          actionLoading={actionLoading}
          setActionLoading={setActionLoading}
          toast={toast}
          updateBookingStatus={updateBookingStatus}
          reloadBookings={refreshBookings}
        />
        <ToastStack toasts={toasts} dismiss={dismiss} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 md:py-8">

        {/* ── Page Header ── */}
        <div className="flex items-start justify-between mb-6 md:mb-8 gap-4 relative">
          <div className="flex items-center gap-3 md:gap-4 min-w-0">
            <div className="p-2.5 md:p-3 rounded-2xl shadow-sm shrink-0 bg-emerald-600">
              <Shield size={22} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight leading-none mb-1 truncate">
                Staff Portal
              </h1>
              <p className="text-slate-500 text-xs md:text-sm truncate">{greeting}, <span className="font-semibold text-slate-700">{user?.first_name || user?.username || 'Staff'}</span><span className="hidden sm:inline"> · {dateStr}</span></p>
            </div>
          </div>

        </div>

        {/* ── Stat Cards (Overview only: on the work tabs the list itself comes first) ── */}
        {activeTab === 'overview' && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Calendar}      label="Today's Bookings"  value={todaysBookings}  iconBg="bg-emerald-50"  iconColor="text-emerald-600" border="border-slate-100" />
          <StatCard icon={Package}       label="Orders to Pack"    value={ordersToPack}    iconBg="bg-blue-50"     iconColor="text-blue-600"    border="border-slate-100" />
          <StatCard icon={FileText}      label="Pending Reviews"   value={pendingDesigns}  iconBg="bg-purple-50"   iconColor="text-purple-600"  border="border-slate-100" />
          <StatCard icon={AlertTriangle} label="Low Stock Alerts"  value={lowStock}        iconBg="bg-red-50"      iconColor="text-red-500"     border="border-slate-100" />
        </div>}

        {/* ── Tab Navigation Bar (desktop + OFFICE_ADMIN) ── */}
        <div className="flex items-center gap-1 mb-6 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm w-fit max-w-full overflow-x-auto">
          {TABS.map(({ key, label, Icon, badge }) => (
            <button
              key={key}
              onClick={() => goTab(key)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer border-none shrink-0 whitespace-nowrap
                ${activeTab === key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 bg-transparent'}`}
            >
              <Icon size={15} />
              <span>{label}</span>
              {badge != null && (
                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold
                  ${activeTab === key ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Loading skeletons ── */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* ── Overview Tab ── */}
        {!loading && activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Welcome banner */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-sm">
              <h2 className="text-xl font-extrabold mb-1">Welcome back, {user?.first_name || user?.username || 'Staff Member'}!</h2>
              <p className="text-emerald-100 text-sm">Here is your daily operational summary for {dateStr}.</p>
            </div>

            {/* Quick action cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  icon: Star, iconBg: 'bg-purple-100', iconColor: 'text-purple-600',
                  title: 'Designs', tab: 'designs',
                  body: pendingDesigns
                    ? `${pendingDesigns} layout${pendingDesigns > 1 ? 's' : ''} awaiting your review.`
                    : 'All design reviews are up to date.',
                  cta: 'Review Designs',
                },
                {
                  icon: Calendar, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',
                  title: 'Bookings', tab: 'bookings',
                  body: todaysBookings
                    ? `${todaysBookings} consultation${todaysBookings > 1 ? 's' : ''} scheduled for today.`
                    : 'No consultations scheduled for today.',
                  cta: 'View Bookings',
                },
                {
                  icon: Package, iconBg: 'bg-blue-100', iconColor: 'text-blue-600',
                  title: 'Orders', tab: 'orders',
                  body: (ordersToPack
                    ? `${ordersToPack} order${ordersToPack > 1 ? 's' : ''} ready to pack and ship.`
                    : 'No orders waiting to be packed.')
                    + (refundsOwed ? ` ${refundsOwed} refund${refundsOwed > 1 ? 's' : ''} owed.` : ''),
                  cta: 'Manage Orders',
                },
              ].map(({ icon: Icon, iconBg, iconColor, title, tab, body, cta }) => (
                <div key={tab} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                  <div>
                    <div className={`inline-flex p-2.5 rounded-xl ${iconBg} mb-3`}>
                      <Icon size={18} className={iconColor} />
                    </div>
                    <h4 className="font-bold text-slate-800 mb-1">{title}</h4>
                    <p className="text-slate-500 text-sm leading-relaxed mb-4">{body}</p>
                  </div>
                  <button
                    onClick={() => goTab(tab)}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer border-none"
                  >
                    {cta} <ArrowRight size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Low stock alert strip */}
            {lowStock > 0 && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
                <AlertTriangle size={18} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-700 font-medium">
                  <span className="font-bold">{lowStock} inventory item{lowStock > 1 ? 's' : ''}</span> {lowStock > 1 ? 'are' : 'is'} at or below the low-stock level. Restock from the inventory page.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Designs Tab ── */}
        {!loading && activeTab === 'designs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {designs.length === 0 ? (
              <EmptyState icon={Star} title="All caught up!" sub="No design layouts are currently pending review." />
            ) : designs.map(design => {
              const w = design.dimensions?.width || 10;
              const l = design.dimensions?.length || 15;
              const terrain = design.dimensions?.terrainType || 'flat';
              const isAct = actionLoading === design.id;
              return (
                <div key={design.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                  {/* Thumbnail */}
                  <div className="relative w-full h-40 bg-slate-50">
                    {design.original_image_url
                      ? <img src={design.original_image_url} alt={design.name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-300">
                          <FileText size={36} strokeWidth={1} /><span className="text-xs">No reference image</span>
                        </div>
                    }
                    <div className="absolute top-2 right-2"><Badge label="Awaiting Review" /></div>
                  </div>

                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-bold text-slate-800 truncate mb-0.5">{design.name}</h3>
                    <p className="text-xs text-slate-400 mb-4">#{design.id} · {new Date(design.updated_at).toLocaleDateString()}</p>

                    <div className="space-y-2 text-sm mb-5">
                      <Row label="Customer"      value={design.customer_name || 'Anonymous'} />
                      <Row label="Lot"           value={`${w}m × ${l}m (${terrain})`} />
                      <Row label="Estimate"      value={`₱${Number(design.total_cost).toLocaleString()}`} valueClass="font-bold text-emerald-600" />
                    </div>

                    <div className="flex flex-col gap-2 mt-auto">
                      <button
                        onClick={() => handleViewDesign(design.id)}
                        disabled={isAct}
                        className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer border-none disabled:opacity-50"
                      >
                        <Eye size={14} /> Review in 3D Studio
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateDesignStatus(design.id, 'approved')}
                          disabled={isAct}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <CheckCircle size={13} /> Approve
                        </button>
                        <button
                          onClick={() => updateDesignStatus(design.id, 'rejected')}
                          disabled={isAct}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl border border-red-200 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <XCircle size={13} /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Bookings Tab ── */}
        {!loading && activeTab === 'bookings' && (
          <BookingQueue api={API} headers={headers} toast={toast} onCounts={setBookingCounts}
            onOpenDesign={setDesignModal} onOpenBilling={setBillingBooking} reloadKey={bookingReload} />
        )}

        {/* ── Orders Tab ── */}
        {!loading && activeTab === 'orders' && (
          <OrderQueue api={API} headers={headers} toast={toast} onCounts={setOrderCounts} />
        )}

        {/* ── Cash Tab (COD cash handed in by the crew) ── */}
        {!loading && activeTab === 'cash' && (
          <CashDesk api={API} headers={headers} toast={toast} onCount={setCashOrders} />
        )}

      </div>

      {/* ── Toast stack ── */}
      <ToastStack toasts={toasts} dismiss={dismiss} />



      {/* ── Design Review Modal ── */}
      {designModal && (
        <DesignReviewModal
          design={designModal}
          arMode={modalArMode}
          setArMode={setModalArMode}
          onClose={() => setDesignModal(null)}
          toCanvasPlants={toCanvasPlants}
        />
      )}

      {/* ── Project & Billing Modal ── */}
      {billingBooking && (
        <ProjectBillingModal
          booking={billingBooking}
          apiBase={API}
          headers={headers}
          toast={toast}
          onChanged={() => setBookingReload(k => k + 1)}
          onClose={() => setBillingBooking(null)}
        />
      )}
    </div>
  );
};


/* ─── Inline key-value row helper ──────────────────────────────────────── */
function Row({ label, value, valueClass = 'font-semibold text-slate-700' }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className={`truncate max-w-[160px] text-right ${valueClass}`}>{value}</span>
    </div>
  );
}


/* ─── DesignReviewModal Component ─── */
function DesignReviewModal({ design, arMode, setArMode, onClose, toCanvasPlants }) {
  if (!design) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#020617]/[0.72] backdrop-blur-[8px] flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[24px] border border-slate-200 overflow-hidden w-full shadow-2xl"
        style={{ maxWidth: '860px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg leading-none mb-1">
              {design.name || 'Unnamed Design'}
            </h3>
            <p className="text-slate-400 text-xs font-semibold">
              {arMode ? 'AR Photo Overlay · Read-only Preview' : '3D Garden Layout · Read-only Preview'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(design.reference_image_url || design.image_url) && (
              <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
                {[{ key: false, label: '3D View' }, { key: true, label: 'AR Overlay' }].map(({ key, label }) => (
                  <button
                    key={String(key)}
                    type="button"
                    onClick={() => setArMode(key)}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      border: arMode === key ? '1.5px solid #10b981' : '1.5px solid transparent',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      background: arMode === key ? '#10b981' : 'transparent',
                      color: arMode === key ? '#ffffff' : '#64748B',
                      transition: 'all 0.18s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer bg-transparent border-none"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        {/* Canvas */}
        <div style={{ height: '480px' }}>
          <ThreeGardenCanvas
            plants={toCanvasPlants(design.placed_items)}
            lotWidth={design.dimensions?.width || 10}
            lotLength={design.dimensions?.length || 15}
            backgroundImageUrl={design.reference_image_url || design.image_url || null}
            arMode={arMode}
            arGrid={arMode}
            photoCorners={design.dimensions?.photoCorners}
            readOnly={true}
          />
        </div>
      </div>
    </div>
  );
}

export default StaffDashboard;
