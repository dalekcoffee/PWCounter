// PW Counter service worker: the app works offline after the first visit.
// Bump VERSION (it follows js/version.js) and the cache is replaced on the next visit.
const VERSION = '0.2.1';
const CACHE = `pwc-${VERSION}`;
const FONTS = 'pwc-fonts';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/state.js',
  'js/calc.js',
  'js/random.js',
  'js/version.js',
  'js/room-ui.js',
  'js/room-game.js',
  'js/dice-anim.js',
  'js/room-memory.js',
  'js/room-sync.js',
  'js/room-proto.js',
  'js/room.js',
  'js/room-fake.js',
  'js/room-config.js',
  'js/room-display.js',
  'worker/room/src/rules.js',
  'js/drawer.js',
  'js/qr.js',
  'js/vendor/qrcodegen.js',
  'assets/logo.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png',
  'assets/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((p) => new Request(p, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pwc-') && k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: cache what was loaded once, so the fonts work offline too.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // The app's own files: from the cache, refreshed in the background.
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const key = req.mode === 'navigate' ? 'index.html' : req;
    const hit = await c.match(key, { ignoreSearch: true });
    const fresh = fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') c.put(key, res.clone());
      return res;
    }).catch(() => null);
    return hit || (await fresh) || new Response('Offline', { status: 503 });
  }));
});
