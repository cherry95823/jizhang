/**
 * 很薄的一层离线缓存：第一次打开成功后，没网也能再开账本。
 * 账目本身在 localStorage，不经过这里。
 */
const CACHE = 'jizhang-shell-v2';
const ASSETS = [
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/ledger.js',
  './js/icons.js',
  './js/charts.js',
  './js/storage.js',
  './js/demo.js',
  './js/backgrounds.js',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/bg/rose-window.webp',
  './assets/bg/rose-window.jpg',
  './assets/bg/sakura-water.webp',
  './assets/bg/sakura-water.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const home = await caches.match('./index.html');
      if (home) return home;
    }
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}
