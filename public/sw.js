/*
 * Service worker DevizConstruct.ro — doar pentru instalare și pagina „fără internet”.
 * Nu păstrează date din cont (devize, documente): paginile se cer mereu de la server.
 * Fișierele statice ale aplicației (/_next/static, sigle, iconițe) se păstrează local, ca să pornească repede.
 */
const VERSION = "dc-v1";
const OFFLINE = "/offline.html";
const PRECACHE = [OFFLINE, "/brand/devizconstruct-logo.png", "/pwa/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pagini: mereu de la server; fără internet, pagina „fără conexiune”.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  // Fișiere statice cu nume unic (nu se schimbă): din cache, altfel de la server și se păstrează.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/pwa/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
  }
});
