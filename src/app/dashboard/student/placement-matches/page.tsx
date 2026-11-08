"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Search,
  Filter,
  Check,
  Briefcase,
  Calendar,
  IndianRupee,
  ChevronRight,
  TrendingUp,
  FileText,
  RefreshCw,
  Info,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";
import type { DriveMatchOpportunity } from "@/modules/students/services/smart-drive-matching-service";

export default function SmartPlacementMatchesPage() {
  const auth = useAuthContext();
  const router = useRouter();

  const [matches, setMatches] = React.useState<DriveMatchOpportunity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Filters & Search
  const [filterTab, setFilterTab] = React.useState<"ALL" | "ELIGIBLE" | "HIGH_MATCH">("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");

  const fetchMatches = React.useCallback(async (selectedFilter: "ALL" | "ELIGIBLE" | "HIGH_MATCH") => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/student/placement-matches?filter=${selectedFilter}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to load placement matches");
      }
      const json = await res.json();
      setMatches(json.data || []);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!auth.isLoading) {
      if (!auth.isAuthenticated) {
        router.push("/auth/signin");
        return;
      }
      if (auth.accountCategory === "COLLEGE") {
        router.push("/dashboard");
        return;
      }
      fetchMatches(filterTab);
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.accountCategory, router, filterTab, fetchMatches]);

  // Client-side text search over current match set
  const filteredMatches = React.useMemo(() => {
    if (!searchQuery.trim()) return matches;
    const q = searchQuery.toLowerCase().trim();
    return matches.filter((m) => {
      return (
        m.companyName.toLowerCase().includes(q) ||
        (m.jobRole && m.jobRole.toLowerCase().includes(q)) ||
        m.driveTitle.toLowerCase().includes(q) ||
        m.matchedSkills.some((s) => s.toLowerCase().includes(q)) ||
        m.missingSkills.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [matches, searchQuery]);

  // Summary counts
  const eligibleCount = React.useMemo(
    () => matches.filter((m) => m.officialEligibility === "ELIGIBLE").length,
    [matches]
  );
  const highMatchCount = React.useMemo(
    () => matches.filter((m) => m.matchScore >= 70).length,
    [matches]
  );
  const appliedCount = React.useMemo(
    () => matches.filter((m) => m.applicationState?.hasApplied).length,
    [matches]
  );

  if (auth.isLoading || (loading && matches.length === 0)) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary font-heading">
              Smart Placement Matches
            </h1>
            <Badge variant="outline" className="px-2.5 py-0.5 text-xs font-semibold border-primary/50 text-primary">
              <Sparkles className="h-3 w-3 mr-1 text-primary inline" /> AI Intelligence
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-text-secondary">
            Algorithmic competency matching against live recruitment drives at {auth.tenant?.name || "your institution"}.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Button asChild variant="outline" size="sm" className="border-border">
            <Link href="/dashboard/student/career-profile" className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              <span>Update Profile</span>
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-border">
            <Link href="/dashboard/student/resume" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Resume Scanner</span>
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMatches(filterTab)}
            disabled={loading}
            className="border-border"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Advisory Callout: Invariant Separation Notice */}
      <div className="p-4 rounded-xl border border-secondary/30 bg-[var(--color-secondary-subtle)] text-xs text-text-primary flex items-start gap-3 shadow-sm">
        <Info className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-secondary block font-heading">
            Official Eligibility vs. Advisory AI Competency Score
          </span>
          <p className="text-text-secondary leading-relaxed">
            <strong>Official Collegiate Eligibility</strong> is strictly determined by academic requirements (CGPA, active backlogs, department, and graduation year) configured by the College Placement Cell. The <strong>AI Match Score</strong> is an advisory competency rating evaluating your profile and resume against job requirements to help focus your interview preparation. AI scores never override official eligibility.
          </p>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
              Total Live Drives
            </CardTitle>
            <Building2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-text-primary">
              {matches.length}
            </div>
            <p className="text-[11px] text-text-secondary mt-1">Active campus recruitment drives</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
              Officially Eligible
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-secondary">
              {eligibleCount}
            </div>
            <p className="text-[11px] text-text-secondary mt-1">Meets collegiate academic criteria</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
              High Competency Match
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-primary">
              {highMatchCount}
            </div>
            <p className="text-[11px] text-text-secondary mt-1">&ge; 70% skill &amp; project match</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
              Applied Drives
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-text-primary">
              {appliedCount}
            </div>
            <p className="text-[11px] text-text-secondary mt-1">Applications in progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 bg-surface rounded-xl border border-border">
          <Button
            type="button"
            size="sm"
            variant={filterTab === "ALL" ? "primary" : "ghost"}
            onClick={() => setFilterTab("ALL")}
            className={`text-xs px-3 h-8 ${filterTab === "ALL" ? "bg-primary text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
          >
            All Drives ({matches.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filterTab === "ELIGIBLE" ? "primary" : "ghost"}
            onClick={() => setFilterTab("ELIGIBLE")}
            className={`text-xs px-3 h-8 ${filterTab === "ELIGIBLE" ? "bg-primary text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
          >
            Officially Eligible ({eligibleCount})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filterTab === "HIGH_MATCH" ? "primary" : "ghost"}
            onClick={() => setFilterTab("HIGH_MATCH")}
            className={`text-xs px-3 h-8 ${filterTab === "HIGH_MATCH" ? "bg-primary text-white shadow-sm" : "text-text-secondary hover:text-text-primary"}`}
          >
            High Match &ge; 70% ({highMatchCount})
          </Button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, role, skill..."
            className="pl-9 h-9 text-xs bg-input border-border"
          />
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchMatches(filterTab)}
            className="text-destructive underline text-xs"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Opportunities List */}
      {filteredMatches.length === 0 ? (
        <Card className="border-border bg-card p-12 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-[var(--color-primary-subtle)] text-primary mx-auto flex items-center justify-center">
            <Building2 className="h-7 w-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-base font-bold text-text-primary font-heading">
              {searchQuery ? "No Matches Found for Search" : "No Drives Available"}
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              {searchQuery
                ? `No recruitment opportunities matched "${searchQuery}". Try searching for another skill or clearing the search query.`
                : filterTab === "ELIGIBLE"
                ? "There are currently no active drives matching your collegiate criteria (CGPA, department, backlogs). Check back as new companies are added."
                : filterTab === "HIGH_MATCH"
                ? "No drives have reached a 70%+ match score yet. Enhancing your career profile and uploading an updated resume will improve matching accuracy."
                : "No active recruitment drives are currently published for your college. Your placement cell will publish new hiring drives here."}
            </p>
          </div>
          {searchQuery && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="text-xs"
            >
              Clear Search
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredMatches.map((opportunity) => {
            const isEligible = opportunity.officialEligibility === "ELIGIBLE";
            const matchScore = opportunity.matchScore;
            const hasApplied = opportunity.applicationState?.hasApplied;

            // Score color-coding
            const scoreColor =
              matchScore >= 80
                ? "text-secondary border-secondary/40 bg-[var(--color-secondary-subtle)]"
                : matchScore >= 60
                ? "text-primary border-primary/40 bg-[var(--color-primary-subtle)]"
                : "text-amber-700 border-amber-300 bg-amber-50";

            return (
              <Card
                key={opportunity.driveId}
                className="border-border bg-card shadow-sm hover:border-primary/40 transition-all overflow-hidden"
              >
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Top Bar: Company info, Tier, and Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-text-primary font-heading">
                          {opportunity.companyName}
                        </h3>
                        {opportunity.companyTier && (
                          <Badge variant="outline" className="text-[10px] uppercase font-mono px-2 py-0.5 border-border">
                            {opportunity.companyTier}
                          </Badge>
                        )}
                        {hasApplied && (
                          <Badge className="bg-secondary text-white text-[10px] font-semibold">
                            <Check className="h-3 w-3 mr-1 inline" /> Applied
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">
                          {opportunity.jobRole || opportunity.driveTitle}
                        </span>
                        {opportunity.salaryCtc && (
                          <span className="flex items-center gap-1 font-mono text-primary font-semibold">
                            <IndianRupee className="h-3 w-3" />
                            {opportunity.salaryCtc}
                          </span>
                        )}
                        {opportunity.applicationDeadline && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-text-secondary" />
                            Deadline: {new Date(opportunity.applicationDeadline).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Dual Indicators: Official Eligibility + AI Match Pill */}
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end shrink-0">
                      {/* Official Eligibility Badge */}
                      {isEligible ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-secondary/40 bg-[var(--color-secondary-subtle)] text-secondary text-xs font-semibold">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>Officially Eligible</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-destructive/30 bg-destructive/5 text-destructive text-xs font-semibold">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          <span>Criteria Ineligible</span>
                        </div>
                      )}

                      {/* Advisory Match Score Pill */}
                      <div className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border font-mono font-bold text-xs ${scoreColor}`}>
                        <Sparkles className="h-3 w-3" />
                        <span>{matchScore}% AI Match</span>
                      </div>
                    </div>
                  </div>

                  {/* Eligibility Reason Summary if Ineligible */}
                  {!isEligible && opportunity.eligibilityReasons?.summary && (
                    <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/20 text-xs text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      <span>{opportunity.eligibilityReasons.summary}</span>
                    </div>
                  )}

                  {/* AI Match Overview & Reasoning */}
                  {opportunity.matchExplanation && (
                    <p className="text-xs text-text-secondary leading-relaxed bg-surface/50 p-3 rounded-lg border border-border/50">
                      <strong className="text-text-primary">AI Competency Assessment: </strong>
                      {opportunity.matchExplanation}
                    </p>
                  )}

                  {/* Skills Grid: Matched vs Missing */}
                  <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-border/60">
                    {/* Matched Skills */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-secondary font-heading">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Matched Skills ({opportunity.matchedSkills?.length || 0})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {opportunity.matchedSkills && opportunity.matchedSkills.length > 0 ? (
                          opportunity.matchedSkills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-[var(--color-secondary-subtle)] text-secondary border border-secondary/30"
                            >
                              {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-text-secondary italic">
                            No matching skills detected from profile/resume
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Missing / Prep Skills */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 font-heading">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Recommended Skills to Bridge ({opportunity.missingSkills?.length || 0})</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {opportunity.missingSkills && opportunity.missingSkills.length > 0 ? (
                          opportunity.missingSkills.map((skill, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-amber-50 text-amber-800 border border-amber-200"
                            >
                              + {skill}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-secondary font-medium">
                            &check; Comprehensive skill coverage
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recommendations / Highlights if any */}
                  {opportunity.recommendations && opportunity.recommendations.length > 0 && (
                    <div className="space-y-1 text-xs text-text-secondary bg-surface/30 p-2.5 rounded-lg border border-border/40">
                      <span className="font-semibold text-text-primary block font-mono text-[11px] uppercase tracking-wider">
                        Preparation Recommendations:
                      </span>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                        {opportunity.recommendations.slice(0, 2).map((rec, idx) => (
                          <li key={idx} className="leading-snug">
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Card Action Row */}
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <span className="text-[11px] text-text-secondary">
                      {isEligible
                        ? "Officially eligible to register & participate"
                        : "Academic requirements do not match eligibility policy"}
                    </span>

                    <div className="flex items-center gap-2">
                      {hasApplied ? (
                        <Button asChild variant="outline" size="sm" className="text-xs">
                          <Link href="/dashboard/student/applications">
                            <span>View Application</span>
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      ) : isEligible ? (
                        <Button asChild variant="primary" size="sm" className="bg-primary text-white text-xs">
                          <Link href={`/dashboard/student/drives/${opportunity.driveId}`}>
                            <span>Apply to Drive</span>
                            <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild variant="outline" size="sm" className="text-xs border-border">
                          <Link href={`/dashboard/student/drives/${opportunity.driveId}`}>
                            <span>View Drive Details</span>
                            <ChevronRight className="h-3.5 w-3.5 ml-1" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
