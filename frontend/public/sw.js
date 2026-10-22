/*
 * Garden Studio service worker: shows push alerts (crew jobs, deliveries) even when the app is
 * closed, and opens the right page when one is tapped. It does no offline caching on purpose:
 * the app always loads fresh, so a deploy can never be stuck behind an old cached copy.
 * Messages come from the backend (apps/library/push.py) as {title, body, url, tag}.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

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
