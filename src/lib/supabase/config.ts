/**
 * Supabase Environment Configuration
 * Safely resolves and validates Supabase credentials from the project's .env file.
 * NEVER prints or exposes secret keys.
 */

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;
  projectId?: string;
}

export function getSupabaseConfig(): SupabaseConfig {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "";

  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    "";

  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    undefined;

  const projectId =
    process.env.SUPABASE_PROJECT_ID ||
    process.env.VITE_SUPABASE_PROJECT_ID ||
    undefined;

  if (!supabaseUrl) {
    throw new Error(
      "[Supabase Config Error] Missing Supabase URL. Please define SUPABASE_URL in .env"
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "[Supabase Config Error] Missing Supabase Publishable/Anon Key. Please define SUPABASE_PUBLISHABLE_KEY in .env"
    );
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    projectId,
  };
}
