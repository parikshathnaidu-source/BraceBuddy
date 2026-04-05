// ══════════════════════════════════════════════
//  BraceBuddy Service Worker  v1.0
//  Offline-first caching strategy
// ══════════════════════════════════════════════

const CACHE_NAME = 'bracebuddy-v1';
const STATIC_CACHE = 'bracebuddy-static-v1';
const DYNAMIC_CACHE = 'bracebuddy-dynamic-v1';

// Core app shell — always cache these
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/bb.jpg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// External resources to cache
const EXTERNAL_RESOURCES = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// ── INSTALL ──────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing BraceBuddy v1...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(APP_SHELL);
      })
      .then(() => {
        // Cache external resources separately (don't fail install if they fail)
        return caches.open(DYNAMIC_CACHE).then(cache => {
          return Promise.allSettled(
            EXTERNAL_RESOURCES.map(url =>
              cache.add(url).catch(err => console.log('[SW] Failed to cache:', url, err))
            )
          );
        });
      })
      .then(() => {
        console.log('[SW] Install complete — skipping waiting');
        return self.skipWaiting();
      })
  );
});

// ── ACTIVATE ─────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Now controlling all clients');
      return self.clients.claim();
    })
  );
});

// ── FETCH ─────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and non-http requests
  if (!request.url.startsWith('http')) return;

  // ── Strategy: Cache First for app shell ──
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) {
          // Serve from cache, update in background
          const fetchPromise = fetch(request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                caches.open(STATIC_CACHE).then(cache => {
                  cache.put(request, responseClone);
                });
              }
              return networkResponse;
            })
            .catch(() => cached); // fallback to cached on network error
          return cached; // return cached immediately, update happens in background
        }

        // Not in cache — fetch from network and cache it
        return fetch(request)
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(STATIC_CACHE).then(cache => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback for navigation
            if (request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
    );
    return;
  }

  // ── Strategy: Network First for external resources ──
  event.respondWith(
    fetch(request)
      .then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(DYNAMIC_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});

// ── PUSH NOTIFICATIONS ────────────────────────
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'BraceBuddy';
  const options = {
    body: data.body || 'Time to check your aligner!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: '📸 Take Photos' },
      { action: 'dismiss', title: 'Later' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ── NOTIFICATION CLICK ────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow('/');
      })
  );
});

console.log('[SW] BraceBuddy Service Worker loaded ✓');
