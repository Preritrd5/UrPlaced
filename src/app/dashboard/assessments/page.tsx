"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileCheck,
  PlusCircle,
  Clock,
  Users,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Sparkles,
  ChevronRight,
  BookOpen,
  ArrowRight,
  RefreshCw,
  Loader2,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { TableSkeleton } from "@/components/ui/page-skeletons";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
  confirmDialog,
} from "@/components/ui/dialog";

export default function StaffAssessmentsPage() {
  const router = useRouter();
  const { role, isPlatformAdmin, isLoading: isLoadingAuth } = useAuthContext();
  const [assessments, setAssessments] = useState<any[]>([]);
  const [questionSets, setQuestionSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"ALL" | "PUBLISHED" | "DRAFT" | "ARCHIVED">("ALL");

  const canViewAssessments = isPlatformAdmin || (role && ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"].includes(role));

  useEffect(() => {
    if (!isLoadingAuth) {
      if (role === "STUDENT") {
        router.replace("/dashboard/student/assessments");
      } else if (!canViewAssessments) {
        router.replace("/auth/access-denied");
      }
    }
  }, [role, canViewAssessments, isLoadingAuth, router]);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    purpose: "ASSESSMENT",
    question_set_id: "",
    time_limit_minutes: "60",
    allowed_attempts: "1",
    pass_percentage: "60",
    review_policy: "IMMEDIATE",
    release_policy: "IMMEDIATE",
    shuffle_questions: false,
  });

  // Assign Modal State
  const [assigningAssessment, setAssigningAssessment] = useState<any | null>(null);
  const [assignScope, setAssignScope] = useState<"COLLEGE_WIDE" | "COHORT">("COLLEGE_WIDE");
  const [assignForm, setAssignForm] = useState({
    cohort_name: "All Eligible Students",
    window_start: "",
    window_end: "",
    max_attempts_override: "",
  });

  // Delete Draft Assessment State
  const [assessmentToDelete, setAssessmentToDelete] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [assRes, setsRes] = await Promise.all([
        fetch("/api/placement/assessments"),
        fetch("/api/questions/sets"),
      ]);

      if (assRes.ok) {
        const assData = await assRes.json();
        setAssessments(assData);
      }
      if (setsRes.ok) {
        const setsData = await setsRes.json();
        setQuestionSets(setsData);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load assessments.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateAssessment(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.title || !createForm.question_set_id) {
      toast.warning("Title and Question Set are required.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/placement/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: createForm.title,
          description: createForm.description || null,
          purpose: createForm.purpose,
          question_set_id: createForm.question_set_id,
          time_limit_minutes: createForm.time_limit_minutes
            ? Number(createForm.time_limit_minutes)
            : null,
          allowed_attempts: Number(createForm.allowed_attempts || 1),
          pass_percentage: Number(createForm.pass_percentage || 60),
          review_policy: createForm.review_policy,
          release_policy: createForm.release_policy,
          shuffle_questions: createForm.shuffle_questions,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create assessment");
      }

      toast.success("Assessment blueprint created successfully.");
      setShowCreateModal(false);
      setCreateForm({
        title: "",
        description: "",
        purpose: "ASSESSMENT",
        question_set_id: "",
        time_limit_minutes: "60",
        allowed_attempts: "1",
        pass_percentage: "60",
        review_policy: "IMMEDIATE",
        release_policy: "IMMEDIATE",
        shuffle_questions: false,
      });
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create assessment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePublish(assessmentId: string) {
    const confirmed = await confirmDialog({
      title: "Publish Assessment",
      description: "Are you sure you want to publish this assessment? Its question set snapshot will be locked.",
      confirmText: "Publish",
      variant: "primary",
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/placement/assessments/${assessmentId}/publish`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to publish");
      }
      toast.success("Assessment published successfully.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish assessment.");
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assigningAssessment) return;

    const finalCohortName =
      assignScope === "COLLEGE_WIDE"
        ? "All Eligible Students"
        : assignForm.cohort_name.trim();

    if (assignScope === "COHORT" && !finalCohortName) {
      toast.warning("Please specify a target cohort name (e.g. Computer Science - Batch 2026).");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/placement/assessments/${assigningAssessment.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohort_name: finalCohortName,
          window_start: assignForm.window_start || null,
          window_end: assignForm.window_end || null,
          max_attempts_override: assignForm.max_attempts_override
            ? Number(assignForm.max_attempts_override)
            : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to assign assessment");
      }

      toast.success("Assessment assigned successfully!");
      setAssigningAssessment(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign assessment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReleaseResults(assessmentId: string) {
    const confirmed = await confirmDialog({
      title: "Release Assessment Results",
      description: "Release results now? Students will immediately see their scores and question breakdowns.",
      confirmText: "Release Results",
      variant: "primary",
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/placement/assessments/${assessmentId}/release`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to release results");
      }
      toast.success(data.message || "Results released successfully.");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to release results.");
    }
  }

  async function handleConfirmDeleteAssessment() {
    if (!assessmentToDelete) return;
    setDeleteLoading(true);

    try {
      const res = await fetch(`/api/placement/assessments/${assessmentToDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete assessment.");
      }

      toast.success("Assessment deleted successfully.");
      setAssessmentToDelete(null);
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete assessment.");
    } finally {
      setDeleteLoading(false);
    }
  }

  const filteredAssessments = assessments.filter((a) => {
    if (activeTab === "ALL") return true;
    return a.status === activeTab;
  });

  if (isLoadingAuth || (loading && assessments.length === 0)) {
    return (
      <TableSkeleton
        title="Assessments & Student Prep"
        subtitle="Author authoritative assessment activities, schedule availability windows, track participation, and govern result releases."
        columns={5}
        rows={6}
      />
    );
  }

  if (!canViewAssessments) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary font-heading">
              Assessments & Student Prep
            </h1>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Author authoritative assessment activities, schedule availability windows, track participation, and govern result releases.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
          >
            <PlusCircle className="h-4 w-4 mr-2" /> New Assessment
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-text-secondary font-mono uppercase tracking-wider">
              Total Blueprints
            </CardTitle>
            <BookOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-text-primary">
              {assessments.length}
            </div>
            <p className="text-[11px] text-text-muted mt-1">Created in current college workspace</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-text-secondary font-mono uppercase tracking-wider">
              Published & Active
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-text-primary">
              {assessments.filter((a) => a.status === "PUBLISHED").length}
            </div>
            <p className="text-[11px] text-text-muted mt-1">Open for cohort assignments & attempts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-text-secondary font-mono uppercase tracking-wider">
              Question Sets
            </CardTitle>
            <FileCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-text-primary">
              {questionSets.length}
            </div>
            <p className="text-[11px] text-text-muted mt-1">Managed via QuestionBank Sentinel</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-text-secondary font-mono uppercase tracking-wider">
              Total Attempts
            </CardTitle>
            <Users className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-heading text-text-primary">
              {assessments.reduce((sum, a) => sum + (a.attemptCount || 0), 0)}
            </div>
            <p className="text-[11px] text-text-muted mt-1">Candidate attempts recorded</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-border gap-2">
        {(["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Directory List */}
      {loading ? (
        <div className="py-12 text-center text-text-muted">Loading assessments...</div>
      ) : filteredAssessments.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="h-10 w-10 text-text-muted mx-auto mb-3" />
            <h3 className="text-base font-semibold text-text-primary">No Assessments Found</h3>
            <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
              Create your first assessment blueprint by selecting an approved question set from QuestionBank Sentinel.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={() => setShowCreateModal(true)}
            >
              <PlusCircle className="h-4 w-4 mr-2" /> Create Assessment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAssessments.map((a) => (
            <Card key={a.id} className="flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={a.status === "PUBLISHED" ? "default" : "outline"}>
                    {a.status}
                  </Badge>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {a.purpose}
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold text-text-primary mt-2">
                  {a.title}
                </CardTitle>
                <CardDescription className="text-xs line-clamp-2">
                  {a.description || "No description provided."}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary border-t border-border pt-3">
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase font-mono">Time Limit</span>
                    <span className="font-medium text-text-primary">
                      {a.time_limit_minutes ? `${a.time_limit_minutes} mins` : "Untimed"}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase font-mono">Attempts Allowed</span>
                    <span className="font-medium text-text-primary">{a.allowed_attempts} max</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase font-mono">Pass Mark</span>
                    <span className="font-medium text-text-primary">{a.pass_percentage}%</span>
                  </div>
                  <div>
                    <span className="text-text-muted block text-[10px] uppercase font-mono">Attempts Taken</span>
                    <span className="font-medium text-text-primary">{a.attemptCount || 0}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
                  {a.status === "DRAFT" && (
                    <>
                      <Button
                        variant="primary"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => handlePublish(a.id)}
                      >
                        Publish
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8 text-status-danger hover:bg-[var(--color-danger-subtle)] hover:text-status-danger"
                        onClick={() => setAssessmentToDelete(a)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    </>
                  )}

                  {a.status === "PUBLISHED" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => {
                        setAssigningAssessment(a);
                        setAssignScope("COLLEGE_WIDE");
                        setAssignForm({
                          cohort_name: "All Eligible Students",
                          window_start: "",
                          window_end: "",
                          max_attempts_override: "",
                        });
                      }}
                    >
                      <Users className="h-3.5 w-3.5 mr-1.5" /> Assign Assessment
                    </Button>
                  )}

                  {a.release_policy === "MANUAL_STAFF_RELEASE" && a.status === "PUBLISHED" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8 text-secondary"
                      onClick={() => handleReleaseResults(a.id)}
                    >
                      Release Results
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Assessment Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-xl max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border border-border shadow-2xl rounded-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-border bg-card shrink-0">
            <DialogTitle className="text-xl font-bold font-heading text-text-primary">
              New Assessment Blueprint
            </DialogTitle>
            <DialogDescription className="text-xs text-text-secondary mt-1">
              Bind an approved question set, configure server timers, pass marks, and result governance.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAssessment} noValidate className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <Label htmlFor="title" className="text-xs font-medium text-text-primary">
                  Title <span className="text-status-danger">*</span>
                </Label>
                <Input
                  id="title"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  placeholder="e.g. TCS Ninja Diagnostic Assessment 2025"
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="qset" className="text-xs font-medium text-text-primary">
                    Question Set <span className="text-status-danger">*</span>
                  </Label>
                  <Link
                    href="/dashboard/questions/sets"
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    + Manage Question Sets
                  </Link>
                </div>
                <select
                  id="qset"
                  value={createForm.question_set_id}
                  onChange={(e) => setCreateForm({ ...createForm, question_set_id: e.target.value })}
                  className="w-full mt-1 border border-border rounded-md px-3 py-2 text-sm bg-input text-text-primary"
                  required
                >
                  <option value="">-- Select Question Set --</option>
                  {questionSets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.purpose}) - {s.is_locked ? "Locked" : "Draft"}
                    </option>
                  ))}
                </select>
                {questionSets.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No Question Sets found.{" "}
                    <Link href="/dashboard/questions/sets" className="underline font-semibold">
                      Assemble a Question Set
                    </Link>{" "}
                    with verified questions before creating an assessment.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="purpose" className="text-xs font-medium text-text-primary">Purpose</Label>
                  <select
                    id="purpose"
                    value={createForm.purpose}
                    onChange={(e) => setCreateForm({ ...createForm, purpose: e.target.value })}
                    className="w-full mt-1 border border-border rounded-md px-3 py-2 text-sm bg-input text-text-primary"
                  >
                    <option value="ASSESSMENT">Assessment</option>
                    <option value="PRACTICE">Practice</option>
                    <option value="DIAGNOSTIC">Diagnostic</option>
                    <option value="COMPANY_PREP">Company Prep</option>
                    <option value="INTERVIEW">Interview</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="timeLimit" className="text-xs font-medium text-text-primary">Time Limit (mins)</Label>
                  <Input
                    id="timeLimit"
                    type="number"
                    value={createForm.time_limit_minutes}
                    onChange={(e) => setCreateForm({ ...createForm, time_limit_minutes: e.target.value })}
                    placeholder="e.g. 60 (blank for untimed)"
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="attempts" className="text-xs font-medium text-text-primary">Allowed Attempts</Label>
                  <Input
                    id="attempts"
                    type="number"
                    min="1"
                    value={createForm.allowed_attempts}
                    onChange={(e) => setCreateForm({ ...createForm, allowed_attempts: e.target.value })}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="passMark" className="text-xs font-medium text-text-primary">Pass Percentage (%)</Label>
                  <Input
                    id="passMark"
                    type="number"
                    min="1"
                    max="100"
                    value={createForm.pass_percentage}
                    onChange={(e) => setCreateForm({ ...createForm, pass_percentage: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reviewPolicy" className="text-xs font-medium text-text-primary">Review Policy</Label>
                  <select
                    id="reviewPolicy"
                    value={createForm.review_policy}
                    onChange={(e) => setCreateForm({ ...createForm, review_policy: e.target.value })}
                    className="w-full mt-1 border border-border rounded-md px-3 py-2 text-sm bg-input text-text-primary"
                  >
                    <option value="IMMEDIATE">Immediate</option>
                    <option value="AFTER_DEADLINE">After Deadline</option>
                    <option value="NEVER">Never</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="releasePolicy" className="text-xs font-medium text-text-primary">Release Policy</Label>
                  <select
                    id="releasePolicy"
                    value={createForm.release_policy}
                    onChange={(e) => setCreateForm({ ...createForm, release_policy: e.target.value })}
                    className="w-full mt-1 border border-border rounded-md px-3 py-2 text-sm bg-input text-text-primary"
                  >
                    <option value="IMMEDIATE">Immediate</option>
                    <option value="AFTER_DEADLINE">After Deadline</option>
                    <option value="MANUAL_STAFF_RELEASE">Manual Staff Release</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="shuffle"
                  checked={createForm.shuffle_questions}
                  onChange={(e) => setCreateForm({ ...createForm, shuffle_questions: e.target.checked })}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="shuffle" className="text-xs font-medium text-text-primary cursor-pointer">
                  Shuffle question presentation order for each attempt
                </Label>
              </div>

              <div>
                <Label htmlFor="desc" className="text-xs font-medium text-text-primary">Instructions / Description</Label>
                <Textarea
                  id="desc"
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={2}
                  className="mt-1"
                  placeholder="Provide exam rules, allowed tools, or topic focus..."
                />
              </div>
            </div>

            <DialogFooter className="p-4 sm:p-6 sm:py-4 border-t border-border bg-surface/50 flex flex-row justify-end gap-3 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreateModal(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Blueprint"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign Cohort Modal */}
      <Dialog
        open={!!assigningAssessment}
        onOpenChange={(open) => {
          if (!open) setAssigningAssessment(null);
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border border-border shadow-2xl rounded-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-border bg-card shrink-0">
            <DialogTitle className="text-xl font-bold font-heading text-text-primary">
              Schedule & Assign Assessment
            </DialogTitle>
            <DialogDescription className="text-xs text-text-secondary mt-1">
              Assign <span className="font-semibold text-text-primary">{assigningAssessment?.title}</span> to a cohort with availability windows.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAssign} noValidate className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-text-primary">Assignment Scope *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignScope("COLLEGE_WIDE");
                      setAssignForm((prev) => ({ ...prev, cohort_name: "All Eligible Students" }));
                    }}
                    className={`px-3 py-2 text-xs font-semibold rounded-md border text-left transition-colors ${
                      assignScope === "COLLEGE_WIDE"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-input text-text-secondary hover:bg-card"
                    }`}
                  >
                    College-Wide
                    <span className="block text-[10px] font-normal text-text-muted mt-0.5">
                      All enrolled students in college
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignScope("COHORT");
                      setAssignForm((prev) => ({
                        ...prev,
                        cohort_name: prev.cohort_name === "All Eligible Students" ? "" : prev.cohort_name,
                      }));
                    }}
                    className={`px-3 py-2 text-xs font-semibold rounded-md border text-left transition-colors ${
                      assignScope === "COHORT"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-input text-text-secondary hover:bg-card"
                    }`}
                  >
                    Specific Cohort
                    <span className="block text-[10px] font-normal text-text-muted mt-0.5">
                      Branch, batch, or degree
                    </span>
                  </button>
                </div>

                {assignScope === "COHORT" ? (
                  <div className="pt-1">
                    <Label htmlFor="cohort" className="text-xs font-medium text-text-secondary">
                      Cohort Target Group *
                    </Label>
                    <Input
                      id="cohort"
                      value={assignForm.cohort_name}
                      onChange={(e) => setAssignForm({ ...assignForm, cohort_name: e.target.value })}
                      placeholder="e.g. Computer Science - Batch 2026"
                      className="mt-1"
                      required
                    />
                    <p className="text-[11px] text-text-muted mt-1">
                      Only active students matching this department, degree, or graduation batch will gain access.
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-md bg-secondary-accent/10 border border-secondary-accent/20 text-xs text-text-primary">
                    <span className="font-semibold text-secondary-accent">College-Wide Access:</span>{" "}
                    All active, enrolled students across every department in this college tenant will be eligible.
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="wstart" className="text-xs font-medium text-text-primary">Window Start</Label>
                  <Input
                    id="wstart"
                    type="datetime-local"
                    value={assignForm.window_start}
                    onChange={(e) => setAssignForm({ ...assignForm, window_start: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="wend" className="text-xs font-medium text-text-primary">Window End</Label>
                  <Input
                    id="wend"
                    type="datetime-local"
                    value={assignForm.window_end}
                    onChange={(e) => setAssignForm({ ...assignForm, window_end: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="overrideAttempts" className="text-xs font-medium text-text-primary">
                  Max Attempts Override (Optional)
                </Label>
                <Input
                  id="overrideAttempts"
                  type="number"
                  min="1"
                  value={assignForm.max_attempts_override}
                  onChange={(e) => setAssignForm({ ...assignForm, max_attempts_override: e.target.value })}
                  placeholder={`Default: ${assigningAssessment?.allowed_attempts}`}
                  className="mt-1"
                />
              </div>
            </div>

            <DialogFooter className="p-4 sm:p-6 sm:py-4 border-t border-border bg-surface/50 flex flex-row justify-end gap-3 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAssigningAssessment(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  "Confirm Assignment"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Draft Assessment Dialog */}
      <DeleteConfirmationDialog
        isOpen={!!assessmentToDelete}
        onOpenChange={(open: boolean) => {
          if (!open) setAssessmentToDelete(null);
        }}
        onConfirm={handleConfirmDeleteAssessment}
        title="Delete Draft Assessment"
        description={`Are you sure you want to delete the draft assessment "${assessmentToDelete?.title}"? This draft blueprint will be permanently removed. This action cannot be undone.`}
        confirmText="Delete Assessment"
        isLoading={deleteLoading}
      />
    </div>
  );
}
