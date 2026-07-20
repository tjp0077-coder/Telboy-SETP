/* EDI SETP 2026 — Service Worker
 *
 * Caching strategy:
 *   App shell (HTML, JS, CSS, fonts, images) → cache-first
 *   API GET requests (/api/schedule, /api/feed, /api/city-guide) → network-first
 *     with cache fallback so the schedule remains visible offline.
 *   Other requests pass through.
 */

const VERSION = "v3";
const APP_SHELL_CACHE = `setp2026-shell-${VERSION}`;
const RUNTIME_CACHE   = `setp2026-runtime-${VERSION}`;
const API_CACHE       = `setp2026-api-${VERSION}`;

const APP_SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

// Endpoints we want to keep available offline.
const API_GET_PATHS = [
  "/api/schedule",
  "/api/feed",
  "/api/city-guide",
];

// ──────────────────────────────────────────────────────────────
// Install — pre-cache the app shell.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      cache.addAll(APP_SHELL_URLS).catch(() => {
        // Some entries may 404 in dev; that's fine.
      })
    )
  );
  self.skipWaiting();
});

// Activate — purge old caches.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![APP_SHELL_CACHE, RUNTIME_CACHE, API_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ──────────────────────────────────────────────────────────────
// Fetch handler

function isApiGet(req, url) {
  return (
    req.method === "GET" &&
    API_GET_PATHS.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"))
  );
}

function isShellAsset(req, url) {
  if (req.method !== "GET") return false;
  if (url.origin !== self.location.origin) return false;
  return (
    url.pathname === "/" ||
    url.pathname.startsWith("/_expo/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".ttf") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".svg")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never touch non-GET — let auth/posts pass through.
  if (req.method !== "GET") return;

  // ── HTML navigation: network-first so design/code updates appear
  //    immediately after a redeploy. Falls back to cached shell offline.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          const cache = await caches.open(APP_SHELL_CACHE);
          cache.put("/", fresh.clone());
          return fresh;
        } catch (e) {
          const cached =
            (await caches.match(req)) || (await caches.match("/"));
          if (cached) return cached;
          return new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // ── API GET: network-first, cache fallback ───────────────
  if (isApiGet(req, url)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(API_CACHE);
          // Only cache successful 200s
          if (fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        } catch (e) {
          const cached = await caches.match(req, { cacheName: API_CACHE });
          if (cached) return cached;
          return new Response(JSON.stringify({ offline: true }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
      })()
    );
    return;
  }

  // ── App shell / assets: cache-first, network fallback ───
  if (isShellAsset(req, url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) {
          // Refresh in background
          fetch(req)
            .then((r) => {
              if (r.ok) caches.open(RUNTIME_CACHE).then((c) => c.put(req, r));
            })
            .catch(() => {});
          return cached;
        }
        try {
          const fresh = await fetch(req);
          if (fresh.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch {
          // For SPA navigations fall back to the cached root page.
          if (req.mode === "navigate") {
            const fallback = await caches.match("/");
            if (fallback) return fallback;
          }
          return new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // Everything else: pass through.
});

// Allow the page to trigger a SW update without reload.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
