import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

/**
 * Server-only Admin Supabase Client.
 * Uses SUPABASE_SERVICE_ROLE_KEY to perform privileged administrative operations
 * (e.g. system bootstrapping, tenant provisioning, and server-side verification).
 *
 * CAUTION: This client bypasses RLS policies. It MUST NEVER be exposed to the browser
 * or used for ordinary user requests!
 */
export function createAdminClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getSupabaseConfig();

  if (!supabaseServiceRoleKey) {
    throw new Error(
      "[Supabase Admin Error] Missing SUPABASE_SERVICE_ROLE_KEY in .env. Service role operations unavailable."
    );
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
