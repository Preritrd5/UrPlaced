"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SimpleAuthCard } from "@/components/auth/simple-auth-card";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setErrorMsg(error.message || "Failed to update password. Your reset link may have expired.");
        setIsLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorMsg("An unexpected error occurred. Please request a new recovery link.");
      setIsLoading(false);
    }
  }

  return (
    <SimpleAuthCard>
      <div className="space-y-6">
        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold font-heading text-text-primary">
            Set New Password
          </h2>
          <p className="text-xs text-text-secondary">
            Enter your new password below to secure your account.
          </p>
        </div>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertTitle>Update Error</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handlePasswordUpdate} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" required>
              New Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" required>
              Confirm New Password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {isLoading ? (
              "Updating Password..."
            ) : (
              <>
                <KeyRound className="h-4 w-4 mr-2" /> Update Password &amp; Continue
              </>
            )}
          </Button>
        </form>
      </div>
    </SimpleAuthCard>
  );
}
