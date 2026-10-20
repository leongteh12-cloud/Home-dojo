// Home Dojo service worker: keeps the app working offline and picks up new versions.
// Bump VERSION whenever any app file changes.
const VERSION = "home-dojo-v43";
// Pictures change rarely and are big, so they live in their own cache that survives app updates.
const ART = "home-dojo-art";
const SHELL = [
  "./", "index.html", "styles.css", "app.js", "monsters.js", "guide.js", "voice.js", "islands.js", "config.js", "news.json", "manifest.webmanifest",
  "vendor/supabase.js", "icons/icon.svg", "icons/icon-192.png", "icons/apple-touch-icon.png",
  "fonts/fredoka-latin-500-normal.woff2", "fonts/fredoka-latin-600-normal.woff2", "fonts/fredoka-latin-700-normal.woff2",
  "fonts/atkinson-hyperlegible-latin-400-normal.woff2", "fonts/atkinson-hyperlegible-latin-700-normal.woff2"
];

// Fetch every app file fresh (skipping the browser's own cache), so a new version never installs with old files.
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== ART).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });

// App files come only from this version's cache, so old and new files are never mixed; a new version arrives as a
// whole through install above. Pictures: from the art cache, refreshed in the background. Database calls go straight to the network.
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  const art = /\/(scenery|icons)\//.test(url.pathname);
  e.respondWith((async () => {
    const shell = await caches.open(VERSION);
    const hit = await shell.match(req, { ignoreSearch: req.mode === "navigate" }) || (art && await (await caches.open(ART)).match(req));
    if (hit && !art) return hit;
    const net = fetch(req).then(async (res) => {
      if (res && res.ok && art) await (await caches.open(ART)).put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    return res || (req.mode === "navigate" ? shell.match("index.html") : Response.error());
  })());
});
