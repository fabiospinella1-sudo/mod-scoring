/* MOD Range Scoring — offline support.
   The page itself: tries the network first (so updates show up right away when there
   is signal) but gives up after 2.5 seconds and uses the saved copy, so it still opens
   instantly at a range with no signal. Everything else (logo, icons, QR library) comes
   from the saved copy and is quietly refreshed in the background. */
const CACHE = 'mod-scoring-v5';
const FILES = ['./', 'index.html', 'qrcode.min.js', 'logo.png', 'manifest.webmanifest',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // Only handle this site's own files. Google Sheet calls always go to the network.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || /\/(index\.html)?$/.test(new URL(req.url).pathname);
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true }) || (isPage && await cache.match('index.html'));
    const fresh = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    });
    fresh.catch(() => {});
    if (!isPage) return cached || fresh.catch(() => cached);
    const timeout = new Promise(r => setTimeout(() => r(null), 2500));
    try {
      const res = await Promise.race([fresh, timeout]);
      return res || cached || fresh;
    } catch (err) {
      return cached || Response.error();
    }
  }));
});
