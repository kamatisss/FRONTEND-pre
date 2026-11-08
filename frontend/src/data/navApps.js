// Which app the crew's Navigate buttons open: Google Maps or Waze (a per-phone choice, Me tab).
// Turn-by-turn driving stays with these apps (traffic, closures, voice); our own maps cover the rest:
// the day's stops, the suggested order, and finding the gate (CrewArrival).
const KEY = 'crew_nav_app';
export const NAV_APPS = { google: 'Google Maps', waze: 'Waze' };

export function getNavApp() {
  try { return localStorage.getItem(KEY) === 'waze' ? 'waze' : 'google'; } catch { return 'google'; }
}

export function setNavApp(app) {
  try { localStorage.setItem(KEY, app === 'waze' ? 'waze' : 'google'); } catch { /* private mode: default stays */ }
}

/**
 * A Navigate link to one place: { lat, lng } (the customer's pin) when known, else the written address.
 * Waze takes a single destination; the whole-day route (several stops) always uses Google Maps.
 */
export function navLink(where, app = getNavApp()) {
  const pinned = where && Number.isFinite(where.lat) && Number.isFinite(where.lng);
  const text = (where?.address || '').trim();
  if (!pinned && !text) return null;
  if (app === 'waze') {
    return pinned
      ? `https://waze.com/ul?ll=${where.lat},${where.lng}&navigate=yes`
      : `https://waze.com/ul?q=${encodeURIComponent(text)}&navigate=yes`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pinned ? `${where.lat},${where.lng}` : text)}`;
}
