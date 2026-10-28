"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus, User, Mail, ShieldAlert, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AuthSplitLayout, UrPlacedBrandLogo } from "@/components/auth/auth-split-layout";
import { AuthInput, AuthPasswordInput } from "@/components/auth/auth-input";

export default function StudentSignUpPage() {
  const router = useRouter();

  const [srn, setSrn] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showCollegeSelect, setShowCollegeSelect] = React.useState(false);
  const [selectedCollegeId, setSelectedCollegeId] = React.useState("");
  const [colleges, setColleges] = React.useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const fetchColleges = React.useCallback(async () => {
    try {
      const res = await fetch("/api/auth/colleges");
      const data = await res.json();
      if (data.success && Array.isArray(data.colleges)) {
        setColleges(data.colleges);
      }
    } catch {
      // Fallback
    }
  }, []);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const collegeParam = params.get("college") || params.get("tenant") || params.get("institutionId");
      if (collegeParam) {
        setSelectedCollegeId(collegeParam);
        setShowCollegeSelect(true);
        fetchColleges();
      }
    }
  }, [fetchColleges]);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    // Validation checks
    const cleanSrn = srn.trim();
    if (!cleanSrn) {
      setErrorMsg("Please enter your Student Registration Number (SRN).");
      return;
    }

    if (showCollegeSelect && !selectedCollegeId) {
      setErrorMsg("Please select your college / institution to continue.");
      return;
    }

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMsg("Please enter your full name (minimum 2 characters).");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid student email address.");
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
      // 1. Call server-side signup API with SRN and fixed STUDENT category
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srn: cleanSrn,
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: "STUDENT",
          accountCategory: "STUDENT",
          ...(selectedCollegeId ? { institutionId: selectedCollegeId } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === "AMBIGUOUS_SRN" || data.requiresInstitutionSelection) {
          setShowCollegeSelect(true);
          fetchColleges();
        }
        setErrorMsg(data.error || "Failed to create student account. Please try again.");
        setIsLoading(false);
        return;
      }

      setSuccessMsg("Student account created and linked to campus roster! Signing in...");

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
            "Account registered successfully! Please check your email inbox to verify your address before signing in."
          );
          setIsLoading(false);
          return;
        }
        router.push(`/auth/signin?registered=true&email=${encodeURIComponent(email)}`);
        return;
      }

      // 3. Redirect to Student Workspace
      router.push("/dashboard/student");
      router.refresh();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during registration. Please try again.";
      setErrorMsg(msg);
      setIsLoading(false);
    }
  }

  return (
    <AuthSplitLayout
      headlineLines={["Your next", "chapter", "starts here."]}
      supportingText="Build skills, practice smarter, and get placement ready with UrPlaced."
    >
      <div className="flex flex-col justify-center h-full min-h-0 space-y-3 sm:space-y-4">
        {/* Form Title & Subtitle */}
        <div className="shrink-0 space-y-1.5">
          <h1 className="text-2xl sm:text-3xl lg:text-[2.2rem] font-extrabold font-heading text-[#24283A] tracking-tight leading-tight">
            Create Student Account
          </h1>
          <p className="text-xs sm:text-sm text-[#747683]">
            Enter your official SRN, name, email address, and create your portal password.
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
          {/* SRN */}
          <AuthInput
            id="srn"
            label="Student Registration Number (SRN)"
            placeholder="E.g. 1MS21CS001 or 00123"
            value={srn}
            onChange={(e) => setSrn(e.target.value)}
            required
            disabled={isLoading}
            autoCapitalize="characters"
            spellCheck={false}
            icon={User}
            helperText="Enter your official roll number or registration ID from your campus placement roster."
            className="font-mono uppercase"
          />

          {/* Conditional College Selection for Disambiguation */}
          {showCollegeSelect && (
            <div className="space-y-1">
              <label
                htmlFor="institutionId"
                className="block text-xs font-semibold text-[#24283A]"
              >
                Select Your Institution / College
              </label>
              <select
                id="institutionId"
                value={selectedCollegeId}
                onChange={(e) => setSelectedCollegeId(e.target.value)}
                disabled={isLoading}
                required
                className="w-full h-11 px-3.5 rounded-xl border border-[#DDDCD5] bg-[#FBFAF7] text-xs sm:text-sm text-[#24283A] focus:outline-none focus:border-[#5052C9] focus:ring-2 focus:ring-[#5052C9]/20 transition-all font-sans"
              >
                <option value="">-- Choose your college --</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[#747683]">
                Your registration number matches multiple institutions. Please specify your college.
              </p>
            </div>
          )}

          {/* Full Name */}
          <AuthInput
            id="fullName"
            label="Full Name"
            placeholder="e.g. Rahul Sharma"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={isLoading}
            icon={User}
          />

          {/* Email Address */}
          <AuthInput
            id="email"
            type="email"
            label="Email Address"
            placeholder="e.g. rahul.sharma@campus.edu"
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
            <UserPlus className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
            <span>
              {isLoading ? "Creating Account..." : "Create Student Account (Sign Up)"}
            </span>
          </button>
        </form>

        {/* Footer Navigation */}
        <div className="shrink-0 pt-1 text-center">
          <p className="text-xs sm:text-sm text-[#24283A]">
            Already have a student account?{" "}
            <Link
              href="/auth/signin"
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
