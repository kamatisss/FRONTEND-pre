import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDesign } from '../context/DesignContext';
import { loadDesign } from '../services/api';
import CrewDashboardView from './CrewDashboardView';
import {
  LayoutDashboard, Shield, Eye, CheckCircle2,
  ShoppingBag, Calendar, FileText, AlertTriangle, Truck,
  X, Package, Star, ArrowRight, Clock, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Layers, Bell, UserCheck,
} from 'lucide-react';
import ThreeGardenCanvas from './ThreeGardenCanvas';

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
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
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
  Finished:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  Paid:             'bg-emerald-50 text-emerald-700 border-emerald-200',
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

/* ─── FSM Capacity Recommendation helpers ───────────────────────────────── */

/**
 * Extracts lot area (sqm) from a booking.
 * Prefers structured design_details.dimensions; falls back to allDesigns lookup.
 */
function parseLotArea(booking, allDesigns = []) {
  const dims = booking.design_details?.dimensions;
  if (dims?.width && dims?.length) {
    return parseFloat(dims.width) * parseFloat(dims.length);
  }
  const design = allDesigns.find(d => d.id === booking.design);
  if (design?.dimensions?.width && design?.dimensions?.length) {
    return parseFloat(design.dimensions.width) * parseFloat(design.dimensions.length);
  }
  return null;
}

/**
 * FSM dispatch heuristic:
 *   < 100 sqm  → 1 crew member
 *   100–200 sqm → 2 crew members
 *   > 200 sqm  → 3+ crew members
 */
function getCrewRecommendation(areaSqm, serviceType) {
  if (serviceType && (serviceType.toLowerCase() === 'consultation' || serviceType.toLowerCase() === 'consultation service')) {
    return { count: 1, label: '1 staff member/estimator' };
  }
  if (!areaSqm || areaSqm <= 0) return null;
  if (areaSqm < 100)  return { count: 1,    label: '1 crew member'  };
  if (areaSqm <= 200) return { count: 2,    label: '2 crew members' };
  return                     { count: '3+', label: '3+ crew members' };
}

/* ─── Main component ─────────────────────────────────────────────────────── */
const StaffDashboard = () => {
  const { authTokens, user } = useAuth();
  const { dispatch } = useDesign();
  const navigate = useNavigate();
  const location = useLocation();
  const { toasts, push: toast, dismiss } = useToast();

  const [designs,          setDesigns]          = useState([]);
  const [allDesigns,       setAllDesigns]       = useState([]);
  const [orders,           setOrders]           = useState([]);
  const [bookings,         setBookings]         = useState([]);
  const [inventoryItems,   setInventoryItems]   = useState([]);
  const [activeAttendance, setActiveAttendance] = useState(null);
  const [loading,          setLoading]          = useState(true);
  const isFieldCrew = user?.staff_role === 'FIELD_CREW';
  const [activeTab,        setActiveTab]        = useState(() => user?.staff_role === 'FIELD_CREW' ? 'home' : 'overview');
  const [expandedOrder,    setExpandedOrder]    = useState(null);
  const [actionLoading,    setActionLoading]    = useState(null);
  const [designModal,      setDesignModal]      = useState(null);
  const [modalArMode,      setModalArMode]      = useState(false);
  const [notifications,    setNotifications]    = useState([]);
  const [showNotifPanel,   setShowNotifPanel]   = useState(false);
  const [crewList,         setCrewList]         = useState([]);
  const [crewSelections,   setCrewSelections]   = useState({});  // bookingId → [userId, ...]
  const [assignLoading,    setAssignLoading]    = useState(null);
  const [bookingSubTab,      setBookingSubTab]      = useState('awaiting');
  const [bookingSubTabInited,setBookingSubTabInited] = useState(false);
  const [crewViewMode,       setCrewViewMode]       = useState('today'); // 'today' | 'all'

  const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

  /* Sync tab with ?tab= URL param */
  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    const validTabs = isFieldCrew
      ? ['home', 'projects', 'attendance']
      : ['overview', 'designs', 'bookings', 'orders'];
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  /* Reset AR mode whenever a new design is opened in the modal */
  useEffect(() => { setModalArMode(false); }, [designModal]);

  const headers = { Authorization: `Bearer ${authTokens?.access}` };

  const refreshActiveAttendance = async () => {
    try {
      const r = await fetch(`${API}/attendance/current/`, { headers });
      if (r.ok) setActiveAttendance(await r.json());
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (!authTokens) return;
    const get = (url) => fetch(`${API}${url}`, { headers }).then(r => r.ok ? r.json() : Promise.reject());
    const fetches = [
      get('/bookings/').then(data => { console.log('All Bookings statuses:', data.map(b => b.status)); setBookings(data); }).catch(() => {}),
      get('/notifications/').then(setNotifications).catch(() => {}),
      refreshActiveAttendance(),
    ];
    if (!isFieldCrew) {
      fetches.push(
        get('/designs/submitted_designs/').then(setDesigns).catch(() => {}),
        get('/orders/').then(setOrders).catch(() => {}),
        get('/inventory/').then(setInventoryItems).catch(() => {}),
        get('/designs/').then(setAllDesigns).catch(() => {}),
      );
    }
    Promise.all(fetches).finally(() => setLoading(false));
  }, [authTokens]);

  /* Lazy-load FIELD_CREW list when OFFICE_ADMIN opens the Bookings tab */
  useEffect(() => {
    if (activeTab !== 'bookings' || isFieldCrew || crewList.length > 0 || !authTokens) return;
    fetch(`${API}/bookings/field_crew_members/`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(setCrewList)
      .catch(() => {});
  }, [activeTab]);

  /* Sync multi-select crew selections from latest booking data */
  useEffect(() => {
    if (!bookings.length) return;
    setCrewSelections(prev => {
      const next = { ...prev };
      bookings.forEach(b => {
        if (!(b.id in next)) {
          next[b.id] = Array.isArray(b.assigned_crew) ? [...b.assigned_crew] : [];
        }
      });
      return next;
    });
  }, [bookings]);

  /* Smart-default the booking sub-tab to the most urgent category on first load */
  useEffect(() => {
    if (bookingSubTabInited || !bookings.length || isFieldCrew) return;
    const hasPending  = bookings.some(b => b.status === 'Pending');
    const hasDispatch = bookings.some(b =>
      ['Preparing', 'Installing'].includes(b.status) &&
      (!Array.isArray(b.assigned_crew) || b.assigned_crew.length === 0)
    );
    setBookingSubTab(hasPending ? 'awaiting' : hasDispatch ? 'dispatch' : 'all');
    setBookingSubTabInited(true);
  }, [bookings]);

  /* ── Derived counts ── */
  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();
  const pendingDesigns   = designs.length;
  const todaysBookings   = bookings.filter(b => b.scheduled_date === today).length;
  const pendingOrders    = orders.filter(o => o.status?.toLowerCase() === 'pending').length;
  const lowStock         = inventoryItems.filter(i => Number(i.stock_quantity || 0) < 10).length;

  /* ── Tab definitions ── */
  const TABS = isFieldCrew ? [
    { key: 'home',       label: 'Home',        Icon: LayoutDashboard, badge: null },
    { key: 'projects',   label: 'My Tasks',    Icon: Calendar, badge: bookings.filter(b => ['Preparing', 'Installing'].includes(b.status)).length || null },
    { key: 'attendance', label: 'Attendance',  Icon: Clock,    badge: null },
  ] : [
    { key: 'overview',  label: 'Overview',  Icon: LayoutDashboard, badge: null },
    { key: 'designs',   label: 'Designs',   Icon: Star,            badge: pendingDesigns || null },
    { key: 'bookings',  label: 'Bookings',  Icon: Calendar,        badge: todaysBookings || null },
    { key: 'orders',    label: 'Orders',    Icon: Package,         badge: pendingOrders || null },
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

  const refreshOrders = async () => {
    const r = await fetch(`${API}/orders/`, { headers });
    if (r.ok) setOrders(await r.json());
  };

  const updateOrderStatus = async (id, status) => {
    setActionLoading(id);
    try {
      const r = await fetch(`${API}/orders/${id}/update_status/`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (r.ok) { await refreshOrders(); toast(`Order marked as ${status}.`); }
      else       { const d = await r.json(); toast(d.error || 'Failed to update order.', 'error'); }
    } catch {
      toast('Network error — please try again.', 'error');
    }
    setActionLoading(null);
  };

  const refreshBookings = async () => {
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
      if (r.ok) { await refreshBookings(); toast(`Booking updated to ${status}.`); }
      else       { toast('Failed to update booking.', 'error'); }
    } catch {
      toast('Network error — please try again.', 'error');
    }
    setActionLoading(null);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const openNotifPanel = async () => {
    setShowNotifPanel(s => !s);
    if (!showNotifPanel && unreadCount > 0) {
      await fetch(`${API}/notifications/mark_all_read/`, { method: 'POST', headers });
      setNotifications(n => n.map(x => ({ ...x, is_read: true })));
    }
  };

  const toggleCrewMember = (bookingId, memberId) => {
    setCrewSelections(prev => {
      const current = prev[bookingId] || [];
      return {
        ...prev,
        [bookingId]: current.includes(memberId)
          ? current.filter(id => id !== memberId)
          : [...current, memberId],
      };
    });
  };

  const handleAssignCrew = async (bookingId) => {
    const crewIds = crewSelections[bookingId] || [];
    setAssignLoading(bookingId);
    try {
      const r = await fetch(`${API}/bookings/${bookingId}/assign_crew/`, {
        method: 'POST',
        // Explicit token header — avoids stale-closure issues with the shared `headers` object
        headers: {
          'Authorization': `Bearer ${authTokens?.access}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ crew_ids: crewIds }),
      });
      const data = await r.json();
      if (r.ok) {
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, ...data } : b));
        setCrewSelections(prev => ({
          ...prev,
          [bookingId]: Array.isArray(data.assigned_crew) ? [...data.assigned_crew] : [],
        }));
        toast(crewIds.length > 0
          ? `${crewIds.length} crew member${crewIds.length !== 1 ? 's' : ''} assigned.`
          : 'Crew unassigned.');
      } else {
        // data.detail = DRF permission-denied format; data.error = our custom format
        toast(data.error || data.detail || 'Assignment failed.', 'error');
      }
    } catch {
      toast('Network error — please try again.', 'error');
    } finally {
      setAssignLoading(null);
    }
  };


  const handleDownloadJobSheet = async (bookingId) => {
    try {
      const r = await fetch(`${API}/bookings/${bookingId}/generate_pdf/`, {
        headers: { 'Authorization': `Bearer ${authTokens?.access}` },
      });
      if (!r.ok) {
        toast('Failed to generate job sheet.', 'error');
        return;
      }
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
          timeOfDay: design.time_of_day || 14,
        },
      });
      navigate('/studio');
    } catch {
      toast('Could not load the design for preview.', 'error');
    }
  };

  const getLinkedDesign = (identifier) =>
    allDesigns.find(d =>
      d.customer_name?.toLowerCase() === identifier?.toLowerCase() ||
      d.name?.toLowerCase().includes(identifier?.toLowerCase())
    );

  const getLotProfile = (booking) => {
    const d = allDesigns.find(x => x.id === booking.design);
    return d?.dimensions
      ? `${d.dimensions.width}m × ${d.dimensions.length}m (${d.dimensions.terrainType || 'flat'})`
      : 'Consultation Lot';
  };

  const getThumbnail = (booking) => {
    const d = allDesigns.find(x => x.id === booking.design);
    return d?.original_image_url || booking.design_details?.image_url || null;
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
          activeAttendance={activeAttendance}
          refreshActiveAttendance={refreshActiveAttendance}
          authTokens={authTokens}
          user={user}
          actionLoading={actionLoading}
          setActionLoading={setActionLoading}
          toast={toast}
          updateBookingStatus={updateBookingStatus}
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

          {/* Notification Bell */}
          <div className="relative shrink-0">
            <button
              onClick={openNotifPanel}
              className="relative p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Bell size={18} className={unreadCount > 0 ? 'text-orange-500' : 'text-slate-500'} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification dropdown */}
            {showNotifPanel && (
              <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <span className="font-bold text-slate-800 text-sm">Notifications</span>
                  <button onClick={() => setShowNotifPanel(false)} className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer bg-transparent border-none">
                    <X size={14} />
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-slate-400 text-xs">No notifications yet.</div>
                  ) : notifications.slice(0, 15).map(n => (
                    <div key={n.id} className={`px-4 py-3 border-b border-slate-50 text-xs ${n.is_read ? 'text-slate-500' : 'text-slate-800 bg-orange-50'}`}>
                      <p className={`leading-relaxed mb-1 ${!n.is_read ? 'font-semibold' : ''}`}>{n.message}</p>
                      <p className="text-slate-400 text-[10px]">{new Date(n.timestamp).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Calendar}      label="Today's Bookings"  value={todaysBookings}  iconBg="bg-emerald-50"  iconColor="text-emerald-600" border="border-slate-100" />
          <StatCard icon={Package}       label="Pending Orders"    value={pendingOrders}   iconBg="bg-blue-50"     iconColor="text-blue-600"    border="border-slate-100" />
          <StatCard icon={FileText}      label="Pending Reviews"   value={pendingDesigns}  iconBg="bg-purple-50"   iconColor="text-purple-600"  border="border-slate-100" />
          <StatCard icon={AlertTriangle} label="Low Stock Alerts"  value={lowStock}        iconBg="bg-red-50"      iconColor="text-red-500"     border="border-slate-100" />
        </div>

        {/* ── Tab Navigation Bar (desktop + OFFICE_ADMIN) ── */}
        <div className="flex items-center gap-1 mb-6 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm w-fit">
          {TABS.map(({ key, label, Icon, badge }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer border-none
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
                  title: 'Design Queue', tab: 'designs',
                  body: pendingDesigns
                    ? `${pendingDesigns} layout${pendingDesigns > 1 ? 's' : ''} awaiting your review.`
                    : 'All design reviews are up to date.',
                  cta: 'Review Designs',
                },
                {
                  icon: Calendar, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',
                  title: 'Appointments', tab: 'bookings',
                  body: todaysBookings
                    ? `${todaysBookings} consultation${todaysBookings > 1 ? 's' : ''} scheduled for today.`
                    : 'No consultations scheduled for today.',
                  cta: 'View Bookings',
                },
                {
                  icon: Package, iconBg: 'bg-blue-100', iconColor: 'text-blue-600',
                  title: 'Order Fulfillment', tab: 'orders',
                  body: pendingOrders
                    ? `${pendingOrders} order${pendingOrders > 1 ? 's' : ''} pending fulfillment.`
                    : 'No orders pending fulfillment.',
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
                    onClick={() => setActiveTab(tab)}
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
                  <span className="font-bold">{lowStock} inventory item{lowStock > 1 ? 's' : ''}</span> {lowStock > 1 ? 'are' : 'is'} running low (under 10 units). Check the inventory manager.
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
        {!loading && activeTab === 'bookings' && (() => {
          // Sub-tab filter predicates
          const needsDispatch = b =>
            ['Preparing', 'Installing'].includes(b.status) &&
            (!Array.isArray(b.assigned_crew) || b.assigned_crew.length === 0);

          const BOOKING_SUB_TABS = [
            { key: 'all',       label: 'All',                  count: bookings.length },
            { key: 'awaiting',  label: 'Awaiting Confirmation', count: bookings.filter(b => b.status === 'Pending').length },
            { key: 'dispatch',  label: 'Needs Dispatch',        count: bookings.filter(needsDispatch).length },
            { key: 'active',    label: 'Active in Field',       count: bookings.filter(b => ['Preparing', 'Installing'].includes(b.status) && Array.isArray(b.assigned_crew) && b.assigned_crew.length > 0).length },
            { key: 'completed', label: 'Completed',             count: bookings.filter(b => ['Finished','Cancelled'].includes(b.status)).length },
          ];

          const filteredBookings = (() => {
            switch (bookingSubTab) {
              case 'awaiting':  return bookings.filter(b => b.status === 'Pending');
              case 'dispatch':  return bookings.filter(needsDispatch);
              case 'active':    return bookings.filter(b => ['Preparing', 'Installing'].includes(b.status) && Array.isArray(b.assigned_crew) && b.assigned_crew.length > 0);
              case 'completed': return bookings.filter(b => ['Finished','Cancelled'].includes(b.status));
              default:          return bookings;
            }
          })();

          const BookingCard = (booking) => {
            const isAct = actionLoading === booking.id;
            const thumb = getThumbnail(booking);
            const bom   = booking.design_details?.plant_breakdown || [];
            // Assign Crew block: only render on dispatch/all sub-tabs to keep other views compact
            const showAssignCrew = !isFieldCrew
              && !['Finished', 'Cancelled'].includes(booking.status)
              && crewList.length > 0
              && (bookingSubTab === 'dispatch' || bookingSubTab === 'all');

            return (
              <div key={booking.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                {/* Thumbnail — compact 3D design access via icon overlay */}
                <div className="relative w-full h-36 bg-slate-50">
                  {thumb ? (
                    <img src={thumb} alt={booking.service_type} className="w-full h-full object-cover" />
                  ) : booking.design_details ? (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-50">
                      <Layers size={30} className="text-emerald-300" strokeWidth={1.5} />
                    </div>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-300">
                      <Calendar size={36} strokeWidth={1} /><span className="text-xs">No reference image</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    {booking.design_details && (
                      <button
                        onClick={() => setDesignModal(booking.design_details)}
                        title="View 3D Design"
                        className="p-1.5 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm cursor-pointer transition-colors"
                        style={{ border: 'none' }}
                      >
                        <Layers size={13} />
                      </button>
                    )}
                    <Badge label={booking.status} />
                  </div>
                </div>

                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold text-slate-800 capitalize mb-0.5">{booking.service_type} Service</h3>
                  <p className="text-xs text-slate-400 mb-3">Ref #{booking.id} · {booking.scheduled_date}</p>

                  <div className="space-y-1.5 text-sm mb-3">
                    <Row label="Customer" value={booking.customer_name} />
                    <Row label="Lot"      value={getLotProfile(booking)} />
                    <Row label="Time"     value={booking.preferred_time || 'Morning'} />
                    <Row label="Contact"  value={booking.contact_number || '—'} />
                    {booking.design_details?.total_cost > 0 && (
                      <Row label="Estimate" value={`₱${Number(booking.design_details.total_cost).toLocaleString()}`} valueClass="font-bold text-emerald-600" />
                    )}
                  </div>

                  {booking.service_address && (
                    <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-3 leading-relaxed border border-slate-100">
                      <span className="font-bold text-slate-600 uppercase tracking-wide text-[10px] block mb-0.5">Address</span>
                      {booking.service_address}
                    </div>
                  )}

                  <PlantBOM breakdown={bom} />

                  {/* Progress bar — read-only for admin */}
                  {['Preparing', 'Installing'].includes(booking.status) &&
                    typeof booking.progress_pct === 'number' && (
                    <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '10px', paddingTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                        <span>Project Progress</span>
                        <span style={{ color: booking.progress_pct === 100 ? '#059669' : booking.progress_pct > 0 ? '#d97706' : '#64748b' }}>
                          {booking.progress_pct}%
                        </span>
                      </div>
                      <div style={{ height: '5px', background: '#e5e7eb', borderRadius: '9999px' }}>
                        <div style={{ height: '100%', borderRadius: '9999px', width: `${booking.progress_pct}%`, background: booking.progress_pct === 100 ? '#059669' : '#d97706', transition: 'width 0.35s ease' }} />
                      </div>
                    </div>
                  )}

                  {/* Assigned crew pill — always visible when crew exists */}
                  {Array.isArray(booking.assigned_crew_names) && booking.assigned_crew_names.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700 font-semibold">
                      <UserCheck size={11} className="shrink-0" />
                      <span className="truncate">{booking.assigned_crew_names.join(', ')}</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 mt-3">
                    {/* OFFICE_ADMIN PERMITTED: Confirm & Prepare */}
                    {booking.status === 'Pending' && (
                      <div className="flex gap-2">
                        {booking.design_details ? (
                          <button
                            type="button"
                            onClick={() => setDesignModal(booking.design_details)}
                            className="flex items-center justify-center gap-2 flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer border-none"
                          >
                            <Layers size={15} /> Preview Design
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="flex items-center justify-center gap-2 flex-1 py-2.5 bg-slate-100 text-slate-400 text-sm font-bold rounded-xl border-none cursor-not-allowed"
                          >
                            No Design
                          </button>
                        )}
                        <button
                          onClick={() => updateBookingStatus(booking.id, 'Preparing')}
                          disabled={isAct}
                          className="flex items-center justify-center gap-2 flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer border-none disabled:opacity-50"
                        >
                          {isAct ? 'Confirming…' : '✓ Confirm & Prepare'}
                        </button>
                      </div>
                    )}

                    {/* OFFICE_ADMIN ONLY: Assign Crew — focused on dispatch/all sub-tabs */}
                    {showAssignCrew && (
                      <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                        {/* Capacity Recommendation Badge */}
                        {(() => {
                          const area = parseLotArea(booking, allDesigns);
                          const rec  = getCrewRecommendation(area, booking.service_type);
                          if (!rec) return null;
                          const currentCount = (crewSelections[booking.id] || []).length;
                          const targetCount = typeof rec.count === 'number' ? rec.count : parseInt(rec.count, 10);
                          const understaffed  = currentCount > 0 && currentCount < targetCount;
                          const isConsultation = booking.service_type && (booking.service_type.toLowerCase() === 'consultation' || booking.service_type.toLowerCase() === 'consultation service');
                          return (
                            <div className={`flex items-start gap-2 px-3 py-2 rounded-xl text-xs font-semibold border ${
                              understaffed
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-blue-50 border-blue-200 text-blue-700'
                            }`}>
                              <span className="shrink-0 leading-tight">💡</span>
                              <span className="leading-relaxed">
                                <span className="font-bold">AI Dispatch Suggestion:</span>{' '}
                                {isConsultation ? (
                                  <>Recommend exactly <span className="font-bold">1 staff member/estimator</span> to preserve project margins.</>
                                ) : (
                                  <>Assign <span className="font-bold">{rec.label}</span> for a <span className="font-bold">{area ? area.toFixed(0) : '0'} sqm</span> lot.</>
                                )}
                                {understaffed && (
                                  <span className="block text-amber-600 font-bold mt-0.5">
                                    ⚠ Currently {currentCount} selected — below recommendation.
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })()}

                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <UserCheck size={11} /> Assign Crew
                          {(crewSelections[booking.id] || []).length > 0 && (
                            <span className="ml-1 text-emerald-600 normal-case font-bold">
                              · {(crewSelections[booking.id] || []).length} selected
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-0.5 max-h-28 overflow-y-auto border border-slate-100 rounded-lg p-2 bg-slate-50">
                          {crewList.map(c => {
                            const isChecked = (crewSelections[booking.id] || []).includes(c.id);
                            return (
                              <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-white px-1 py-0.5 rounded transition-colors">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleCrewMember(booking.id, c.id)}
                                  disabled={assignLoading === booking.id}
                                  className="w-3.5 h-3.5 accent-emerald-600 shrink-0"
                                />
                                <span className={isChecked ? 'text-emerald-700 font-semibold' : 'text-slate-600'}>
                                  {c.name}
                                </span>
                              </label>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => handleAssignCrew(booking.id)}
                          disabled={assignLoading === booking.id}
                          className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl border-none cursor-pointer disabled:opacity-50 transition-colors"
                        >
                          {assignLoading === booking.id ? 'Saving…' : 'Save Crew Assignment'}
                        </button>
                      </div>
                    )}

                    {/* OFFICE_ADMIN PERMITTED: Cancel Booking */}
                    {!['Finished', 'Cancelled'].includes(booking.status) && (
                      <button
                        onClick={() => updateBookingStatus(booking.id, 'Cancelled')}
                        disabled={isAct}
                        className="w-full py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold rounded-xl border border-red-200 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Cancel Booking
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          };

          return (
            <div className="space-y-5">
              {/* Sub-tab pill row */}
              <div className="flex items-center gap-1 flex-wrap p-1 bg-white border border-slate-200 rounded-2xl shadow-sm w-fit max-w-full">
                {BOOKING_SUB_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setBookingSubTab(tab.key)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-none whitespace-nowrap
                      ${bookingSubTab === tab.key
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 bg-transparent'}`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold
                        ${bookingSubTab === tab.key ? 'bg-white/25 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Context banner for Needs Dispatch */}
              {bookingSubTab === 'dispatch' && filteredBookings.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-xl text-xs font-semibold text-violet-700">
                  <span>🚀</span>
                  <span>
                    <span className="font-bold">{filteredBookings.length}</span>{' '}
                    booking{filteredBookings.length !== 1 ? 's' : ''}{' '}
                    {filteredBookings.length !== 1 ? 'need' : 'needs'} crew assignment before field deployment.
                  </span>
                </div>
              )}

              {/* Card grid — 3-up on desktop */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBookings.length === 0 ? (
                  <EmptyState
                    icon={Calendar}
                    title={
                      bookingSubTab === 'dispatch'  ? 'All crews deployed!' :
                      bookingSubTab === 'awaiting'  ? 'No pending confirmations' :
                      bookingSubTab === 'active'    ? 'No active field projects' :
                      bookingSubTab === 'completed' ? 'No completed bookings yet' :
                      'No bookings found'
                    }
                    sub={
                      bookingSubTab === 'dispatch'
                        ? 'Every active booking already has crew assigned.'
                        : 'Switch tabs to view other booking states.'
                    }
                  />
                ) : filteredBookings.map(b => BookingCard(b))}
              </div>
            </div>
          );
        })()}

        {/* ── Orders Tab ── */}
        {!loading && activeTab === 'orders' && (() => {
          const active = orders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled');
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {active.length === 0 ? (
                <EmptyState icon={Package} title="No active orders" sub="All orders have been delivered or cancelled." />
              ) : active.map(order => {
                const isAct = actionLoading === order.id;
                const linked = getLinkedDesign(order.customer_name);
                const thumb = linked?.original_image_url || null;
                const itemSummary = order.items?.map(i => `${i.quantity}× ${i.item_name}`).join(', ') || 'Custom Plant Assets';
                const isExpanded = expandedOrder === order.id;
                return (
                  <div key={order.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden flex flex-col hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
                    <div className="relative w-full h-40 bg-slate-50">
                      {thumb
                        ? <img src={thumb} alt="Order ref" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-300">
                            <ShoppingBag size={36} strokeWidth={1} /><span className="text-xs">No reference photo</span>
                          </div>
                      }
                      <div className="absolute top-2 right-2"><Badge label={order.status} /></div>
                    </div>

                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="font-bold text-slate-800 mb-0.5">Order #{order.id}</h3>
                      <p className="text-xs text-slate-400 mb-4">
                        {new Date(order.created_at).toLocaleDateString()} · {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Paid Online'}
                      </p>

                      <div className="space-y-2 text-sm mb-3">
                        <Row label="Customer" value={order.customer_name} />
                        <Row label="Email"    value={order.customer_email} />
                        <Row label="Total"    value={`₱${Number(order.total_price).toLocaleString()}`} valueClass="font-bold text-emerald-600" />
                      </div>

                      <div className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-5 leading-relaxed border border-slate-100 line-clamp-2">
                        <span className="font-bold text-slate-600 uppercase tracking-wide text-[10px] block mb-0.5">Items</span>
                        {itemSummary}
                      </div>

                      <div className="flex flex-col gap-2 mt-auto">
                        <button
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                          className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer border-none"
                        >
                          <Truck size={14} /> Update Fulfillment
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {isExpanded && (
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mt-1">
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">Order Items</p>
                            <ul className="space-y-1 mb-3">
                              {order.items?.map(item => (
                                <li key={item.id} className="text-xs text-slate-600">
                                  <span className="font-bold">{item.quantity}×</span> {item.item_name}
                                  <span className="text-slate-400"> · ₱{Number(item.price_at_booking).toLocaleString()}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200">
                              {(order.status === 'Pending' || order.status === 'Paid') && (
                                <button
                                  onClick={() => updateOrderStatus(order.id, 'Shipped')}
                                  disabled={isAct}
                                  className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg border-none cursor-pointer disabled:opacity-50"
                                >
                                  Ship Order
                                </button>
                              )}
                              {(order.status !== 'Delivered') && (
                                <button
                                  onClick={() => updateOrderStatus(order.id, 'Delivered')}
                                  disabled={isAct}
                                  className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg border-none cursor-pointer disabled:opacity-50"
                                >
                                  Mark Delivered
                                </button>
                              )}
                              <button
                                onClick={() => updateOrderStatus(order.id, 'Cancelled')}
                                disabled={isAct}
                                className="flex-1 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-[11px] font-bold rounded-lg border border-red-200 cursor-pointer disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

      </div>

      {/* ── Toast stack ── */}
      <ToastStack toasts={toasts} dismiss={dismiss} />

      {/* ── Notification panel click-away ── */}
      {showNotifPanel && (
        <div className="fixed inset-0 z-40" onClick={() => setShowNotifPanel(false)} />
      )}


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


/* ─── Plant procurement list (Bill of Materials) ───────────────────────── */
function PlantBOM({ breakdown }) {
  const [open, setOpen] = React.useState(false);
  if (!breakdown?.length) return null;
  const total = breakdown.reduce((s, r) => s + (r.subtotal || 0), 0);
  return (
    <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '10px', paddingTop: '10px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '11px', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}
      >
        <span>Plant BOM · {breakdown.length} items</span>
        <span style={{ marginLeft: 'auto', color: '#059669', fontWeight: 800 }}>₱{total.toLocaleString()}</span>
      </button>
      {open && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '8px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              {['Plant', 'Qty', 'Unit', 'Total'].map(h => (
                <th key={h} style={{ padding: '4px 2px', color: '#94a3b8', fontWeight: 700, textAlign: h === 'Plant' ? 'left' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {breakdown.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '5px 2px', fontWeight: 600, color: '#334155' }}>{r.name}</td>
                <td style={{ padding: '5px 2px', textAlign: 'right', color: '#059669', fontWeight: 700 }}>{r.quantity}</td>
                <td style={{ padding: '5px 2px', textAlign: 'right', color: '#64748b' }}>₱{Number(r.unit_price).toLocaleString()}</td>
                <td style={{ padding: '5px 2px', textAlign: 'right', fontWeight: 700, color: '#334155' }}>₱{Number(r.subtotal).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
            horizonY={design.dimensions?.horizonY ?? 0.5}
            readOnly={true}
          />
        </div>
      </div>
    </div>
  );
}

export default StaffDashboard;
