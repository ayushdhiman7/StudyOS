/* StudyOS service worker — cache app shell assets; network-first for pages. */
const VERSION = "studyos-v1";
const SHELL = ["/offline.html", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then(async (cache) => {
      await Promise.all(
        SHELL.map(async (url) => {
          try {
            await cache.add(url);
          } catch {
            // Ignore individual precache misses so install still completes.
          }
        }),
      );
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API or server-action traffic.
  if (url.pathname.startsWith("/api/") || url.pathname.includes("server-action")) return;

  // Static assets: cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname === "/sw.js"
  ) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // Navigations: network-first, offline offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const cache = await caches.open(VERSION);
          cache.put(request, response.clone());
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(VERSION);
          return (await cache.match(request)) || (await cache.match("/offline.html")) || Response.error();
        }),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
