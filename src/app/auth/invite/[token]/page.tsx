"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { UserCheck, ShieldAlert, ArrowRight, CheckCircle2, Building } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface InviteState {
  loading: boolean;
  valid: boolean;
  error?: string;
  email?: string;
  role?: string;
  tenantName?: string;
}

export default function InviteAcceptancePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [state, setState] = React.useState<InviteState>({
    loading: true,
    valid: false,
  });

  const [fullName, setFullName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Validate invitation on mount via server action / route
  React.useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(`/api/auth/invite?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (json.valid) {
          setState({
            loading: false,
            valid: true,
            email: json.email,
            role: json.role,
            tenantName: json.tenantName,
          });
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
  }, [token]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
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

      // Auto sign-in with the newly created credentials
      if (state.email && password) {
        const supabase = createClient();
        await supabase.auth.signInWithPassword({
          email: state.email,
          password,
        });
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setSubmitError("An unexpected error occurred during account activation.");
      setIsSubmitting(false);
    }
  }

  if (state.loading) {
    return (
      <div className="py-8 text-center space-y-3">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-xs text-text-secondary font-mono">
          Verifying institutional invitation token...
        </p>
      </div>
    );
  }

  if (!state.valid) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle className="flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" /> Invitation Invalid
          </AlertTitle>
          <AlertDescription>
            {state.error || "This invitation link is invalid, expired, or has already been consumed."}
          </AlertDescription>
        </Alert>

        <p className="text-xs text-text-secondary text-center">
          Please contact your institution placement cell administrator to receive a new invitation link.
        </p>

        <Button asChild variant="outline" className="w-full">
          <Link href="/auth/signin">Return to Sign In</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="h-10 w-10 rounded-full bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center mx-auto">
          <Building className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-bold font-heading text-text-primary">
          Join {state.tenantName}
        </h2>
        <p className="text-xs text-text-secondary">
          Complete your account setup to accept your placement workspace invitation.
        </p>
      </div>

      {/* Invitation Details Summary */}
      <div className="p-3.5 rounded-xl border border-border bg-input space-y-2 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Bound Email:</span>
          <span className="font-semibold text-text-primary font-mono">{state.email}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-text-muted">Assigned Role:</span>
          <Badge variant="secondary">{state.role}</Badge>
        </div>
      </div>

      {submitError && (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleAccept} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName" required>
            Full Legal Name
          </Label>
          <Input
            id="fullName"
            placeholder="e.g. Aditi Sharma"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" required>
            Create Password
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

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          isLoading={isSubmitting}
        >
          <UserCheck className="h-4 w-4 mr-2" /> Activate Account &amp; Accept
        </Button>
      </form>
    </div>
  );
}
