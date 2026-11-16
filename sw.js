// aayu offline cache: serve the saved copy at once, refresh it from the network in the background.
// If the site answers with an error page (for example 404 while the site is switched off), show the saved app instead.
// All apps on one github.io address share the browser's cache storage, so aayu only touches caches named "aayu-…".
const PREFIX = "aayu-";
const CACHE = PREFIX + "v8";
const APP = "./PR.html";
const ASSETS = [
  APP,
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.indexOf(PREFIX) === 0 && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // Only aayu's own folder: other apps on the same address have their own copy.
  if (!new URL(req.url).pathname.startsWith(new URL("./", self.location).pathname)) return;
  const isPage = req.mode === "navigate";

  const network = fetch(req).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(req, copy));
    }
    return res;
  });
  event.waitUntil(network.catch(() => {}));

  const savedApp = (fallback) => caches.match(APP, { cacheName: CACHE }).then((app) => app || fallback);

  event.respondWith(
    caches.match(req, { ignoreSearch: true, cacheName: CACHE }).then((cached) =>
      cached ||
      network
        .then((res) => (res.ok || !isPage ? res : savedApp(res)))
        .catch(() => (isPage ? savedApp(Response.error()) : Response.error()))
    )
  );
});
