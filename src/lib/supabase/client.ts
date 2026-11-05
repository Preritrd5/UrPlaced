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
 * Uses @supabase/supabase-js createClient configured with tabSessionStorage,
 * unique per-tab storageKey, and broadcastTab: false.
 *
 * Strict Tab Isolation Guarantees:
 * 1. Each browser tab maintains its own independent authentication session.
 * 2. Tabs on the same origin NEVER leak or overwrite each other's credentials.
 * 3. Token auto-refresh is tab-scoped, eliminating refresh-token reuse race conditions.
 * 4. Sign-in, sign-out, or user updates in one tab DO NOT broadcast across tabs.
 * 5. Tab reloads (F5) preserve tab identity via window.sessionStorage.
 * 6. Closing the tab discards the tab session cleanly.
 */
export function createClient(): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  if (typeof window !== "undefined") {
    const win = window as any;
    const tabStorageKey = getTabStorageKey();

    if (!win.__urplaced_clients_by_tab__) {
      win.__urplaced_clients_by_tab__ = {};
    }

    if (win.__urplaced_clients_by_tab__[tabStorageKey]) {
      return win.__urplaced_clients_by_tab__[tabStorageKey];
    }

    const client = createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: tabSessionStorage,
        storageKey: tabStorageKey,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

    // Strictly disable cross-tab broadcast notifications so tabs remain completely isolated
    if ((client.auth as any).broadcastChannel) {
      try {
        (client.auth as any).broadcastChannel.close();
      } catch {
        // Fallback
      }
      (client.auth as any).broadcastChannel = null;
    }

    win.__urplaced_clients_by_tab__[tabStorageKey] = client;
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
