// MarginSnap service worker — app-shell caching only.
// Real order/profit data always comes from the network; this just makes the
// installed app open instantly instead of showing a blank white screen while
// offline or on a slow connection. Bump CACHE_NAME to invalidate on deploy.

const CACHE_NAME = "marginsnap-shell-v1";
const SHELL_URLS = ["/dashboard", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for everything (this is a live-data app); fall back to the
// cached shell only when the network is genuinely unreachable.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(event.request).then((cached) => cached || caches.match("/dashboard"))
    )
  );
});
