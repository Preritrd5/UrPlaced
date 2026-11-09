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
  Target,
  FileText,
  User,
  TrendingUp,
  Award,
  Bot,
  SlidersHorizontal,
  ShieldCheck,
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

  const [careerIntel, setCareerIntel] = React.useState<{
    completeness: number;
    missingSections: string[];
    primaryResume: { id: string; fileName: string } | null;
    latestScanScore: number | null;
    matchesCount: number;
    highestMatchScore: number;
  }>({
    completeness: 0,
    missingSections: [],
    primaryResume: null,
    latestScanScore: null,
    matchesCount: 0,
    highestMatchScore: 0,
  });

  const [careerImprovement, setCareerImprovement] = React.useState<{
    skillGapTargetRole: string | null;
    skillGapReadinessScore: number | null;
    passportVisibility: string;
    interviewSessionsCount: number;
    interviewAvgScore: number | null;
  }>({
    skillGapTargetRole: null,
    skillGapReadinessScore: null,
    passportVisibility: "PRIVATE",
    interviewSessionsCount: 0,
    interviewAvgScore: null,
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

      // Fetch dashboard metrics
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

      // Background fetch Career Intelligence summary
      Promise.allSettled([
        fetch("/api/student/career-profile").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/student/resumes").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/student/placement-matches?filter=ALL").then((r) => (r.ok ? r.json() : null)),
      ]).then(([profileRes, resumesRes, matchesRes]) => {
        let completeness = 0;
        let missingSections: string[] = [];
        let primaryResume: { id: string; fileName: string } | null = null;
        let latestScanScore: number | null = null;
        let matchesCount = 0;
        let highestMatchScore = 0;

        if (profileRes.status === "fulfilled" && profileRes.value?.data) {
          const comp = profileRes.value.data.completeness;
          completeness =
            typeof comp?.overallPercentage === "number"
              ? comp.overallPercentage
              : typeof comp?.score === "number"
              ? comp.score
              : typeof profileRes.value.data.completeness_percentage === "number"
              ? profileRes.value.data.completeness_percentage
              : 0;

          const rawMissing = comp?.missingSections || [];
          missingSections = rawMissing.map((m: any) =>
            typeof m === "string" ? m : m?.title || m?.sectionKey || "Section"
          );
        }

        if (resumesRes.status === "fulfilled" && resumesRes.value?.data) {
          const list = resumesRes.value.data as any[];
          const primary = list.find((r) => r.isPrimary) || list[0];
          if (primary) {
            primaryResume = { id: primary.id, fileName: primary.fileName };
          }
        }

        if (matchesRes.status === "fulfilled" && matchesRes.value?.data) {
          const list = matchesRes.value.data as any[];
          matchesCount = list.length;
          highestMatchScore = list.reduce(
            (max, item) => Math.max(max, item.matchScore || 0),
            0
          );
        }

        setCareerIntel({
          completeness,
          missingSections,
          primaryResume,
          latestScanScore,
          matchesCount,
          highestMatchScore,
        });
      });

      // Background fetch Career Improvement summary (Phase 02)
      Promise.allSettled([
        fetch("/api/student/skill-gap").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/student/career-passport").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/student/mock-interview").then((r) => (r.ok ? r.json() : null)),
      ]).then(([gapRes, passportRes, interviewRes]) => {
        let skillGapTargetRole: string | null = null;
        let skillGapReadinessScore: number | null = null;
        let passportVisibility = "PRIVATE";
        let interviewSessionsCount = 0;
        let interviewAvgScore: number | null = null;

        if (gapRes.status === "fulfilled" && gapRes.value?.data) {
          const analysisData = gapRes.value.data.analysis || gapRes.value.data;
          skillGapTargetRole = analysisData.targetRole || null;
          skillGapReadinessScore =
            typeof analysisData.overallReadinessScore === "number"
              ? analysisData.overallReadinessScore
              : typeof analysisData.readinessScore === "number"
              ? analysisData.readinessScore
              : null;
        }

        if (passportRes.status === "fulfilled" && passportRes.value?.data) {
          passportVisibility = passportRes.value.data.visibility || "PRIVATE";
        }

        if (interviewRes.status === "fulfilled" && interviewRes.value?.data) {
          const sessions = Array.isArray(interviewRes.value.data) ? interviewRes.value.data : [];
          interviewSessionsCount = sessions.length;
          const completed = sessions.filter(
            (s: any) => s.status === "COMPLETED" && typeof s.overallScore === "number"
          );
          if (completed.length > 0) {
            const sum = completed.reduce((acc: number, s: any) => acc + s.overallScore, 0);
            interviewAvgScore = Math.round(sum / completed.length);
          }
        }

        setCareerImprovement({
          skillGapTargetRole,
          skillGapReadinessScore,
          passportVisibility,
          interviewSessionsCount,
          interviewAvgScore,
        });
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

      {/* Career Intelligence Command Center */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold font-heading text-text-primary">
                Career Intelligence &amp; Placement Readiness
              </h2>
              <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 border-primary/40 text-primary">
                <Sparkles className="h-3 w-3 mr-1 text-primary inline" /> AI Intelligence
              </Badge>
            </div>
            <p className="text-xs text-text-secondary">
              Professional profile completeness, AI ATS resume diagnostics, and real-time campus drive matching.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Card 1: Career Profile Completeness */}
          <Card className="border-border bg-card shadow-sm hover:border-primary/40 transition-colors flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs font-mono font-semibold ${
                    careerIntel.completeness >= 80
                      ? "border-secondary/50 text-secondary bg-[var(--color-secondary-subtle)]"
                      : "border-primary/50 text-primary bg-[var(--color-primary-subtle)]"
                  }`}
                >
                  {careerIntel.completeness}% Complete
                </Badge>
              </div>
              <CardTitle className="text-base font-heading mt-2">Career Profile</CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Professional summary, categorized skills, education, projects, and work experience.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="h-2 w-full bg-surface rounded-full overflow-hidden border border-border">
                  <div
                    className="h-full bg-primary transition-all duration-500 rounded-full"
                    style={{ width: `${careerIntel.completeness}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-text-secondary">
                  <span>Profile Strength</span>
                  <span>{careerIntel.completeness}/100</span>
                </div>
              </div>

              {careerIntel.missingSections.length > 0 ? (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                  Missing:{" "}
                  {careerIntel.missingSections
                    .slice(0, 2)
                    .map((m: any) => (typeof m === "string" ? m : m?.title || m?.sectionKey || "Details"))
                    .join(", ")}
                  {careerIntel.missingSections.length > 2 && "..."}
                </p>
              ) : (
                <p className="text-[11px] text-secondary bg-[var(--color-secondary-subtle)] p-2 rounded-lg border border-secondary/20">
                  &check; All 7 core sections complete &amp; verified
                </p>
              )}

              <Button asChild variant="outline" size="sm" className="w-full justify-between mt-2">
                <Link href="/dashboard/student/career-profile">
                  <span>Manage Profile</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: AI Resume & ATS Scanner */}
          <Card className="border-border bg-card shadow-sm hover:border-primary/40 transition-colors flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-xs font-mono font-semibold border-secondary/50 text-secondary">
                  {careerIntel.primaryResume ? "Resume Active" : "Upload Ready"}
                </Badge>
              </div>
              <CardTitle className="text-base font-heading mt-2">AI Resume &amp; ATS</CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Upload PDF/DOCX, diagnose ATS parseability risks, and scan against recruiter filters.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="p-2.5 rounded-lg bg-surface border border-border space-y-1">
                <span className="text-[11px] text-text-secondary font-mono uppercase tracking-wider block">
                  Active Resume
                </span>
                <p className="text-xs font-semibold text-text-primary truncate">
                  {careerIntel.primaryResume?.fileName || "No primary resume designated"}
                </p>
              </div>

              <p className="text-[11px] text-text-secondary leading-relaxed">
                Run automated ATS analysis to check header parseability, keyword density, and bullet point impact.
              </p>

              <Button asChild variant="outline" size="sm" className="w-full justify-between mt-2">
                <Link href="/dashboard/student/resume">
                  <span>Resume Scanner</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: Smart Placement Matches */}
          <Card className="border-border bg-card shadow-sm hover:border-primary/40 transition-colors flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center">
                  <Target className="h-5 w-5" />
                </div>
                <Badge variant="outline" className="text-xs font-mono font-semibold border-primary/50 text-primary">
                  {careerIntel.matchesCount} Live Drives
                </Badge>
              </div>
              <CardTitle className="text-base font-heading mt-2">Smart Drive Matching</CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Direct collegiate eligibility tracking &amp; AI competency alignment with campus drives.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="p-2.5 rounded-lg bg-surface border border-border space-y-1">
                <span className="text-[11px] text-text-secondary font-mono uppercase tracking-wider block">
                  Highest Fit Opportunity
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary">
                    {careerIntel.highestMatchScore > 0
                      ? `${careerIntel.highestMatchScore}% Competency Match`
                      : "Calculating alignment..."}
                  </span>
                  <TrendingUp className="h-3.5 w-3.5 text-secondary" />
                </div>
              </div>

              <p className="text-[11px] text-text-secondary leading-relaxed">
                Compare verified criteria (CGPA, backlogs) with AI skill gap analysis for immediate application.
              </p>

              <Button asChild variant="outline" size="sm" className="w-full justify-between mt-2">
                <Link href="/dashboard/student/placement-matches">
                  <span>Explore Matches</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Career Improvement Suite (Phase 02) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold font-heading text-text-primary">
                Career Improvement &amp; Practice Suite
              </h2>
              <Badge variant="outline" className="text-[10px] font-mono px-2 py-0.5 border-[#2E8F86]/40 text-[#2E8F86]">
                <Sparkles className="h-3 w-3 mr-1 text-[#2E8F86] inline" /> Mastery Tools
              </Badge>
            </div>
            <p className="text-xs text-text-secondary">
              Evidence-based skill gap analyzer, verified career passport portfolio, and turn-based AI mock interview studio.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {/* Card 1: AI Skill Gap Analyzer */}
          <Card className="border-border bg-card shadow-sm hover:border-primary/40 transition-colors flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <Badge
                  variant="outline"
                  className="text-xs font-mono font-semibold border-primary/50 text-primary"
                >
                  {careerImprovement.skillGapReadinessScore !== null
                    ? `${careerImprovement.skillGapReadinessScore}% Ready`
                    : "Ready to Analyze"}
                </Badge>
              </div>
              <CardTitle className="text-base font-heading mt-2">AI Skill Gap Analyzer</CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Map target job roles or campus drives to verified skill tiers &amp; phased milestones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="p-2.5 rounded-lg bg-surface border border-border space-y-1">
                <span className="text-[11px] text-text-secondary font-mono uppercase tracking-wider block">
                  Target Role
                </span>
                <p className="text-xs font-semibold text-text-primary truncate">
                  {careerImprovement.skillGapTargetRole || "No target role evaluated"}
                </p>
              </div>

              <p className="text-[11px] text-text-secondary leading-relaxed">
                Evaluates verified campus assessments, project evidence, and resume claims into structured learning paths.
              </p>

              <Button asChild variant="outline" size="sm" className="w-full justify-between mt-2">
                <Link href="/dashboard/student/skill-gap">
                  <span>Analyze Skill Gaps</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Card 2: Student Career Passport */}
          <Card className="border-border bg-card shadow-sm hover:border-primary/40 transition-colors flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center">
                  <Award className="h-5 w-5" />
                </div>
                <Badge
                  variant="outline"
                  className="text-xs font-mono font-semibold border-secondary/50 text-secondary"
                >
                  {careerImprovement.passportVisibility === "SHAREABLE"
                    ? "Shareable"
                    : careerImprovement.passportVisibility === "COLLEGE_VISIBLE"
                    ? "College Visible"
                    : "Private"}
                </Badge>
              </div>
              <CardTitle className="text-base font-heading mt-2">Student Career Passport</CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Verified portfolio with privacy controls, recruiter share links, and branded PDF exports.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="p-2.5 rounded-lg bg-surface border border-border space-y-1">
                <span className="text-[11px] text-text-secondary font-mono uppercase tracking-wider block">
                  Passport Status
                </span>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                  <ShieldCheck className="h-3.5 w-3.5 text-secondary" />
                  <span>Student Controlled Visibility</span>
                </div>
              </div>

              <p className="text-[11px] text-text-secondary leading-relaxed">
                Cryptographic share tokens ensure tamper-proof portfolio previews for campus and off-campus recruiters.
              </p>

              <Button asChild variant="outline" size="sm" className="w-full justify-between mt-2">
                <Link href="/dashboard/student/career-passport">
                  <span>Manage Passport</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Card 3: AI Mock Interview Studio */}
          <Card className="border-border bg-card shadow-sm hover:border-primary/40 transition-colors flex flex-col justify-between">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center">
                  <Bot className="h-5 w-5" />
                </div>
                <Badge
                  variant="outline"
                  className="text-xs font-mono font-semibold border-primary/50 text-primary"
                >
                  {careerImprovement.interviewSessionsCount > 0
                    ? `${careerImprovement.interviewSessionsCount} Sessions`
                    : "5 Practice Modes"}
                </Badge>
              </div>
              <CardTitle className="text-base font-heading mt-2">AI Mock Interview Studio</CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Turn-based technical, HR, behavioral, project, and company-specific interview sessions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="p-2.5 rounded-lg bg-surface border border-border space-y-1">
                <span className="text-[11px] text-text-secondary font-mono uppercase tracking-wider block">
                  Practice Performance
                </span>
                <p className="text-xs font-semibold text-text-primary truncate">
                  {careerImprovement.interviewAvgScore !== null
                    ? `Average Score: ${careerImprovement.interviewAvgScore}/100`
                    : "No completed interviews yet"}
                </p>
              </div>

              <p className="text-[11px] text-text-secondary leading-relaxed">
                6-dimension rubric evaluation, actionable strengths &amp; weaknesses, and illustrative model answers.
              </p>

              <Button asChild variant="outline" size="sm" className="w-full justify-between mt-2">
                <Link href="/dashboard/student/mock-interview">
                  <span>Open Interview Studio</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

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
