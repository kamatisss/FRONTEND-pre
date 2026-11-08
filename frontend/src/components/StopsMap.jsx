import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, WifiOff, Route, Navigation, Home, LocateFixed, Loader2 } from 'lucide-react';
import { planRoute, routeUrl } from '../data/route';

// Leaflet only downloads when a map is actually shown (crew phones, slow data)
const PinMap = lazy(() => import('./PinMap'));

const STOP_COLORS = { job: '#059669', delivery: '#2563eb', pack: '#d97706', crew: '#7c3aed' };
const START_COLOR = '#334155';
const KIND_WORDS = { job: ['job', 'jobs'], delivery: ['delivery', 'deliveries'], pack: ['to pack', 'to pack'], crew: ['crew live', 'crew live'] };

/*
 * The day's stops on one map: job sites and deliveries, from their customers' pins.
 *   stops: [{ key, kind: 'job' | 'delivery' | 'pack', lat, lng, title, onOpen? }]
 *   plan:  suggest the order to visit them (crew), starting from `base` ({ lat, lng }, the business's crew
 *          base) or from where the crew member is; numbered pins, a dashed line, distance and time, and
 *          one Google Maps link for the whole route (data/route.js — worked out on the phone, offline too)
 * Stops without a pin (older bookings / orders) are counted below the map instead.
 */
export default function StopsMap({ stops, online = true, height = 260, title = "Today's stops", plan = false, base = null, fit = 'always' }) {
  const pinned = stops.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  // Parents rebuild `stops` on every render: rebuild the markers (and refit the map) only when the stops
  // themselves change, so the map doesn't jump while someone is panning it. Taps use the latest handlers.
  const handlers = useRef({});
  useEffect(() => { handlers.current = Object.fromEntries(pinned.map(s => [s.key, s.onOpen])); });
  const signature = JSON.stringify(pinned.map(s => [s.key, s.kind, s.lat, s.lng, s.title]));

  // Where the route starts: the crew base, or the phone's location (asked for only when chosen)
  // (the base loads after the first render: default to it until the crew member picks)
  const [choice, setFrom] = useState(null);
  const from = choice || (base ? 'base' : 'none');
  const [here, setHere] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locateNote, setLocateNote] = useState('');
  const start = from === 'base' && base ? base : (from === 'here' ? here : null);
  const locate = () => {
    setFrom('here');
    if (!navigator.geolocation) { setLocateNote("This phone can't share its location; the route starts at the first stop."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setHere({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocating(false); setLocateNote(''); },
      () => { setLocating(false); setLocateNote('Location is off; the route starts at the first stop.'); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 });
  };
  const startKey = start ? `${start.lat.toFixed(5)},${start.lng.toFixed(5)}` : '';

  const route = useMemo(() => {
    if (!plan) return null;
    const list = JSON.parse(signature).map(([key, kind, lat, lng, title]) => ({ key, kind, lat, lng, title }));
    const s = startKey ? { lat: +startKey.split(',')[0], lng: +startKey.split(',')[1] } : null;
    return { ...planRoute(s, list), start: s };
  }, [plan, signature, startKey]);

  const markers = useMemo(() => {
    const list = route ? route.order : JSON.parse(signature).map(([key, kind, lat, lng, title]) => ({ key, kind, lat, lng, title }));
    const pins = list.map((s, i) => ({
      lat: s.lat, lng: s.lng, color: STOP_COLORS[s.kind], label: route ? `${i + 1}. ${s.title}` : s.title,
      number: route ? i + 1 : null, onClick: () => handlers.current[s.key]?.(),
    }));
    if (route?.start) pins.unshift({ ...route.start, color: START_COLOR, label: from === 'base' ? 'Base' : 'You are here' });
    return pins;
  }, [signature, route, from]);
  const path = useMemo(() => (route && route.order.length ? [...(route.start ? [route.start] : []), ...route.order] : null), [route]);

  const unpinned = stops.length - pinned.length;
  if (!stops.length) return null;
  const counts = Object.keys(STOP_COLORS).map(kind => [kind, pinned.filter(s => s.kind === kind).length]).filter(([, n]) => n);
  const link = route && route.order.length ? routeUrl(route.start, route.order) : null;

  return (
    <section aria-label={title}>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h2 className="m-0 text-xs font-extrabold tracking-wider uppercase text-slate-500">{title}</h2>
        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500">
          {counts.map(([kind, n]) => (
            <span key={kind} className="inline-flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: STOP_COLORS[kind] }} /> {n} {KIND_WORDS[kind][n > 1 ? 1 : 0]}
            </span>
          ))}
        </div>
      </div>

      {plan && pinned.length > 1 && (
        <div role="radiogroup" aria-label="Start the route from" className="flex items-center gap-2 mb-2 flex-wrap text-xs">
          <span className="font-bold text-slate-500">Start from</span>
          {base && (
            <button type="button" role="radio" aria-checked={from === 'base'} onClick={() => setFrom('base')}
              className={`inline-flex items-center gap-1 min-h-[36px] px-3 rounded-full border font-bold cursor-pointer ${from === 'base' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
              <Home size={13} /> Base
            </button>
          )}
          <button type="button" role="radio" aria-checked={from === 'here'} onClick={locate}
            className={`inline-flex items-center gap-1 min-h-[36px] px-3 rounded-full border font-bold cursor-pointer ${from === 'here' ? 'border-slate-700 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
            {locating ? <Loader2 size={13} className="animate-spin" /> : <LocateFixed size={13} />} Where I am
          </button>
        </div>
      )}

      {pinned.length > 0 && (online ? (
        <Suspense fallback={<div style={{ height }} className="rounded-xl bg-slate-100 animate-pulse" />}>
          <PinMap markers={markers} path={path} fit={fit} readOnly height={height} ariaLabel={`${title}: ${pinned.length} on the map`} />
        </Suspense>
      ) : (
        <div style={{ height: Math.min(height, 120) }} className="rounded-xl border border-dashed border-slate-300 flex items-center justify-center gap-2 text-sm text-slate-500 px-3 text-center">
          <WifiOff size={16} className="shrink-0" /> The map needs signal. The order below and each stop's Navigate still work.
        </div>
      ))}

      {route && route.order.length > 1 && (
        <div className="mt-3 bg-white border border-slate-200 rounded-2xl p-3">
          <p className="m-0 text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Route size={15} className="text-emerald-600" /> Suggested order · about {route.km < 10 ? route.km.toFixed(1) : Math.round(route.km)} km, {route.minutes} min driving
          </p>
          <ol className="m-0 mt-2 p-0 list-none space-y-1">
            {route.order.map((s, i) => (
              <li key={s.key}>
                <button type="button" onClick={() => handlers.current[s.key]?.()}
                  className="w-full text-left flex items-center gap-2.5 min-h-[40px] px-2 rounded-lg bg-transparent border-none cursor-pointer hover:bg-slate-50">
                  <span className="w-6 h-6 rounded-full text-white text-xs font-extrabold flex items-center justify-center shrink-0" style={{ background: STOP_COLORS[s.kind] }}>{i + 1}</span>
                  <span className="flex-1 min-w-0 text-sm text-slate-800 truncate">{s.title}</span>
                  {route.legs[i] > 0 && <span className="text-xs text-slate-400 shrink-0">{route.legs[i] < 10 ? route.legs[i].toFixed(1) : Math.round(route.legs[i])} km</span>}
                </button>
              </li>
            ))}
          </ol>
          {link && (
            <a href={link.url} target="_blank" rel="noopener noreferrer"
              className="mt-2 min-h-[48px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold no-underline flex items-center justify-center gap-2">
              <Navigation size={16} /> Open the whole route in Google Maps
            </a>
          )}
          {link && link.included < link.total && (
            <p className="m-0 mt-1.5 text-xs text-slate-500">Google Maps takes {link.included} stops at a time: open the rest from stop {link.included + 1}.</p>
          )}
          <p className="m-0 mt-1.5 text-[11px] text-slate-400">
            {locateNote || 'Distances and times are estimates from the map pins; traffic and roads may differ.'}
          </p>
        </div>
      )}

      {unpinned > 0 && (
        <p className="m-0 mt-1.5 text-xs text-slate-500 flex items-center gap-1">
          <MapPin size={12} /> {unpinned} older stop{unpinned > 1 ? 's have' : ' has'} no map pin; use the written address.
        </p>
      )}
    </section>
  );
}
