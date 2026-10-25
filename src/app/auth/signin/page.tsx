"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LogIn,
  Clock,
  TrendingUp,
  Briefcase,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  GraduationCap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SplitAuthCard, type FeatureHighlight } from "@/components/auth/split-auth-card";
import { PasswordField } from "@/components/auth/password-field";

const studentSignInFeatures: FeatureHighlight[] = [
  {
    icon: Clock,
    tint: "rose",
    title: "Timed Full-Length Mock Exams",
    description: "Company-aligned test patterns, negative marking options, and real-time score tracking.",
  },
  {
    icon: TrendingUp,
    tint: "cyan",
    title: "Instant Accuracy & Mistake Analytics",
    description: "Structured error logging, cognitive classification, and spaced repetition schedules.",
  },
  {
    icon: Briefcase,
    tint: "amber",
    title: "Target Drive Recruitment Intelligence",
    description: "Past campus cutoffs, company-specific syllabus coverage, and candidate debriefs.",
  },
  {
    icon: ShieldCheck,
    tint: "indigo",
    title: "Verified Skill & Readiness Credentials",
    description: "Institutional readiness scores visible directly to verified campus placement coordinators.",
  },
];

function StudentSignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard/student";

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
        // Enforce Category Boundary: Verify that account is a STUDENT account
        const appMeta = data.user.app_metadata || {};
        const userMeta = data.user.user_metadata || {};
        const metaCategory = appMeta.account_category || userMeta.account_category;
        const metaRole = appMeta.role || userMeta.role;

        let authoritativeCategory = metaCategory;
        try {
          const ctxRes = await fetch("/api/auth/context");
          if (ctxRes.ok) {
            const ctx = await ctxRes.json();
            if (ctx.authenticated && ctx.accountCategory) {
              authoritativeCategory = ctx.accountCategory;
            }
          }
        } catch {
          // Context fallback
        }

        const isCollegeUser =
          authoritativeCategory === "COLLEGE" ||
          metaRole === "PLACEMENT_HEAD" ||
          metaRole === "PLACEMENT_STAFF" ||
          metaRole === "TRAINER";

        if (isCollegeUser) {
          // Reject cross-category login attempt immediately
          await supabase.auth.signOut();
          setErrorMsg(
            <div className="space-y-2">
              <p>
                This sign-in portal is exclusively for <strong>Students</strong>. Your account is registered under <strong>Placement Cell</strong>.
              </p>

            </div>
          );
          setIsLoading(false);
          return;
        }

        // Legitimate student login: destination strictly within student workspace
        const destination = next.startsWith("/dashboard/student") ? next : "/dashboard/student";
        router.push(destination);
        router.refresh();
      }
    } catch {
      setErrorMsg("An unexpected error occurred during sign-in. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <SplitAuthCard
      badgeText="• Student Member Sign In"
      subtitle="CAMPUS PLACEMENT PLATFORM"
      headline="Your Placement Preparation Starts Here"
      description="Access your real-time mock test roster across company patterns, review instant mistake remediation, and track your campus placement readiness."
      features={studentSignInFeatures}
      footerLeft="UrPlaced 2026 Academic Session"
      footerRight="Student Portal"
    >
      <div className="space-y-6">
        {/* Form Header */}
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900 tracking-tight">
            Student Sign In
          </h2>
          <p className="text-sm text-slate-500">
            Enter your registered email address &amp; password.
          </p>
        </div>

        {/* URL Alerts */}
        {searchParams.get("registered") === "true" && (
          <Alert variant="success">
            <AlertTitle>Registration Successful</AlertTitle>
            <AlertDescription>
              Your student account has been created. Please sign in with your credentials.
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

        {/* Sign In Form */}
        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" required className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              Registered Email Address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="e.g. student@university.edu or student@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="bg-input border-border/80 rounded-xl h-11 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1">
            <PasswordField
              id="password"
              label="Password"
              required
              autoComplete="current-password"
              placeholder="Enter account password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
            <div className="flex justify-end pt-0.5">
              <Link
                href="/auth/forgot-password"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full h-12 rounded-xl text-sm font-bold shadow-md mt-2"
            isLoading={isLoading}
          >
            {isLoading ? (
              "Signing in to Student Portal..."
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" /> Sign In to Student Portal
              </>
            )}
          </Button>
        </form>

        {/* Secondary Account Creation Action */}
        <div className="pt-2">
          <Link
            href="/auth/signup"
            className="w-full h-11 rounded-xl bg-[#FFF8EE] hover:bg-[#FFF2DE] border border-[#FDE6C8] text-slate-800 text-sm font-medium transition-all flex items-center justify-center gap-1 shadow-sm"
          >
            <span>New student?</span>
            <span className="font-bold text-primary">Create Account (Sign Up) &rarr;</span>
          </Link>
        </div>

        {/* Alternative Role Switcher & Back to Home */}
        <div className="pt-3 border-t border-slate-100 space-y-2 text-center">
          <div>
            <Link
              href="/"
              className="text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors inline-block pt-1"
            >
              &larr; Back to Home Page
            </Link>
          </div>
        </div>
      </div>
    </SplitAuthCard>
  );
}

export default function StudentSignInPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-16 text-center text-xs text-text-muted font-mono">
          Loading student portal sign in...
        </div>
      }
    >
      <StudentSignInContent />
    </React.Suspense>
  );
}
