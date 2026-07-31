const CACHE_NAME = 'opti-transfer-v1.20';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/crypto.js',
  './js/chunker.js',
  './js/encoder.js',
  './js/decoder.js',
  './js/worker.js',
  './js/app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});