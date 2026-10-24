"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SimpleAuthCard } from "@/components/auth/simple-auth-card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const supabase = createClient();
      const origin = window.location.origin;

      await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${origin}/auth/reset-password`,
      });
    } catch {
      // Intentionally suppress errors to prevent account enumeration
    } finally {
      setIsLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <SimpleAuthCard>
      <div className="space-y-6">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold font-heading text-text-primary">
            Password Recovery
          </h2>
          <p className="text-xs text-text-secondary">
            Enter your registered institutional email to receive recovery instructions.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <Alert variant="success">
              <AlertTitle className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-secondary" /> Request Received
              </AlertTitle>
              <AlertDescription>
                If an account associated with <strong className="font-semibold text-text-primary">{email}</strong> exists,
                we have dispatched recovery instructions. Please check your inbox and spam folder.
              </AlertDescription>
            </Alert>

            <Button asChild variant="outline" className="w-full">
              <Link href="/auth/signin" className="inline-flex items-center gap-1.5 justify-center">
                <ArrowLeft className="h-4 w-4" /> Return to Sign In
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" required>
                Institutional Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@campus.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              <Mail className="h-4 w-4 mr-2" /> Send Recovery Instructions
            </Button>

            <div className="text-center pt-2">
              <Link
                href="/auth/signin"
                className="text-xs text-text-secondary hover:text-text-primary inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </SimpleAuthCard>
  );
}
