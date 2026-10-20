"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Brain,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Users,
  TrendingDown,
  BarChart3,
  Filter,
  Check,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthContext } from "@/lib/auth/auth-context-provider";

export default function PlacementMistakesAnalyticsPage() {
  const router = useRouter();
  const { role, isPlatformAdmin, isLoading: isLoadingAuth } = useAuthContext();
  const [activeTab, setActiveTab] = useState<"SKILLS" | "QUESTIONS" | "DEFECTS">("SKILLS");
  const [loading, setLoading] = useState(true);

  const canViewCohortMistakes = isPlatformAdmin || (role && ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"].includes(role));

  useEffect(() => {
    if (!isLoadingAuth) {
      if (role === "STUDENT") {
        router.replace("/dashboard/student/mistakes");
      } else if (!canViewCohortMistakes) {
        router.replace("/auth/access-denied");
      }
    }
  }, [role, canViewCohortMistakes, isLoadingAuth, router]);

  // Cohort analytics data
  const [summaryData, setSummaryData] = useState<{
    summary: { totalMistakes: number; activeReviews: number; affectedStudentsCount: number };
    skillGaps: any[];
    reasonDistribution: Record<string, number>;
    questionHotspots: any[];
  } | null>(null);

  // Defects data
  const [defects, setDefects] = useState<any[]>([]);
  const [loadingDefects, setLoadingDefects] = useState(false);
  const [resolvingDefect, setResolvingDefect] = useState<any | null>(null);
  const [decision, setDecision] = useState<"CONFIRMED_DEFECT" | "FALSE_ALARM" | "RESOLVED">("CONFIRMED_DEFECT");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [invalidateMistakes, setInvalidateMistakes] = useState(true);
  const [submittingResolution, setSubmittingResolution] = useState(false);

  useEffect(() => {
    loadCohortSummary();
  }, []);

  useEffect(() => {
    if (activeTab === "DEFECTS") {
      loadDefects();
    }
  }, [activeTab]);

  async function loadCohortSummary() {
    try {
      setLoading(true);
      const res = await fetch("/api/placement/mistakes/cohort-summary");
      if (res.ok) {
        const json = await res.json();
        setSummaryData(json);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadDefects() {
    try {
      setLoadingDefects(true);
      const res = await fetch("/api/placement/mistakes/defects");
      if (res.ok) {
        const json = await res.json();
        setDefects(json);
      }
    } finally {
      setLoadingDefects(false);
    }
  }

  async function handleResolveDefectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resolvingDefect || !resolutionNotes.trim()) return;

    try {
      setSubmittingResolution(true);
      const res = await fetch(`/api/placement/mistakes/defects/${resolvingDefect.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          resolutionNotes: resolutionNotes.trim(),
          invalidateStudentMistakes: invalidateMistakes,
        }),
      });

      if (res.ok) {
        setResolvingDefect(null);
        setResolutionNotes("");
        loadDefects();
        loadCohortSummary();
        alert("Defect ticket resolved. Affected student records have been updated.");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to resolve defect.");
      }
    } finally {
      setSubmittingResolution(false);
    }
  }

  if (isLoadingAuth || !canViewCohortMistakes) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary font-heading">
              Cohort Error Analytics & Question Integrity
            </h1>
            <Badge variant="secondary">Staff & Trainer Portal</Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Analyze recurring student skill gaps, pinpoint defective or ambiguous question items, and restore candidate mastery fairly.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">Back to Overview</Link>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <span className="text-xs font-medium text-text-secondary">Total Ingested Errors</span>
            <div className="text-2xl font-extrabold text-text-primary mt-2">
              {summaryData?.summary.totalMistakes || 0}
            </div>
            <span className="text-[11px] text-text-muted mt-1 block">Across all assessments</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs font-medium text-amber-700">Active Review Queue</span>
            <div className="text-2xl font-extrabold text-amber-700 mt-2">
              {summaryData?.summary.activeReviews || 0}
            </div>
            <span className="text-[11px] text-text-muted mt-1 block">Awaiting retest or drill</span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <span className="text-xs font-medium text-text-secondary">Students with Mistakes</span>
            <div className="text-2xl font-extrabold text-text-primary mt-2">
              {summaryData?.summary.affectedStudentsCount || 0}
            </div>
            <span className="text-[11px] text-text-muted mt-1 block">In current cohort</span>
          </CardContent>
        </Card>

        <Card className="bg-[#2E8F86]/10 border-[#2E8F86]/30">
          <CardContent className="p-4">
            <span className="text-xs font-medium text-[#2E8F86]">Pending Question Defects</span>
            <div className="text-2xl font-extrabold text-[#2E8F86] mt-2">
              {defects.filter((d) => d.status === "PENDING").length}
            </div>
            <span className="text-[11px] text-[#2E8F86]/80 mt-1 block">Reported by students</span>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => setActiveTab("SKILLS")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            activeTab === "SKILLS"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Skill Gap Hotspots ({summaryData?.skillGaps?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("QUESTIONS")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            activeTab === "QUESTIONS"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <TrendingDown className="h-4 w-4" />
          <span>Top Question Slip Rates</span>
        </button>

        <button
          onClick={() => setActiveTab("DEFECTS")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 ${
            activeTab === "DEFECTS"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          <span>Question Defect Tickets ({defects.length})</span>
        </button>
      </div>

      {/* Tab 1: Skill Gaps */}
      {activeTab === "SKILLS" && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-text-muted">Loading cohort skill analytics...</div>
          ) : !summaryData?.skillGaps || summaryData.skillGaps.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <CheckCircle2 className="h-10 w-10 text-secondary mx-auto mb-3" />
                <h3 className="text-base font-semibold text-text-primary">No Skill Errors Detected</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Students have either completed no assessments yet or scored 100% across all questions.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {summaryData.skillGaps.map((gap) => (
                <Card key={gap.skillId} className="hover:border-primary/40 transition-all">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-text-primary">{gap.skillName}</span>
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {gap.category.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-text-secondary">
                        <strong className="text-rose-600">{gap.totalMistakes} mistakes</strong> logged by{" "}
                        <strong className="text-text-primary">{gap.studentCount} students</strong> •{" "}
                        <strong className="text-amber-700">{gap.activeReviews} active reviews</strong> pending
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {Math.round((gap.studentCount / (summaryData.summary.affectedStudentsCount || 1)) * 100)}% of Cohort
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Question Hotspots */}
      {activeTab === "QUESTIONS" && (
        <div className="space-y-4">
          {!summaryData?.questionHotspots || summaryData.questionHotspots.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-xs text-text-muted">No high-frequency mistake questions recorded.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {summaryData.questionHotspots.map((q) => (
                <Card key={q.questionId}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="danger" className="text-[11px]">
                          {q.studentCount} Students Failed
                        </Badge>
                        <Badge variant="outline" className="text-[11px] font-mono">
                          {q.skillName}
                        </Badge>
                        <Badge variant="outline" className="text-[11px] font-mono">
                          {q.difficulty}
                        </Badge>
                      </div>

                      <span className="text-xs text-text-muted">
                        Total Fail Occurrences: <strong>{q.totalOccurrences}</strong>
                      </span>
                    </div>

                    <p className="text-xs font-medium text-text-primary line-clamp-2">
                      {q.prompt}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Defect Moderation Queue */}
      {activeTab === "DEFECTS" && (
        <div className="space-y-4">
          {loadingDefects ? (
            <div className="py-12 text-center text-text-muted">Loading question defect tickets...</div>
          ) : defects.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <CheckCircle2 className="h-10 w-10 text-secondary mx-auto mb-3" />
                <h3 className="text-base font-semibold text-text-primary">All Clear! No Defect Tickets</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Students have not reported any suspect questions or erroneous answer keys.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {defects.map((ticket) => (
                <Card key={ticket.id} className="hover:border-primary/40 transition-all">
                  <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={ticket.status === "PENDING" ? "default" : "outline"}
                          className={ticket.status === "CONFIRMED_DEFECT" ? "bg-rose-600 text-white" : ""}
                        >
                          {ticket.status.replace("_", " ")}
                        </Badge>
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {ticket.defect_type.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-xs text-text-muted">
                          Reported: {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="p-2.5 bg-[#EDECE7]/40 rounded border border-border text-xs text-text-primary whitespace-pre-wrap">
                        {ticket.description}
                      </div>

                      {ticket.resolution_notes && (
                        <div className="text-xs text-text-secondary bg-[#2E8F86]/10 p-2 rounded border border-[#2E8F86]/30">
                          <strong className="text-[#2E8F86]">Staff Resolution: </strong>
                          {ticket.resolution_notes}
                        </div>
                      )}
                    </div>

                    {ticket.status === "PENDING" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setResolvingDefect(ticket);
                          setDecision("CONFIRMED_DEFECT");
                          setResolutionNotes("");
                          setInvalidateMistakes(true);
                        }}
                      >
                        Review & Resolve
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Defect Resolution Modal */}
      {resolvingDefect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-heading text-text-primary">
                Resolve Question Defect
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Confirm or dismiss reported question defects and protect student mastery records.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleResolveDefectSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Decision</label>
                  <select
                    value={decision}
                    onChange={(e: any) => setDecision(e.target.value)}
                    className="w-full text-xs rounded-md border border-border bg-input px-3 py-2 text-text-primary font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="CONFIRMED_DEFECT">Confirmed Defect (Question or Key is Erroneous)</option>
                    <option value="FALSE_ALARM">False Alarm (Question & Key are Valid)</option>
                    <option value="RESOLVED">Resolved / Clarified</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">
                    Resolution Notes (Visible to Candidates)
                  </label>
                  <Textarea
                    required
                    rows={3}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="e.g. Confirmed that option B is correct due to errata. Invalidation applied to protect candidates."
                    className="bg-input text-xs text-text-primary"
                  />
                </div>

                {decision === "CONFIRMED_DEFECT" && (
                  <div className="flex items-center gap-2 p-2 bg-amber-50 rounded border border-amber-300 text-xs text-amber-900">
                    <input
                      type="checkbox"
                      id="invalidateCheck"
                      checked={invalidateMistakes}
                      onChange={(e) => setInvalidateMistakes(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="invalidateCheck" className="cursor-pointer font-medium">
                      Automatically invalidate all candidate mistakes for this question and recalculate skill mastery
                    </label>
                  </div>
                )}
              </CardContent>

              <div className="flex justify-end gap-2 p-4 border-t border-border bg-[#EDECE7]/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setResolvingDefect(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingResolution || !resolutionNotes.trim()}
                >
                  {submittingResolution ? "Resolving..." : "Confirm Resolution"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
