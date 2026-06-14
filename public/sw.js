// PokéWatch Service Worker v2.1
// Handles background push notifications on iPhone

self.addEventListener('install', e => {
  console.log('[SW] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW] Activated');
  e.waitUntil(clients.claim());
});

self.addEventListener('push', e => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); }
  catch { data = { title: '🚨 PokéWatch Alert!', body: e.data.text(), url: '/' }; }

  const options = {
    body: data.body || 'A product you are watching is in stock!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'pokewatch-alert',
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'buy', title: '🛒 Buy Now' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  e.waitUntil(
    self.registration.showNotification(data.title || '🚨 IN STOCK!', options)
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  if (e.action === 'dismiss') return;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).catch(() => new Response('Offline', { status: 503 })));
});
