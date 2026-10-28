import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";
import { getTabStorageKey, tabSessionStorage } from "@/lib/auth/auth-tab";
import { setupTabFetchInterceptor } from "@/lib/auth/auth-fetch";

// Ensure fetch interceptor is installed in browser environment
if (typeof window !== "undefined") {
  setupTabFetchInterceptor();
}

/**
 * Creates or retrieves the browser-side Supabase client for this specific tab.
 * Uses tab-isolated storage (window.sessionStorage with a tab-scoped key)
 * so that different tabs within the same browser profile maintain completely
 * isolated authenticated sessions without cross-tab token overwrites or broadcasts.
 */
export function createClient(): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  if (typeof window !== "undefined") {
    const win = window as any;
    if (win.__urplaced_supabase_client__) {
      return win.__urplaced_supabase_client__;
    }

    const storageKey = getTabStorageKey();
    const client = createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: tabSessionStorage,
        storageKey,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    });

    win.__urplaced_supabase_client__ = client;
    return client;
  }

  // Fallback for SSR / Node.js contexts where window is undefined
  return createSupabaseJsClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
