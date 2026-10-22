// Offline shell for Gugah!: network first, cached copy when offline. Live connections (PeerJS) are never cached.
const CACHE = "gugah-v1";
const SHELL = ["./", "index.html", "app.js?v=1", "i18n.js?v=1", "kits.js?v=1", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js", "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("gugah-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const mine = url.origin === self.location.origin && url.pathname.startsWith(new URL("./", self.location).pathname);
  const lib = url.hostname === "cdnjs.cloudflare.com";
  if (!mine && !lib) return;
  e.respondWith(fetch(mine ? new Request(e.request, { cache: "no-cache" }) : e.request)
    .then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: false }).then((m) => m || caches.match("index.html"))));
});
