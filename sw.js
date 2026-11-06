// PW Counter service worker: the app works offline after the first visit.
// Bump VERSION (it follows js/version.js) and the cache is replaced on the next visit.
// The cache always holds ONE version of every file: a new version is fetched whole (past the CDN, with ?v=) and
// checked before it is used, and files are never refreshed one by one. A page from one version with scripts from
// another breaks every button wired after the first missing element (0.3.3: dice, coin and settings stopped working).
const VERSION = '0.3.19';
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
  'js/die3d.js',
  'js/dom-write.js',
  'js/first-pick.js',
  'js/room-memory.js',
  'js/room-sync.js',
  'js/room-proto.js',
  'js/room.js',
  'js/room-fake.js',
  'js/room-config.js',
  'js/room-display.js',
  'worker/room/src/rules.js',
  'js/drawer.js',
  'js/life.js',
  'js/qr.js',
  'js/vendor/qrcodegen.js',
  'assets/logo.svg',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png',
  'assets/apple-touch-icon.png',
];

// files that name the version: if any is from another version, the set is mixed and this install fails
// (the old version keeps running and the browser tries again on its next update check)
const STAMPED = ['index.html', 'js/version.js', 'css/app.css'];

async function fetchShell() {
  const got = await Promise.all(SHELL.map(async (p) => {
    const res = await fetch(new Request(`${p}?v=${VERSION}`, { cache: 'reload' }));
    if (!res.ok) throw new Error(`${p}: ${res.status}`);
    if (STAMPED.includes(p) && !(await res.clone().text()).includes(VERSION)) throw new Error(`${p} is not ${VERSION}`);
    return [p, res];
  }));
  const c = await caches.open(CACHE);
  await Promise.all(got.map(([p, res]) => c.put(p, res)));
}

self.addEventListener('install', (e) => {
  e.waitUntil(fetchShell().then(() => self.skipWaiting()));
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

  // The app's own files: from this version's cache only (never refreshed one at a time); anything else from the network.
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const key = req.mode === 'navigate' ? 'index.html' : req;
    const hit = await c.match(key, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); } catch { return new Response('Offline', { status: 503 }); }
  }));
});
