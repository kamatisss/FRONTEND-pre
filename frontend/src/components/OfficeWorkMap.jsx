import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StopsMap from './StopsMap';

/* The office's view of today's field work: job sites scheduled today, deliveries out, orders to pack
   (they go out next), and where each crew member is right now (on shift only — crew_location.py).
   Pins come from the customers' map pins; tap one to open it in its queue. */
const localIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const CREW_REFRESH_MS = 30000;

export default function OfficeWorkMap({ api, headers }) {
  const navigate = useNavigate();
  const [stops, setStops] = useState(null);
  const [crew, setCrew] = useState([]);
  const auth = headers?.Authorization;

  useEffect(() => {
    let alive = true;
    const get = (path) => fetch(`${api}${path}`, { headers: { Authorization: auth } }).then(r => (r.ok ? r.json() : [])).catch(() => []);
    const today = localIso();
    Promise.all([get(`/bookings/?from=${today}&to=${today}`), get('/orders/?queue=in_transit'), get('/orders/?queue=to_pack')])
      .then(([bookings, out, pack]) => {
        if (!alive) return;
        const jobs = (Array.isArray(bookings) ? bookings : []).filter(b => b.status !== 'Cancelled');
        const order = (kind) => (o) => ({
          key: `order-${o.id}`, kind, lat: o.delivery_lat ?? NaN, lng: o.delivery_lng ?? NaN,
          title: `Order #${o.id} ${o.customer_name || ''}`.trim() + (o.crew_arrived_at ? ' · rider arrived' : ''),
          onOpen: () => navigate(`/staff-dashboard?tab=orders&open=${o.id}`),
        });
        setStops([
          ...jobs.map(b => ({ key: `job-${b.id}`, kind: 'job', lat: b.site_lat ?? NaN, lng: b.site_lng ?? NaN,
            title: `#${b.id} ${b.customer_name || 'Customer'}` + (b.crew_arrived_at ? ' · crew arrived' : ''),
            onOpen: () => navigate(`/staff-dashboard?tab=bookings&open=${b.id}`) })),
          ...(Array.isArray(out) ? out : []).map(order('delivery')),
          ...(Array.isArray(pack) ? pack : []).map(order('pack')),
        ]);
      });
    return () => { alive = false; };
  }, [api, auth, navigate]);

  // Live crew positions, refreshed while this page is on screen
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.visibilityState !== 'visible') return;
      fetch(`${api}/crew-location/live/`, { headers: { Authorization: auth } })
        .then(r => (r.ok ? r.json() : { crew: [] })).then(d => { if (alive) setCrew(d.crew || []); }).catch(() => {});
    };
    load();
    const timer = setInterval(load, CREW_REFRESH_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [api, auth]);

  const all = [
    ...(stops || []),
    ...crew.map(c => ({
      key: `crew-${c.user_id}`, kind: 'crew', lat: c.lat, lng: c.lng,
      title: `${c.name} · ${c.minutes_ago < 1 ? 'just now' : `${c.minutes_ago} min ago`}`
        + (c.job ? ` · job #${c.job.id}` : '') + (c.deliveries_out ? ` · ${c.deliveries_out} out for delivery` : ''),
      onOpen: c.job ? () => navigate(`/staff-dashboard?tab=bookings&open=${c.job.id}`) : undefined,
    })),
  ];
  if (!all.length) return null;
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
      <StopsMap title="Today's field work" stops={all} height={340} fit="once" />
      <p className="m-0 mt-2 text-xs text-slate-500">
        Crew positions show while they are on shift with the crew app open, updated about every minute.
      </p>
    </div>
  );
}
