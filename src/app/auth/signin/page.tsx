"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
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

      if (data.session) {
        router.push(next);
        router.refresh();
      }
    } catch {
      setErrorMsg("An unexpected error occurred during sign-in. Please try again.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1 text-center">
        <h2 className="text-xl font-bold font-heading text-text-primary">
          Sign In to Your Workspace
        </h2>
        <p className="text-xs text-text-secondary">
          Enter your institutional credentials to access your college placement cell.
        </p>
      </div>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertTitle>Authentication Failed</AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {searchParams.get("error") === "verification_failed" && (
        <Alert variant="warning">
          <AlertTitle>Verification Notice</AlertTitle>
          <AlertDescription>
            The verification code was invalid or has expired. Please try signing in again.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSignIn} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" required>
            Institutional Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@campus.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" required>
              Password
            </Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          isLoading={isLoading}
        >
          <LogIn className="h-4 w-4 mr-2" /> Sign In
        </Button>
      </form>

      <div className="pt-4 border-t border-border text-center">
        <p className="text-xs text-text-secondary">
          New student or faculty member?
        </p>
        <p className="text-[11px] text-text-muted mt-0.5">
          UrPlaced accounts are invitation-based. Use the activation link sent to your institutional email.
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-8 text-center text-xs text-text-muted">
          Loading sign in...
        </div>
      }
    >
      <SignInContent />
    </React.Suspense>
  );
}
