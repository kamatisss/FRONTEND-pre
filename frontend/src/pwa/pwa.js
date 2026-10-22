/*
 * PWA plumbing shared by the whole app (public/sw.js is the worker itself).
 *   - registers the service worker for every visitor in production (push alerts reuse it: services/push.js)
 *   - notices a new version waiting after a deploy → the "New version available" banner
 *   - keeps the browser's install prompt (Android / desktop Chrome) for the "Install app" button
 * State lives here and is read through the hooks in usePwa.js.
 */

const listeners = new Set();
const state = { updateReady: false, installEvent: null, installed: false };
const emit = () => listeners.forEach((fn) => fn({ ...state }));

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getState = () => ({ ...state });

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   // iPadOS reports as a Mac

let waitingWorker = null;

function watch(registration) {
  const markReady = (worker) => {
    // Only an UPDATE waits; the very first install takes over by itself
    if (worker && navigator.serviceWorker.controller) {
      waitingWorker = worker;
      state.updateReady = true;
      emit();
    }
  };
  markReady(registration.waiting);
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => { if (worker.state === 'installed') markReady(worker); });
  });
}

/** The user tapped "Refresh": let the new version take over, then reload once. */
export function applyUpdate() {
  if (!waitingWorker) { window.location.reload(); return; }
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!reloaded) { reloaded = true; window.location.reload(); }
  });
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

export async function promptInstall() {
  const event = state.installEvent;
  if (!event) return 'unavailable';
  event.prompt();
  const { outcome } = await event.userChoice;
  state.installEvent = null;
  emit();
  return outcome;   // 'accepted' | 'dismissed'
}

export function initPwa() {
  state.installed = isStandalone();
  // Fires once, early: keep it for the "Install app" button (Chrome/Edge on Android and desktop)
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.installEvent = event;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    state.installEvent = null;
    state.installed = true;
    emit();
  });

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
      watch(registration);
      // A long-open tab (office desk, crew phone) still hears about new deploys
      setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000);
    }).catch(() => { /* no offline support; the site works as normal */ });
  });
}
