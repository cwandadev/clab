/* clab service worker — makes the shop installable, starts faster on repeat visits,
   and shows an offline page instead of the browser's error.
   Never caches: server functions, Supabase API/auth, or any page HTML (pages can hold private data). */
const VERSION = "clab-v1";
const STATIC = `${VERSION}-static`;
const IMAGES = `${VERSION}-images`;
const FONTS = `${VERSION}-fonts`;
const PRECACHE = ["/offline.html", "/manifest.webmanifest", "/favicon-192x192.png", "/favicon-512x512.png"];
const MAX_IMAGES = 200;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.startsWith(VERSION)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });

async function cacheFirst(req, name) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") (await caches.open(name)).put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(IMAGES);
  const hit = await cache.match(req);
  const update = fetch(req).then(async (res) => {
    if (res.ok) {
      await cache.put(req, res.clone());
      const keys = await cache.keys();
      for (const k of keys.slice(0, Math.max(0, keys.length - MAX_IMAGES))) await cache.delete(k);
    }
    return res;
  }).catch(() => hit);
  return hit || update;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith("/_serverFn") || url.pathname.startsWith("/api")) return;
    if (req.mode === "navigate") {
      e.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
      return;
    }
    if (url.pathname.startsWith("/assets/")) { e.respondWith(cacheFirst(req, STATIC)); return; }  // hashed file names never change
    if (/\.(png|svg|ico|webp|webmanifest)$/.test(url.pathname)) { e.respondWith(cacheFirst(req, STATIC)); return; }
    return;
  }

  if (url.pathname.includes("/storage/v1/object/public/")) { e.respondWith(staleWhileRevalidate(req)); return; }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") { e.respondWith(cacheFirst(req, FONTS)); return; }
  // everything else (Supabase REST/auth/realtime, pawaPay, …) goes straight to the network
});
