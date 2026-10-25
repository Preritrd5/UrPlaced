"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Users,
  ShieldCheck,
  Award,
  ArrowRight,
  ShieldAlert,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SplitAuthCard, type FeatureHighlight } from "@/components/auth/split-auth-card";
import { PasswordField } from "@/components/auth/password-field";

const collegeSignUpFeatures: FeatureHighlight[] = [
  {
    icon: Building2,
    tint: "rose",
    title: "Dedicated Institutional Tenant",
    description: "Complete data isolation, custom institutional identity, and strict boundary enforcement under PostgreSQL RLS.",
  },
  {
    icon: ShieldCheck,
    tint: "indigo",
    title: "Authorized Placement Head Account",
    description: "Provisions the verified institutional administrator role authorized to invite staff coordinators and trainers.",
  },
  {
    icon: Users,
    tint: "cyan",
    title: "Staff & Coordinator Governance",
    description: "Granular role-based permissions for placement officers, department liaisons, and faculty training specialists.",
  },
  {
    icon: Award,
    tint: "amber",
    title: "Comprehensive Analytics & Placement Memory",
    description: "Institutional recruitment intelligence, company conversion metrics, and placement audit reports.",
  },
];

function CollegeSignUpContent() {
  const router = useRouter();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [institutionName, setInstitutionName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    // Validation checks
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMsg("Please enter your full name (minimum 2 characters).");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid institutional email address.");
      return;
    }

    if (!institutionName.trim() || institutionName.trim().length < 3) {
      setErrorMsg("Please enter your full college or university name (min. 3 characters).");
      return;
    }

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please re-enter your password.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Call server-side signup API with fixed COLLEGE category and PLACEMENT_HEAD role
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: "PLACEMENT_HEAD",
          accountCategory: "COLLEGE",
          institutionName: institutionName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Failed to create institutional account. Please try again.");
        setIsLoading(false);
        return;
      }

      setSuccessMsg("College workspace initialized! Signing you in...");

      // 2. Automatically authenticate session in browser client
      const supabase = createClient();
      const { data: authData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (signInError || !authData.session) {
        router.push(`/auth/college/signin?registered=true&email=${encodeURIComponent(email)}`);
        return;
      }

      // 3. Redirect to College Placement Command Center
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred during institutional registration. Please try again.";
      setErrorMsg(msg);
      setIsLoading(false);
    }
  }

  return (
    <SplitAuthCard
      badgeText="• Institutional Placement Portal"
      subtitle="INSTITUTIONAL ONBOARDING"
      headline="Build Your Campus Placement Workspace"
      description="Establish an authorized, multi-tenant placement management workspace for your institution. Coordinate drives, staff coordinators, and student readiness."
      features={collegeSignUpFeatures}
      footerLeft="UrPlaced Enterprise Edition"
      footerRight="Institutional Onboarding"
    >
      <div className="space-y-4">
        {/* Form Header */}
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900 tracking-tight">
            Register Your Placement Cell
          </h2>
          <p className="text-sm text-slate-500">
            Provision a verified placement workspace for your college or university.
          </p>
        </div>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertTitle className="flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" /> Registration Failed
            </AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {successMsg && (
          <Alert variant="success">
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{successMsg}</AlertDescription>
          </Alert>
        )}

        {/* Sign Up Form */}
        <form onSubmit={handleSignUp} className="space-y-3.5">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName" required className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              Authorized Representative Full Name
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="e.g. Dr. Ramesh Kumar"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isLoading}
              className="bg-input border-border/80 rounded-xl h-11 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Institution Name */}
          <div className="space-y-1.5">
            <Label htmlFor="institutionName" required className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              College / University Name
            </Label>
            <Input
              id="institutionName"
              type="text"
              placeholder="e.g. National Institute of Technology, Bangalore"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              required
              disabled={isLoading}
              className="bg-input border-border/80 rounded-xl h-11 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <Label htmlFor="email" required className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              Institutional Email Address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="e.g. placement.head@nitb.ac.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="bg-input border-border/80 rounded-xl h-11 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Paired Password Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PasswordField
              id="password"
              label="Create Login Password"
              required
              autoComplete="new-password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />

            <PasswordField
              id="confirmPassword"
              label="Retype Login Password"
              required
              autoComplete="new-password"
              placeholder="Retype password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full h-12 rounded-xl text-sm font-bold shadow-md mt-2"
            isLoading={isLoading}
          >
            {isLoading ? (
              "Registering Placement Cell..."
            ) : (
              <>
                <Building2 className="h-4 w-4 mr-2" /> Register Placement Cell
              </>
            )}
          </Button>
        </form>

        {/* Secondary Sign In Action */}
        <div className="pt-2">
          <Link
            href="/auth/college/signin"
            className="w-full h-11 rounded-xl bg-[#FFF8EE] hover:bg-[#FFF2DE] border border-[#FDE6C8] text-slate-800 text-sm font-medium transition-all flex items-center justify-center gap-1 shadow-sm"
          >
            <span>Already registered your institution?</span>
            <span className="font-bold text-primary">Sign In &rarr;</span>
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

export default function CollegeSignUpPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-16 text-center text-xs text-text-muted font-mono">
          Loading institutional registration...
        </div>
      }
    >
      <CollegeSignUpContent />
    </React.Suspense>
  );
}
