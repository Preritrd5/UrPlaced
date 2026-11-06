"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  User,
  Mail,
  ShieldAlert,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Check,
  AlertCircle,
} from "lucide-react";
import { BrandLoader } from "@/components/common/brand-loader";
import { createClient } from "@/lib/supabase/client";
import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { AuthPasswordInput } from "@/components/auth/auth-input";
import { Button } from "@/components/ui/button";

interface InvitationData {
  collegeName: string;
  officialEmail: string;
  contactName: string;
}

function CollegeSignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  // Invitation Verification State
  const [verifying, setVerifying] = React.useState(true);
  const [invitationData, setInvitationData] = React.useState<InvitationData | null>(null);
  const [verificationError, setVerificationError] = React.useState<{
    error: string;
    message: string;
    collegeName?: string;
  } | null>(null);

  // Password Setup Form State (Only two editable fields)
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState<string | null>(null);

  // 1. Verify invitation token on mount
  React.useEffect(() => {
    if (!token || token.trim().length === 0) {
      setVerificationError({
        error: "INVITATION_REQUIRED",
        message:
          "An authorized institutional invitation is required to access college account setup. Public self-registration is disabled.",
      });
      setVerifying(false);
      return;
    }

    let isMounted = true;
    async function verifyToken() {
      setVerifying(true);
      setVerificationError(null);
      try {
        const res = await fetch(`/api/auth/college/invite/verify?token=${encodeURIComponent(token.trim())}`);
        const data = await res.json();

        if (!isMounted) return;

        if (!res.ok || !data.valid) {
          setVerificationError({
            error: data.error || "INVALID_INVITATION",
            message: data.message || "This invitation link is invalid or has expired.",
            collegeName: data.collegeName,
          });
        } else {
          setInvitationData({
            collegeName: data.collegeName,
            officialEmail: data.officialEmail,
            contactName: data.contactName,
          });
        }
      } catch {
        if (isMounted) {
          setVerificationError({
            error: "NETWORK_ERROR",
            message: "Unable to verify institutional invitation. Please check your connection and try again.",
          });
        }
      } finally {
        if (isMounted) {
          setVerifying(false);
        }
      }
    }

    verifyToken();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // 2. Handle Password Setup Submission
  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match. Please re-enter your password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/college/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setSubmitError(data.error || "Failed to complete account setup. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setSubmitSuccess("Account setup completed successfully! Signing you in...");

      // Automatically sign in with the new credentials
      const supabase = createClient();
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email: invitationData?.officialEmail || data.email,
        password,
      });

      if (signInError || !authData.session) {
        // Redirect to College Sign In with confirmation message
        router.push(
          `/auth/college/signin?setup=completed&email=${encodeURIComponent(
            invitationData?.officialEmail || data.email
          )}`
        );
        return;
      }

      // Redirect to College Dashboard
      window.location.replace("/dashboard");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "An unexpected network error occurred. Please try again.";
      setSubmitError(msg);
      setIsSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout
      headlineLines={["Partner With", "UrPlaced"]}
      supportingText="Empower your campus with verified student readiness metrics, automated placement gating, and multi-round drive management."
    >
      <div className="flex flex-col justify-center h-full min-h-0 space-y-3 sm:space-y-4">
        {/* Loading Verification State */}
        {verifying && (
          <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
            <BrandLoader size="card" className="mx-auto" />
            <h2 className="text-base font-bold font-heading text-[#24283A]">
              Verifying Institutional Invitation...
            </h2>
            <p className="text-xs text-[#747683]">
              Validating single-use cryptographic security token.
            </p>
          </div>
        )}

        {/* Invalid or Missing Invitation State */}
        {!verifying && verificationError && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-[11px] font-semibold font-mono">
                <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                Invitation Restricted
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[#24283A] tracking-tight leading-tight">
                {verificationError.error === "INVITATION_ALREADY_CONSUMED"
                  ? "Invitation Already Used"
                  : verificationError.error === "INVITATION_EXPIRED"
                  ? "Invitation Expired"
                  : verificationError.error === "INVITATION_REVOKED"
                  ? "Invitation Revoked"
                  : "Institutional Invitation Required"}
              </h1>
              <p className="text-xs sm:text-sm text-[#747683] leading-relaxed">
                {verificationError.message}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#FBFAF7] border border-[#DDDCD5] text-xs text-[#24283A] space-y-2">
              <div className="font-semibold flex items-center gap-1.5 text-[#24283A]">
                <AlertCircle className="h-4 w-4 text-[#5052C9]" />
                UrPlaced Institutional Security Policy
              </div>
              <p className="text-[#747683] text-[11px] leading-relaxed">
                Only colleges registered by the Platform Super Admin can provision College Placement Cell accounts. Self-service registration is strictly disabled. If you are a College Placement Head, please contact your administrator or platform support to obtain a fresh invitation.
              </p>
            </div>

            <div className="pt-2">
              <Button asChild className="w-full bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs sm:text-sm h-11 rounded-xl">
                <Link href="/auth/college/signin">
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Return to College Sign In
                </Link>
              </Button>
            </div>
          </div>
        )}

        {/* Valid Invitation: 2-Field Password Setup Form */}
        {!verifying && invitationData && (
          <div className="space-y-3 sm:space-y-4">
            {/* Header with Verified Badge */}
            <div className="shrink-0 space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-semibold font-mono">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Invitation Verified
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[#24283A] tracking-tight leading-tight">
                Complete Your College Account Setup
              </h1>
              <p className="text-xs sm:text-sm text-[#747683]">
                Create a login password to activate institutional administration access for your college.
              </p>
            </div>

            {/* Error Notification */}
            {submitError && (
              <div
                role="alert"
                className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 text-xs sm:text-sm font-medium"
              >
                <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Success Notification */}
            {submitSuccess && (
              <div
                role="status"
                className="shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-xs sm:text-sm font-medium"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{submitSuccess}</span>
              </div>
            )}

            {/* Read-Only Prefilled Institutional Confirmation Details */}
            <div className="rounded-xl bg-[#FBFAF7] border border-[#DDDCD5] p-3 space-y-2 text-xs">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#747683] font-bold">
                Registered Institutional Information (Read-Only)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-white border border-[#DDDCD5]/60">
                  <div className="text-[10px] text-[#747683] flex items-center gap-1">
                    <Building2 className="h-3 w-3 text-[#5052C9]" /> College / University
                  </div>
                  <div className="font-semibold text-[#24283A] truncate mt-0.5">
                    {invitationData.collegeName}
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-white border border-[#DDDCD5]/60">
                  <div className="text-[10px] text-[#747683] flex items-center gap-1">
                    <User className="h-3 w-3 text-[#2E8F86]" /> Placement Head
                  </div>
                  <div className="font-semibold text-[#24283A] truncate mt-0.5">
                    {invitationData.contactName}
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-white border border-[#DDDCD5]/60">
                <div className="text-[10px] text-[#747683] flex items-center gap-1">
                  <Mail className="h-3 w-3 text-[#5052C9]" /> Authorized Institutional Email
                </div>
                <div className="font-mono font-semibold text-[#24283A] truncate mt-0.5">
                  {invitationData.officialEmail}
                </div>
              </div>
            </div>

            {/* ONLY TWO EDITABLE FIELDS: Password and Confirm Password */}
            <form onSubmit={handleSetup} className="space-y-3 min-h-0" suppressHydrationWarning>
              <div className="space-y-2.5">
                <div>
                  <AuthPasswordInput
                    id="password"
                    label="Create Login Password *"
                    placeholder="Minimum 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isSubmitting}
                    autoComplete="new-password"
                  />
                  <p className="text-[11px] text-[#747683] mt-1">
                    Use at least 8 characters with letters, numbers, and symbols.
                  </p>
                </div>

                <AuthPasswordInput
                  id="confirmPassword"
                  label="Confirm Login Password *"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  autoComplete="new-password"
                />
              </div>

              {/* Primary CTA Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                suppressHydrationWarning
                className="w-full bg-[#5052C9] hover:bg-[#4345B0] active:bg-[#383A99] text-white font-semibold text-xs sm:text-sm rounded-xl h-11 sm:h-12 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5052C9]/50 mt-1 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <BrandLoader size="button" className="mr-2" />
                    <span>Activating Institutional Account...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Complete Account Setup</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer Navigation */}
            <div className="shrink-0 pt-1 text-center">
              <p className="text-xs text-[#24283A]">
                Already completed account setup?{" "}
                <Link
                  href="/auth/college/signin"
                  className="text-[#5052C9] font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5052C9]/50 rounded"
                >
                  Sign In →
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>
    </AuthSplitLayout>
  );
}

export default function CollegeSignUpPage() {
  return (
    <React.Suspense
      fallback={
        <div className="h-[100dvh] w-full bg-[#EDECE7] flex items-center justify-center">
          <BrandLoader size="page" aria-label="Loading institutional account setup..." />
        </div>
      }
    >
      <CollegeSignUpContent />
    </React.Suspense>
  );
}
