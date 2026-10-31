"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Award,
  Layers,
  Send,
  Loader2,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DetailViewSkeleton } from "@/components/ui/page-skeletons";
import { confirmDialog, toast } from "@/components/ui/dialog-system";

interface StudentDriveDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function StudentDriveDetailPage({ params }: StudentDriveDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: isLoadingAuth, role } = useAuthContext();

  const [drive, setDrive] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  useEffect(() => {
    if (!isLoadingAuth) {
      if (!isAuthenticated) {
        router.push("/auth/signin");
      } else if (role !== "STUDENT") {
        router.push(`/dashboard/drives/${id}`);
      }
    }
  }, [isAuthenticated, isLoadingAuth, role, router, id]);

  const loadDrive = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/drives/${id}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load recruitment drive.");
      }
      const data = await res.json();
      setDrive(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAuthenticated && role === "STUDENT") {
      loadDrive();
    }
  }, [loadDrive, isAuthenticated, role]);

  async function handleApply() {
    const confirmed = await confirmDialog({
      title: "Confirm Application",
      description: `Confirm application for ${drive.roleTitle} at ${drive.company?.name}? Your academic profile will be submitted to the college placement department.`,
      confirmText: "Submit Application",
      variant: "primary",
    });
    if (!confirmed) {
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/drives/${id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Application submission failed.");
      }

      setApplySuccess(true);
      await loadDrive();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsApplying(false);
    }
  }

  if (isLoading || isLoadingAuth) {
    return <DetailViewSkeleton />;
  }

  if (error && !drive) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 p-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/student/drives">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Drives
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Drive</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!drive) return null;

  const isEligible = drive.eligibility?.isEligible;
  const hasApplied = Boolean(drive.application);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Breadcrumb & Nav */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/student/drives">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> All Campus Drives
          </Link>
        </Button>

        {drive.isRegistrationOpen && (
          <Badge variant="success" className="text-xs">
            Registrations Open
          </Badge>
        )}
      </div>

      {/* Hero Header */}
      <Card className="border-primary/20 bg-card">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-semibold text-text-primary text-sm">{drive.company?.name}</span>
                {drive.company?.industry && (
                  <Badge variant="secondary" className="text-[10px]">
                    {drive.company.industry}
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-primary tracking-tight">
                {drive.roleTitle}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-secondary pt-1">
                <div>
                  <span className="text-text-muted">Type: </span>
                  <span className="font-semibold text-text-primary">
                    {drive.recruitmentType === "FULL_TIME"
                      ? "Full-Time (FTE)"
                      : drive.recruitmentType === "INTERNSHIP"
                      ? "Internship"
                      : "Intern to FTE"}
                  </span>
                </div>
                <div>
                  <span className="text-text-muted">Location: </span>
                  <span className="font-semibold text-text-primary">{drive.location || "On-Campus / Hybrid"}</span>
                </div>
                <div>
                  <span className="text-text-muted">Package: </span>
                  <span className="font-mono font-bold text-secondary text-sm">
                    {drive.compensationRange || "Confidential"}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Card Button */}
            <div className="sm:self-center shrink-0">
              {hasApplied ? (
                <div className="space-y-1.5 text-right">
                  <Badge variant="default" className="text-xs px-3 py-1">
                    Status: {drive.application.status}
                  </Badge>
                  <div>
                    <Button asChild variant="outline" size="sm" className="text-xs">
                      <Link href="/dashboard/student/applications">
                        Track Application <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : drive.isRegistrationOpen && isEligible ? (
                <Button
                  variant="primary"
                  size="default"
                  onClick={handleApply}
                  disabled={isApplying}
                  className="font-semibold px-6 shadow-md"
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" /> Apply for Drive
                    </>
                  )}
                </Button>
              ) : !isEligible ? (
                <Button variant="outline" disabled size="default" className="text-xs opacity-60">
                  <XCircle className="h-4 w-4 mr-1.5" /> Ineligible to Apply
                </Button>
              ) : (
                <Button variant="outline" disabled size="default" className="text-xs opacity-60">
                  <Clock className="h-4 w-4 mr-1.5" /> Registrations Closed
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {applySuccess && (
        <Alert variant="success" className="bg-[rgba(46,143,134,0.08)] border-secondary/30">
          <CheckCircle2 className="h-4 w-4 text-secondary" />
          <AlertTitle className="text-secondary font-semibold">Application Submitted!</AlertTitle>
          <AlertDescription className="text-xs text-text-primary">
            Your application for {drive.roleTitle} has been registered. You can track recruitment updates on your applications page.
          </AlertDescription>
        </Alert>
      )}

      {/* Comprehensive Eligibility Breakdown Card */}
      {drive.eligibility && (
        <Card
          className={`border ${
            isEligible
              ? "border-secondary/40 bg-[rgba(46,143,134,0.03)]"
              : "border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10"
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {isEligible ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-secondary" />
                    <span className="text-secondary">You Satisfy All Eligibility Criteria</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-amber-600" />
                    <span className="text-amber-700 dark:text-amber-400">Eligibility Criteria Not Satisfied</span>
                  </>
                )}
              </CardTitle>

              <Badge variant={isEligible ? "success" : "danger"}>
                {drive.eligibility.status}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {drive.eligibility.summary}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pt-0">
            {/* Criteria checks list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {drive.eligibility.passedCriteria?.map((crit: any) => (
                <div
                  key={crit.code}
                  className="p-2.5 rounded-lg border border-border bg-input/60 flex items-start gap-2"
                >
                  <Check className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-text-primary block">{crit.label}</span>
                    <span className="text-[11px] text-text-secondary">{crit.explanation}</span>
                  </div>
                </div>
              ))}

              {drive.eligibility.failedCriteria?.map((crit: any) => (
                <div
                  key={crit.code}
                  className="p-2.5 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 flex items-start gap-2"
                >
                  <XCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-amber-800 dark:text-amber-300 block">
                      {crit.label}
                    </span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-400">
                      {crit.explanation}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job Description & Responsibilities */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" /> Role Description &amp; Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-xs text-text-primary leading-relaxed">
          {drive.jobDescription ? (
            <div className="whitespace-pre-line bg-input p-4 rounded-lg border border-border">
              {drive.jobDescription}
            </div>
          ) : (
            <p className="text-text-muted italic">No detailed job description provided by the company.</p>
          )}

          {/* Important Timelines */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
            <div>
              <span className="text-[10px] font-mono uppercase text-text-muted block">Registration Start</span>
              <span className="font-medium">
                {drive.registrationStart
                  ? new Date(drive.registrationStart).toLocaleString()
                  : "Open immediately"}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-text-muted block">Application Deadline</span>
              <span className="font-mono font-bold text-primary">
                {drive.registrationDeadline
                  ? new Date(drive.registrationDeadline).toLocaleString()
                  : "Not specified"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recruitment Stages & Process */}
      {drive.stages && drive.stages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-secondary" /> Selection Process &amp; Rounds ({drive.stages.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Sequential candidate evaluation pipeline configured by your placement cell
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {drive.stages.map((stage: any) => (
              <div
                key={stage.id}
                className="p-3 rounded-lg border border-border bg-input flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="h-6 w-6 rounded-full bg-primary text-white font-mono text-xs flex items-center justify-center font-bold shrink-0">
                    {stage.stage_order}
                  </span>
                  <div>
                    <span className="font-semibold text-text-primary block">{stage.name}</span>
                    <span className="text-[10px] text-text-muted font-mono">{stage.stage_type}</span>
                  </div>
                </div>

                {stage.scheduled_at && (
                  <span className="text-[11px] text-text-secondary font-mono">
                    Scheduled: {new Date(stage.scheduled_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
