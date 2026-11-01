// HKBP Singapore service worker: offline shell, push notifications, and opening the app from a notification.
const CACHE = "hkbp-v122";
const NT_CACHE = "sada-notasi-v1"; // song notation pictures: cache-first, kept across app updates
const SHELL = ["./", "index.html", "config.js?v=60", "i18n.js?v=65", "store.js?v=68", "parse.js?v=60", "app.js?v=166", "notasi.js?v=10", "fields.js?v=1", "manifest.webmanifest", "logo.png", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "warta/head.jpg", "warta/banner.png", "warta/badan.png", "warta/corsiva.png", "warta/samb.png", "warta/wa.png", "fonts/LiberationSansNarrow-Regular.woff2", "fonts/LiberationSansNarrow-Bold.woff2", "fonts/LiberationSansNarrow-Italic.woff2", "fonts/LiberationSansNarrow-BoldItalic.woff2", "fonts/LiberationSans-Regular.woff2", "fonts/LiberationSans-Bold.woff2"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("hkbp-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.includes("/hkbp/")) return;
  if (url.pathname.includes("/hkbp/notasi/") && url.pathname.endsWith(".png")) {
    e.respondWith(caches.open(NT_CACHE).then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }))));
    return;
  }
  e.respondWith(fetch(new Request(e.request, { cache: "no-cache" })).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: url.pathname.endsWith("/hkbp/") || url.pathname.endsWith("index.html") })));
});

// Push from the server job (backend/notify.mjs): { title, body, url, tag }
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Sada HKBPS", { body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", tag: d.tag, data: { url: d.url || "#/home" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const hash = (e.notification.data && e.notification.data.url) || "#/home";
  const target = new URL("./" + (hash.startsWith("#") ? hash : "#/home"), self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => x.url.startsWith(self.registration.scope));
    if (c) { c.postMessage({ url: hash }); return c.focus(); }
    return self.clients.openWindow(target);
  }));
});
