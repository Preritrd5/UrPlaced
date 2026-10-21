import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "" });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  // Refresh auth session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 1. Protected routes guard (/dashboard, /admin)
  const isProtectedRoute =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  if (isProtectedRoute && !user) {
    const isStudentRoute = pathname.startsWith("/dashboard/student");
    const targetSignIn = isStudentRoute ? "/auth/signin" : "/auth/college/signin";
    const redirectUrl = new URL(targetSignIn, request.url);
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Auth routes guard (redirect already logged-in users away from auth pages)
  const isAuthRoute =
    pathname === "/auth/signin" ||
    pathname === "/auth/signup" ||
    pathname === "/auth/college/signin" ||
    pathname === "/auth/college/signup" ||
    pathname === "/auth/forgot-password";

  if (isAuthRoute && user) {
    const appMeta = user.app_metadata || {};
    const userMeta = user.user_metadata || {};
    const metaCategory = appMeta.account_category || userMeta.account_category;
    const metaRole = appMeta.role || userMeta.role;

    const isStudent = metaCategory === "STUDENT" || metaRole === "STUDENT";
    const isTrainer = metaRole === "TRAINER";

    const destination = isStudent
      ? "/dashboard/student"
      : isTrainer
      ? "/dashboard/training"
      : "/dashboard";

    return NextResponse.redirect(new URL(destination, request.url));
  }

  // Security Headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/auth/signin",
    "/auth/signup",
    "/auth/college/:path*",
    "/auth/forgot-password",
  ],
};
