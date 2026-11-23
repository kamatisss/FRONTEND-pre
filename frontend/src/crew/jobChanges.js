/*
 * "Changed since you last checked": what the office changed in this crew member's jobs while the phone
 * had no signal (or wasn't looking). Found by comparing the job list saved on the phone with the fresh one,
 * so a date change, a cancellation or a reassignment is never missed (push alerts don't reach a phone
 * with no signal). Notices stay until dismissed; kept in gs.crew.* (wiped on sign-out).
 */
import { dayLabel, TIME_SHORT } from '../data/crewJobs';

const KEY = 'gs.crew.changes';
const MAX = 20;
const OPEN = ['Pending', 'Preparing', 'Installing', 'For Review'];
const listeners = new Set();

const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
const write = (items) => {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* full: notices just aren't kept */ }
  const copy = [...items];
  listeners.forEach((fn) => fn(copy));
};
export const getChanges = read;
export const subscribeChanges = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const dismissChange = (key) => write(read().filter((c) => c.key !== key));
export const dismissAllChanges = () => write([]);

const who = (b) => `#${b.id}${b.customer_name ? ` (${b.customer_name})` : ''}`;

/** Old job list (saved on the phone) vs the fresh one → notices, newest facts only. */
export function diffJobs(before = [], after = [], today) {
  const now = new Map(after.map((b) => [b.id, b]));
  const was = new Map(before.map((b) => [b.id, b]));
  const out = [];
  const add = (b, kind, text, value) => out.push({ key: `${b.id}:${kind}:${value ?? ''}`, bookingId: b.id, kind, text });
  for (const old of before) {
    if (!OPEN.includes(old.status)) continue;   // finished or cancelled before: nothing new to say
    const b = now.get(old.id);
    if (!b) { add(old, 'removed', `Job ${who(old)} is no longer on your list. It may have been given to someone else.`); continue; }
    if (b.status === 'Cancelled') { add(b, 'cancelled', `Job ${who(b)} was cancelled.`); continue; }
    if (old.status === 'For Review' && b.status === 'Installing') add(b, 'sent_back', `Job ${who(b)} was sent back to you for more work.`);
    if (b.scheduled_date !== old.scheduled_date) {
      add(b, 'date', `Job ${who(b)} moved to ${dayLabel(b.scheduled_date, today)} (was ${dayLabel(old.scheduled_date, today)}).`, b.scheduled_date);
    } else if (b.preferred_time !== old.preferred_time) {
      add(b, 'time', `Job ${who(b)} is now ${TIME_SHORT[b.preferred_time] || b.preferred_time || 'any time'}.`, b.preferred_time);
    }
    if ((b.service_address || '') !== (old.service_address || '')) add(b, 'address', `Job ${who(b)} has a new address: ${b.service_address || 'none on file'}.`, b.service_address);
    const rev = b.design_details?.revision; const oldRev = old.design_details?.revision;
    if (rev && oldRev && rev !== oldRev) add(b, 'design', `The design for job ${who(b)} was updated. Check the 3D and plan before you start.`, rev);
  }
  for (const b of after) {
    if (!was.has(b.id) && OPEN.includes(b.status) && b.status !== 'For Review') {
      add(b, 'added', `New job ${who(b)}: ${dayLabel(b.scheduled_date, today)}.`);
    }
  }
  return out;
}

/** Keep new notices (newest first), without repeating one already shown. */
export function addChanges(notices) {
  if (!notices.length) return;
  const items = read();
  const seen = new Set(items.map((c) => c.key));
  const at = new Date().toISOString();
  write([...notices.filter((n) => !seen.has(n.key)).map((n) => ({ ...n, at })), ...items].slice(0, MAX));
}
