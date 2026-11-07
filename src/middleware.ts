import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

/**
 * Checks whether an active Supabase session in cookies requires refresh.
 * Returns false if the session token is valid for more than 60 seconds,
 * eliminating redundant blocking network calls to Supabase Auth on normal navigations.
 */
function shouldRefreshToken(cookies: { name: string; value: string }[]): boolean {
  try {
    const direct = cookies.find((c) => c.name === "sb-access-token");
    if (direct?.value) {
      const parts = direct.value.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
        if (payload?.exp) {
          const now = Math.floor(Date.now() / 1000);
          return payload.exp <= now + 60;
        }
      }
    }

    const authCookies = cookies.filter(
      (c) => c.name.includes("-auth-token") && !c.name.includes("-code-verifier")
    );
    if (authCookies.length === 0) return false;

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

    if (!raw) return true;
    if (raw.startsWith("base64-")) {
      raw = Buffer.from(raw.slice(7), "base64url").toString("utf-8");
    }

    const parsed = JSON.parse(raw);
    const expiresAt = parsed?.expires_at || parsed?.currentSession?.expires_at;
    if (typeof expiresAt === "number") {
      const now = Math.floor(Date.now() / 1000);
      return expiresAt <= now + 60;
    }

    const token = parsed?.access_token || parsed?.currentSession?.access_token;
    if (typeof token === "string") {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
        if (payload?.exp) {
          const now = Math.floor(Date.now() / 1000);
          return payload.exp <= now + 60;
        }
      }
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Next.js Middleware
 * Enforces security headers and handles session refresh.
 * Tab-isolated authentication allows multi-tab sessions without cross-tab collisions.
 * Eager cookie-based redirects are avoided so each browser tab can independently
 * authenticate and manage its own session lifecycle in tab-scoped storage.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: new Headers(request.headers),
    },
  });

  // Fast path: Apply standard security headers
  const applyHeaders = (res: NextResponse) => {
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return res;
  };

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
  const allCookies = request.cookies.getAll();
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
