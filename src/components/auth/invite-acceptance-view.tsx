"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserCheck, ShieldAlert, ArrowRight, Building, CheckCircle2, Lock, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

interface InviteState {
  loading: boolean;
  valid: boolean;
  error?: string;
  email?: string;
  role?: string;
  tenantName?: string;
  userExists?: boolean;
  isStudent?: boolean;
  isCurrentUser?: boolean;
  currentUserName?: string;
}

export function InviteAcceptanceView({ token }: { token: string }) {
  const router = useRouter();
  const cleanToken = React.useMemo(() => {
    return token ? decodeURIComponent(token.trim()).trim() : "";
  }, [token]);

  const [state, setState] = React.useState<InviteState>({
    loading: true,
    valid: false,
  });

  const [fullName, setFullName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Validate invitation token on mount
  React.useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(`/api/auth/invite?token=${encodeURIComponent(cleanToken)}`);
        const json = await res.json();
        if (json.valid) {
          setState({
            loading: false,
            valid: true,
            email: json.email,
            role: json.role,
            tenantName: json.tenantName,
            userExists: json.userExists,
            isStudent: json.isStudent,
            isCurrentUser: json.isCurrentUser,
            currentUserName: json.currentUserName,
          });
          if (json.currentUserName) {
            setFullName(json.currentUserName);
          }
        } else {
          setState({
            loading: false,
            valid: false,
            error: json.error || "Invalid or expired invitation token.",
          });
        }
      } catch {
        setState({
          loading: false,
          valid: false,
          error: "Failed to connect to verification server.",
        });
      }
    }
    verify();
  }, [cleanToken]);

  const roleTitle =
    state.role === "TRAINER"
      ? "Faculty / Training Specialist"
      : state.role === "PLACEMENT_STAFF"
      ? "Placement Officer"
      : state.role || "Staff Member";

  const targetDashboard = state.role === "TRAINER" ? "/dashboard/training" : "/dashboard";

  // Case A: New user password setup & activation
  async function handleNewUserAccept(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 8) {
      setSubmitError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match. Please verify.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: cleanToken,
          fullName: fullName.trim(),
          password,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setSubmitError(json.error || "Failed to accept invitation.");
        setIsSubmitting(false);
        return;
      }

      // Establish client session via Supabase Auth
      if (state.email && password) {
        const supabase = createClient();
        await supabase.auth.signInWithPassword({
          email: state.email,
          password,
        });
      }

      router.push(targetDashboard);
      router.refresh();
    } catch {
      setSubmitError("An unexpected error occurred during account activation.");
      setIsSubmitting(false);
    }
  }

  // Case B1: Logged-in user accepting for their active account
  async function handleExistingLoggedInAccept(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: cleanToken,
          fullName: fullName.trim() || state.currentUserName,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setSubmitError(json.error || "Failed to accept invitation.");
        setIsSubmitting(false);
        return;
      }

      router.push(targetDashboard);
      router.refresh();
    } catch {
      setSubmitError("An unexpected error occurred during invitation acceptance.");
      setIsSubmitting(false);
    }
  }

  // Case B2: Existing user entering their current password
  async function handleExistingUserSignInAccept(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!password) {
      setSubmitError("Please enter your existing password.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: state.email!,
        password,
      });

      if (signInError) {
        setSubmitError("Invalid password. Please check your credentials or reset your password.");
        setIsSubmitting(false);
        return;
      }

      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: cleanToken,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setSubmitError(json.error || "Failed to link college membership.");
        setIsSubmitting(false);
        return;
      }

      router.push(targetDashboard);
      router.refresh();
    } catch {
      setSubmitError("An unexpected error occurred during sign in and acceptance.");
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.reload();
  }

  if (state.loading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true">
        <span className="sr-only">Verifying institutional invitation token...</span>
        <div className="space-y-2 text-center">
          <Skeleton className="h-10 w-10 rounded-full mx-auto" />
          <Skeleton className="h-6 w-48 rounded mx-auto" />
          <Skeleton className="h-3.5 w-64 rounded mx-auto" />
        </div>
        <div className="p-4 rounded-xl border border-border bg-input space-y-3">
          <div className="flex justify-between items-center">
            <Skeleton className="h-3.5 w-20 rounded" />
            <Skeleton className="h-3.5 w-40 rounded" />
          </div>
          <div className="flex justify-between items-center">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-3.5 w-32 rounded" />
          </div>
        </div>
        <div className="space-y-3 pt-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (!state.valid) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle className="flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" /> Invitation Invalid or Expired
          </AlertTitle>
          <AlertDescription>
            {state.error || "This invitation link is invalid, expired, or has already been accepted."}
          </AlertDescription>
        </Alert>

        <p className="text-xs text-text-secondary text-center">
          Please contact your institution placement cell administrator to receive a fresh invitation.
        </p>

        <Button asChild variant="outline" className="w-full">
          <Link href="/auth/college/signin">
            Return to College Sign In
          </Link>
        </Button>
      </div>
    );
  }

  // Boundary check: Incompatible Student account
  if (state.isStudent) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle className="flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" /> Account Category Conflict
          </AlertTitle>
          <AlertDescription>
            The email <strong>{state.email}</strong> is registered on UrPlaced as a <strong>Student</strong> account.
            Student accounts cannot be assigned College staff or trainer roles. Please contact your institution
            administrator to issue an invitation to a dedicated institutional staff email address.
          </AlertDescription>
        </Alert>

        <Button asChild variant="outline" className="w-full">
          <Link href="/auth/signin">
            Sign In to Student Portal <ArrowRight className="h-4 w-4 ml-1.5" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="h-10 w-10 rounded-full bg-[rgba(80,82,201,0.12)] text-primary flex items-center justify-center mx-auto">
          <Building className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold font-heading text-text-primary">
          Join {state.tenantName}
        </h2>
        <p className="text-xs text-text-secondary">
          Accept your institutional appointment as a <strong>{roleTitle}</strong>.
        </p>
      </div>

      {/* Invitation Bound Credentials Summary */}
      <div className="p-3.5 rounded-xl border border-border bg-input space-y-2 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Bound Email:</span>
          <span className="font-semibold text-text-primary font-mono">{state.email}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Assigned Role:</span>
          <Badge variant="secondary">{roleTitle}</Badge>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Workspace:</span>
          <span className="font-semibold text-text-primary">{state.tenantName}</span>
        </div>
      </div>

      {submitError && (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      {/* Case B1: Logged in as the matching account */}
      {state.isCurrentUser ? (
        <form onSubmit={handleExistingLoggedInAccept} className="space-y-4">
          <div className="p-3 bg-[rgba(46,143,134,0.08)] border border-secondary/30 rounded-lg text-xs text-text-secondary flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-secondary shrink-0" />
            <span>
              You are currently authenticated as <strong>{state.email}</strong>. Accepting will link your account to{" "}
              <strong>{state.tenantName}</strong> with the <strong>{roleTitle}</strong> role.
            </span>
          </div>

          <Button
            type="submit"
            variant="secondary"
            className="w-full"
            isLoading={isSubmitting}
          >
            <UserCheck className="h-4 w-4 mr-2" /> Accept &amp; Join Workspace
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-text-muted hover:text-text-primary underline"
            >
              Sign out to switch account
            </button>
          </div>
        </form>
      ) : state.userExists ? (
        /* Case B2: Existing user not currently signed in */
        <form onSubmit={handleExistingUserSignInAccept} className="space-y-4">
          <div className="p-3 bg-[rgba(80,82,201,0.08)] border border-primary/20 rounded-lg text-xs text-text-secondary flex items-start gap-2">
            <Lock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <span>
              An account with <strong>{state.email}</strong> already exists on UrPlaced. Enter your account password
              to accept this appointment. Your password will remain unchanged.
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="existingPassword" required>
              Account Password
            </Label>
            <Input
              id="existingPassword"
              type="password"
              placeholder="Enter your existing password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            isLoading={isSubmitting}
          >
            {isSubmitting ? (
              "Signing in & joining..."
            ) : (
              <>
                <LogIn className="h-4 w-4 mr-2" /> Sign In &amp; Accept Appointment
              </>
            )}
          </Button>
        </form>
      ) : (
        /* Case A: New user activation */
        <form onSubmit={handleNewUserAccept} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName" required>
              Full Legal Name
            </Label>
            <Input
              id="fullName"
              placeholder="e.g. Dr. Rajesh Kumar"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" required>
              Create Account Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" required>
              Confirm Password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            isLoading={isSubmitting}
          >
            {isSubmitting ? (
              "Activating Account & Joining College..."
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" /> Activate Account &amp; Join College
              </>
            )}
          </Button>
        </form>
      )}
    </div>
  );
}
