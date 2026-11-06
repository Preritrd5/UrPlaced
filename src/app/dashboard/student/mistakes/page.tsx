"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  Brain,
  HelpCircle,
  Flag,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AIMistakeAnalysisModal } from "@/components/mistakes/ai-mistake-analysis-modal";
import { toast } from "@/components/ui/dialog-system";

export default function StudentMistakesPage() {
  const [loading, setLoading] = useState(true);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [targets, setTargets] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<{
    dueTodayCount: number;
    overdueCount: number;
    upcomingWeekCount: number;
    totalActiveCount: number;
    masteredCount: number;
  }>({
    dueTodayCount: 0,
    overdueCount: 0,
    upcomingWeekCount: 0,
    totalActiveCount: 0,
    masteredCount: 0,
  });
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);

  // Filter States
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedReason, setSelectedReason] = useState<string>("ALL");
  const [selectedSkill, setSelectedSkill] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dueOnly, setDueOnly] = useState<boolean>(false);
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);

  // Quick Reschedule Modal State
  const [reschedulingTarget, setReschedulingTarget] = useState<any | null>(null);
  const [customDueDate, setCustomDueDate] = useState<string>("");
  const [rescheduleNotes, setRescheduleNotes] = useState<string>("");
  const [savingReschedule, setSavingReschedule] = useState(false);

  useEffect(() => {
    loadMistakes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStatus, selectedReason, selectedSkill, dueOnly, overdueOnly]);

  async function loadMistakes() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedStatus !== "ALL") params.set("status", selectedStatus);
      if (selectedReason !== "ALL") params.set("primaryReason", selectedReason);
      if (selectedSkill !== "ALL") params.set("skillId", selectedSkill);
      if (dueOnly) params.set("dueOnly", "true");
      if (overdueOnly) params.set("overdueOnly", "true");
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/student/mistakes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTargets(data.targets || []);
        if (data.metrics) setMetrics(data.metrics);
        if (data.availableSkills) setAvailableSkills(data.availableSkills);
      }
    } catch {
      // Handled silently
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadMistakes();
  }

  async function handleRescheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reschedulingTarget || !customDueDate) return;

    try {
      setSavingReschedule(true);
      const res = await fetch(`/api/student/mistakes/${reschedulingTarget.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customDueDate: new Date(customDueDate).toISOString(),
          notes: rescheduleNotes,
        }),
      });

      if (res.ok) {
        setReschedulingTarget(null);
        setCustomDueDate("");
        setRescheduleNotes("");
        toast.success("Review target rescheduled successfully.");
        loadMistakes();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to reschedule target.");
      }
    } finally {
      setSavingReschedule(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "MASTERY_DEMONSTRATED":
        return <Badge className="bg-[#2E8F86] text-white">Mastery Demonstrated</Badge>;
      case "PROVISIONAL_MASTERY":
        return <Badge className="bg-[#2E8F86]/80 text-white">Provisional Mastery</Badge>;
      case "IMPROVING":
        return <Badge className="bg-[#5052C9] text-white">Improving</Badge>;
      case "PRACTISING":
        return <Badge variant="secondary">Practising</Badge>;
      case "REVISION_DUE":
        return <Badge variant="danger">Revision Due</Badge>;
      case "CONTENT_DEFECT_SUSPECTED":
        return <Badge variant="outline" className="border-amber-500 text-amber-700">Defect Suspected</Badge>;
      case "CONTENT_INVALIDATED":
        return <Badge variant="outline" className="border-gray-400 text-gray-500 line-through">Invalidated Defect</Badge>;
      case "RESOLVED_DISMISSED":
        return <Badge variant="outline">Dismissed</Badge>;
      default:
        return <Badge variant="outline" className="text-amber-700 border-amber-300">Needs Review</Badge>;
    }
  }

  function getReasonBadge(reason: string) {
    switch (reason) {
      case "INCORRECT_ANSWER":
        return <Badge variant="outline" className="text-rose-700 border-rose-300 bg-rose-50/50">Incorrect Answer</Badge>;
      case "SKIPPED_UNANSWERED":
        return <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50/50">Skipped Question</Badge>;
      case "STUDENT_FLAGGED":
        return <Badge variant="outline" className="text-indigo-700 border-indigo-300 bg-indigo-50/50">Flagged for Review</Badge>;
      case "CORRECT_REVIEW_LATER":
        return <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50/50">Got Right & Flagged</Badge>;
      case "CONTENT_DEFECT_SUSPECTED":
        return <Badge variant="outline" className="text-amber-800 border-amber-400">Content Issue</Badge>;
      default:
        return <Badge variant="outline">{reason}</Badge>;
    }
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary font-heading">
              Mistake Bank & Spaced Revision
            </h1>
            <Badge variant="secondary">Mistake-to-Mastery Engine</Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Turn errors into verified mastery. Track what went wrong, revisit explanations, and prove skill retention with new-question retests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAiModalOpen(true)}
            className="flex items-center gap-1.5 border-[#5052C9]/30 text-[#5052C9] hover:bg-[#5052C9]/10"
          >
            <Sparkles className="h-4 w-4 text-[#5052C9]" />
            <span>AI Gap Analysis</span>
          </Button>

          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/student/mastery" className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span>Skill Mastery Radar</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Spaced Repetition KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card
          className={`cursor-pointer transition-all ${
            dueOnly ? "ring-2 ring-primary border-primary bg-primary/5" : "hover:border-primary/50"
          }`}
          onClick={() => {
            setDueOnly(!dueOnly);
            setOverdueOnly(false);
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">Due Today</span>
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-extrabold text-text-primary mt-2">
              {metrics.dueTodayCount}
            </div>
            <div className="text-[11px] text-text-muted mt-1">
              {dueOnly ? "Filter active (click to clear)" : "Scheduled for review"}
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            overdueOnly ? "ring-2 ring-rose-500 border-rose-500 bg-rose-50/20" : "hover:border-rose-400"
          }`}
          onClick={() => {
            setOverdueOnly(!overdueOnly);
            setDueOnly(false);
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-rose-700">Overdue (&gt;24h)</span>
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            </div>
            <div className="text-2xl font-extrabold text-rose-700 mt-2">
              {metrics.overdueCount}
            </div>
            <div className="text-[11px] text-text-muted mt-1">
              {overdueOnly ? "Filter active" : "Needs immediate catch-up"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">Upcoming (7d)</span>
              <Calendar className="h-4 w-4 text-secondary" />
            </div>
            <div className="text-2xl font-extrabold text-text-primary mt-2">
              {metrics.upcomingWeekCount}
            </div>
            <div className="text-[11px] text-text-muted mt-1">Next revision intervals</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">Active Items</span>
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-extrabold text-text-primary mt-2">
              {metrics.totalActiveCount}
            </div>
            <div className="text-[11px] text-text-muted mt-1">In practice or revision</div>
          </CardContent>
        </Card>

        <Card className="bg-[#2E8F86]/10 border-[#2E8F86]/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#2E8F86]">Mastered</span>
              <CheckCircle2 className="h-4 w-4 text-[#2E8F86]" />
            </div>
            <div className="text-2xl font-extrabold text-[#2E8F86] mt-2">
              {metrics.masteredCount}
            </div>
            <div className="text-[11px] text-[#2E8F86]/80 mt-1">Retested & verified</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-muted" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions by prompt, skill, or topic tag..."
                  className="pl-9 bg-input text-text-primary"
                />
              </div>
              <Button type="submit" variant="secondary" size="sm">
                Search
              </Button>
            </form>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs rounded-md border border-border bg-input px-3 py-2 text-text-primary font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
              <option value="PRACTISING">Practising</option>
              <option value="IMPROVING">Improving</option>
              <option value="PROVISIONAL_MASTERY">Provisional Mastery</option>
              <option value="MASTERY_DEMONSTRATED">Mastery Demonstrated</option>
              <option value="CONTENT_DEFECT_SUSPECTED">Defect Suspected</option>
              <option value="RESOLVED_DISMISSED">Dismissed</option>
            </select>

            {/* Primary Reason Filter */}
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="text-xs rounded-md border border-border bg-input px-3 py-2 text-text-primary font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="ALL">All Error Reasons</option>
              <option value="INCORRECT_ANSWER">Incorrect Answer</option>
              <option value="SKIPPED_UNANSWERED">Skipped Question</option>
              <option value="STUDENT_FLAGGED">Flagged for Review</option>
              <option value="CORRECT_REVIEW_LATER">Correct & Review Later</option>
              <option value="CONTENT_DEFECT_SUSPECTED">Defect Suspected</option>
            </select>

            {/* Canonical Skill Filter */}
            <select
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="text-xs rounded-md border border-border bg-input px-3 py-2 text-text-primary font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="ALL">All Skills</option>
              {availableSkills.map((sk) => (
                <option key={sk.id} value={sk.id}>
                  {sk.name}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Target Directory List */}
      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3" role="status" aria-busy="true">
            <span className="sr-only">Loading mistake bank items...</span>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-48 rounded" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <Skeleton className="h-3.5 w-3/4 rounded" />
                <div className="flex items-center gap-3 pt-1">
                  <Skeleton className="h-3 w-28 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : targets.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <CheckCircle2 className="h-10 w-10 text-secondary mx-auto mb-3" />
              <h3 className="text-base font-semibold text-text-primary">No Mistake Items Match Your Filter</h3>
              <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                {dueOnly || overdueOnly
                  ? "Great job! You have no items due for revision under the selected filter."
                  : "As you take assessments and practice drills, any questions you miss or flag will be automatically organized here for spaced retention."}
              </p>
              {(dueOnly || overdueOnly || selectedStatus !== "ALL" || selectedReason !== "ALL" || selectedSkill !== "ALL") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setSelectedStatus("ALL");
                    setSelectedReason("ALL");
                    setSelectedSkill("ALL");
                    setDueOnly(false);
                    setOverdueOnly(false);
                    setSearchQuery("");
                  }}
                >
                  Reset All Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {targets.map((target) => {
              const qv = target.question_versions;
              const skill = target.canonical_skills;
              const isOverdue =
                new Date(target.next_due_at).getTime() < Date.now() - 24 * 60 * 60 * 1000;
              const isDueToday = new Date(target.next_due_at).getTime() <= Date.now();

              return (
                <Card
                  key={target.id}
                  className={`hover:border-primary/50 transition-all ${
                    isOverdue
                      ? "border-l-4 border-l-rose-500"
                      : isDueToday
                      ? "border-l-4 border-l-primary"
                      : ""
                  }`}
                >
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-2 flex-1">
                        {/* Meta Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          {getStatusBadge(target.status)}
                          {getReasonBadge(target.primary_reason)}
                          {skill && (
                            <Badge variant="secondary" className="font-mono text-[11px]">
                              {skill.name}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-text-muted font-mono text-[11px]">
                            Stage {target.revision_stage}/5
                          </Badge>
                          {target.occurrence_count > 1 && (
                            <Badge variant="danger" className="text-[11px]">
                              Missed {target.occurrence_count}x
                            </Badge>
                          )}
                        </div>

                        {/* Prompt Preview */}
                        <p className="text-sm font-medium text-text-primary line-clamp-2">
                          {qv?.prompt || "Question prompt unavailable."}
                        </p>

                        {/* Student Reflection Snippet */}
                        {target.student_reflection && (
                          <div className="text-xs text-text-secondary bg-[#EDECE7]/40 p-2 rounded border border-border/50">
                            <span className="font-semibold text-primary">Your Reflection: </span>
                            {target.student_reflection}
                          </div>
                        )}

                        {/* Timing Metadata */}
                        <div className="flex items-center gap-4 text-xs text-text-muted pt-1">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            Next due:{" "}
                            <span
                              className={`font-semibold ${
                                isOverdue
                                  ? "text-rose-600 font-bold"
                                  : isDueToday
                                  ? "text-primary font-bold"
                                  : "text-text-secondary"
                              }`}
                            >
                              {new Date(target.next_due_at).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </span>

                          <span>
                            First observed:{" "}
                            {new Date(target.first_observed_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center sm:flex-col gap-2 shrink-0 self-end sm:self-center">
                        <Button size="sm" asChild className="w-full">
                          <Link href={`/dashboard/student/mistakes/${target.id}`} className="flex items-center gap-1.5">
                            <span>Review & Drill</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-text-muted hover:text-text-primary"
                          onClick={() => {
                            setReschedulingTarget(target);
                            setCustomDueDate(target.next_due_at.split("T")[0]);
                          }}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reschedule
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Reschedule Modal */}
      {reschedulingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-hidden">
          <Card className="w-full max-w-md min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden shadow-2xl bg-card border-border">
            <CardHeader className="shrink-0 pb-3 border-b border-border">
              <CardTitle className="text-lg font-heading text-text-primary">
                Reschedule Revision Target
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Adjust when this item appears next in your Spaced Repetition queue.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleRescheduleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pr-3 sm:pr-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Next Due Date</label>
                  <Input
                    type="date"
                    required
                    value={customDueDate}
                    onChange={(e) => setCustomDueDate(e.target.value)}
                    className="bg-input text-text-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Notes (Optional)</label>
                  <Input
                    placeholder="e.g. Will revisit after reviewing DBMS lecture"
                    value={rescheduleNotes}
                    onChange={(e) => setRescheduleNotes(e.target.value)}
                    className="bg-input text-text-primary"
                  />
                </div>
              </CardContent>

              <div className="shrink-0 p-3.5 sm:p-4 border-t border-border bg-surface/50 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setReschedulingTarget(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={savingReschedule}>
                  {savingReschedule ? "Saving..." : "Save Due Date"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {/* AI Gap Analysis Modal */}
      <AIMistakeAnalysisModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
      />
    </div>
  );
}
