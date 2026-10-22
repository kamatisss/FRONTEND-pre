/*
 * Crew work without signal (PWA phase 2).
 *
 * Saved copies   The last good answer for the crew's jobs, deliveries and clock-in status is kept on
 *                the phone, so the screens still open on site with no signal ("Saved at 10:42").
 * Outbox         Start/clock out, delivery steps and problem reports are tried at once; if there is
 *                no signal they wait here and are sent, in order, when the signal comes back.
 *                Each action carries an Idempotency-Key (a retry after a dropped connection is done
 *                once) and X-Action-Time (the server keeps the real time). Backend: apps/library/offline.py
 * Privacy        Only this crew member's own work is kept, and all of it is wiped on sign-out.
 * Things that only make sense live (On my way, photos, sign-off) are NOT queued.
 */
import { API_BASE_URL } from '../config';

const OUTBOX_KEY = 'gs.crew.outbox';
const SNAP_PREFIX = 'gs.crew.snap.';
const MAX_ATTEMPTS = 8;   // server errors (5xx) before an action is shown as failed

const listeners = new Set();
let flushing = null;

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
};
const token = () => read('authTokens', null)?.access;
const newId = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '')
  : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`);

export const getOutbox = () => read(OUTBOX_KEY, []);
const setOutbox = (items) => { write(OUTBOX_KEY, items); listeners.forEach((fn) => fn(items)); };
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/* ── Saved copies ─────────────────────────────────────────────────────────── */

/**
 * GET an API path for the crew screens. Online: fresh data (and a saved copy).
 * No signal or server trouble: the saved copy. Returns { data, savedAt } — savedAt is null when fresh.
 */
export async function cachedGet(path, name) {
  try {
    const r = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token()}` } });
    if (r.ok) {
      const data = await r.json();
      write(SNAP_PREFIX + name, { at: new Date().toISOString(), data });
      return { data, savedAt: null };
    }
    if (r.status === 401 || r.status === 403) return { data: null, savedAt: null };
  } catch { /* no signal: fall back to the saved copy */ }
  const snap = read(SNAP_PREFIX + name, null);
  return snap ? { data: snap.data, savedAt: snap.at } : { data: null, savedAt: null };
}

/** Wipe everything kept for offline use (sign-out; the next person on this phone sees nothing). */
export function clearCrewOffline() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith('gs.crew.')).forEach((k) => localStorage.removeItem(k));
  } catch { /* storage blocked: nothing was kept */ }
  listeners.forEach((fn) => fn([]));
}

/* ── Sending ──────────────────────────────────────────────────────────────── */

// Weak signal can leave a request hanging: give up after this and keep the action for later
// (if it did reach the server, the Idempotency-Key makes the resend harmless)
const SEND_TIMEOUT_MS = 15000;
const timeoutSignal = () => (AbortSignal.timeout ? AbortSignal.timeout(SEND_TIMEOUT_MS) : undefined);

async function deliver(entry) {
  const r = await fetch(`${API_BASE_URL}${entry.path}`, {
    signal: timeoutSignal(),
    method: entry.method,
    headers: {
      Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json',
      'Idempotency-Key': entry.id, 'X-Action-Time': entry.at,
    },
    body: entry.method === 'GET' ? undefined : JSON.stringify(entry.body || {}),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

const errorText = (data) => data?.error || data?.detail || 'The server refused this.';

/**
 * Do a crew action now, or keep it for later if there's no signal.
 *   { label, path, method = 'POST', body, kind, ref }  →  { data } when done now, { queued: true } when waiting.
 * A refusal from the server (e.g. "You are 300 m from the site") is thrown as an Error, not queued.
 */
export async function sendAction({ label, path, method = 'POST', body = {}, kind, ref = {} }) {
  const entry = { id: newId(), label, path, method, body, kind, ref, at: new Date().toISOString(), state: 'waiting', attempts: 0 };
  if (navigator.onLine === false) {
    setOutbox([...getOutbox(), entry]);
    return { queued: true };
  }
  let result;
  try {
    result = await deliver(entry);
  } catch {
    // No answer (signal dropped mid-way): keep it. If it did reach the server, the key makes the resend harmless.
    setOutbox([...getOutbox(), entry]);
    return { queued: true };
  }
  if (result.ok) return { data: result.data };
  if (result.status >= 500 || result.status === 429 || result.status === 409) {
    setOutbox([...getOutbox(), { ...entry, attempts: 1 }]);
    return { queued: true };
  }
  throw new Error(errorText(result.data));
}

/** Send waiting actions in order. Resolves to the list of actions that were sent. */
export function flushOutbox() {
  if (flushing) return flushing;
  flushing = (async () => {
    const sent = [];
    for (const entry of getOutbox()) {
      if (entry.state !== 'waiting') continue;
      if (navigator.onLine === false) break;
      let result;
      try {
        result = await deliver(entry);
      } catch {
        break;   // still no signal: try again later, keeping the order
      }
      const items = getOutbox();
      const i = items.findIndex((e) => e.id === entry.id);
      if (i < 0) continue;   // discarded meanwhile
      if (result.ok) {
        items.splice(i, 1);
        sent.push(entry);
      } else if (result.status === 401) {
        items[i] = { ...items[i], error: 'Sign in again to send this.' };
        setOutbox(items);
        break;
      } else if (result.status >= 500 || result.status === 429 || result.status === 409) {
        const attempts = (items[i].attempts || 0) + 1;
        items[i] = attempts >= MAX_ATTEMPTS
          ? { ...items[i], attempts, state: 'failed', error: 'The server had a problem. Try again or tell the office.' }
          : { ...items[i], attempts };
        setOutbox(items);
        break;
      } else {
        // Refused (e.g. the job was reassigned meanwhile): show why; the crew member decides
        items[i] = { ...items[i], state: 'failed', error: errorText(result.data) };
      }
      setOutbox(items);
    }
    return sent;
  })().finally(() => { flushing = null; });
  return flushing;
}

export function discardAction(id) { setOutbox(getOutbox().filter((e) => e.id !== id)); }

export function retryAction(id) {
  setOutbox(getOutbox().map((e) => (e.id === id ? { ...e, state: 'waiting', error: '', attempts: 0 } : e)));
  return flushOutbox();
}

/* ── What the screens should show meanwhile ───────────────────────────────── */

/** Clock-in status as it will be once the waiting actions are sent. */
export function withPendingAttendance(activeAttendance, outbox) {
  let session = activeAttendance?.clocked_in ? activeAttendance.attendance : null;
  let pending = false;
  for (const e of outbox) {
    if (e.state !== 'waiting') continue;
    if (e.kind === 'clock_in') { session = { booking: e.ref.bookingId, clock_in_time: e.at, pending: true }; pending = true; }
    if (e.kind === 'clock_out') { session = null; pending = true; }
  }
  if (!pending) return activeAttendance;
  return session ? { clocked_in: true, attendance: session } : { clocked_in: false, attendance: null };
}

/** The delivery run as it will be once the waiting delivery steps are sent. */
export function withPendingDeliveries(run, outbox) {
  const steps = outbox.filter((e) => e.state === 'waiting' && e.kind === 'order_status');
  if (!run || !steps.length) return run;
  let active = [...(run.active || [])];
  let done = [...(run.delivered_today || [])];
  let cash = 0;   // cash on delivery collected but not yet sent: it's in the crew member's pocket already
  for (const e of steps) {
    const order = active.find((o) => o.id === e.ref.orderId);
    if (!order) continue;
    if (e.body.status === 'Delivered') {
      active = active.filter((o) => o.id !== order.id);
      done = [{ ...order, status: 'Delivered', delivered_at: e.at, pending: true }, ...done];
      if (order.payment_method === 'cod') cash += Number(order.total_price || 0);
    } else {
      active = active.map((o) => (o.id === order.id ? { ...o, status: e.body.status, pending: true } : o));
    }
  }
  const plus = (v) => (v == null ? v : (Number(v) + cash).toFixed(2));
  return { ...run, active, delivered_today: done, cash_today: plus(run.cash_today), cash_to_hand_in: plus(run.cash_to_hand_in) };
}
