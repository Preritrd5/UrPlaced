"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Building2, GraduationCap, ArrowRight, AlertCircle, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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

        // Check authoritative context via /api/auth/context
        let authoritativeCategory = metaCategory;
        let authoritativeRole = metaRole;
        try {
          const ctxRes = await fetch("/api/auth/context");
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
          authoritativeCategory === "STUDENT" ||
          (metaRole === "STUDENT" && authoritativeCategory !== "COLLEGE");

        if (isStudentUser) {
          // Reject cross-category login attempt immediately
          await supabase.auth.signOut();
          setErrorMsg(
            <div className="space-y-2">
              <p>
                This sign-in portal is exclusively for <strong>College / Cell</strong> staff. Your account is registered as a <strong>Student</strong>.
              </p>
              <div className="pt-1">
                <Link
                  href={`/auth/signin?email=${encodeURIComponent(email)}`}
                  className="inline-flex items-center gap-1 font-semibold text-primary underline hover:text-[var(--color-primary-hover)]"
                >
                  Sign In to Student Portal <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
          setIsLoading(false);
          return;
        }

        // Legitimate College login: route according to internal college role
        let destination = next;
        if (!searchParams.get("next") || next.startsWith("/dashboard/student")) {
          if (authoritativeRole === "TRAINER") {
            destination = "/dashboard/training";
          } else {
            destination = "/dashboard";
          }
        }

        router.push(destination);
        router.refresh();
      }
    } catch {
      setErrorMsg("An unexpected error occurred during sign-in. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[rgba(46,143,134,0.12)] text-secondary text-xs font-semibold">
          <Building2 className="h-4 w-4" />
          <span>Placement Cell Portal</span>
        </div>
        <h2 className="text-2xl font-bold font-heading text-text-primary">
          Placement Cell Sign In
        </h2>
        <p className="text-xs text-text-secondary">
          Enter your institutional credentials to access your placement operations and student tracking workspace.
        </p>
      </div>

      {/* URL alerts */}
      {searchParams.get("registered") === "true" && (
        <Alert variant="success">
          <AlertTitle>Registration Successful</AlertTitle>
          <AlertDescription>
            Your college workspace has been initialized. Please sign in with your credentials.
          </AlertDescription>
        </Alert>
      )}

      {searchParams.get("error") === "verification_failed" && (
        <Alert variant="warning">
          <AlertTitle>Verification Notice</AlertTitle>
          <AlertDescription>
            The verification code was invalid or has expired. Please try signing in again.
          </AlertDescription>
        </Alert>
      )}

      {errorMsg && (
        <Alert variant="destructive">
          <AlertTitle className="flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" /> Access Restricted
          </AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={handleSignIn} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" required>
            Institutional Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="placement.officer@college.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" required>
              Password
            </Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          isLoading={isLoading}
        >
          <LogIn className="h-4 w-4 mr-2" /> Sign In to College Workspace
        </Button>
      </form>

      {/* Navigation & Portal Switching */}
      {/* <div className="pt-4 border-t border-border space-y-3 text-center">
        <p className="text-xs text-text-secondary">
          Need to register your institution?{" "}
          <Link
            href="/auth/college/signup"
            className="font-semibold text-primary hover:underline ml-1"
          >
            Register College / Cell
          </Link>
        </p>
      </div> */}

    </div>
  );
}

export default function CollegeSignInPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-8 text-center text-xs text-text-muted">
          Loading college sign in...
        </div>
      }
    >
      <CollegeSignInContent />
    </React.Suspense>
  );
}
