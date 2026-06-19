/* Flick — a small, honest service worker. Precache the crayon app shell so the
   fridge opens offline; never cache the API or media (those are live / persisted
   server-side). This makes Flick an installable PWA without pretending the Qwen
   crew works offline — the shell loads, and the app degrades honestly inside. */
const CACHE = 'flick-shell-v1';
const SHELL = [
  '/', '/index.html',
  '/styles/tokens.css', '/styles/components.css', '/styles/app.css',
  '/lib/crayon.js', '/lib/scene.js', '/lib/ui.js',
  '/app/api.js', '/app/movie.js', '/app/components.js', '/app/app.js',
  '/app/screens/fridge.js', '/app/screens/backstage.js', '/app/screens/watch.js',
  '/app/screens/toybox.js', '/app/screens/booth.js', '/app/screens/edges.js',
  '/fonts/Fredoka.ttf', '/fonts/Nunito.ttf', '/fonts/PatrickHand-Regular.ttf',
  '/fonts/SpaceMono-Regular.ttf', '/fonts/SpaceMono-Bold.ttf',
  '/icons/favicon.png', '/manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // never intercept the live surfaces
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/') || url.pathname.startsWith('/mcp/')) return;
  // cache-first for the shell; fall back to network; SPA fallback to '/'
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      if (res.ok && (url.pathname.startsWith('/lib/') || url.pathname.startsWith('/app/') || url.pathname.startsWith('/styles/') || url.pathname.startsWith('/fonts/'))) {
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match('/')))
  );
});
