/**
 * UrPlaced Progressive Web App — Production Service Worker
 * Version: urplaced-v1.0.0
 * 
 * Strict Security Architecture:
 * - Only public static application shell assets and the offline fallback are cached.
 * - ZERO private student records, resumes, ATS scans, interviews, or tenant data are ever cached.
 * - All /api/** endpoints, Supabase Auth/Storage calls, and protected dashboard pages are NETWORK ONLY.
 */

const CACHE_NAME = "urplaced-v1";
const OFFLINE_FALLBACK_URL = "/offline";

// Public static assets safe for offline caching
const PRECACHE_ASSETS = [
  OFFLINE_FALLBACK_URL,
  "/manifest.json",
  "/favicon.ico",
  "/assets/logo.png",
  "/brand/brand-loader.png",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-192x192.png",
  "/icons/icon-maskable-512x512.png",
  "/icons/apple-touch-icon.png",
];

// Routes and domains strictly forbidden from being cached under any circumstances
const PRIVATE_OR_DYNAMIC_PATTERNS = [
  /\/api\//i,
  /\/dashboard\b/i,
  /\/preritrd\b/i,
  /\/passport\b/i,
  /supabase\.(co|in|net)/i,
  /\/storage\/v1\//i,
  /\/auth\/v1\//i,
  /\/rest\/v1\//i,
];

/**
 * Checks whether a request must strictly be Network Only
 */
function isStrictlyNetworkOnly(request) {
  // Non-GET requests are always network-only
  if (request.method !== "GET") {
    return true;
  }

  const url = new URL(request.url);

  // External APIs or third-party origins (Supabase, Gemini, Razorpay, Google)
  if (url.origin !== self.location.origin) {
    return true;
  }

  // Matches any forbidden private or dynamic pattern
  for (const pattern of PRIVATE_OR_DYNAMIC_PATTERNS) {
    if (pattern.test(url.pathname) || pattern.test(url.href)) {
      return true;
    }
  }

  return false;
}

/**
 * Installation Event: Pre-cache public application shell assets
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        // Pre-cache individual assets gracefully so a single failure doesn't abort the entire worker
        return Promise.allSettled(
          PRECACHE_ASSETS.map((asset) =>
            cache.add(asset).catch((err) => {
              console.warn(`[UrPlaced SW] Notice: Failed to precache ${asset}:`, err?.message);
            })
          )
        );
      })
  );
});

/**
 * Activation Event: Clean up outdated cache versions
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((staleName) => {
              console.log(`[UrPlaced SW] Purging obsolete cache: ${staleName}`);
              return caches.delete(staleName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

/**
 * Fetch Event Handler: Controlled Caching with Strict Privacy Isolation
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Ignore unsupported schemes (chrome-extension, etc.)
  if (!request.url.startsWith("http://") && !request.url.startsWith("https://")) {
    return;
  }

  // 1. Strictly Network Only for all private, API, auth, and dynamic resources
  if (isStrictlyNetworkOnly(request)) {
    event.respondWith(
      fetch(request).catch(() => {
        // For failed navigation requests to private pages while offline, provide the generic offline page
        if (request.mode === "navigate") {
          return caches.match(OFFLINE_FALLBACK_URL);
        }
        // For failed API requests while offline, return a clean 503 response
        return new Response(
          JSON.stringify({
            error: "You are currently offline. An active internet connection is required for this operation.",
            code: "OFFLINE",
          }),
          {
            status: 503,
            statusText: "Service Unavailable (Offline)",
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
    return;
  }

  // 2. Navigation Requests: Network First, fallback to generic /offline shell
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Never cache HTML responses containing private headers or Set-Cookie
          return response;
        })
        .catch(() => {
          return caches.match(OFFLINE_FALLBACK_URL).then((fallback) => {
            return (
              fallback ||
              new Response(
                "<!DOCTYPE html><html><body><h1>UrPlaced Offline</h1><p>Please check your internet connection.</p></body></html>",
                { headers: { "Content-Type": "text/html" } }
              )
            );
          });
        })
    );
    return;
  }

  // 3. Static Assets (/_next/static/*, /icons/*, /assets/*, public images/fonts): Cache First
  const url = new URL(request.url);
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname === "/favicon.ico" ||
    url.pathname === "/manifest.json";

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
            return networkResponse;
          }

          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });

          return networkResponse;
        });
      })
    );
    return;
  }

  // 4. Default: Network with safe fallback
  event.respondWith(fetch(request));
});

/**
 * Message Event: Controlled skipWaiting for user-approved application updates
 */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("[UrPlaced SW] Received SKIP_WAITING signal from user action");
    self.skipWaiting();
  }
});
