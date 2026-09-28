/**
 * Push-notification handling for the generated Workbox service worker
 * (see electron.vite.config.ts's `workbox.importScripts` — this file is
 * `importScripts()`'d into the generated `sw.js`, not built/bundled by
 * Vite itself, so it stays plain, dependency-free JS with no imports of
 * its own). Precaching/runtime-caching (the actual PWA offline behavior)
 * all still comes from generateSW; this file only ever adds the two
 * event listeners generateSW has no way to produce on its own.
 */

self.addEventListener('push', (event) => {
  let payload = { title: 'Mt Hood Lanes', body: '', url: '/' };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  const fullUrl = new URL(`/#${url}`, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(fullUrl);
      }
      return undefined;
    }),
  );
});
