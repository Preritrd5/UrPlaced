"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Building,
  QrCode,
  Copy,
  Check,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

export default function SuperAdminLoginPage() {
  const router = useRouter();

  // Step 1: Credentials | Step 2: MFA Challenge/Enrollment
  const [step, setStep] = React.useState<"CREDENTIALS" | "MFA">("CREDENTIALS");

  // Form State
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [mfaCode, setMfaCode] = React.useState("");

  // MFA Challenge / Enrollment State
  const [mfaAction, setMfaAction] = React.useState<"CHALLENGE" | "ENROLL">("CHALLENGE");
  const [factorId, setFactorId] = React.useState<string | null>(null);
  const [challengeId, setChallengeId] = React.useState<string | null>(null);
  const [sessionToken, setSessionToken] = React.useState<string | null>(null);
  const [totpSecret, setTotpSecret] = React.useState<string | null>(null);
  const [qrCode, setQrCode] = React.useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = React.useState(false);

  // Session & Loading State
  const [userId, setUserId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [isVerified, setIsVerified] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  // If already authenticated with elevated AAL2 session, automatically redirect to dashboard
  React.useEffect(() => {
    let isMounted = true;
    async function checkExistingSession() {
      try {
        const res = await fetch("/api/preritrd/auth/session", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && isMounted) {
            window.location.replace("/preritrd/dashboard");
          }
        }
      } catch {
        // Not authenticated, stay on login page
      }
    }
    checkExistingSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Step 1: Credentials Submission
  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      // 1. Authenticate with Supabase Auth via browser client
      const supabase = createClient();
      const cleanEmail = email.trim().toLowerCase();
      // Password is used directly without trimming or transformation
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (authError || !authData?.user || !authData?.session) {
        setErrorMsg(
          authError?.message ||
            "Invalid email or password. Access is restricted to authorized platform personnel."
        );
        setLoading(false);
        return;
      }

      // 2. Authorize with server-side dual-layer check
      const res = await fetch("/api/preritrd/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authData.session.access_token}`,
        },
        body: JSON.stringify({
          email: cleanEmail,
          userId: authData.user.id,
          sessionToken: authData.session.access_token,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // Sign out client session if unauthorized
        await supabase.auth.signOut();
        setErrorMsg(data.error || "Authentication failed. Access is restricted to authorized platform personnel.");
        setLoading(false);
        return;
      }

      setUserId(data.userId);
      setFactorId(data.factorId);
      setChallengeId(data.challengeId);
      setSessionToken(data.sessionToken || authData.session.access_token);
      setMfaAction(data.mfaAction || "CHALLENGE");

      if (data.mfaAction === "ENROLL") {
        setTotpSecret(data.totpSecret || null);
        setQrCode(data.qrCode || null);
        setSuccessMsg("Primary credentials verified. First-time setup: enroll TOTP using your authenticator app.");
      } else {
        setSuccessMsg("Primary credentials verified. Enter the 6-digit TOTP code from your authenticator app.");
      }

      setStep("MFA");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error connecting to platform authentication server.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }

  // Handle MFA Reset / Re-enrollment
  async function handleResetMfa() {
    if (!userId || !sessionToken) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/preritrd/auth/mfa/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ userId, sessionToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Failed to reset MFA enrollment.");
      } else {
        setMfaAction("ENROLL");
        setFactorId(data.factorId);
        setChallengeId(data.challengeId);
        setTotpSecret(data.totpSecret || null);
        setQrCode(data.qrCode || null);
        setSuccessMsg("New TOTP factor generated. Scan the QR code below into your authenticator app.");
      }
    } catch {
      setErrorMsg("Network error resetting MFA enrollment.");
    } finally {
      setLoading(false);
    }
  }

  // Handle Step 2: MFA Verification
  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    const cleanCode = mfaCode.trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      setErrorMsg("Please enter a valid 6-digit numeric authenticator token.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/preritrd/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          factorId,
          challengeId,
          code: cleanCode,
          sessionToken,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Invalid MFA verification token. Please try again.");
        setLoading(false);
        return;
      }

      // Establish tab session with elevated AAL2 credentials
      if (data.sessionToken) {
        try {
          const supabase = createClient();
          await supabase.auth.setSession({
            access_token: data.sessionToken,
            refresh_token: data.refreshToken || "",
          });
        } catch {
          // Fallback to cookie
        }
      }

      setIsVerified(true);
      setLoading(false);
      setSuccessMsg("MFA verified with AAL2 elevation. Opening platform control plane...");
      
      // Perform clean document navigation to dashboard
      window.location.replace(data.redirectTo || "/preritrd/dashboard");
    } catch {
      setErrorMsg("Network error during MFA token verification.");
      setLoading(false);
    }
  }

  function handleCopySecret() {
    if (!totpSecret) return;
    navigator.clipboard.writeText(totpSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  }

  return (
    <div className="min-h-screen bg-[#EDECE7] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#5052C9] selection:text-white">
      {/* Platform Branding Header */}
      <div className="w-full max-w-md text-center mb-6 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#5052C9]/10 border border-[#5052C9]/25 text-[#5052C9] text-xs font-semibold font-mono uppercase tracking-wider">
          <ShieldCheck className="h-4 w-4" />
          <span>Platform Control Plane</span>
        </div>
        <h1 className="text-3xl font-extrabold font-heading text-[#24283A] tracking-tight">
          UrPlaced
        </h1>
        <p className="text-xs text-[#292D40]/80">
          Super Admin Gateway &bull; Multi-Tenant SaaS Infrastructure
        </p>
      </div>

      {/* Main Login Card */}
      <Card className="w-full max-w-md bg-[#F8F7F3] border-[#B8B6AC] shadow-md rounded-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#7779D8] to-[#5052C9]" />

        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Header Title */}
          <div className="space-y-1">
            <h2 className="text-xl font-bold font-heading text-[#24283A] flex items-center justify-between">
              <span>{step === "CREDENTIALS" ? "Sign In to Control Plane" : mfaAction === "ENROLL" ? "Enroll Authenticator (TOTP)" : "Two-Factor Verification"}</span>
              <Badge variant="outline" className="text-[10px] border-[#5052C9]/40 text-[#5052C9] bg-[#5052C9]/5 font-mono">
                {step === "CREDENTIALS" ? "Step 1 of 2" : "AAL2 Enforced"}
              </Badge>
            </h2>
            <p className="text-xs text-[#292D40]/75">
              {step === "CREDENTIALS"
                ? "Enter your platform administrator credentials to proceed."
                : mfaAction === "ENROLL"
                ? `Scan the QR code into your authenticator app to enroll ${email}.`
                : `Enter the 6-digit TOTP code associated with ${email}.`}
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900 py-3">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-xs font-bold font-heading">Authentication Refused</AlertTitle>
              <AlertDescription className="text-xs leading-relaxed">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert className="bg-emerald-50 border-emerald-200 text-emerald-900 py-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertTitle className="text-xs font-bold font-heading">Authorization Progress</AlertTitle>
              <AlertDescription className="text-xs leading-relaxed">{successMsg}</AlertDescription>
            </Alert>
          )}

          {/* Step 1 Form: Email & Password */}
          {step === "CREDENTIALS" ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#24283A] block">
                  Administrator Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-[#747683]" />
                  <Input
                    type="email"
                    required
                    placeholder="admin@urplaced.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 bg-[#FBFAF7] border-[#B8B6AC] text-xs h-10 focus:ring-2 focus:ring-[#5052C9]/30"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#24283A] block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-[#747683]" />
                  <Input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 bg-[#FBFAF7] border-[#B8B6AC] text-xs h-10 focus:ring-2 focus:ring-[#5052C9]/30"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-[11px] text-[#747683]">Super Admin Authority</span>
                <a
                  href="/auth/forgot-password"
                  className="text-[11px] text-[#5052C9] hover:underline font-medium"
                >
                  Forgot Password?
                </a>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-[#5052C9] hover:bg-[#4345B0] text-white font-medium text-xs h-10 mt-2 shadow-sm transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    Continue to MFA <ArrowRight className="h-4 w-4 ml-1.5" />
                  </>
                )}
              </Button>
            </form>
          ) : isVerified ? (
            <div className="py-8 text-center space-y-4">
              <div className="mx-auto h-12 w-12 rounded-full bg-[#2E8F86]/15 flex items-center justify-center text-[#2E8F86]">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading font-bold text-lg text-[#24283A]">
                  Assurance Level Elevated (AAL2)
                </h3>
                <p className="text-xs text-[#747683]">
                  Opening Platform Super Admin Dashboard...
                </p>
              </div>
              <div className="flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-[#5052C9]" />
              </div>
            </div>
          ) : (
            /* Step 2 Form: MFA Token Challenge or Enrollment */
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              {mfaAction === "ENROLL" && (
                <div className="p-3.5 bg-white border border-[#B8B6AC]/60 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#24283A]">
                    <QrCode className="h-4 w-4 text-[#5052C9]" />
                    <span>Authenticator App Enrollment</span>
                  </div>

                  {qrCode ? (
                    <div className="flex flex-col items-center justify-center p-2 bg-white rounded-lg border border-[#DDDCD5]">
                      <img
                        src={qrCode}
                        alt="TOTP Enrollment QR Code"
                        className="w-44 h-44 object-contain"
                      />
                      <span className="text-[10px] text-[#747683] mt-1 font-mono">
                        Scan with Google Authenticator or Authy
                      </span>
                    </div>
                  ) : null}

                  {totpSecret && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-[#747683] uppercase tracking-wider block">
                        Manual Entry Secret Code
                      </label>
                      <div className="flex items-center gap-1.5">
                        <code className="flex-1 bg-[#FBFAF7] border border-[#DDDCD5] px-2 py-1.5 rounded text-xs font-mono text-[#24283A] select-all break-all">
                          {totpSecret}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCopySecret}
                          className="h-8 px-2.5 text-xs border-[#B8B6AC]"
                        >
                          {copiedSecret ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#24283A] block">
                  6-Digit Verification Token
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-[#747683]" />
                  <Input
                    type="text"
                    required
                    autoFocus
                    maxLength={6}
                    placeholder="123456"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    className="pl-9 bg-[#FBFAF7] border-[#B8B6AC] text-base tracking-[0.3em] font-mono h-11 focus:ring-2 focus:ring-[#5052C9]/30 text-center font-bold"
                  />
                </div>
                <p className="text-[11px] text-[#747683] flex items-center gap-1">
                  <Smartphone className="h-3.5 w-3.5" />
                  Enter the current 6-digit code shown in your authenticator app.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("CREDENTIALS");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                    setMfaCode("");
                  }}
                  className="w-1/3 border-[#B8B6AC] text-xs h-10 text-[#24283A]"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading || mfaCode.trim().length !== 6}
                  className="w-2/3 bg-[#5052C9] hover:bg-[#4345B0] text-white font-medium text-xs h-10 shadow-sm transition-all"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify &amp; Enter <ShieldCheck className="h-4 w-4 ml-1.5" />
                    </>
                  )}
                </Button>
              </div>

              <div className="text-center pt-2 border-t border-[#DDDCD5]/60">
                <button
                  type="button"
                  onClick={handleResetMfa}
                  disabled={loading}
                  className="text-[11px] text-[#5052C9] hover:underline hover:text-[#4345B0] transition-colors"
                >
                  Need to scan QR code again or lost authenticator? Reset MFA
                </button>
              </div>
            </form>
          )}

          {/* Security Notice Footer */}
          <div className="pt-4 border-t border-[#B8B6AC]/30 text-center space-y-1 text-[11px] text-[#747683]">
            <p className="font-semibold text-[#24283A]">Strict Option A Security Enforced</p>
            <p>
              Platform Super Admin manages SaaS infrastructure only and cannot access private college student records or evaluation data.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
