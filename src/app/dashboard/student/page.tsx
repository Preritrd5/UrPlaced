"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Compass,
  AlertCircle,
  Sparkles,
  BarChart3,
  Building2,
  ArrowRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";
import { StudentActivityHeatmap } from "@/components/student/student-activity-heatmap";

export default function StudentDashboardPage() {
  const auth = useAuthContext();
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [dashboardData, setDashboardData] = React.useState<{
    metrics: {
      totalAssignedCount: number;
      availableAssessmentsCount: number;
      averageScore: number;
      totalMistakes: number;
      pendingReviews: number;
      masteredMistakes: number;
    };
    assignedAssessments: any[];
    attempts: any[];
    mistakes: any[];
  }>({
    metrics: {
      totalAssignedCount: 0,
      availableAssessmentsCount: 0,
      averageScore: 0,
      totalMistakes: 0,
      pendingReviews: 0,
      masteredMistakes: 0,
    },
    assignedAssessments: [],
    attempts: [],
    mistakes: [],
  });

  React.useEffect(() => {
    if (!auth.isLoading) {
      if (!auth.isAuthenticated) {
        router.push("/auth/signin");
        return;
      }

      if (auth.accountCategory === "COLLEGE") {
        if (auth.role === "TRAINER") {
          router.push("/dashboard/training");
        } else {
          router.push("/dashboard");
        }
        return;
      }

      fetch("/api/student/dashboard")
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Failed to load student dashboard");
        })
        .then((data) => {
          setDashboardData(data);
        })
        .catch(() => {
          // Graceful fallback
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.accountCategory, auth.role, router]);

  if (auth.isLoading || loading) {
    return <DashboardSkeleton />;
  }

  const { metrics, attempts } = dashboardData;
  const completedAttempts =
    attempts.filter((a: any) =>
      ["SUBMITTED", "SCORED", "RESULT_RELEASED"].includes(a.status)
    ) || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary font-heading">
              Welcome back, {auth.fullName || "Student"}
            </h1>
            <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-semibold">
              Student Prep
            </Badge>
          </div>

          <p className="text-xs sm:text-sm text-text-secondary">
            <Sparkles
              className="inline-block h-4 w-4 mr-1 text-teal-600 align-middle"
              aria-hidden="true"
            />
            {auth.tenant?.name || "Campus Placement Portal"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button asChild variant="primary" className="bg-primary text-white shadow-sm w-full sm:w-auto">
            <Link href="/dashboard/student/assessments" className="inline-flex items-center justify-center gap-1.5">
              <Compass className="h-4 w-4" />
              <span>Take Assessment</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-border hover:bg-surface w-full sm:w-auto">
            <Link href="/dashboard/student/mistakes" className="inline-flex items-center justify-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-secondary" />
              <span>Mistake Bank ({metrics.pendingReviews})</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Active Assessments */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
              Available Tests
            </CardTitle>
            <Compass className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-text-primary">
              {metrics.availableAssessmentsCount}
            </div>
            <p className="text-[11px] text-text-secondary mt-1">
              {metrics.availableAssessmentsCount === 1
                ? "1 active test ready for attempt"
                : `${metrics.availableAssessmentsCount} active tests ready for attempt`}
            </p>
          </CardContent>
        </Card>

        {/* Completed Attempts */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
              Tests Completed
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-text-primary">
              {completedAttempts.length}
            </div>
            <p className="text-[11px] text-text-secondary mt-1">
              Avg score: {metrics.averageScore}%
            </p>
          </CardContent>
        </Card>

        {/* Mistakes Review Queue */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
              Mistake Bank
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-text-primary">
              {metrics.pendingReviews}
            </div>
            <p className="text-[11px] text-text-secondary mt-1">
              {metrics.totalMistakes} captured &bull; {metrics.masteredMistakes} mastered
            </p>
          </CardContent>
        </Card>

        {/* Readiness Index */}
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
              Mastery Progress
            </CardTitle>
            <Sparkles className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-text-primary">
              {metrics.totalMistakes > 0
                ? Math.round((metrics.masteredMistakes / metrics.totalMistakes) * 100)
                : 100}%
            </div>
            <p className="text-[11px] text-text-secondary mt-1">
              Conversion rate to verified mastery
            </p>
          </CardContent>
        </Card>
      </div>

      {/* GitHub / LeetCode Style 365-Day Student Activity Contribution Heatmap */}
      <StudentActivityHeatmap />

      {/* Quick Action Navigation Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold font-heading text-text-primary">
          Preparation Modules
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:border-primary/50 transition-colors bg-card">
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center mb-2">
                <Compass className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-heading">Assessments &amp; Practice</CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Take timed mock drives and practice curated question sets.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm" className="w-full justify-between">
                <Link href="/dashboard/student/assessments">
                  <span>Enter Tests</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors bg-card">
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center mb-2">
                <AlertCircle className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-heading">Mistake Bank</CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Study guided explanations for missed questions and take scheduled re-tests.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm" className="w-full justify-between">
                <Link href="/dashboard/student/mistakes">
                  <span>Review Mistakes</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors bg-card">
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center mb-2">
                <Building2 className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-heading">Target Drive Intel</CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Inspect historical drive patterns, topic weightages, and cutoffs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm" className="w-full justify-between">
                <Link href="/dashboard/student/memory">
                  <span>View Drive Patterns</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors bg-card">
            <CardHeader className="pb-3">
              <div className="h-10 w-10 rounded-xl bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center mb-2">
                <BarChart3 className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-heading">Performance Analytics</CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Review your topic-wise accuracy, speed, and preparation trends.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm" className="w-full justify-between">
                <Link href="/dashboard/student/analytics">
                  <span>Check Analytics</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Attempts History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold font-heading text-text-primary">
            Recent Assessment Attempts
          </h2>
          <Button asChild variant="ghost" size="sm" className="text-xs text-primary">
            <Link href="/dashboard/student/assessments">View All Tests</Link>
          </Button>
        </div>

        {completedAttempts.length === 0 ? (
          <Card className="border-border bg-card p-8 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-[var(--color-primary-subtle)] text-primary mx-auto flex items-center justify-center">
              <Compass className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-text-primary font-heading">
              No Completed Assessments Yet
            </h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              Start practicing to build your assessment history and mistake remediation queue.
            </p>
            <Button asChild variant="primary" size="sm" className="mt-2 bg-primary text-white">
              <Link href="/dashboard/student/assessments">Browse Available Tests</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {completedAttempts.map((attempt: any) => (
              <div
                key={attempt.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-border bg-card shadow-sm hover:border-primary/40 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <h4 className="text-sm font-bold text-text-primary font-heading truncate">
                    {attempt.assessments?.title || "Assessment Attempt"}
                  </h4>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-secondary" />
                      {attempt.assessments?.time_limit_minutes || 60} mins
                    </span>
                    <span>&bull;</span>
                    <span>
                      Completed on {new Date(attempt.submitted_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/student/attempts/${attempt.id}/review`}>
                      Review
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
