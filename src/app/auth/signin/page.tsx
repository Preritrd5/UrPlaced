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
        let destination = next;
        if (!searchParams.get("next")) {
          const metaRole = data.user?.user_metadata?.role;
          const metaCategory = data.user?.user_metadata?.account_category;
          if (metaCategory === "STUDENT" || metaRole === "STUDENT") {
            destination = "/dashboard/student";
          } else if (metaRole === "TRAINER") {
            destination = "/dashboard/training";
          } else {
            destination = "/dashboard";
          }
        }
        router.push(destination);
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
          Enter your student or institutional credentials to access your preparation portal or placement cell.
        </p>
      </div>

      {searchParams.get("registered") === "true" && (
        <Alert variant="success">
          <AlertTitle>Registration Successful</AlertTitle>
          <AlertDescription>
            Your account has been created. Please sign in with your credentials to access your workspace.
          </AlertDescription>
        </Alert>
      )}

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

      <div className="pt-4 border-t border-border text-center space-y-2">
        <p className="text-xs text-text-secondary">
          Don&apos;t have an account yet?{" "}
          <Link
            href="/auth/signup"
            className="font-semibold text-primary hover:underline ml-1"
          >
            Create an Account
          </Link>
        </p>
        <p className="text-[11px] text-text-muted">
          Institutional member with an invite? You can also activate via your invitation link.
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
