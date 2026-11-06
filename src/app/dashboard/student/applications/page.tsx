"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Layers,
  ChevronRight,
  Award,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SkeletonCard } from "@/components/ui/skeleton";
import { confirmDialog, toast } from "@/components/ui/dialog-system";

export default function StudentApplicationsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isLoadingAuth, role } = useAuthContext();

  const [applications, setApplications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoadingAuth) {
      if (!isAuthenticated) {
        router.push("/auth/signin");
      } else if (role !== "STUDENT") {
        router.push("/dashboard/drives");
      }
    }
  }, [isAuthenticated, isLoadingAuth, role, router]);

  const loadApplications = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/applications");
      if (!res.ok) {
        throw new Error("Failed to load your applications.");
      }
      const data = await res.json();
      setApplications(data.applications || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && role === "STUDENT") {
      loadApplications();
    }
  }, [loadApplications, isAuthenticated, role]);

  async function handleWithdraw(applicationId: string, companyName: string) {
    const confirmed = await confirmDialog({
      title: "Withdraw Application",
      description: `Are you sure you want to withdraw your application for ${companyName}? This action cannot be undone.`,
      confirmText: "Withdraw Application",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }

    setWithdrawingId(applicationId);
    try {
      const res = await fetch(`/api/student/applications/${applicationId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Student requested withdrawal" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to withdraw application.");
      }

      toast.success("Application successfully withdrawn.");
      await loadApplications();
    } catch (err: any) {
      toast.error(err.message || "Failed to withdraw application.");
    } finally {
      setWithdrawingId(null);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "OFFER_ACCEPTED":
      case "OFFER_EXTENDED":
        return <Badge variant="success">Offer Extended</Badge>;
      case "IN_PROCESS":
        return <Badge variant="default">In Recruitment Rounds</Badge>;
      case "REGISTERED":
        return <Badge variant="secondary">Registered / Applied</Badge>;
      case "REJECTED":
        return <Badge variant="danger">Application Closed</Badge>;
      case "WITHDRAWN":
        return <Badge variant="outline" className="opacity-60">Withdrawn</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold font-heading text-text-primary tracking-tight">
              My Drive Applications
            </h1>
          </div>
          <p className="text-xs text-text-secondary">
            Track evaluation stages, candidate progress, round schedules, and offer updates.
          </p>
        </div>

        <Button asChild variant="primary" size="sm">
          <Link href="/dashboard/student/drives">
            Explore More Drives <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Link>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Applications List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="h-36" />
          ))}
        </div>
      ) : applications.length === 0 ? (
        <Card className="text-center py-12 text-text-muted space-y-3">
          <FileSpreadsheet className="h-10 w-10 mx-auto opacity-30" />
          <div className="space-y-1">
            <p className="font-semibold text-text-primary text-sm">No applications submitted yet</p>
            <p className="text-xs text-text-secondary">
              Browse campus recruitment opportunities published by your college and submit applications.
            </p>
          </div>
          <Button asChild variant="primary" size="sm">
            <Link href="/dashboard/student/drives">Browse Recruitment Drives</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const drive = app.drive;
            const canWithdraw = app.status === "REGISTERED" || app.status === "IN_PROCESS";
            return (
              <Card key={app.id} className="hover:border-primary/40 transition-colors shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-semibold text-xs text-text-secondary">
                          {drive?.company?.name || "Corporate Partner"}
                        </span>
                        <span className="text-text-muted">&bull;</span>
                        <span className="text-[11px] text-text-muted">
                          Applied {new Date(app.registration_date).toLocaleDateString()}
                        </span>
                      </div>

                      <CardTitle className="text-lg font-bold font-heading text-text-primary">
                        {drive?.role_title || drive?.title}
                      </CardTitle>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {getStatusBadge(app.status)}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  {/* Current Stage Indicator */}
                  <div className="p-3 rounded-lg bg-input border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-secondary shrink-0" />
                      <span className="text-text-secondary">Current Stage:</span>
                      <span className="font-semibold text-text-primary">
                        {app.current_stage?.name || "Initial Review"}
                      </span>
                    </div>

                    {app.status === "OFFER_EXTENDED" && (
                      <Button asChild variant="secondary" size="sm" className="h-7 text-xs font-semibold">
                        <Link href="/dashboard/student/offers">
                          <Award className="h-3.5 w-3.5 mr-1" /> View Placement Offer
                        </Link>
                      </Button>
                    )}
                  </div>

                  {/* Stage Evaluation Results Timeline */}
                  {app.results && app.results.length > 0 && (
                    <div className="pt-2 border-t border-border space-y-1.5">
                      <span className="text-[10px] font-mono uppercase text-text-muted block">
                        Rounds Evaluation History
                      </span>
                      <div className="space-y-1.5">
                        {app.results.map((res: any) => (
                          <div
                            key={res.id}
                            className="p-2 rounded bg-card border border-border flex items-center justify-between text-xs"
                          >
                            <span className="font-medium text-text-primary">
                              {res.stage?.name || "Recruitment Round"}
                            </span>
                            <div className="flex items-center gap-2">
                              {res.status === "PASSED" ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary">
                                  <CheckCircle2 className="h-3 w-3" /> Qualified
                                </span>
                              ) : res.status === "FAILED" ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600">
                                  <XCircle className="h-3 w-3" /> Not Cleared
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
                                  <Clock className="h-3 w-3" /> In Evaluation
                                </span>
                              )}
                              {res.student_feedback && (
                                <span className="text-[11px] text-text-secondary italic">
                                  &bull; {res.student_feedback}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="pt-2 flex items-center justify-between text-xs">
                    <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                      <Link href={`/dashboard/student/drives/${drive?.id}`}>
                        View Drive Details <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>

                    {canWithdraw && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={withdrawingId === app.id}
                        onClick={() => handleWithdraw(app.id, drive?.company?.name || "this drive")}
                        className="h-7 text-xs text-text-muted hover:text-red-600 hover:bg-red-50"
                      >
                        {withdrawingId === app.id ? "Withdrawing..." : "Withdraw Application"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
