import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

/**
 * Creates a browser-side Supabase client for client components.
 * Uses the public publishable/anon key only.
 */
export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
