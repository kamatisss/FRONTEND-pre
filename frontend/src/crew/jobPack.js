/*
 * Job pack: everything a crew member needs to open their next jobs with no signal (offline phase 4).
 *
 * The booking itself (address, design, plant list, setting-out plan) is already kept by outbox.cachedGet.
 * The 3D view and the work order need more, which this saves while there is signal:
 *   catalog      /inventory/ (plant sizes and which model each plant uses), so plants aren't stand-ins
 *   3D models    every model the job's design uses (bundled /models/… and office uploads alike)
 *   textures     the lawn's grass texture
 *   yard photo   the design's photo, for the AR view
 *   work order   the job's PDF (/bookings/<id>/generate_pdf/)
 * Jobs packed: under way, or scheduled today or tomorrow. Files go in the "crew-pack" cache; the service
 * worker (public/sw.js) answers from it when there's no signal. Wiped on sign-out (clearJobPack), like
 * the rest of the crew's offline copies. Public catalog and models are fine to keep; the work order and
 * yard photo belong to this crew member's own jobs only.
 */
import { API_BASE_URL } from '../config';
import { resolveModelUrl } from '../data/modelCatalog';
import { toCanvasPlants } from '../data/projectHub';
import { isoDay } from '../data/crewJobs';

export const PACK_CACHE = 'crew-pack';
const META_KEY = 'gs.crew.pack';          // gs.crew.* is wiped on sign-out with the other saved copies
const CATALOG_KEY = '/__crew-pack/inventory.json';
const workOrderKey = (id) => `/__crew-pack/work-order-${id}.pdf`;
const TEXTURES = ['/textures/grass_normal.jpg'];
const FETCH_TIMEOUT_MS = 60000;

const listeners = new Set();
const readMeta = () => { try { return JSON.parse(localStorage.getItem(META_KEY)) || { jobs: {} }; } catch { return { jobs: {} }; } };
const writeMeta = (m) => {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* full: status just isn't kept */ }
  const copy = { ...m, jobs: { ...m.jobs } };   // a new object each time, or React sees "no change" and skips the update
  listeners.forEach(fn => fn(copy));
};
export const getPackMeta = readMeta;
export const subscribePack = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

const token = () => { try { return JSON.parse(localStorage.getItem('authTokens'))?.access; } catch { return null; } };
const absolute = (url) => new URL(url, window.location.origin).href;
const openPack = () => (typeof caches === 'undefined' ? Promise.resolve(null) : caches.open(PACK_CACHE).catch(() => null));
const signal = () => (AbortSignal.timeout ? AbortSignal.timeout(FETCH_TIMEOUT_MS) : undefined);

/** Jobs worth packing: under way, or due today / tomorrow (the phone's own date). */
export function jobsToPack(bookings, now = new Date()) {
  const today = isoDay(now);
  const tomorrow = isoDay(new Date(now.getTime() + 864e5));
  return (bookings || []).filter(b => b && (b.status === 'Installing'
    || (['Pending', 'Preparing'].includes(b.status) && b.scheduled_date >= today && b.scheduled_date <= tomorrow)));
}

// What the job's files depend on: a change re-packs it (new design version, rescheduled, edited)
const signature = (b) => `${b.updated_at || ''}|${b.design_details?.revision ?? ''}|${b.design_details?.id ?? ''}`;

/** The files one job needs, given the catalog → [{ key, url, what, auth }] */
export function filesFor(booking, catalog) {
  const d = booking.design_details;
  const files = [{ key: workOrderKey(booking.id), url: `${API_BASE_URL}/bookings/${booking.id}/generate_pdf/`, what: 'work order', auth: true }];
  if (!d) return files;
  const byId = new Map((catalog || []).map(i => [String(i.id), i]));
  const dims = d.dimensions || {};
  const ids = new Set(toCanvasPlants(d.placed_items, dims.width || 10, dims.length || 15).map(p => String(p.plant_id)));
  (dims.groundcover || []).forEach(g => ids.add(String(g.plant_id)));
  const models = new Set();
  ids.forEach(id => { const url = resolveModelUrl(byId.get(id)?.model_file); if (url) models.add(absolute(url)); });
  models.forEach(url => files.push({ key: url, url, what: '3D model' }));
  TEXTURES.forEach(t => files.push({ key: absolute(t), url: absolute(t), what: 'lawn texture' }));
  const photo = d.reference_image_url || d.image_url;
  if (photo) files.push({ key: absolute(photo), url: absolute(photo), what: 'yard photo' });
  return files;
}

async function save(cache, file) {
  if (!file.auth && await cache.match(file.key)) return true;   // models and photos don't change under the same link
  const r = await fetch(file.url, {
    signal: signal(), mode: 'cors', credentials: 'omit',
    headers: file.auth ? { Authorization: `Bearer ${token()}` } : undefined,
  });
  if (!r.ok) return false;
  await cache.put(file.key, r);
  return true;
}

let running = null;

/**
 * Save the files for the crew's next jobs (only jobs that changed, unless force). Never throws.
 * Returns the meta: { at, jobs: { [bookingId]: { sig, at, ready, missing: ['3D model', …] } } }
 */
export function packJobs(bookings, { force = false } = {}) {
  if (running) return running;
  running = (async () => {
    const meta = readMeta();
    const cache = await openPack();
    if (!cache || !navigator.onLine) return meta;
    const jobs = jobsToPack(bookings);
    const todo = jobs.filter(b => force || meta.jobs[b.id]?.sig !== signature(b) || !meta.jobs[b.id]?.ready);
    // Jobs no longer due: forget them and drop their work orders (models are shared, the cache is small)
    const keep = new Set(jobs.map(b => String(b.id)));
    for (const id of Object.keys(meta.jobs)) {
      if (!keep.has(id)) { delete meta.jobs[id]; cache.delete(workOrderKey(id)).catch(() => {}); }
    }
    if (todo.length) {
      let catalog = null;
      try {
        const r = await fetch(`${API_BASE_URL}/inventory/`, { signal: signal(), headers: { Authorization: `Bearer ${token()}` } });
        if (r.ok) { catalog = await r.clone().json(); await cache.put(CATALOG_KEY, r); }
      } catch { /* no catalog: models can't be found either, the jobs show what's missing */ }
      for (const b of todo) {
        meta.jobs[b.id] = { ...(meta.jobs[b.id] || {}), saving: true };
        writeMeta(meta);
        const missing = [];
        if (b.design_details && !catalog) missing.push('plant catalog');
        for (const f of filesFor(b, catalog)) {
          const ok = await save(cache, f).catch(() => false);
          if (!ok) missing.push(f.what);
        }
        meta.jobs[b.id] = { sig: signature(b), at: new Date().toISOString(), ready: !missing.length, missing: [...new Set(missing)] };
        writeMeta(meta);
      }
    }
    meta.at = new Date().toISOString();
    writeMeta(meta);
    return meta;
  })().finally(() => { running = null; });
  return running;
}

/** The saved catalog (services/api getInventoryItems falls back to it with no signal), or null. */
export async function packedCatalog() {
  const cache = await openPack();
  const r = cache && await cache.match(CATALOG_KEY).catch(() => null);
  return r ? r.json().catch(() => null) : null;
}

/** The saved work order PDF for a job, or null. */
export async function packedWorkOrder(bookingId) {
  const cache = await openPack();
  const r = cache && await cache.match(workOrderKey(bookingId)).catch(() => null);
  return r ? r.blob() : null;
}

/** Sign-out: nothing of this person's jobs stays on the phone. */
export function clearJobPack() {
  if (typeof caches !== 'undefined') caches.delete(PACK_CACHE).catch(() => {});
  try { localStorage.removeItem(META_KEY); } catch { /* blocked: nothing was kept */ }
  listeners.forEach(fn => fn({ jobs: {} }));
}

// Should the pack download by itself now? Not on a phone that asked to save data or on very slow data.
export function autoPackAllowed() {
  const c = navigator.connection;
  return !(c?.saveData || ['slow-2g', '2g'].includes(c?.effectiveType));
}
