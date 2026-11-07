import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

// In-memory 5-second cache for maintenance status to maintain sub-millisecond edge routing
let middlewareMaintenanceCache: { enabled: boolean; message: string; timestamp: number } | null = null;
const MAINTENANCE_CACHE_TTL_MS = 5000;

/**
 * Checks current global platform maintenance status via Supabase REST API.
 * Uses an in-memory 5-second TTL cache to eliminate redundant edge network latency.
 */
async function checkGlobalMaintenance(): Promise<{ enabled: boolean; message: string }> {
  const now = Date.now();
  if (
    middlewareMaintenanceCache &&
    now - middlewareMaintenanceCache.timestamp < MAINTENANCE_CACHE_TTL_MS
  ) {
    return middlewareMaintenanceCache;
  }

  try {
    const { supabaseUrl, supabaseAnonKey, supabaseServiceRoleKey } = getSupabaseConfig();
    const apiKey = supabaseServiceRoleKey || supabaseAnonKey;
    const res = await fetch(
      `${supabaseUrl}/rest/v1/platform_settings?key=eq.maintenance_mode&select=value`,
      {
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        cache: "no-store",
      }
    );

    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.value) {
        middlewareMaintenanceCache = {
          enabled: Boolean(rows[0].value.enabled),
          message: rows[0].value.message || "",
          timestamp: now,
        };
        return middlewareMaintenanceCache;
      }
    }
  } catch {
    // Non-blocking fallback
  }

  return middlewareMaintenanceCache || { enabled: false, message: "", timestamp: now };
}

/**
 * Checks whether a given path is exempt from maintenance lockdown.
 * Preserves Super Admin control plane, critical payment webhooks, health, and auth.
 */
function isExemptFromMaintenance(pathname: string): boolean {
  // 1. Super Admin control plane and Super Admin API routes
  if (pathname.startsWith("/preritrd") || pathname.startsWith("/api/preritrd")) {
    return true;
  }

  // 2. Critical billing integrations (Razorpay webhooks & checkout)
  if (
    pathname.startsWith("/api/billing/webhook") ||
    pathname.startsWith("/api/webhooks/razorpay") ||
    pathname.startsWith("/api/billing/checkout")
  ) {
    return true;
  }

  // 3. Platform maintenance status & health endpoints
  if (
    pathname.startsWith("/api/platform/maintenance") ||
    pathname === "/api/health"
  ) {
    return true;
  }

  // 4. Authentication routes (callbacks, session sync, signout)
  if (
    pathname.startsWith("/auth") ||
    pathname === "/api/auth/signout"
  ) {
    return true;
  }

  // 5. Dedicated maintenance screen and static platform assets
  if (
    pathname === "/maintenance" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname === "/favicon.ico" ||
    pathname === "/brand-logo.png" ||
    pathname === "/manifest.json"
  ) {
    return true;
  }

  return false;
}

/**
 * Extracts decoded JWT payload from auth cookies.
 */
function extractPayloadFromCookies(cookies: { name: string; value: string }[]): any {
  try {
    const direct = cookies.find((c) => c.name === "sb-access-token");
    if (direct?.value) {
      const parts = direct.value.split(".");
      if (parts.length === 3) {
        return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
      }
    }

    const authCookies = cookies.filter(
      (c) => c.name.includes("-auth-token") && !c.name.includes("-code-verifier")
    );
    if (authCookies.length === 0) return null;

    let raw = "";
    if (authCookies.length === 1 && !authCookies[0].name.includes(".")) {
      raw = authCookies[0].value;
    } else {
      const sorted = [...authCookies].sort((a, b) => {
        const idxA = parseInt(a.name.split(".").pop() || "0", 10);
        const idxB = parseInt(b.name.split(".").pop() || "0", 10);
        return idxA - idxB;
      });
      raw = sorted.map((c) => c.value).join("");
    }

    if (!raw) return null;
    if (raw.startsWith("base64-")) {
      raw = Buffer.from(raw.slice(7), "base64url").toString("utf-8");
    }

    const parsed = JSON.parse(raw);
    const token = parsed?.access_token || parsed?.currentSession?.access_token;
    if (typeof token === "string") {
      const parts = token.split(".");
      if (parts.length === 3) {
        return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Checks whether the request carries a verified Super Admin claim.
 * Inspects both session cookies and the Authorization Bearer header.
 */
function isSuperAdminSession(
  cookies: { name: string; value: string }[],
  authHeader?: string | null
): boolean {
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    try {
      const token = authHeader.substring(7).trim();
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
        if (payload?.app_metadata?.is_platform_admin === true) {
          return true;
        }
      }
    } catch {
      // Non-blocking fallback
    }
  }

  const payload = extractPayloadFromCookies(cookies);
  return Boolean(payload?.app_metadata?.is_platform_admin === true);
}

/**
 * Checks whether an active Supabase session in cookies requires refresh.
 * Returns false if the session token is valid for more than 60 seconds,
 * eliminating redundant blocking network calls to Supabase Auth on normal navigations.
 */
function shouldRefreshToken(cookies: { name: string; value: string }[]): boolean {
  const payload = extractPayloadFromCookies(cookies);
  if (payload?.exp) {
    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now + 60;
  }
  return true;
}

/**
 * Next.js Middleware
 * Enforces security headers, handles session refresh, and enforces global maintenance mode lockdown.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const allCookies = request.cookies.getAll();

  // Fast path: Apply standard security headers
  const applyHeaders = (res: NextResponse) => {
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return res;
  };

  // ---------------------------------------------------------------------------
  // GLOBAL MAINTENANCE MODE ENFORCEMENT (Directive Requirement)
  // ---------------------------------------------------------------------------
  if (!isExemptFromMaintenance(pathname)) {
    const maintenance = await checkGlobalMaintenance();
    if (maintenance.enabled) {
      const isSuperAdmin = isSuperAdminSession(allCookies, request.headers.get("authorization"));

      // Non-Super Admins are strictly locked out of tenant interfaces and APIs
      if (!isSuperAdmin) {
        // Block tenant-facing APIs with HTTP 503 Service Unavailable
        if (pathname.startsWith("/api/")) {
          return new NextResponse(
            JSON.stringify({
              error: "SERVICE_UNAVAILABLE",
              message: "UrPlaced is temporarily unavailable due to scheduled platform maintenance.",
              announcement:
                maintenance.message ||
                "UrPlaced is performing scheduled maintenance. Services will resume shortly.",
              maintenance: true,
            }),
            {
              status: 503,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": "300",
                "X-Maintenance-Mode": "active",
                "X-Frame-Options": "DENY",
                "X-Content-Type-Options": "nosniff",
              },
            }
          );
        }

        // Rewrite tenant-facing page routes to the dedicated full-screen maintenance view
        if (pathname.startsWith("/dashboard")) {
          const maintenanceUrl = request.nextUrl.clone();
          maintenanceUrl.pathname = "/maintenance";
          const rewriteResponse = NextResponse.rewrite(maintenanceUrl);
          rewriteResponse.headers.set("X-Maintenance-Mode", "active");
          return applyHeaders(rewriteResponse);
        }
      }
    }
  }

  let response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });

  const authHeader = request.headers.get("authorization");
  const hasBearer = Boolean(authHeader && authHeader.toLowerCase().startsWith("bearer "));

  // Tab-isolated requests carrying Bearer tokens bypass cookie session refresh
  if (hasBearer) {
    return applyHeaders(response);
  }

  // Next.js App Router speculative background prefetch requests never perform remote blocking session refresh
  const isPrefetch =
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch";

  if (isPrefetch) {
    return applyHeaders(response);
  }

  // Check if Supabase auth session cookies actually exist
  const hasAuthCookies = allCookies.some(
    (c) =>
      (c.name.includes("-auth-token") && !c.name.includes("-code-verifier")) ||
      c.name === "sb-access-token"
  );

  if (!hasAuthCookies) {
    return applyHeaders(response);
  }

  // Refresh auth session only if the existing session is missing or near expiry
  if (shouldRefreshToken(allCookies)) {
    try {
      const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
      const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      });

      await supabase.auth.getUser();
    } catch {
      // Non-blocking session refresh
    }
  }

  return applyHeaders(response);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/auth/:path*",
    "/api/:path*",
  ],
};

