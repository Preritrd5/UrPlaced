"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Mail, ArrowLeft, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthSplitLayout, UrPlacedBrandLogo } from "@/components/auth/auth-split-layout";
import { AuthInput, AuthPasswordInput } from "@/components/auth/auth-input";

function CollegeSignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = React.useState(searchParams.get("email") || "");
  const [password, setPassword] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<React.ReactNode | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        setErrorMsg("Invalid email or password. Please verify your credentials.");
        setIsLoading(false);
        return;
      }

      if (data.session && data.user) {
        // Enforce Category Boundary: Verify that account is a COLLEGE account
        const appMeta = data.user.app_metadata || {};
        const userMeta = data.user.user_metadata || {};
        const metaCategory = appMeta.account_category || userMeta.account_category;
        const metaRole = appMeta.role || userMeta.role;

        let authoritativeCategory = metaCategory;
        let authoritativeRole = metaRole;
        try {
          const ctxRes = await fetch("/api/auth/context", {
            headers: { Authorization: `Bearer ${data.session.access_token}` },
          });
          if (ctxRes.ok) {
            const ctx = await ctxRes.json();
            if (ctx.authenticated) {
              if (ctx.accountCategory) authoritativeCategory = ctx.accountCategory;
              if (ctx.role) authoritativeRole = ctx.role;
            }
          }
        } catch {
          // Context fallback
        }

        const isStudentUser =
          authoritativeCategory === "STUDENT" &&
          authoritativeRole !== "PLACEMENT_HEAD" &&
          authoritativeRole !== "PLACEMENT_STAFF" &&
          authoritativeRole !== "TRAINER";

        if (isStudentUser) {
          await supabase.auth.signOut();
          setErrorMsg(
            <span>
              This account is registered as a Student account. Please use the{" "}
              <Link href="/auth/signin" className="font-bold underline text-primary">
                Student Sign In portal
              </Link>
              .
            </span>
          );
          setIsLoading(false);
          return;
        }

        // Redirect based on role
        if (authoritativeRole === "TRAINER") {
          router.push("/dashboard/training");
        } else {
          router.push(next);
        }
        router.refresh();
      }
    } catch {
      setErrorMsg("An unexpected connection error occurred. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      headlineLines={["Placement", "Cell Portal"]}
      supportingText="Coordinate recruitment drives, monitor batch readiness, and manage institutional placement records."
    >
      <div className="flex flex-col justify-center h-full min-h-0 space-y-4 sm:space-y-6">
        {/* Form Title & Subtitle */}
        <div className="shrink-0 space-y-2">
          <h1 className="text-2xl sm:text-3xl lg:text-[2.2rem] font-extrabold font-heading text-[#24283A] tracking-tight leading-tight">
            Placement Cell Sign In
          </h1>
          <p className="text-xs sm:text-sm text-[#747683]">
            Enter your authorized institutional email address &amp; password.
          </p>
        </div>

        {/* Compact Alert Notification */}
        {errorMsg && (
          <div
            role="alert"
            className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 text-xs sm:text-sm font-medium"
          >
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
            <div className="text-xs sm:text-sm">{errorMsg}</div>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSignIn} className="space-y-3.5 sm:space-y-4 min-h-0" suppressHydrationWarning>
          {/* Institutional Email */}
          <AuthInput
            id="email"
            type="email"
            label="Institutional Email Address"
            placeholder="e.g. placement.head@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="email"
            icon={Mail}
          />

          {/* Password with inline Forgot Password Link */}
          <div>
            <AuthPasswordInput
              id="password"
              label="Password"
              placeholder="Enter account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
            <div className="text-right pt-1.5">
              <Link
                href="/auth/forgot-password"
                className="text-xs sm:text-sm font-semibold text-[#5052C9] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5052C9]/50 rounded"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {/* Primary CTA Sign In Button */}
          <button
            type="submit"
            disabled={isLoading}
            suppressHydrationWarning
            className="w-full bg-[#5052C9] hover:bg-[#4345B0] active:bg-[#383A99] text-white font-semibold text-xs sm:text-sm rounded-xl h-11 sm:h-12 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5052C9]/50 mt-2"
          >
            <LogIn className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            <span>{isLoading ? "Signing In..." : "Sign In to Placement Portal"}</span>
          </button>

          {/* Secondary CTA: Create Institutional Account Card Button */}
          <Link
            href="/auth/college/signup"
            className="w-full bg-[#FFF9F2] hover:bg-[#FFF2E2] border border-[#FDECD4] text-[#24283A] text-xs sm:text-sm font-medium rounded-xl h-11 sm:h-12 flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5052C9]/50 shadow-sm"
          >
            <span>New institution?</span>
            <span className="text-[#5052C9] font-bold ml-1.5">Register Placement Cell (Sign Up) →</span>
          </Link>
        </form>
      </div>
    </AuthSplitLayout>
  );
}

export default function CollegeSignInPage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-[100dvh] w-full bg-[#EDECE7] flex items-center justify-center text-xs text-[#292D40]/60">
          Loading placement portal sign in...
        </div>
      }
    >
      <CollegeSignInContent />
    </React.Suspense>
  );
}
