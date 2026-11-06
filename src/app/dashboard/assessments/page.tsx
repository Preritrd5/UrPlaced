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
  Trash2,
  Settings2,
} from "lucide-react";
import { BrandLoader } from "@/components/common/brand-loader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { TableSkeleton, AssessmentListSkeleton } from "@/components/ui/page-skeletons";
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
  const canManageAssessments = isPlatformAdmin || (role && ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"].includes(role));

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
  const [isManageMode, setIsManageMode] = useState(false);
  const [assignScope, setAssignScope] = useState<"COLLEGE_WIDE" | "DEPARTMENT" | "BATCH" | "COHORT">("COLLEGE_WIDE");
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<number[]>([]);
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
      const [assRes, setsRes, deptRes] = await Promise.all([
        fetch("/api/placement/assessments"),
        fetch("/api/questions/sets"),
        fetch("/api/placement/departments").catch(() => null),
      ]);

      if (assRes.ok) {
        const assData = await assRes.json();
        setAssessments(assData);
      }
      if (setsRes.ok) {
        const setsData = await setsRes.json();
        setQuestionSets(setsData);
      }
      if (deptRes && deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(Array.isArray(deptData) ? deptData : []);
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

    let finalCohortName = assignForm.cohort_name.trim();

    if (assignScope === "COLLEGE_WIDE") {
      finalCohortName = "All Eligible Students";
    } else if (assignScope === "DEPARTMENT") {
      if (selectedDepartments.length === 0) {
        toast.warning("Please select at least one department.");
        return;
      }
      const names = departments
        .filter((d) => selectedDepartments.includes(d.id))
        .map((d) => d.code || d.name)
        .join(", ");
      finalCohortName = `Dept: ${names}`;
    } else if (assignScope === "BATCH") {
      if (selectedBatches.length === 0) {
        toast.warning("Please select at least one graduation batch.");
        return;
      }
      finalCohortName = `Batch ${selectedBatches.join(", ")}`;
    } else if (assignScope === "COHORT") {
      if (!finalCohortName) {
        toast.warning("Please specify a target cohort name (e.g. Computer Science - Batch 2026).");
        return;
      }
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/placement/assessments/${assigningAssessment.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohort_name: finalCohortName,
          target_type: assignScope,
          department_ids: assignScope === "DEPARTMENT" ? selectedDepartments : undefined,
          graduation_years: assignScope === "BATCH" ? selectedBatches : undefined,
          window_start: assignForm.window_start || null,
          window_end: assignForm.window_end || null,
          max_attempts_override: assignForm.max_attempts_override
            ? Number(assignForm.max_attempts_override)
            : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to assign assessment");
      }

      const count = data.recipientCount ?? 0;
      toast.success(
        count > 0
          ? `Assessment assigned to ${count} student(s) successfully!`
          : "Assessment assigned successfully!"
      );
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

      toast.success(data.message || "Assessment deleted successfully.");
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
    return <AssessmentListSkeleton />;
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
      <div className="flex border-b border-border gap-2 overflow-x-auto scrollbar-none max-w-full">
        {(["ALL", "PUBLISHED", "DRAFT", "ARCHIVED"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
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
        <AssessmentListSkeleton />
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
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant={a.status === "PUBLISHED" ? "default" : "outline"}>
                      {a.status}
                    </Badge>
                    {a.status === "PUBLISHED" && (
                      (a.is_assigned || a.isAssigned) ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 text-[10px]"
                        >
                          ASSIGNED
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-amber-50 text-amber-700 border-amber-300 font-medium dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800 text-[10px]"
                        >
                          NOT ASSIGNED
                        </Badge>
                      )
                    )}
                  </div>
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

                {(a.is_assigned || a.isAssigned) && (
                  <div className="bg-card rounded-lg border border-border p-2.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-text-secondary">
                      <span className="text-text-muted text-[10px] uppercase font-mono">Assigned Cohort</span>
                      <span className="font-medium text-text-primary truncate max-w-[170px]" title={a.assigned_cohort_name || a.assignedCohortName || "All Eligible Students"}>
                        {a.assigned_cohort_name || a.assignedCohortName || "All Eligible Students"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-text-secondary">
                      <span className="text-text-muted text-[10px] uppercase font-mono">Target Recipients</span>
                      <span className="font-semibold text-secondary-accent">
                        {a.assigned_recipients_count ?? a.assignedRecipientsCount ?? 0} students
                      </span>
                    </div>
                    {(a.window_start || a.window_end) && (
                      <div className="flex items-center justify-between text-text-secondary pt-1 border-t border-border/50 text-[11px]">
                        <span className="text-text-muted text-[10px] uppercase font-mono">Window</span>
                        <span className="font-mono text-[10px] text-text-primary">
                          {a.window_start ? new Date(a.window_start).toLocaleDateString() : "Anytime"} &rarr; {a.window_end ? new Date(a.window_end).toLocaleDateString() : "Open"}
                        </span>
                      </div>
                    )}
                  </div>
                )}

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
                    <>
                      {!(a.is_assigned || a.isAssigned) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8"
                          disabled={submitting && assigningAssessment?.id === a.id}
                          onClick={() => {
                            setIsManageMode(false);
                            setAssigningAssessment(a);
                            setAssignScope("COLLEGE_WIDE");
                            setAssignForm({
                              cohort_name: "All Eligible Students",
                              window_start: "",
                              window_end: "",
                              max_attempts_override: "",
                            });
                            setSelectedDepartments([]);
                            setSelectedBatches([]);
                          }}
                        >
                          {submitting && assigningAssessment?.id === a.id ? (
                            <>
                              <BrandLoader size="button" className="mr-1.5" />
                              Assigning...
                            </>
                          ) : (
                            <>
                              <Users className="h-3.5 w-3.5 mr-1.5" /> Assign Assessment
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 text-primary border-primary/30 hover:bg-primary/5 hover:border-primary/50"
                          disabled={submitting && assigningAssessment?.id === a.id}
                          onClick={() => {
                            setIsManageMode(true);
                            setAssigningAssessment(a);
                            const cohort = a.assigned_cohort_name || a.assignedCohortName || "All Eligible Students";
                            setAssignScope(
                              cohort.startsWith("Dept:") ? "DEPARTMENT" :
                              cohort.startsWith("Batch") ? "BATCH" :
                              cohort === "All Eligible Students" ? "COLLEGE_WIDE" : "COHORT"
                            );
                            setAssignForm({
                              cohort_name: cohort,
                              window_start: a.window_start ? new Date(a.window_start).toISOString().slice(0, 16) : "",
                              window_end: a.window_end ? new Date(a.window_end).toISOString().slice(0, 16) : "",
                              max_attempts_override: a.max_attempts_override ? String(a.max_attempts_override) : (a.allowed_attempts ? String(a.allowed_attempts) : ""),
                            });
                            setSelectedDepartments([]);
                            setSelectedBatches([]);
                          }}
                        >
                          <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Manage Assignment
                        </Button>
                      )}

                      {canManageAssessments && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8 text-status-danger hover:bg-[var(--color-danger-subtle)] hover:text-status-danger"
                          onClick={() => setAssessmentToDelete(a)}
                          title="Delete assessment"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                        </Button>
                      )}
                    </>
                  )}

                  {a.status === "ARCHIVED" && canManageAssessments && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-8 text-status-danger hover:bg-[var(--color-danger-subtle)] hover:text-status-danger"
                      onClick={() => setAssessmentToDelete(a)}
                      title="Permanently remove assessment"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
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
        <DialogContent className="sm:max-w-xl min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col p-0 gap-0 overflow-hidden bg-card border border-border shadow-2xl rounded-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-border bg-card shrink-0">
            <DialogTitle className="text-xl font-bold font-heading text-text-primary">
              New Assessment Blueprint
            </DialogTitle>
            <DialogDescription className="text-xs text-text-secondary mt-1">
              Bind an approved question set, configure server timers, pass marks, and result governance.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateAssessment} noValidate className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
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
                    <BrandLoader size="button" className="mr-2" />
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
        <DialogContent className="sm:max-w-lg min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col p-0 gap-0 overflow-hidden bg-card border border-border shadow-2xl rounded-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-border bg-card shrink-0">
            <DialogTitle className="text-xl font-bold font-heading text-text-primary">
              {isManageMode ? "Manage Assessment Assignment" : "Schedule & Assign Assessment"}
            </DialogTitle>
            <DialogDescription className="text-xs text-text-secondary mt-1">
              {isManageMode ? (
                <>
                  Update targeting cohorts, availability windows, or max attempts for{" "}
                  <span className="font-semibold text-text-primary">{assigningAssessment?.title}</span>.
                </>
              ) : (
                <>
                  Assign <span className="font-semibold text-text-primary">{assigningAssessment?.title}</span> with targeted eligibility and availability windows.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAssign} noValidate className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
              {isManageMode && (
                <div className="p-3.5 rounded-xl bg-surface/50 border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Current Persistence Status
                    </span>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 text-[10px]">
                      ASSIGNED
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary pt-1">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-text-muted block">Target Cohort</span>
                      <span className="font-medium text-text-primary truncate block" title={assigningAssessment?.assigned_cohort_name || "All Eligible Students"}>
                        {assigningAssessment?.assigned_cohort_name || "All Eligible Students"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono text-text-muted block">Active Recipients</span>
                      <span className="font-semibold text-secondary-accent">
                        {assigningAssessment?.assigned_recipients_count ?? 0} students
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-medium text-text-primary">
                  {isManageMode ? "Update Assignment Targeting *" : "Assignment Targeting *"}
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                      All students
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignScope("DEPARTMENT")}
                    className={`px-3 py-2 text-xs font-semibold rounded-md border text-left transition-colors ${
                      assignScope === "DEPARTMENT"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-input text-text-secondary hover:bg-card"
                    }`}
                  >
                    Department
                    <span className="block text-[10px] font-normal text-text-muted mt-0.5">
                      By branch
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignScope("BATCH")}
                    className={`px-3 py-2 text-xs font-semibold rounded-md border text-left transition-colors ${
                      assignScope === "BATCH"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-input text-text-secondary hover:bg-card"
                    }`}
                  >
                    Batch / Year
                    <span className="block text-[10px] font-normal text-text-muted mt-0.5">
                      Graduation year
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
                    Custom Cohort
                    <span className="block text-[10px] font-normal text-text-muted mt-0.5">
                      Named group
                    </span>
                  </button>
                </div>

                {assignScope === "COLLEGE_WIDE" && (
                  <div className="p-3 rounded-md bg-secondary-accent/10 border border-secondary-accent/20 text-xs text-text-primary">
                    <span className="font-semibold text-secondary-accent">College-Wide Delivery:</span>{" "}
                    All active enrolled students across every department in Sapthagiri NPS University will immediately receive this assessment in their portal.
                  </div>
                )}

                {assignScope === "DEPARTMENT" && (
                  <div className="p-3 rounded-md bg-card border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-text-primary">
                        Select Target Departments ({selectedDepartments.length} selected)
                      </Label>
                      {departments.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedDepartments.length === departments.length) {
                              setSelectedDepartments([]);
                            } else {
                              setSelectedDepartments(departments.map((d) => d.id));
                            }
                          }}
                          className="text-[11px] text-primary hover:underline"
                        >
                          {selectedDepartments.length === departments.length ? "Deselect All" : "Select All"}
                        </button>
                      )}
                    </div>
                    {departments.length === 0 ? (
                      <p className="text-xs text-text-muted">
                        No departments found. Configure departments in Academic Structure settings.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                        {departments.map((dept) => {
                          const isChecked = selectedDepartments.includes(dept.id);
                          return (
                            <button
                              type="button"
                              key={dept.id}
                              onClick={() => {
                                setSelectedDepartments((prev) =>
                                  isChecked ? prev.filter((id) => id !== dept.id) : [...prev, dept.id]
                                );
                              }}
                              className={`flex items-center justify-between p-2 rounded text-xs border text-left transition-colors ${
                                isChecked
                                  ? "border-primary bg-primary/10 text-primary font-medium"
                                  : "border-border bg-input text-text-secondary hover:bg-surface"
                              }`}
                            >
                              <span className="truncate">{dept.name}</span>
                              {dept.code && (
                                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-text-muted uppercase">
                                  {dept.code}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {assignScope === "BATCH" && (
                  <div className="p-3 rounded-md bg-card border border-border space-y-2">
                    <Label className="text-xs font-medium text-text-primary">
                      Select Graduation Batches ({selectedBatches.length} selected)
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {[2024, 2025, 2026, 2027, 2028, 2029].map((year) => {
                        const isSelected = selectedBatches.includes(year);
                        return (
                          <button
                            type="button"
                            key={year}
                            onClick={() => {
                              setSelectedBatches((prev) =>
                                isSelected ? prev.filter((y) => y !== year) : [...prev, year]
                              );
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              isSelected
                                ? "border-primary bg-primary text-white"
                                : "border-border bg-input text-text-secondary hover:bg-surface"
                            }`}
                          >
                            Class of {year}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {assignScope === "COHORT" && (
                  <div className="p-3 rounded-md bg-card border border-border space-y-2">
                    <Label htmlFor="cohort" className="text-xs font-medium text-text-primary">
                      Cohort Identifier *
                    </Label>
                    <Input
                      id="cohort"
                      value={assignForm.cohort_name}
                      onChange={(e) => setAssignForm({ ...assignForm, cohort_name: e.target.value })}
                      placeholder="e.g. Computer Science - Batch 2026, FastTrack Batch A"
                      className="mt-1"
                      required
                    />
                    <p className="text-[11px] text-text-muted">
                      Students whose profile department or graduation year matches will automatically gain access.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="wstart" className="text-xs font-medium text-text-primary">Window Start (Optional)</Label>
                  <Input
                    id="wstart"
                    type="datetime-local"
                    value={assignForm.window_start}
                    onChange={(e) => setAssignForm({ ...assignForm, window_start: e.target.value })}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="wend" className="text-xs font-medium text-text-primary">Window End (Optional)</Label>
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
                  placeholder={`Default blueprint value: ${assigningAssessment?.allowed_attempts || 1}`}
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
                    <BrandLoader size="button" className="mr-2" />
                    {isManageMode ? "Updating..." : "Assigning..."}
                  </>
                ) : (
                  isManageMode ? "Update Assignment" : "Confirm Assignment"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Assessment Dialog */}
      <DeleteConfirmationDialog
        isOpen={!!assessmentToDelete}
        onOpenChange={(open: boolean) => {
          if (!open) setAssessmentToDelete(null);
        }}
        onConfirm={handleConfirmDeleteAssessment}
        title="Delete Assessment"
        description={`Are you sure you want to delete the assessment "${assessmentToDelete?.title}"? This will permanently delete the assessment blueprint, all candidate attempts, and revoke any student assignments. This action cannot be undone.`}
        confirmText="Delete Assessment"
        isLoading={deleteLoading}
      />
    </div>
  );
}
