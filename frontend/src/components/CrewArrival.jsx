import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { X, Navigation, Phone, CheckCircle2, Loader2, Compass, WifiOff, MapPin } from 'lucide-react';
import { metres } from '../data/address';
import { NAV_APPS, getNavApp, navLink } from '../data/navApps';

const PinMap = lazy(() => import('./PinMap'));

/*
 * "Find it": the last stretch to a job site or delivery, inside our app. The drive itself stays with
 * Google Maps / Waze (Navigate); this screen is for the barangay road and the gate: the customer's pin
 * and landmark, the crew member's live position, how far and which way (works without map signal: it's
 * GPS maths), and "I've arrived" — checked against the pin by the server, which tells the customer.
 *   target: { kind: 'job' | 'delivery', id, title, address, lat, lng, phone }
 */
const ARRIVE_M = 150;          // same as the server (crew_location.ARRIVAL_RADIUS_M)
const HERE_M = 60;             // close enough to say "you're here"
const DIRS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

function bearing(a, b) {
  const toR = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toR(b.lng - a.lng)) * Math.cos(toR(b.lat));
  const x = Math.cos(toR(a.lat)) * Math.sin(toR(b.lat)) - Math.sin(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.cos(toR(b.lng - a.lng));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return DIRS[Math.round(deg / 45) % 8];
}
const showDistance = (m) => (m < 1000 ? `${Math.round(m / 10) * 10 || Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`);

export default function CrewArrival({ target, api, headers, toast, onClose, onArrived }) {
  const [me, setMe] = useState(null);
  const [gpsProblem, setGpsProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const hasPin = Number.isFinite(target.lat) && Number.isFinite(target.lng);
  const app = getNavApp();

  useEffect(() => {
    if (!navigator.geolocation) return undefined;
    const id = navigator.geolocation.watchPosition(
      (p) => { setMe({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); setGpsProblem(''); },
      (err) => setGpsProblem(err.code === err.PERMISSION_DENIED ? 'Turn on location for this app to see how far you are.' : 'Waiting for GPS…'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dist = hasPin && me ? metres(me, target) : null;
  const slack = Math.min(me?.accuracy || 0, 50);
  const canArrive = !hasPin || (dist != null && dist - slack <= ARRIVE_M);
  const isHere = dist != null && dist - slack <= HERE_M;

  // Frame the pin, and once we know where the crew member is, both of them
  const located = !!me;
  const center = useMemo(() => {
    if (!hasPin) return null;
    if (!located || dist == null || dist > 5000) return { lat: target.lat, lng: target.lng, zoom: 17 };
    const mid = { lat: (me.lat + target.lat) / 2, lng: (me.lng + target.lng) / 2 };
    const zoom = Math.max(12, Math.min(18, Math.floor(Math.log2((156543 * Math.cos((mid.lat * Math.PI) / 180) * 280) / Math.max(dist * 2.4, 80)))));
    return { ...mid, zoom };
  }, [hasPin, located, target.lat, target.lng]); // eslint-disable-line react-hooks/exhaustive-deps -- frame once per fix
  const markers = useMemo(() => (hasPin ? [{ lat: target.lat, lng: target.lng, color: target.kind === 'job' ? '#059669' : '#2563eb', label: target.title }] : null),
    [hasPin, target.lat, target.lng, target.kind, target.title]);
  const path = useMemo(() => (hasPin && me ? [me, { lat: target.lat, lng: target.lng }] : null),
    [hasPin, me, target.lat, target.lng]);

  const arrive = async () => {
    setBusy(true);
    try {
      const r = await fetch(`${api}/crew-location/arrived/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ kind: target.kind, id: target.id, ...(me ? { lat: me.lat, lng: me.lng, accuracy: me.accuracy } : {}) }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { toast?.(data.error || 'Could not mark your arrival. Try again.', 'error'); return; }
      setDone(true);
      toast?.(data.notified ? 'Arrival saved. The customer has been told you are there.' : 'Arrival saved.');
      onArrived?.();
    } catch {
      toast?.('No signal: try "I\'ve arrived" again in a moment.', 'error');
    } finally { setBusy(false); }
  };

  const tel = (target.phone || '').replace(/[^\d+]/g, '');
  const nav = navLink({ lat: target.lat, lng: target.lng, address: target.address }, app);
  const online = navigator.onLine !== false;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Find ${target.title}`} className="fixed inset-0 z-[1200] bg-white flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
        <div className="flex-1 min-w-0">
          <p className="m-0 text-xs font-extrabold uppercase tracking-wider text-slate-500">{target.kind === 'job' ? 'Job site' : 'Delivery'}</p>
          <p className="m-0 text-base font-extrabold text-slate-900 truncate">{target.title}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-xl bg-slate-100 border-none flex items-center justify-center cursor-pointer text-slate-700"><X size={20} /></button>
      </div>

      <div className="relative flex-1 min-h-0">
        {hasPin && online ? (
          <Suspense fallback={<div className="h-full bg-slate-100 animate-pulse" />}>
            <PinMap center={center} markers={markers} path={path} me={me} fit="once" readOnly height="100%" ariaLabel="Map: the customer's pin and your position" />
          </Suspense>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-500 text-sm px-6 text-center bg-slate-50">
            {hasPin ? <><WifiOff size={22} /> The map needs signal. Distance and direction below still work.</>
              : <><MapPin size={22} /> This older {target.kind === 'job' ? 'booking' : 'order'} has no map pin. Use the address and call the customer.</>}
          </div>
        )}
        {/* How far, which way: big enough to read at a glance on the motorcycle stand */}
        {hasPin && (
          <div className={`absolute left-3 right-3 top-3 z-[500] rounded-2xl px-4 py-3 shadow-md ${isHere ? 'bg-emerald-600 text-white' : 'bg-white/95 text-slate-900'}`} role="status" aria-live="polite">
            {dist == null ? (
              <p className="m-0 text-sm font-semibold flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> {gpsProblem || 'Finding your position…'}</p>
            ) : isHere ? (
              <p className="m-0 text-lg font-extrabold flex items-center gap-2"><CheckCircle2 size={20} /> You're here</p>
            ) : (
              <p className="m-0 text-2xl font-extrabold flex items-center gap-2 tabular-nums"><Compass size={22} className="text-emerald-600" /> {showDistance(dist)} <span className="text-base font-bold text-slate-500">{bearing(me, target)}</span></p>
            )}
            {me?.accuracy > 40 && !isHere && <p className="m-0 mt-0.5 text-xs text-slate-500">GPS is rough here (±{Math.round(me.accuracy)} m).</p>}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-4 flex flex-col gap-2.5" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        {target.address && <p className="m-0 text-sm text-slate-700 leading-snug">{target.address}</p>}
        <div className="grid grid-cols-2 gap-2">
          {nav ? (
            <a href={nav} target="_blank" rel="noopener noreferrer"
              className="min-h-[48px] rounded-xl bg-blue-600 text-white text-sm font-bold no-underline inline-flex items-center justify-center gap-2">
              <Navigation size={16} /> {NAV_APPS[app]}
            </a>
          ) : <span />}
          {tel ? (
            <a href={`tel:${tel}`} className="min-h-[48px] rounded-xl bg-white border border-slate-300 text-slate-900 text-sm font-bold no-underline inline-flex items-center justify-center gap-2">
              <Phone size={16} /> Call
            </a>
          ) : <span />}
        </div>
        <button type="button" onClick={arrive} disabled={busy || done || !canArrive}
          className={`min-h-[52px] rounded-xl text-base font-extrabold border-none inline-flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed
            ${done ? 'bg-emerald-50 text-emerald-700' : canArrive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
          {done ? 'Arrival saved' : canArrive ? "I've arrived" : `I've arrived (within ${ARRIVE_M} m)`}
        </button>
      </div>
    </div>
  );
}
