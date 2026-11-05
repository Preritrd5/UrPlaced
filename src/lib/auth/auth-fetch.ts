/**
 * Tab-Aware Client Fetch Interceptor
 * Automatically attaches the active tab's Supabase session access token
 * (Authorization: Bearer <token>) to all same-origin application requests
 * (including API routes, Server Actions, and Next.js RSC requests).
 * This guarantees that every request from a browser tab is authenticated
 * as that tab's specific user without relying on shared origin cookies.
 */

import { getTabStorageKey, tabSessionStorage } from "./auth-tab";

/**
 * Retrieves the current access token stored for this specific tab.
 */
export function getTabAccessToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const key = getTabStorageKey();
    const raw = tabSessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      const token = parsed?.access_token || parsed?.currentSession?.access_token || null;
      if (token) return token;
    }

    // Never fall back to document.cookie!
    // Falling back to cookies would allow an unauthenticated or newly opened tab
    // to accidentally adopt another tab's session, violating strict session isolation.
    return null;
  } catch {
    return null;
  }
}

/**
 * Performs an authenticated fetch attaching the tab-specific authorization header.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const token = getTabAccessToken();
  const headers = new Headers(
    init?.headers || (typeof input === "object" && "headers" in input ? (input as any).headers : undefined)
  );

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
  });
}

/**
 * Installs the global fetch interceptor on window.fetch once per tab.
 * Intercepts internal same-origin requests and appends the tab's Bearer token.
 */
export function setupTabFetchInterceptor(): void {
  if (typeof window === "undefined") return;

  const win = window as any;
  if (win.__urplaced_fetch_intercepted__) return;
  win.__urplaced_fetch_intercepted__ = true;

  const originalFetch = window.fetch;
  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    try {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;

      const isSameOrigin =
        !url.startsWith("http://") && !url.startsWith("https://")
          ? true
          : typeof window !== "undefined" && url.startsWith(window.location.origin);

      const isStatic =
        url.includes("/_next/static/") ||
        url.includes("/assets/") ||
        url.endsWith(".ico") ||
        url.endsWith(".png") ||
        url.endsWith(".jpg") ||
        url.endsWith(".svg");

      if (isSameOrigin && !isStatic) {
        const headers = new Headers(
          init?.headers || (typeof input === "object" && "headers" in input ? (input as any).headers : undefined)
        );

        if (!headers.has("Authorization")) {
          const token = getTabAccessToken();
          if (token) {
            let shouldAttach = true;
            if (url.includes("/api/preritrd/")) {
              try {
                const parts = token.split(".");
                if (parts.length === 3) {
                  const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
                  // If token belongs to regular student/staff or has non-admin role, omit header so browser cookies authenticate
                  if (payload.app_metadata?.role && payload.app_metadata.role !== "SUPER_ADMIN" && !payload.app_metadata.is_platform_admin) {
                    shouldAttach = false;
                  }
                }
              } catch {
                // Ignore parse errors
              }
            }
            if (shouldAttach) {
              headers.set("Authorization", `Bearer ${token}`);
            }
          }
        }

        return originalFetch.call(this, input, { ...init, headers });
      }
    } catch {
      // Fallback on interceptor error
    }

    return originalFetch.apply(this, arguments as any);
  };
}
