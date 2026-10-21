"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, ArrowRight, Building2, UserPlus, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

function StudentSignUpContent() {
  const router = useRouter();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
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
      // 1. Call server-side signup API with fixed STUDENT category
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: "STUDENT",
          accountCategory: "STUDENT",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "Failed to create student account. Please try again.");
        setIsLoading(false);
        return;
      }

      setSuccessMsg("Student account created! Signing you in...");

      // 2. Automatically authenticate session in browser client
      const supabase = createClient();
      const { data: authData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (signInError || !authData.session) {
        router.push(`/auth/signin?registered=true&email=${encodeURIComponent(email)}`);
        return;
      }

      // 3. Redirect to Student Workspace
      router.push("/dashboard/student");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred during registration. Please try again.";
      setErrorMsg(msg);
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-primary-subtle)] text-primary text-xs font-semibold">
          <GraduationCap className="h-4 w-4" />
          <span>Student Portal</span>
        </div>
        <h2 className="text-2xl font-bold font-heading text-text-primary">
          Create Your Student Account
        </h2>
        <p className="text-xs text-text-secondary max-w-sm mx-auto leading-relaxed">
          Register for personalized placement preparation, mock assessment practice, and mistake mastery tracking.
        </p>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <Alert variant="destructive">
          <AlertTitle className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> Registration Failed
          </AlertTitle>
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success">
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{successMsg}</AlertDescription>
        </Alert>
      )}

      {/* Form */}
      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName" required>
            Full Name
          </Label>
          <Input
            id="fullName"
            type="text"
            placeholder="John Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" required>
            Student Email
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="student@campus.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" required>
            Password (min. 8 characters)
          </Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            disabled={isLoading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword" required>
            Confirm Password
          </Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={isLoading}
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          isLoading={isLoading}
        >
          <UserPlus className="h-4 w-4 mr-2" /> Create Student Account
        </Button>
      </form>

      {/* Navigation & Portal Switching */}
      <div className="pt-4 border-t border-border space-y-3 text-center">
        <p className="text-xs text-text-secondary">
          Already have a Student account?{" "}
          <Link
            href="/auth/signin"
            className="font-semibold text-primary hover:underline ml-1"
          >
            Sign In
          </Link>
        </p>

      </div>
    </div>
  );
}

export default function StudentSignUpPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-8 text-center text-xs text-text-muted">
          Loading student registration...
        </div>
      }
    >
      <StudentSignUpContent />
    </React.Suspense>
  );
}
