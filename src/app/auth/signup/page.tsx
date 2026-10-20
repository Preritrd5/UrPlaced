"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  UserPlus,
  GraduationCap,
  Building2,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type SupportedAccountRole = "STUDENT" | "PLACEMENT_HEAD";

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");

  // Only allow STUDENT or PLACEMENT_HEAD. Any unsupported query param (e.g. recruiter) defaults safely to STUDENT.
  const [role, setRole] = React.useState<SupportedAccountRole>(
    roleParam === "college" ? "PLACEMENT_HEAD" : "STUDENT"
  );

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
    if (!fullName.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
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
      // 1. Call server-side signup API
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
          institutionName: institutionName.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Failed to create account. Please try again.");
        setIsLoading(false);
        return;
      }

      setSuccessMsg("Account created! Signing you in...");

      // 2. Automatically authenticate session in browser client
      const supabase = createClient();
      const { data: authData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (signInError || !authData.session) {
        // If automatic sign-in couldn't create session, redirect to signin page with notice
        router.push(`/auth/signin?registered=true&email=${encodeURIComponent(email)}`);
        return;
      }

      // 3. Redirect to appropriate destination
      const destination =
        data.nextUrl || (role === "STUDENT" ? "/dashboard/student/assessments" : "/dashboard");
      router.push(destination);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(
        err?.message || "An unexpected error occurred during registration. Please try again."
      );
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1.5 text-center">
        <h2 className="text-2xl font-bold font-heading text-text-primary">
          Create Your UrPlaced Account
        </h2>
        <p className="text-xs text-text-secondary max-w-sm mx-auto leading-relaxed">
          Select your account type to register for placement preparation or institutional cell management.
        </p>
      </div>

      {/* Account Type Selector (Strictly Two Supported Roles: Student & College) */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-text-secondary">Register As:</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole("STUDENT")}
            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary ${
              role === "STUDENT"
                ? "border-primary bg-[var(--color-primary-subtle)] text-text-primary shadow-sm ring-1 ring-primary"
                : "border-border bg-input hover:border-border-strong text-text-secondary"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                  role === "STUDENT"
                    ? "bg-primary text-white"
                    : "bg-surface text-text-secondary"
                }`}
              >
                <GraduationCap className="h-4 w-4" />
              </div>
              <span className="font-bold text-sm font-heading">Student</span>
            </div>
            <p className="text-[11px] text-text-secondary mt-1 leading-tight">
              Personal placement preparation, assessments, and mistake mastery.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setRole("PLACEMENT_HEAD")}
            className={`p-3.5 rounded-xl border text-left transition-all flex flex-col gap-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary ${
              role === "PLACEMENT_HEAD"
                ? "border-primary bg-[var(--color-primary-subtle)] text-text-primary shadow-sm ring-1 ring-primary"
                : "border-border bg-input hover:border-border-strong text-text-secondary"
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                  role === "PLACEMENT_HEAD"
                    ? "bg-primary text-white"
                    : "bg-surface text-text-secondary"
                }`}
              >
                <Building2 className="h-4 w-4" />
              </div>
              <span className="font-bold text-sm font-heading">College / Cell</span>
            </div>
            <p className="text-[11px] text-text-secondary mt-1 leading-tight">
              Manage student roster, recruitment drives, and placement memory.
            </p>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Registration Notice</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4 text-secondary" />
          <AlertTitle>Account Created</AlertTitle>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSignUp} className="space-y-3.5">
        <div className="space-y-1">
          <Label htmlFor="fullName" required>
            Full Name
          </Label>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            placeholder={role === "STUDENT" ? "Ananya Sharma" : "Dr. Rajesh Kumar"}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="email" required>
            {role === "STUDENT" ? "Student Email (Campus or Personal)" : "College / Institutional Email"}
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={
              role === "STUDENT"
                ? "student@campus.edu"
                : "placement.head@engineering.edu"
            }
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="institutionName">
            College / University Name {role === "PLACEMENT_HEAD" && <span className="text-primary">*</span>}
          </Label>
          <Input
            id="institutionName"
            type="text"
            placeholder="Institute of Technology &amp; Science"
            value={institutionName}
            onChange={(e) => setInstitutionName(e.target.value)}
            required={role === "PLACEMENT_HEAD"}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="password" required>
            Password (min. 8 characters)
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="confirmPassword" required>
            Confirm Password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-4 h-11 text-sm font-semibold bg-primary hover:bg-[var(--color-primary-hover)] text-white shadow-sm"
          isLoading={isLoading}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          {role === "STUDENT" ? "Create Student Account" : "Register Placement Cell"}
        </Button>
      </form>

      {/* Switch to Sign In */}
      <div className="pt-4 border-t border-border text-center">
        <p className="text-xs text-text-secondary">
          Already have an account?{" "}
          <Link
            href="/auth/signin"
            className="font-semibold text-primary hover:underline inline-flex items-center gap-0.5 ml-1"
          >
            <span>Sign In</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-12 text-center text-xs text-text-muted">
          Loading registration portal...
        </div>
      }
    >
      <SignUpContent />
    </React.Suspense>
  );
}
