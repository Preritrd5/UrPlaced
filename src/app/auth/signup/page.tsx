"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  GraduationCap,
  Award,
  Lock,
  BookOpen,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SplitAuthCard, type FeatureHighlight } from "@/components/auth/split-auth-card";
import { PasswordField } from "@/components/auth/password-field";

const studentSignUpFeatures: FeatureHighlight[] = [
  {
    icon: BookOpen,
    tint: "rose",
    title: "Official Campus Syllabus Aligned",
    description: "Full coverage of quantitative aptitude, coding tests, and company-specific recruiter formats.",
  },
  {
    icon: Award,
    tint: "cyan",
    title: "DriveFit Candidate Scoring",
    description: "Qualify for placement drive shortlists with verified skill mastery and automated readiness metrics.",
  },
  {
    icon: Lock,
    tint: "amber",
    title: "Encrypted Credentials & Protected Records",
    description: "Your test attempts, saved mistakes, and progress benchmarks are secured under PostgreSQL RLS.",
  },
];

function StudentSignUpContent() {
  const router = useRouter();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [graduationYear, setGraduationYear] = React.useState("2026");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    // Validation checks
    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMsg("Please enter your full name (minimum 2 characters).");
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
    <SplitAuthCard
      badgeText="• Student Account Sign Up"
      subtitle="STUDENT ONBOARDING (2026)"
      headline="Join Placement Preparation & Readiness Network"
      description="Create your student account to access full-length timed mock exams, unlock targeted mistake review, and build verified readiness for recruitment drives."
      features={studentSignUpFeatures}
      footerLeft="UrPlaced 2026 Academic Session"
      footerRight="Student Onboarding"
    >
      <div className="space-y-5">
        {/* Form Header */}
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900 tracking-tight">
            Create Student Account
          </h2>
          <p className="text-sm text-slate-500">
            Enter your academic details and create your portal login password.
          </p>
        </div>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertTitle className="flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" /> Registration Failed
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

        {/* Sign Up Form */}
        <form onSubmit={handleSignUp} className="space-y-3.5">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName" required className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              Full Name
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="e.g. Rahul Sharma"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={isLoading}
              className="bg-input border-border/80 rounded-xl h-11 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Academic Stream & Batch (Paired Fields) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="department" className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                Department / Stream
              </Label>
              <Select value={department} onValueChange={setDepartment} disabled={isLoading}>
                <SelectTrigger id="department" suppressHydrationWarning className="bg-input border-border/80 rounded-xl h-11 text-sm">
                  <SelectValue placeholder="Select stream" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cse">Computer Science (CSE)</SelectItem>
                  <SelectItem value="ise">Information Science (ISE/IT)</SelectItem>
                  <SelectItem value="ece">Electronics &amp; Comm (ECE)</SelectItem>
                  <SelectItem value="eee">Electrical Engineering (EEE)</SelectItem>
                  <SelectItem value="me">Mechanical Engineering (ME)</SelectItem>
                  <SelectItem value="other">Other Disciplines</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gradYear" className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
                Graduation Batch
              </Label>
              <Select value={graduationYear} onValueChange={setGraduationYear} disabled={isLoading}>
                <SelectTrigger id="gradYear" suppressHydrationWarning className="bg-input border-border/80 rounded-xl h-11 text-sm">
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">Batch 2025</SelectItem>
                  <SelectItem value="2026">Batch 2026 (Current)</SelectItem>
                  <SelectItem value="2027">Batch 2027</SelectItem>
                  <SelectItem value="2028">Batch 2028</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <Label htmlFor="email" required className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="e.g. rahul.sharma@campus.edu or student@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              className="bg-input border-border/80 rounded-xl h-11 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Paired Password Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PasswordField
              id="password"
              label="Create Login Password"
              required
              autoComplete="new-password"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />

            <PasswordField
              id="confirmPassword"
              label="Retype Login Password"
              required
              autoComplete="new-password"
              placeholder="Retype password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full h-12 rounded-xl text-sm font-bold shadow-md mt-2"
            isLoading={isLoading}
          >
            {isLoading ? (
              "Creating Student Account..."
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" /> Create Student Account (Sign Up)
              </>
            )}
          </Button>
        </form>

        {/* Secondary Sign In Action */}
        <div className="pt-2">
          <Link
            href="/auth/signin"
            className="w-full h-11 rounded-xl bg-[#FFF8EE] hover:bg-[#FFF2DE] border border-[#FDE6C8] text-slate-800 text-sm font-medium transition-all flex items-center justify-center gap-1 shadow-sm"
          >
            <span>Already have a student account?</span>
            <span className="font-bold text-primary">Sign In &rarr;</span>
          </Link>
        </div>

        {/* Alternative Role Switcher & Back to Home */}
        <div className="pt-3 border-t border-slate-100 space-y-2 text-center">
          <div>
            <Link
              href="/"
              className="text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors inline-block pt-1"
            >
              &larr; Back to Home Page
            </Link>
          </div>
        </div>
      </div>
    </SplitAuthCard>
  );
}

export default function StudentSignUpPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-16 text-center text-xs text-text-muted font-mono">
          Loading student registration...
        </div>
      }
    >
      <StudentSignUpContent />
    </React.Suspense>
  );
}
