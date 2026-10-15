/* Bump VERSION whenever any app asset changes. Each release is cached atomically.
 * New versions wait for open tabs to close, avoiding mixed old/new scripts. */
const VERSION = 'v3';
const BASE = new URL('./', self.location.href);
const PREFIX = `solar-battery-brief:${BASE.pathname}:`;
const CACHE = `${PREFIX}${VERSION}`;
const FILES = ['index.html', 'style.css', 'app.js', 'data.js', 'format.js',
  'pwa.js', 'deposit.js', 'combobox.js', 'manifest.webmanifest', 'icons/icon-192.png',
  'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
const URLS = FILES.map(file => new URL(file, BASE).href);

self.addEventListener('install', event => {
  // A failed download rejects installation, retaining the last working release.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(
    URLS.map(url => new Request(url, {cache: 'reload'}))
  )));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin ||
      !url.pathname.startsWith(BASE.pathname)) return;
  // Only the app entry page and explicit app assets are served from this cache.
  // Do not capture unrelated host routes, API responses or customer data.
  const entry = url.pathname === BASE.pathname || url.pathname === new URL('index.html', BASE).pathname;
  const key = entry ? new URL('index.html', BASE).href : new URL(url.pathname, BASE.origin).href;
  if (!URLS.includes(key)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE)).match(key);
    return cached || fetch(request);
  })());
});
