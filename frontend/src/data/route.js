// Suggested stop order for a crew member's day — worked out on the phone (no server, works offline).
// Distances are straight lines between map pins × ROAD_FACTOR; times use an average speed. They are
// estimates for planning ("about 14 km, 35 min"); Google Maps does the real turn-by-turn directions.
import { metres } from './address';

// Our crew ride motorcycles: shorter cuts through barangay roads, and through town traffic
export const ROAD_FACTOR = 1.3;    // provincial roads wind: road distance ≈ 1.3 × the straight line
export const AVG_KMH = 35;         // average on a motorcycle, stops and town traffic included
export const MAX_WAYPOINTS = 9;    // Google Maps links take at most 9 stops between start and end

const km = (a, b) => (metres(a, b) / 1000) * ROAD_FACTOR;

function pathKm(start, order) {
  let total = 0, prev = start;
  for (const s of order) { if (prev) total += km(prev, s); prev = s; }
  return total;
}

export const EXACT_UP_TO = 8;      // a day's stops: try every order (8! = 40,320 — a few ms on a phone)

// Every order, keeping the shortest (exact; only for small days)
function exact(start, stops) {
  let best = null, bestKm = Infinity;
  const used = new Array(stops.length).fill(false), path = [];
  const walk = (prev, sofar) => {
    if (sofar >= bestKm) return;   // already longer than the best found
    if (path.length === stops.length) { best = path.slice(); bestKm = sofar; return; }
    for (let i = 0; i < stops.length; i++) {
      if (used[i]) continue;
      used[i] = true; path.push(stops[i]);
      walk(stops[i], sofar + (prev ? km(prev, stops[i]) : 0));
      path.pop(); used[i] = false;
    }
  };
  walk(start, 0);
  return best;
}

// Bigger days: 2-opt (reverse a stretch) and or-opt (move one stop elsewhere) until nothing improves
function improve(start, order) {
  let best = order.slice(), bestKm = pathKm(start, best), better = true;
  const tryOrder = (next) => {
    const d = pathKm(start, next);
    if (d < bestKm - 1e-9) { best = next; bestKm = d; better = true; }
  };
  while (better) {
    better = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        tryOrder([...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)]);
      }
    }
    for (let i = 0; i < best.length; i++) {
      const rest = [...best.slice(0, i), ...best.slice(i + 1)];
      for (let j = 0; j <= rest.length; j++) {
        if (j !== i) tryOrder([...rest.slice(0, j), best[i], ...rest.slice(j)]);
      }
    }
  }
  return best;
}

function nearestFirst(start, stops) {
  const left = stops.slice(), order = [];
  let here = start || left[0];
  while (left.length) {
    let k = 0;
    for (let i = 1; i < left.length; i++) if (km(here, left[i]) < km(here, left[k])) k = i;
    here = left.splice(k, 1)[0];
    order.push(here);
  }
  return order;
}

/**
 * The order to visit stops in. start: { lat, lng } (the base, or where the crew member is) or null —
 * then the route may begin at any stop. stops: [{ key, lat, lng, ... }] with pins.
 * Returns { order, legs: [km per leg, from the start], km, minutes }.
 */
export function planRoute(start, stops) {
  const pinned = stops.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  if (!pinned.length) return { order: [], legs: [], km: 0, minutes: 0 };
  let order;
  if (pinned.length <= EXACT_UP_TO) {
    order = exact(start, pinned);
  } else if (start) {
    order = improve(start, nearestFirst(start, pinned));
  } else {
    // No fixed start: try beginning at each stop, keep the shortest
    order = pinned.map(first => improve(null, [first, ...nearestFirst(first, pinned.filter(s => s !== first)).filter(s => s !== first)]))
      .reduce((a, b) => (pathKm(null, b) < pathKm(null, a) ? b : a));
  }
  const legs = [];
  let prev = start;
  for (const s of order) { legs.push(prev ? km(prev, s) : 0); prev = s; }
  const total = legs.reduce((a, b) => a + b, 0);
  return { order, legs, km: total, minutes: Math.round((total / AVG_KMH) * 60) };
}

/** One Google Maps link for the whole route (origin omitted = "from where I am now"). Google's link format
    has no motorcycle mode, so it asks for driving; the Google Maps app can be switched to two-wheeler. Waze
    links can't carry several stops, so the whole route always opens in Google Maps. */
export function routeUrl(start, order) {
  const stops = order.slice(0, MAX_WAYPOINTS + 1);
  if (!stops.length) return null;
  const p = (s) => `${s.lat},${s.lng}`;
  const dest = stops[stops.length - 1];
  const params = new URLSearchParams({ api: '1', destination: p(dest), travelmode: 'driving' });
  if (start) params.set('origin', p(start));
  const mid = stops.slice(0, -1);
  if (mid.length) params.set('waypoints', mid.map(p).join('|'));
  return { url: `https://www.google.com/maps/dir/?${params}`, included: stops.length, total: order.length };
}
