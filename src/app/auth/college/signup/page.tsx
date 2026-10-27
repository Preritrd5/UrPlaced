"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, User, Mail, ShieldAlert, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthSplitLayout, UrPlacedBrandLogo } from "@/components/auth/auth-split-layout";
import { AuthInput, AuthPasswordInput } from "@/components/auth/auth-input";

export default function CollegeSignUpPage() {
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
          institution: institutionName.trim(),
          password,
          role: "PLACEMENT_HEAD",
          accountCategory: "COLLEGE",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Failed to create college account. Please try again.");
        setIsLoading(false);
        return;
      }

      setSuccessMsg("College workspace provisioned successfully! Signing in...");

      // 2. Automatically authenticate session in browser client
      const supabase = createClient();
      const { data: authData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (signInError || !authData.session) {
        if (signInError?.message?.toLowerCase().includes("email not confirmed")) {
          setSuccessMsg(
            "College account registered successfully! Please check your institutional email to confirm your address before signing in."
          );
          setIsLoading(false);
          return;
        }
        router.push(`/auth/college/signin?registered=true&email=${encodeURIComponent(email)}`);
        return;
      }

      // 3. Redirect to Placement Command Center
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during institutional registration. Please try again.";
      setErrorMsg(msg);
      setIsLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      headlineLines={["Partner With", "UrPlaced"]}
      supportingText="Empower your campus with verified student readiness metrics, AI mock drives, and comprehensive placement memory."
    >
      <div className="flex flex-col justify-center h-full min-h-0 space-y-3 sm:space-y-4">
        {/* Form Title & Subtitle */}
        <div className="shrink-0 space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-[2.2rem] font-extrabold font-heading text-[#24283A] tracking-tight leading-tight">
            Register Placement Cell
          </h1>
          <p className="text-xs sm:text-sm text-[#747683]">
            Provision an authorized institutional workspace for your college or university.
          </p>
        </div>

        {/* Compact Alert Notification */}
        {errorMsg && (
          <div
            role="alert"
            className="shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 text-xs sm:text-sm font-medium"
          >
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
            <span className="truncate">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-800 text-xs sm:text-sm font-medium"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" />
            <span className="truncate">{successMsg}</span>
          </div>
        )}

        {/* Sign Up Form */}
        <form onSubmit={handleSignUp} className="space-y-2.5 sm:space-y-3 min-h-0" suppressHydrationWarning>
          {/* College or University Name */}
          <AuthInput
            id="institutionName"
            label="College or University Name"
            placeholder="e.g. Bangalore Institute of Technology"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
            required
            disabled={isLoading}
            icon={Building2}
            helperText="Your institution name defines your isolated multi-tenant college placement workspace."
          />

          {/* Placement Officer Full Name */}
          <AuthInput
            id="fullName"
            label="Placement Officer Full Name"
            placeholder="e.g. Dr. Rajesh Kumar"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={isLoading}
            icon={User}
          />

          {/* Institutional Email Address */}
          <AuthInput
            id="email"
            type="email"
            label="Institutional Email Address"
            placeholder="e.g. placement.head@college.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="email"
            icon={Mail}
          />

          {/* Passwords in 2-column grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <AuthPasswordInput
              id="password"
              label="Create Login Password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="new-password"
            />
            <AuthPasswordInput
              id="confirmPassword"
              label="Retype Login Password"
              placeholder="Retype password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="new-password"
            />
          </div>

          {/* Primary CTA Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            suppressHydrationWarning
            className="w-full bg-[#5052C9] hover:bg-[#4345B0] active:bg-[#383A99] text-white font-semibold text-xs sm:text-sm rounded-xl h-11 sm:h-12 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5052C9]/50 mt-1"
          >
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            <span>
              {isLoading ? "Provisioning..." : "Register College Workspace (Sign Up)"}
            </span>
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="shrink-0 pt-1 text-center">
          <p className="text-xs sm:text-sm text-[#24283A]">
            Already have a college account?{" "}
            <Link
              href="/auth/college/signin"
              className="text-[#5052C9] font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5052C9]/50 rounded"
            >
              Sign In →
            </Link>
          </p>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
