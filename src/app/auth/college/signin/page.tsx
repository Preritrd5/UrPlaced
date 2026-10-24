"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LogIn,
  Building2,
  Users,
  Briefcase,
  GraduationCap,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SplitAuthCard, type FeatureHighlight } from "@/components/auth/split-auth-card";
import { PasswordField } from "@/components/auth/password-field";

const collegeSignInFeatures: FeatureHighlight[] = [
  {
    icon: Users,
    tint: "cyan",
    title: "Student Directory & Eligibility Roster",
    description: "Manage verified student profiles, track batch academic performance, and filter drive eligibility.",
  },
  {
    icon: Briefcase,
    tint: "rose",
    title: "Recruitment Drive Pipelines",
    description: "Schedule on-campus and virtual hiring drives, coordinate interview rounds, and log job offers.",
  },
  {
    icon: GraduationCap,
    tint: "amber",
    title: "Assessments & Targeted Training",
    description: "Deploy mock exams, monitor student accuracy trends, and assign faculty coordinators.",
  },
  {
    icon: ShieldCheck,
    tint: "indigo",
    title: "Placement Memory & Institutional Analytics",
    description: "Retain institutional recruitment intelligence, historical packages, and placement audit reports.",
  },
];

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
                This sign-in portal is exclusively for <strong>Placement Cell</strong> staff and trainers. Your account is registered as a <strong>Student</strong>.
              </p>
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
      setErrorMsg("An unexpected error occurred during institutional sign-in. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <SplitAuthCard
      badgeText="• Institutional Cell Workspace"
      subtitle="INSTITUTIONAL PLACEMENT SUITE"
      headline="Placement Management, Connected"
      description="Coordinate recruitment drives, manage authorized student rosters, verify eligibility cutoffs, and access institutional placement intelligence."
      features={collegeSignInFeatures}
      footerLeft="UrPlaced Multi-Tenant V1.0"
      footerRight="College / Cell Portal"
    >
      <div className="space-y-6">
        {/* Form Header */}
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900 tracking-tight">
            Sign In to Your Placement Cell Workspace
          </h2>
          <p className="text-sm text-slate-500">
            Institutional access requires verified membership credentials.
          </p>
        </div>

        {/* URL Alerts */}
        {searchParams.get("registered") === "true" && (
          <Alert variant="success">
            <AlertTitle>Registration Successful</AlertTitle>
            <AlertDescription>
              Your College Placement Workspace has been Registered... Please sign in with your credentials...
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
            <Label htmlFor="email" required className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              Institutional Email Address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="e.g. head.placement@university.edu"
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
              placeholder="Enter institutional password"
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
            <LogIn className="h-4 w-4 mr-2" /> Sign In to Placement Cell
          </Button>
        </form>

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

export default function CollegeSignInPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-16 text-center text-xs text-text-muted font-mono">
          Loading institutional portal sign in...
        </div>
      }
    >
      <CollegeSignInContent />
    </React.Suspense>
  );
}
