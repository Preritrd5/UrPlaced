"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Clock,
  BookOpen,
  CheckSquare,
  Square,
  AlertCircle,
  ExternalLink,
  Layers,
  Award,
  ChevronRight,
  Send,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { AIDriveFitEvaluationCard } from "@/components/drives/ai-drivefit-evaluation-card";

interface PrepPageProps {
  params: Promise<{ id: string }>;
}

export default function DriveStudentPrepPage({ params }: PrepPageProps) {
  const { id: driveId } = use(params);

  const [drive, setDrive] = useState<any | null>(null);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [planSummary, setPlanSummary] = useState<any | null>(null);
  const [experiences, setExperiences] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Experience submission state
  const [showSubmitExperience, setShowSubmitExperience] = useState(false);
  const [expForm, setExpForm] = useState({
    recruitmentCycle: "Campus 2026",
    notes: "",
    isAnonymous: true,
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [driveRes, reqsRes, planRes, expRes] = await Promise.all([
        fetch(`/api/placement/drives/${driveId}`),
        fetch(`/api/placement/drives/${driveId}/intelligence/requirements?publishedOnly=true`),
        fetch(`/api/placement/drives/${driveId}/drivefit/plan`),
        fetch(`/api/placement/drives/${driveId}/experiences`),
      ]);

      if (driveRes.ok) setDrive(await driveRes.json());
      if (reqsRes.ok) setRequirements(await reqsRes.json());
      if (planRes.ok) setPlanSummary(await planRes.json());
      if (expRes.ok) setExperiences(await expRes.json());
    } catch (err: any) {
      setError(err.message || "Failed to load DriveFit preparation plan.");
    } finally {
      setIsLoading(false);
    }
  }, [driveId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toggle Task Status
  async function handleToggleTask(taskId: string, currentStatus: string) {
    const nextStatus = currentStatus === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED";
    try {
      const res = await fetch(`/api/placement/drives/${driveId}/drivefit/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status: nextStatus }),
      });
      if (!res.ok) throw new Error("Failed to update task.");

      // Optimistic update
      setPlanSummary((prev: any) => {
        if (!prev) return prev;
        const updatedTasks = prev.tasks.map((t: any) =>
          t.id === taskId ? { ...t, status: nextStatus } : t
        );
        const completed = updatedTasks.filter((t: any) => t.status === "COMPLETED").length;
        const total = updatedTasks.length;
        return {
          ...prev,
          tasks: updatedTasks,
          metrics: {
            ...prev.metrics,
            completedTasks: completed,
            completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
          },
        };
      });
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Submit candidate experience
  async function handleSubmitExperience(e: React.FormEvent) {
    e.preventDefault();
    if (!drive) return;

    try {
      const res = await fetch(`/api/placement/drives/${driveId}/experiences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: drive.company_id,
          roleTitle: drive.role_title || drive.title,
          recruitmentCycle: expForm.recruitmentCycle,
          notes: expForm.notes,
          isAnonymous: expForm.isAnonymous,
          roundsDescribed: drive.stages?.map((s: any) => s.name) || [],
        }),
      });

      if (!res.ok) throw new Error("Failed to submit candidate experience.");

      setActionSuccess("Experience report submitted for coordinator review. Thank you!");
      setShowSubmitExperience(false);
      setExpForm({ recruitmentCycle: "Campus 2026", notes: "", isAnonymous: true });
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (isLoading) {
    return (
      <div className="p-12 text-center text-text-muted space-y-2">
        <Sparkles className="h-8 w-8 mx-auto animate-pulse text-primary" />
        <p className="text-xs">Assembling your DriveFit preparation plan...</p>
      </div>
    );
  }

  if (!drive) {
    return (
      <div className="p-8 text-center text-text-muted">
        Recruitment drive not found.
      </div>
    );
  }

  const confirmedStages = drive.stages || [];
  const metrics = planSummary?.metrics || { totalTasks: 0, completedTasks: 0, completionPercentage: 0 };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Breadcrumb & Header */}
      <div className="space-y-2 pb-4 border-b border-border">
        <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs text-text-muted">
          <Link href={`/dashboard/drives/${driveId}`}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Drive Overview
          </Link>
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary">
                {drive.company?.name} • DriveFit Hub
              </span>
              <Badge variant="outline" className="text-[10px]">
                {drive.recruitment_type}
              </Badge>
            </div>
            <h1 className="text-2xl font-extrabold font-heading text-text-primary mt-1">
              {drive.title}
            </h1>
            <p className="text-xs text-text-secondary mt-0.5">
              Target Role: <strong className="text-text-primary">{drive.role_title}</strong>
              {drive.compensation_range && ` • Compensation: ${drive.compensation_range}`}
            </p>
          </div>

          {drive.registration_deadline && (
            <div className="p-3 rounded-md bg-card border border-border text-right text-xs">
              <p className="text-[11px] text-text-muted">Registration Deadline</p>
              <p className="font-mono font-bold text-text-primary mt-0.5">
                {new Date(drive.registration_deadline).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Notice</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {actionSuccess && (
        <Alert variant="success" className="bg-[rgba(46,143,134,0.08)] border-secondary/30">
          <CheckCircle2 className="h-4 w-4 text-secondary" />
          <AlertTitle className="text-secondary font-semibold">Success</AlertTitle>
          <AlertDescription className="text-text-primary">{actionSuccess}</AlertDescription>
        </Alert>
      )}

      {/* AI DriveFit Evaluation & Readiness Roadmap */}
      <AIDriveFitEvaluationCard
        driveId={driveId}
        companyName={drive.company?.name || "Company"}
        driveTitle={drive.title}
      />

      {/* 1. Confirmed vs Unconfirmed Recruitment Rounds */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-bold font-heading text-text-primary flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-primary" /> Evaluation Rounds &amp; Selection Process
            </CardTitle>
            <Badge variant={confirmedStages.length > 0 ? "success" : "secondary"}>
              {confirmedStages.length > 0 ? "Official Confirmed Pipeline" : "Rounds Unconfirmed"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {confirmedStages.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {confirmedStages.map((stage: any, idx: number) => (
                <div
                  key={stage.id}
                  className="p-3 rounded-md border border-border bg-card text-xs space-y-1 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-primary">
                      ROUND {idx + 1}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {stage.stage_type}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-text-primary">{stage.name}</h4>
                  {stage.description && (
                    <p className="text-text-muted text-[11px]">{stage.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-md bg-background border border-dashed border-border text-xs text-text-muted space-y-1">
              <p className="font-semibold text-text-primary">
                Evaluation rounds not yet finalized by the placement cell.
              </p>
              <p>
                Displaying role-relevant recommended practice based on verified job requirements and curriculum topics.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Interactive Personalized Preparation Plan */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold font-heading text-text-primary flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" /> Personalized Drive Preparation Plan
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary mt-0.5">
                Actionable study checklist mapped directly to {drive.company?.name}&apos;s required topics.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-primary">
                {metrics.completedTasks} / {metrics.totalTasks} Completed ({metrics.completionPercentage}%)
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-border rounded-full h-2 mt-3 overflow-hidden">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${metrics.completionPercentage}%` }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {planSummary?.tasks?.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted bg-background rounded-md border border-dashed border-border">
              No preparation tasks generated yet. Placement staff is finalizing the curriculum mapping.
            </div>
          ) : (
            <div className="space-y-2">
              {planSummary?.tasks?.map((task: any) => {
                const isDone = task.status === "COMPLETED";
                return (
                  <div
                    key={task.id}
                    onClick={() => handleToggleTask(task.id, task.status)}
                    className={`p-3 rounded-md border text-xs flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isDone
                        ? "border-secondary/40 bg-[rgba(46,143,134,0.04)]"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <button
                        type="button"
                        className="mt-0.5 text-text-primary focus:outline-none"
                      >
                        {isDone ? (
                          <CheckSquare className="h-4 w-4 text-secondary" />
                        ) : (
                          <Square className="h-4 w-4 text-text-muted" />
                        )}
                      </button>
                      <div className="space-y-0.5">
                        <p
                          className={`font-semibold text-text-primary ${
                            isDone ? "line-through text-text-muted" : ""
                          }`}
                        >
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-text-muted flex-wrap">
                          {task.skillName && <span>Topic: {task.skillName}</span>}
                          {task.stageName && <span>• Round: {task.stageName}</span>}
                          <span>• Est: {task.estimated_minutes} min</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge
                        variant={
                          task.priority === "HIGH"
                            ? "default"
                            : task.priority === "MEDIUM"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {task.priority}
                      </Badge>
                      {task.resourceUrl && (
                        <a
                          href={task.resourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline text-xs flex items-center gap-0.5"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Honest Assessment Engine Notice */}
          <div className="p-3 rounded-md bg-background border border-border text-[11px] text-text-muted flex items-start gap-2">
            <Clock className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <strong className="text-text-primary">Upcoming in Phase 06 &amp; 07:</strong> Full interactive timed
              coding runner, adaptive mock tests, and Mistake-to-Mastery review engine will integrate seamlessly into
              each task above.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Verified Drive Requirements & Evidence Provenance */}
      {requirements.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-sm font-bold font-heading text-text-primary flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-secondary" /> Requirements &amp; Evidence Provenance ({requirements.length})
                </CardTitle>
                <CardDescription className="text-xs text-text-secondary mt-0.5">
                  Distinguishing officially confirmed employer criteria, reported candidate experiences, and DriveFit recommendations.
                </CardDescription>
              </div>
            </div>

            {/* Evidence Classification Trust Legend */}
            <div className="mt-3 p-3 rounded-md bg-background border border-border text-[11px] grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-secondary flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-text-primary">Confirmed by Employer:</strong> Sourced directly from official placement circulars or job specifications.
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-text-primary">Reported Experience:</strong> Observed and shared by previous candidates from past recruitment drives.
                </span>
              </div>
              <div className="flex items-start gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-text-primary">Recommended Guidance:</strong> Suggested curriculum preparation inferred by DriveFit.
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {requirements.map((req) => {
                const isOfficial = req.evidence_level === "OFFICIAL";
                const isReported = req.evidence_level === "REPORTED";
                const isInferred = req.evidence_level === "INFERRED" || !req.evidence_level;

                return (
                  <div
                    key={req.id}
                    className={`p-3.5 rounded-md border text-xs space-y-2 transition-colors ${
                      isOfficial
                        ? "border-secondary/40 bg-[rgba(46,143,134,0.03)]"
                        : isReported
                        ? "border-primary/30 bg-card"
                        : "border-border bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-bold text-text-primary">{req.title}</span>
                      <Badge
                        variant={
                          isOfficial
                            ? "success"
                            : isReported
                            ? "info"
                            : "warning"
                        }
                        className="text-[10px] flex items-center gap-1 font-semibold"
                      >
                        {isOfficial ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" /> Confirmed by Employer
                          </>
                        ) : isReported ? (
                          <>
                            <MessageSquare className="h-3 w-3" /> Reported Previous Experience
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" /> DriveFit Recommendation
                          </>
                        )}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-text-muted">
                      <Badge variant="outline" className="text-[10px]">
                        {req.category}
                      </Badge>
                      <span>Scope: {req.scope_level}</span>
                    </div>

                    {req.description && (
                      <p className="text-text-secondary text-[11px] leading-relaxed">{req.description}</p>
                    )}

                    {req.source_excerpt && (
                      <div className="p-2 rounded bg-background text-[11px] text-text-muted italic border-l-2 border-primary">
                        &quot;{req.source_excerpt}&quot;
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Historical Experiences & Senior Advice */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-bold font-heading text-text-primary flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-primary" /> Senior Candidate Reports ({experiences.length})
            </CardTitle>
            <CardDescription className="text-xs text-text-secondary">
              Historical experiences and interview advice from previous campus recruitment cycles.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSubmitExperience(!showSubmitExperience)}
          >
            {showSubmitExperience ? "Cancel" : "Share Experience"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showSubmitExperience && (
            <form onSubmit={handleSubmitExperience} className="p-4 rounded-md border border-border bg-input space-y-3 text-xs">
              <h4 className="font-bold font-heading text-text-primary uppercase tracking-wider">
                Submit Your Recruitment Experience
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-text-secondary font-medium">Recruitment Cycle</label>
                  <Input
                    placeholder="e.g. Campus Drive 2025"
                    value={expForm.recruitmentCycle}
                    onChange={(e) => setExpForm({ ...expForm, recruitmentCycle: e.target.value })}
                    className="text-xs"
                    required
                  />
                </div>
                <div className="space-y-1 flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-text-primary">
                    <input
                      type="checkbox"
                      checked={expForm.isAnonymous}
                      onChange={(e) => setExpForm({ ...expForm, isAnonymous: e.target.checked })}
                      className="rounded border-border text-primary"
                    />
                    Keep my submission anonymous to other students
                  </label>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-text-secondary font-medium">Interview Questions &amp; Preparation Advice</label>
                <textarea
                  rows={3}
                  placeholder="Describe the coding questions, technical round questions, and helpful tips..."
                  value={expForm.notes}
                  onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })}
                  className="w-full text-xs rounded-md border border-border bg-input p-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowSubmitExperience(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  <Send className="h-3.5 w-3.5 mr-1" /> Submit for Review
                </Button>
              </div>
            </form>
          )}

          {experiences.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted bg-background rounded-md border border-dashed border-border">
              No historical candidate reports submitted yet for this company.
            </div>
          ) : (
            <div className="space-y-2">
              {experiences.map((exp) => (
                <div key={exp.id} className="p-3 rounded-md border border-border bg-card text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-text-primary">
                      {exp.is_anonymous ? "Anonymous Candidate" : "Verified Student"} • {exp.recruitment_cycle}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      Historical Report
                    </Badge>
                  </div>
                  {exp.notes && <p className="text-text-secondary text-xs">{exp.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
