/* SaloonEase service worker: app-shell caching, offline fallback, API always live. */
const VERSION = 'v1.1.0';
const STATIC_CACHE = `saloonease-static-${VERSION}`;
const PAGES_CACHE = `saloonease-pages-${VERSION}`;
const OFFLINE_URL = '/offline';
const PRECACHE = ['/', OFFLINE_URL, '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGES_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

const isApi = (url) => url.pathname.startsWith('/api') || /\/api\//.test(url.href) || url.port === '5000';
const isStatic = (url) =>
  url.pathname.startsWith('/_next/static') ||
  url.pathname.startsWith('/icons/') ||
  /\.(png|jpg|jpeg|webp|svg|gif|ico|woff2?|ttf|css|js)$/.test(url.pathname) ||
  url.hostname === 'fonts.gstatic.com' ||
  url.hostname === 'fonts.googleapis.com';

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never cache API or Cloudinary uploads (always live data)
  if (isApi(url)) return;

  // Navigations: network first, fall back to cached page, then offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGES_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL)) || Response.error()),
    );
    return;
  }

  // Static assets: stale-while-revalidate
  if (isStatic(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'SaloonEase', body: event.data.text() };
  }
  const show = self.registration.showNotification(data.title || 'SaloonEase', {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/maskable-192.png',
    tag: data.tag || 'saloonease',
    renotify: true,
    silent: false, // system notification sound
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
    data: { url: data.url || '/admin', id: data.id, type: data.type },
  });
  // tell open admin tabs so they can play the in-app sound + bubble immediately
  const ping = self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => list.forEach((c) => c.postMessage({ type: 'PUSH_RECEIVED', payload: data })));
  event.waitUntil(Promise.all([show, ping]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/admin';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => 'focus' in c);
      if (existing) {
        existing.navigate ? existing.navigate(url).then((c) => c && c.focus()) : existing.focus();
        return;
      }
      return self.clients.openWindow(url);
    }),
  );
});
