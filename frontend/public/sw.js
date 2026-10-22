/*
 * Garden Studio service worker.
 *
 * 1. Push alerts (crew jobs, deliveries) even when the app is closed; tapping one opens the right page.
 *    Messages come from the backend (apps/library/push.py) as {title, body, url, tag}.
 * 2. Offline-friendly app (PWA), with rules chosen so a deploy can never leave anyone on an old app
 *    and private data never sits on the phone:
 *      pages          network first; offline → the app saved with this version; never visited → a small
 *                     "you're offline" page
 *      /assets/*      cache first (file names change every build); old builds' files are cleaned up
 *      /models/*      3D models: cached the first time they're used
 *      photos, fonts  product photos, icons, Google Fonts: shown from cache, refreshed in the background
 *      API            NEVER cached here (orders, bookings, cash, reports always come from the server)
 *    A new version installs in the background and waits; the app shows "New version available —
 *    Refresh" (src/pwa) and only then swaps over, so nobody is switched mid-task.
 *
 * BUILD_ID and PRECACHE are filled in by the build (vite.config.js); in development they stay as is.
 */
const BUILD_ID = 'dev';
const PRECACHE = [];

const SHELL = `shell-${BUILD_ID}`;
const ASSETS = 'assets';
const MODELS = 'models';
const SITE = 'site';      // the site's own images, icons, manifest
const PHOTOS = 'photos';  // public product photos from the backend
const FONTS = 'fonts';
// Cross-site responses (backend photos, Google Fonts) are "opaque": browsers count each one as
// several MB of storage quota, so those caches stay small
const LIMITS = { [ASSETS]: 150, [MODELS]: 40, [SITE]: 60, [PHOTOS]: 40, [FONTS]: 12 };
// Public product photos from the backend; crew/attendance photos are left alone (private)
const PUBLIC_MEDIA = /\/media\/(thumbnails|images|gardens|portfolio)\//;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(SHELL);
      // One missing file must not stop the install: cache what we can
      await Promise.all(PRECACHE.map((url) =>
        cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
    } catch {
      // Storage unavailable (private browsing, full disk): no offline copy, but push alerts still work
    }
    // First install (nothing to replace) or a dev build: take over at once. Updates wait for the app.
    if (!self.registration.active || BUILD_ID === 'dev') await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try { await cleanUp(); } catch { /* storage unavailable: nothing to clean */ }
    await self.clients.claim();
  })());
});

async function cleanUp() {
  const names = await caches.keys();
  await Promise.all(names.filter((n) => n.startsWith('shell-') && n !== SHELL).map((n) => caches.delete(n)));
  // Built files from older versions are no longer referenced: drop them
  const assets = await caches.open(ASSETS);
  const keep = new Set(PRECACHE.map((u) => new URL(u, self.location.origin).href));
  if (keep.size > 1) {
    for (const req of await assets.keys()) if (!keep.has(req.url)) await assets.delete(req);
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();   // the user tapped "Refresh"
});

async function trim(cacheName) {
  const cache = await caches.open(cacheName).catch(() => null);
  if (!cache) return;
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - LIMITS[cacheName]; i++) await cache.delete(keys[i]);   // oldest first
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request).catch(() => null);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type !== 'opaque') {
    caches.open(cacheName).then((cache) => cache.put(request, response.clone())).then(() => trim(cacheName)).catch(() => {});
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  let cache;
  try { cache = await caches.open(cacheName); } catch { return fetch(request); }
  const cached = await cache.match(request).catch(() => null);
  const fresh = fetch(request).then((response) => {
    if (response.ok || response.type === 'opaque') cache.put(request, response.clone()).then(() => trim(cacheName)).catch(() => {});
    return response;
  }).catch(() => cached || Response.error());
  return cached || fresh;
}

const OFFLINE_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Garden Studio</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;
font-family:Inter,system-ui,sans-serif;color:#0f172a;text-align:center;padding:24px}
.c{max-width:360px}.i{width:56px;height:56px;border-radius:16px;background:#ecfdf5;color:#059669;display:flex;
align-items:center;justify-content:center;margin:0 auto 18px;font-size:28px}h1{font-size:22px;margin:0 0 8px}
p{color:#475569;margin:0 0 20px;line-height:1.5}button{height:48px;padding:0 22px;border:0;border-radius:12px;
background:#059669;color:#fff;font-weight:700;font-size:15px}</style></head><body><div class="c">
<div class="i">🌿</div><h1>You're offline</h1><p>Garden Studio needs a connection the first time you open
this page. Check your signal and try again.</p><button onclick="location.reload()">Try again</button></div></body></html>`;

async function page(request) {
  try {
    return await fetch(request);
  } catch {
    // Every route is the same app (Vercel serves index.html for all of them): show the saved one
    const shell = await caches.match('/', { cacheName: SHELL }).catch(() => null) || await caches.match('/').catch(() => null);
    return shell || new Response(OFFLINE_PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') return;

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') return event.respondWith(page(request));
    if (url.pathname.startsWith('/assets/')) return event.respondWith(cacheFirst(request, ASSETS));
    if (url.pathname.startsWith('/models/')) return event.respondWith(cacheFirst(request, MODELS));
    if (/\.(png|jpe?g|webp|svg|ico|webmanifest)$/.test(url.pathname)) return event.respondWith(staleWhileRevalidate(request, SITE));
    return;   // anything else from the site: straight to the network
  }
  if (PUBLIC_MEDIA.test(url.pathname)) return event.respondWith(staleWhileRevalidate(request, PHOTOS));
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    return event.respondWith(staleWhileRevalidate(request, FONTS));
  }
  // The backend API and everything else: not touched (never cached)
});

// ── Push alerts ──────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    data: { url: data.url || '/staff-dashboard' },
    vibrate: [120, 60, 120],
  };
  if (data.tag) {          // only the test alert is tagged: a second test replaces the first
    options.tag = data.tag;
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(data.title || 'Garden Studio', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/staff-dashboard', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
    if (open) {
      // The app is already open: bring it forward and let it route there without a reload
      await open.focus();
      open.postMessage({ type: 'open-url', url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});
