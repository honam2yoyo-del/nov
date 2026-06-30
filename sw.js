const CACHE_NAME = 'jago-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/main.js',
  '/js/home.js',
  '/js/auth.js',
  '/js/firebase.js',
  '/js/firestore.js',
  '/js/state.js',
  '/js/ui.js',
  '/js/orders.js',
  '/js/vendors.js',
  '/js/products.js',
  '/js/dm-orders.js',
  '/js/dm-vendors.js',
  '/js/domaemae.js',
  '/js/inspect.js',
  '/js/stats.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: Firebase/외부 요청은 항상 네트워크 우선, 실패 시 캐시
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Firebase, CDN 등 외부 요청은 캐시 안 씀
  if (url.origin !== self.location.origin) {
    e.respondWith(fetch(e.request));
    return;
  }

  // 내부 정적 파일: Cache-first
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached || fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        return res;
      })
    )
  );
});
