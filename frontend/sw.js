const CACHE = "agriguide-shell-v5";
const ASSETS = [
  "/",
  "/index.html",
  "/css/style.css?v=4",
  "/js/app.js?v=4",
  "/js/chat.js",
  "/js/dashboard.js",
  "/js/farm.js",
  "/js/i18n.js",
  "/js/live.js",
  "/js/location.js",
  "/js/offline.js",
  "/js/voice.js",
  "/js/journal.js",
  "/js/calendar.js",
  "/js/soil.js",
  "/js/finance.js",
  "/locales/en.json",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE && key.startsWith("agriguide-")).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Live API data should not silently become stale. FAQ responses are the one
  // API resource we deliberately cache for offline use.
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname.startsWith("/api/faqs/")) {
      event.respondWith(
        fetch(event.request)
          .then((response) => {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
            return response;
          })
          .catch(() => caches.match(event.request))
      );
    }
    return;
  }

  // Network-first keeps deployed UI fresh while preserving an offline shell.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response?.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("/index.html");
        throw new Error("Offline and resource is not cached");
      })
  );
});
