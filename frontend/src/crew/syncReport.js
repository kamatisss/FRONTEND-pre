/*
 * Tell the office what this crew phone still holds (backend crew_sync.py): how many actions wait to be
 * sent, how many were refused, and since when. Sent whenever the phone has signal, at most every few
 * minutes unless the numbers change. Counts and times only, never what the actions are.
 */
import { API_BASE_URL } from '../config';
import { getOutbox } from './outbox';

const EVERY_MS = 5 * 60 * 1000;
let last = { sig: '', at: 0 };

export function outboxSummary(items = getOutbox()) {
  const waiting = items.filter((e) => e.state === 'waiting').length;
  const failed = items.filter((e) => e.state === 'failed').length;
  const oldest = items.reduce((min, e) => (!min || e.at < min ? e.at : min), null);
  return { waiting, failed, oldest_waiting_at: oldest };
}

export async function reportSync({ force = false } = {}) {
  if (navigator.onLine === false) return false;
  const summary = outboxSummary();
  const sig = `${summary.waiting}|${summary.failed}|${summary.oldest_waiting_at || ''}`;
  if (!force && sig === last.sig && Date.now() - last.at < EVERY_MS) return false;
  let token = null;
  try { token = JSON.parse(localStorage.getItem('authTokens'))?.access; } catch { /* signed out */ }
  if (!token) return false;
  try {
    const r = await fetch(`${API_BASE_URL}/crew-sync/`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(summary), signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
    });
    if (r.ok) { last = { sig, at: Date.now() }; return true; }
  } catch { /* no signal after all: the next try reports it */ }
  return false;
}
