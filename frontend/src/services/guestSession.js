import { API_BASE_URL as API_ROOT } from '../config';
const KEY = 'gs_guest_design';

export const saveGuestDesign = (data) => {
  try { localStorage.setItem(KEY, JSON.stringify({ ...data, savedAt: Date.now() })); } catch { /* storage blocked or full */ }
};

export const loadGuestDesign = () => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export const clearGuestDesign = () => {
  try { localStorage.removeItem(KEY); } catch { /* storage blocked */ }
};

// ─── AI Designer session of a signed-in customer ──────────────────
// Their designs, edits and answers, kept on this device per account, so a refresh or a later visit
// doesn't lose them (generating again would use up their daily AI designs). Kept for 14 days.
const AI_SESSION_KEY = (owner) => `gs_ai_session_${owner}`;
const AI_SESSION_DAYS = 14;

export const saveAiSession = (owner, data) => {
  try { localStorage.setItem(AI_SESSION_KEY(owner), JSON.stringify({ ...data, savedAt: Date.now() })); } catch { /* storage blocked or full */ }
};

export const loadAiSession = (owner) => {
  try {
    const data = JSON.parse(localStorage.getItem(AI_SESSION_KEY(owner)) || 'null');
    return data && Date.now() - (data.savedAt || 0) < AI_SESSION_DAYS * 24 * 3600 * 1000 ? data : null;
  } catch { return null; }
};

export const clearAiSession = (owner) => {
  try { localStorage.removeItem(AI_SESSION_KEY(owner)); } catch { /* storage blocked or full */ }
};

// ─── Free 3D Studio draft ─────────────────────────────────────────
// A guest's Studio work is kept on this device and moved into their account
// (the /studio page imports it) once they sign in, so nothing is lost at the login wall.
const DRAFT_KEY = 'gs_studio_draft';

export const saveStudioDraft = (state) => {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      designName: state.designName,
      placedItems: state.placedItems,
      dimensions: state.dimensions,
      terrainHeight: state.terrainHeight,
      timeOfDay: state.timeOfDay,
      sizeOnly: !!state.sizeOnly && !state.placedItems?.length,
      savedAt: new Date().toISOString(),
    }));
  } catch { /* storage blocked or full */ }
};

export const loadStudioDraft = () => {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    return draft && Array.isArray(draft.placedItems) ? draft : null;
  } catch { return null; }
};

export const clearStudioDraft = () => {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* storage blocked or full */ }
};

// ─── Studio → AI Designer hand-off ────────────────────────────────
// Lot size, the yard's shape (outline, lot metres) and chosen plants carry over so the customer doesn't redo them. The landing
// estimate also passes its budget range and install mode (source: 'estimate').
const AI_PREFILL_KEY = 'gs_ai_prefill';

export const saveAiPrefill = ({ lotWidth, lotLength, plantIds = [], budgetRange = null, install = null, source = 'studio', outline = null }) => {
  try {
    localStorage.setItem(AI_PREFILL_KEY, JSON.stringify({ lotWidth, lotLength, plantIds, budgetRange, install, source, outline, savedAt: Date.now() }));
  } catch { /* storage blocked or full */ }
};

// Pure read (safe in a useState initializer); ignore anything older than a day.
// Call clearAiPrefill() once it has been applied.
export const loadAiPrefill = () => {
  try {
    const data = JSON.parse(localStorage.getItem(AI_PREFILL_KEY) || 'null');
    return data && Date.now() - data.savedAt < 24 * 3600 * 1000 ? data : null;
  } catch { return null; }
};

export const clearAiPrefill = () => {
  try { localStorage.removeItem(AI_PREFILL_KEY); } catch { /* storage blocked or full */ }
};

// ─── Funnel analytics (anonymous) ─────────────────────────────────
// Each step is counted once per browser tab: a random id, no personal data.
const SESSION_KEY = 'gs_funnel_session';
const SENT_KEY = 'gs_funnel_sent';

const funnelSession = () => {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`).slice(0, 40);
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
};

export const trackFunnel = (name) => {
  try {
    const sent = JSON.parse(sessionStorage.getItem(SENT_KEY) || '[]');
    if (sent.includes(name)) return;
    sessionStorage.setItem(SENT_KEY, JSON.stringify([...sent, name]));
    // No auth header on purpose: events stay anonymous, and a stale token can't 401 them
    fetch(`${API_ROOT}/funnel-events/`, {
      method: 'POST',
      keepalive: true, // survives the navigation that often follows (e.g. to the AI Designer)
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, session_id: funnelSession() }),
    }).catch(() => {});
  } catch { /* analytics must never break the page */ }
};
