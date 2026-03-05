// Fog of War - Offline Demo Service Worker
const CACHE_NAME = "fog-of-war-v2";
const PRECACHE_ROUTES = ["/", "/match/900000001?demo=1"];
const STATIC_DESTINATIONS = new Set([
  "style",
  "script",
  "image",
  "font",
  "audio",
  "video",
  "manifest",
  "worker",
]);

function isDemoNavigation(url, request) {
  if (request.mode !== "navigate") return false;
  if (url.pathname === "/") return true;
  if (!url.pathname.startsWith("/match/")) return false;
  return url.searchParams.get("demo") === "1";
}

function isStaticAsset(url, request) {
  if (STATIC_DESTINATIONS.has(request.destination)) return true;
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.svg"
  );
}

function shouldHandleRequest(request, url) {
  if (url.origin !== self.location.origin) return false;
  if (request.method !== "GET") return false;
  if (request.cache === "no-store") return false;
  return isDemoNavigation(url, request) || isStaticAsset(url, request);
}

function isCacheableResponse(response) {
  if (!response || !response.ok || response.type !== "basic") return false;
  const cacheControl = (response.headers.get("cache-control") || "").toLowerCase();
  if (cacheControl.includes("no-store") || cacheControl.includes("private")) {
    return false;
  }
  return true;
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ROUTES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (!shouldHandleRequest(event.request, url)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (isCacheableResponse(response)) {
          const clone = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
