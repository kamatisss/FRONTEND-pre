import api from './api';

/*
 * Phone alerts (Web Push) for this browser. The service worker is public/sw.js; the server side is
 * BACKEND apps/library/push.py. Every function is safe to call on browsers without push support.
 *
 * pushState() → 'unsupported' | 'ios-install' | 'insecure' | 'server-off' | 'denied' | 'off' | 'on'
 */

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   // iPadOS reports as a Mac
const isInstalled = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
const hasPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function base64UrlToBytes(value) {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function pushState() {
  // iPhone/iPad only offer push to sites added to the Home Screen (iOS 16.4+)
  if (!hasPush()) return isIOS() && !isInstalled() ? 'ios-install' : 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  try {
    const { data } = await api.get('/push/config/');
    if (!data.enabled) return 'server-off';
  } catch {
    return 'server-off';
  }
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'off';
  return (await currentSubscription()) ? 'on' : 'off';
}

export async function enablePush() {
  const { data: config } = await api.get('/push/config/');
  if (!config.enabled) return 'server-off';
  // Must run straight from the tap, or browsers ignore the permission prompt
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const key = base64UrlToBytes(config.public_key);
  let sub = await reg.pushManager.getSubscription();
  if (sub && sub.options?.applicationServerKey) {
    // Server keys changed since this phone subscribed: start over with the new ones
    const old = new Uint8Array(sub.options.applicationServerKey);
    if (old.length !== key.length || old.some((b, i) => b !== key[i])) { await sub.unsubscribe(); sub = null; }
  }
  sub = sub || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api.post('/push/subscribe/', sub.toJSON());
  return 'on';
}

export async function disablePush() {
  if (!hasPush()) return 'off';
  const sub = await currentSubscription();
  if (sub) {
    await api.post('/push/unsubscribe/', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return 'off';
}

// On every visit: tell the server this phone is still subscribed (and to whom: after a sign-in on a
// shared phone the alerts move to the new account). Quietly does nothing when alerts are off.
export async function syncPush() {
  if (!hasPush() || Notification.permission !== 'granted') return;
  const sub = await currentSubscription().catch(() => null);
  if (sub) await api.post('/push/subscribe/', sub.toJSON()).catch(() => {});
}

export const sendTestPush = () => api.post('/push/test/').then(r => r.data);
