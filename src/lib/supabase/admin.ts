import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

let cachedAdminClient: SupabaseClient<any> | null = null;

/**
 * Server-only Admin Supabase Client.
 * Uses SUPABASE_SERVICE_ROLE_KEY to perform privileged administrative operations
 * (e.g. system bootstrapping, tenant provisioning, and server-side verification).
 *
 * CAUTION: This client bypasses RLS policies. It MUST NEVER be exposed to the browser
 * or used for ordinary user requests!
 */
export function createAdminClient() {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseConfig();

  if (!supabaseServiceRoleKey) {
    throw new Error(
      "[Supabase Admin Error] Missing SUPABASE_SERVICE_ROLE_KEY in .env. Service role operations unavailable."
    );
  }

  cachedAdminClient = createSupabaseClient<any>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storageKey: "urplaced-service-role-admin",
    },
  });

  return cachedAdminClient;
}

/**
 * Resets cached admin client (primarily for testing and environment refreshes).
 */
export function resetAdminClient() {
  cachedAdminClient = null;
}
