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
  CheckCircle2,
  QrCode,
  Copy,
  Check,
  Smartphone,
} from "lucide-react";
import { BrandLoader } from "@/components/common/brand-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { UrPlacedLogo } from "@/components/ui/urplaced-logo";
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
      const supabase = createClient();
      const cleanEmail = email.trim().toLowerCase();
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

      setUserId(authData.user.id);
      setSessionToken(authData.session.access_token);

      const res = await fetch("/api/preritrd/auth/mfa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authData.user.id,
          sessionToken: authData.session.access_token,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "MFA validation sequence failed.");
        setLoading(false);
        return;
      }

      setMfaAction(data.action);
      setFactorId(data.factorId);
      setChallengeId(data.challengeId);
      if (data.totpSecret) setTotpSecret(data.totpSecret);
      if (data.qrCode) setQrCode(data.qrCode);

      setStep("MFA");
      setLoading(false);
    } catch {
      setErrorMsg("Network error connecting to platform authentication service.");
      setLoading(false);
    }
  }

  // Handle MFA Reset
  async function handleResetMfa() {
    if (!userId || !sessionToken) {
      setErrorMsg("Please enter your credentials first to reset your authenticator.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/preritrd/auth/mfa/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, sessionToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Failed to reset MFA enrollment.");
      } else {
        setMfaAction("ENROLL");
        setFactorId(data.factorId);
        setChallengeId(data.challengeId);
        setTotpSecret(data.totpSecret);
        setQrCode(data.qrCode);
        setSuccessMsg("Previous authenticator reset. Please scan the new QR code below.");
      }
    } catch {
      setErrorMsg("Network error resetting MFA enrollment.");
    } finally {
      setLoading(false);
    }
  }

  // Handle Step 2: MFA Code Verification
  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = mfaCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setErrorMsg("Please enter the complete 6-digit TOTP verification code.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

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
    <div className="min-h-screen bg-background text-text-primary flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-primary selection:text-white">
      {/* Platform Branding Header */}
      <div className="w-full max-w-md text-center mb-6 space-y-2">
        <div className="flex justify-center mb-2">
          <UrPlacedLogo size="lg" className="h-12 w-12" />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-semibold font-mono uppercase tracking-wider">
          <ShieldCheck className="h-4 w-4" />
          <span>Platform Control Plane</span>
        </div>
        <h1 className="text-3xl font-extrabold font-heading text-text-primary tracking-tight">
          UrPlaced
        </h1>
        <p className="text-xs text-text-secondary">
          Super Admin Gateway &bull; Multi-Tenant SaaS Infrastructure
        </p>
      </div>

      {/* Main Login Card */}
      <Card className="w-full max-w-md bg-card border-border shadow-md rounded-2xl overflow-hidden">
        <div className="h-1.5 bg-primary-gradient" />

        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Header Title */}
          <div className="space-y-1">
            <h2 className="text-xl font-bold font-heading text-text-primary flex items-center justify-between">
              <span>{step === "CREDENTIALS" ? "Sign In to Control Plane" : mfaAction === "ENROLL" ? "Enroll Authenticator (TOTP)" : "Two-Factor Verification"}</span>
              <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/5 font-mono">
                {step === "CREDENTIALS" ? "Step 1 of 2" : "AAL2 Enforced"}
              </Badge>
            </h2>
            <p className="text-xs text-text-secondary">
              {step === "CREDENTIALS"
                ? "Enter your platform administrator credentials to proceed."
                : mfaAction === "ENROLL"
                  ? `Scan the QR code into your authenticator app to enroll ${email}.`
                  : `Enter the 6-digit TOTP code associated with ${email}.`}
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <Alert variant="destructive" className="bg-status-danger-subtle border-status-danger/30 text-status-danger py-3 rounded-xl">
              <AlertCircle className="h-4 w-4 text-status-danger" />
              <AlertTitle className="text-xs font-bold font-heading">Authentication Refused</AlertTitle>
              <AlertDescription className="text-xs leading-relaxed">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {successMsg && (
            <Alert className="bg-secondary/10 border-secondary/30 text-secondary py-3 rounded-xl">
              <CheckCircle2 className="h-4 w-4 text-secondary" />
              <AlertTitle className="text-xs font-bold font-heading">Authorization Progress</AlertTitle>
              <AlertDescription className="text-xs leading-relaxed">{successMsg}</AlertDescription>
            </Alert>
          )}

          {/* Step 1 Form: Email & Password */}
          {step === "CREDENTIALS" ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary block">
                  Administrator Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-text-secondary" />
                  <Input
                    type="email"
                    required
                    placeholder="admin@urplaced.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 bg-input border-border text-xs h-10 rounded-xl focus:ring-2 focus:ring-primary/25 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-text-secondary" />
                  <Input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 bg-input border-border text-xs h-10 rounded-xl focus:ring-2 focus:ring-primary/25"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-xs">
                <a
                  href="/auth/forgot-password"
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Forgot Password?
                </a>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-[var(--color-primary-hover)] text-white font-medium text-xs h-10 mt-2 rounded-xl shadow-xs transition-all"
              >
                {loading ? (
                  <>
                    <BrandLoader size="button" className="mr-2" />
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
              <div className="mx-auto h-12 w-12 rounded-full bg-secondary/15 flex items-center justify-center text-secondary">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading font-bold text-lg text-text-primary">
                  Assurance Level Elevated (AAL2)
                </h3>
                <p className="text-xs text-text-secondary">
                  Opening Platform Super Admin Dashboard...
                </p>
              </div>
              <div className="flex justify-center">
                <BrandLoader size="inline" className="mx-auto" />
              </div>
            </div>
          ) : (
            /* Step 2 Form: MFA Token Challenge or Enrollment */
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              {mfaAction === "ENROLL" && (
                <div className="p-3.5 bg-surface border border-border rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                    <QrCode className="h-4 w-4 text-primary" />
                    <span>Authenticator App Enrollment</span>
                  </div>

                  {qrCode ? (
                    <div className="flex flex-col items-center justify-center p-2 bg-card rounded-lg border border-border">
                      <img
                        src={qrCode}
                        alt="TOTP Enrollment QR Code"
                        className="w-44 h-44 object-contain"
                      />
                      <span className="text-[10px] text-text-secondary mt-1 font-mono">
                        Scan with Google Authenticator or Authy
                      </span>
                    </div>
                  ) : null}

                  {totpSecret && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
                        Manual Entry Secret Code
                      </label>
                      <div className="flex items-center gap-1.5">
                        <code className="flex-1 bg-input border border-border px-2 py-1.5 rounded text-xs font-mono text-text-primary select-all break-all">
                          {totpSecret}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCopySecret}
                          className="h-8 px-2.5 text-xs border-border"
                        >
                          {copiedSecret ? <Check className="h-3.5 w-3.5 text-secondary" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary block">
                  6-Digit Verification Token
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-text-secondary" />
                  <Input
                    type="text"
                    required
                    autoFocus
                    maxLength={6}
                    placeholder="123456"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    className="pl-9 bg-input border-border text-base tracking-[0.3em] font-mono h-11 focus:ring-2 focus:ring-primary/25 text-center font-bold rounded-xl text-text-primary"
                  />
                </div>
                <p className="text-[11px] text-text-secondary flex items-center gap-1">
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
                  className="w-1/3 border-border text-xs h-10 text-text-primary rounded-xl"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading || mfaCode.trim().length !== 6}
                  className="w-2/3 bg-primary hover:bg-[var(--color-primary-hover)] text-white font-medium text-xs h-10 rounded-xl shadow-xs transition-all"
                >
                  {loading ? (
                    <>
                      <BrandLoader size="button" className="mr-2" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify &amp; Enter <ShieldCheck className="h-4 w-4 ml-1.5" />
                    </>
                  )}
                </Button>
              </div>

              <div className="text-center pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={handleResetMfa}
                  disabled={loading}
                  className="text-[11px] text-primary hover:underline hover:text-primary-hover transition-colors font-mono"
                >
                  Need to scan QR code again or lost authenticator? Reset MFA
                </button>
              </div>
            </form>
          )}

          {/* Security Notice Footer */}
          <div className="pt-4 border-t border-border/40 text-center space-y-1 text-[11px] text-text-secondary font-mono">
            <p>
              Platform Super Admin manages SaaS infrastructure
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
