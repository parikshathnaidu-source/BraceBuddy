// ══════════════════════════════════════════════
//  BraceBuddy Service Worker  v1.1
//  Fixed for GitHub Pages /BraceBuddy/ scope
// ══════════════════════════════════════════════

const CACHE_NAME = 'bracebuddy-v1';

const APP_SHELL = [
  '/BraceBuddy/',
  '/BraceBuddy/index.html',
  '/BraceBuddy/manifest.json',
  '/BraceBuddy/bb.jpg',
  '/BraceBuddy/icons/icon-192.png',
  '/BraceBuddy/icons/icon-512.png'
];

// ── INSTALL ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ─────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/BraceBuddy/index.html');
        }
      });
    })
  );
});

// ── NOTIFICATION CLICK ────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('/BraceBuddy/');
    })
  );
});

console.log('[SW] BraceBuddy Service Worker v1.1 loaded ✓');
