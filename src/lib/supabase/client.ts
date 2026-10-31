import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
import { getTabStorageKey, tabSessionStorage } from "@/lib/auth/auth-tab";
import { setupTabFetchInterceptor } from "@/lib/auth/auth-fetch";

// Ensure fetch interceptor is installed in browser environment
if (typeof window !== "undefined") {
  setupTabFetchInterceptor();
}

/**
 * Creates or retrieves the browser-side Supabase client.
 * Uses @supabase/ssr createBrowserClient to guarantee cookie-based session
 * synchronization across Server Components, Route Handlers, Middleware,
 * and page navigations, while syncing with tabSessionStorage for multi-tab
 * bearer token awareness.
 */
export function createClient(): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  if (typeof window !== "undefined") {
    const win = window as any;
    if (win.__urplaced_supabase_client__) {
      return win.__urplaced_supabase_client__;
    }

    const client = createBrowserClient(supabaseUrl, supabaseAnonKey);

    // Sync session to tabSessionStorage so tab-scoped bearer interceptor remains populated
    try {
      const storageKey = getTabStorageKey();
      client.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          tabSessionStorage.setItem(storageKey, JSON.stringify(session));
        }
      });

      client.auth.onAuthStateChange((_event, session) => {
        if (session) {
          tabSessionStorage.setItem(storageKey, JSON.stringify(session));
        } else {
          tabSessionStorage.removeItem(storageKey);
        }
      });
    } catch {
      // Non-blocking sync
    }

    win.__urplaced_supabase_client__ = client;
    return client as unknown as SupabaseClient;
  }

  // Fallback for SSR / Node.js contexts where window is undefined
  return createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
