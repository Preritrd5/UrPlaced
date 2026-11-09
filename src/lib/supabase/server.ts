import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { getSupabaseConfig } from "./config";

/**
 * Creates a server-side Supabase client for Server Components,
 * Server Actions, and Route Handlers.
 * In Next.js 15, cookies() and headers() are asynchronous.
 * Prioritizes the requesting tab's Authorization: Bearer <token> header,
 * with fallback to cookies for backwards compatibility.
 */
export async function createClient(explicitToken?: string) {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  let token = explicitToken;
  let authHeader: string | null = null;

  if (!token) {
    try {
      const headerStore = await headers();
      authHeader = headerStore.get("authorization");
      if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
        token = authHeader.substring(7).trim();
      }
    } catch {
      // Outside request context
    }
  } else {
    authHeader = `Bearer ${token}`;
  }

  // If a tab bearer token is present, bind client to that token for RLS and auth
  if (token && authHeader) {
    let cookieStore: any;
    try {
      cookieStore = await cookies();
    } catch {
      // Outside request context
    }

    const client = createServerClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      cookies: {
        getAll() {
          return cookieStore?.getAll?.() || [];
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore?.set?.({ name, value, ...options });
            });
          } catch {
            // Setting cookies in Server Components can fail safely
          }
        },
      },
    });

    // Ensure client.auth.getUser() with no parameters automatically uses the verified bearer token
    const originalGetUser = client.auth.getUser.bind(client.auth);
    client.auth.getUser = async (jwt?: string) => {
      return originalGetUser(jwt || token);
    };

    return client;
  }

  // Fallback to cookie-based client
  let cookieStore: any;
  try {
    cookieStore = await cookies();
  } catch {
    // Outside request context
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    cookies: {
      getAll() {
        return cookieStore?.getAll?.() || [];
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore?.set?.({ name, value, ...options });
          });
        } catch {
          // Setting cookies in Server Components can fail safely
        }
      },
    },
  });
}

export { createClient as createServerSupabaseClient };
