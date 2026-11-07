"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Briefcase,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Award,
  Search,
  Filter,
  Check,
  X,
  PlusCircle,
  AlertCircle,
} from "lucide-react";
import { BrandLoader } from "@/components/common/brand-loader";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DetailViewSkeleton } from "@/components/ui/page-skeletons";
import { toast } from "@/components/ui/dialog-system";

interface PipelinePageProps {
  params: Promise<{ id: string }>;
}

export default function CandidatePipelinePage({ params }: PipelinePageProps) {
  const { id: driveId } = use(params);
  const router = useRouter();
  const { isAuthenticated, isLoading: isLoadingAuth, role } = useAuthContext();

  const isStaff = Boolean(role && ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"].includes(role));
  const canManage = Boolean(role && ["PLACEMENT_HEAD", "PLACEMENT_STAFF"].includes(role));

  useEffect(() => {
    if (!isLoadingAuth) {
      if (!isAuthenticated) {
        router.push("/auth/signin");
      } else if (!isStaff) {
        router.push("/dashboard/student");
      }
    }
  }, [isAuthenticated, isLoadingAuth, isStaff, router]);

  const [pipelineData, setPipelineData] = useState<{
    drive: any;
    stages: any[];
    candidates: any[];
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");

  // Evaluation modal state
  const [evalModal, setEvalModal] = useState<{
    isOpen: boolean;
    candidate: any | null;
    stageId: string;
    stageName: string;
    isFinalStage: boolean;
  }>({
    isOpen: false,
    candidate: null,
    stageId: "",
    stageName: "",
    isFinalStage: false,
  });

  const [evalForm, setEvalForm] = useState({
    status: "PASSED",
    score: "",
    studentFeedback: "",
    internalNotes: "",
  });

  const [isSubmittingEval, setIsSubmittingEval] = useState(false);

  // Extend offer modal state
  const [offerModal, setOfferModal] = useState<{
    isOpen: boolean;
    candidate: any | null;
  }>({
    isOpen: false,
    candidate: null,
  });

  const [offerForm, setOfferForm] = useState({
    compensationAmount: "",
    compensationDetails: "",
    offerType: "FULL_TIME",
    joiningDate: "",
  });

  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);

  const loadPipeline = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/placement/drives/${driveId}/pipeline`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load candidate pipeline.");
      }
      const data = await res.json();
      setPipelineData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [driveId]);

  useEffect(() => {
    if (isAuthenticated && isStaff) {
      loadPipeline();
    }
  }, [loadPipeline, isAuthenticated, isStaff]);

  async function handleRecordAdvance(e: React.FormEvent) {
    e.preventDefault();
    if (!evalModal.candidate) return;

    setIsSubmittingEval(true);
    try {
      const res = await fetch(
        `/api/placement/drives/${driveId}/candidates/${evalModal.candidate.id}/advance`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stageId: evalModal.stageId,
            status: evalForm.status,
            score: evalForm.score ? parseFloat(evalForm.score) : null,
            studentFeedback: evalForm.studentFeedback || null,
            internalNotes: evalForm.internalNotes || null,
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to advance candidate.");
      }

      setEvalModal({ isOpen: false, candidate: null, stageId: "", stageName: "", isFinalStage: false });
      await loadPipeline();
      toast.success("Candidate evaluated successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to advance candidate.");
    } finally {
      setIsSubmittingEval(false);
    }
  }

  async function handleCreateOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!offerModal.candidate) return;

    setIsSubmittingOffer(true);
    try {
      const res = await fetch(`/api/placement/drives/${driveId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: offerModal.candidate.student_id,
          applicationId: offerModal.candidate.id,
          offerType: offerForm.offerType,
          compensationAmount: offerForm.compensationAmount ? parseFloat(offerForm.compensationAmount) : null,
          compensationDetails: offerForm.compensationDetails,
          joiningDate: offerForm.joiningDate || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to issue placement offer.");
      }

      setOfferModal({ isOpen: false, candidate: null });
      await loadPipeline();
      toast.success("Placement offer extended successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to issue placement offer.");
    } finally {
      setIsSubmittingOffer(false);
    }
  }

  if (isLoading || isLoadingAuth) {
    return <DetailViewSkeleton />;
  }

  if (!pipelineData) {
    return (
      <div className="p-8 text-center text-text-muted">
        Pipeline data unavailable.
      </div>
    );
  }

  const { drive, stages, candidates } = pipelineData;

  // Filter candidates
  const filteredCandidates = candidates.filter((c: any) => {
    const matchesSearch =
      !search ||
      c.student?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.student?.enrollment_number?.toLowerCase().includes(search.toLowerCase());

    const matchesDept =
      selectedDept === "ALL" || c.student?.department?.code === selectedDept;

    return matchesSearch && matchesDept;
  });

  // Extract unique departments for filter
  const departments = Array.from(
    new Set(candidates.map((c: any) => c.student?.department?.code).filter(Boolean))
  );

  // Group candidates into stages
  const sortedStages = [...stages].sort((a, b) => a.stage_order - b.stage_order);

  const initialCandidates = filteredCandidates.filter(
    (c: any) =>
      c.status === "REGISTERED" &&
      (!c.current_stage_id || c.current_stage_id === sortedStages[0]?.id)
  );

  const activeCandidatesCount = candidates.filter(
    (c: any) => c.status !== "REJECTED" && c.status !== "WITHDRAWN" && c.status !== "OFFER_ACCEPTED"
  ).length;

  const offeredCount = candidates.filter(
    (c: any) => c.status === "OFFER_EXTENDED" || c.status === "OFFER_ACCEPTED"
  ).length;

  const rejectedCount = candidates.filter((c: any) => c.status === "REJECTED").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb & Drive Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="h-7 px-2 -ml-2 text-xs">
            <Link href={`/dashboard/drives/${driveId}`}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Drive Overview
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold font-heading text-text-primary tracking-tight">
              Candidate Pipeline Board
            </h1>
            <Badge variant="secondary">{drive.company?.name}</Badge>
          </div>
          <p className="text-xs text-text-secondary">
            Role: <span className="font-semibold text-text-primary">{drive.roleTitle}</span> &bull; Manage stage progression and final offers
          </p>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-2 px-3 rounded-lg border border-border bg-card text-center">
            <span className="text-[10px] font-mono uppercase text-text-muted block">Total</span>
            <span className="font-bold text-sm text-text-primary">{candidates.length}</span>
          </div>
          <div className="p-2 px-3 rounded-lg border border-primary/30 bg-primary/5 text-center">
            <span className="text-[10px] font-mono uppercase text-primary block">Active</span>
            <span className="font-bold text-sm text-primary">{activeCandidatesCount}</span>
          </div>
          <div className="p-2 px-3 rounded-lg border border-secondary/30 bg-secondary/5 text-center">
            <span className="text-[10px] font-mono uppercase text-secondary block">Offers</span>
            <span className="font-bold text-sm text-secondary">{offeredCount}</span>
          </div>
          <div className="p-2 px-3 rounded-lg border border-border bg-card text-center">
            <span className="text-[10px] font-mono uppercase text-text-muted block">Dropped</span>
            <span className="font-bold text-sm text-text-muted">{rejectedCount}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search candidate by name or enrollment number..."
            className="pl-9 h-9 text-xs"
          />
        </div>

        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          className="h-9 rounded-lg border border-border bg-input px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
        >
          <option value="ALL">All Departments</option>
          {departments.map((d: any) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Pipeline Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-6 items-start min-h-[500px]">
        {/* Stage Columns */}
        {sortedStages.map((stage: any, index: number) => {
          const isFinal = index === sortedStages.length - 1;
          const stageCandidates = filteredCandidates.filter(
            (c: any) =>
              c.status !== "REJECTED" &&
              c.status !== "WITHDRAWN" &&
              c.current_stage_id === stage.id
          );

          return (
            <div
              key={stage.id}
              className="w-72 shrink-0 rounded-xl border border-border bg-card/60 flex flex-col max-h-[700px] shadow-sm"
            >
              {/* Column Header */}
              <div className="p-3 border-b border-border bg-card rounded-t-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full bg-primary text-white text-[10px] font-mono font-bold flex items-center justify-center">
                    {stage.stage_order}
                  </span>
                  <span className="font-bold text-xs text-text-primary truncate max-w-[150px]">
                    {stage.name}
                  </span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {stageCandidates.length}
                </Badge>
              </div>

              {/* Candidates in this stage */}
              <div className="p-2 space-y-2 overflow-y-auto flex-1">
                {stageCandidates.length === 0 ? (
                  <div className="py-8 text-center text-text-muted text-[11px] italic">
                    No candidates currently in this round.
                  </div>
                ) : (
                  stageCandidates.map((cand: any) => (
                    <Card
                      key={cand.id}
                      className="p-3 bg-card border-border hover:border-primary/40 transition-all shadow-sm space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <span className="font-bold text-text-primary block">
                            {cand.student?.full_name}
                          </span>
                          <span className="font-mono text-[10px] text-text-muted">
                            {cand.student?.enrollment_number} &bull; {cand.student?.department?.code}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-secondary text-[11px]">
                          CGPA: {cand.student?.cgpa?.toFixed(2)}
                        </span>
                      </div>

                      {/* Quick stage actions */}
                      {canManage && (
                        <div className="pt-2 border-t border-border flex items-center justify-between gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-2 text-[10px] text-red-600 hover:bg-red-50"
                            onClick={() => {
                              setEvalForm({ status: "FAILED", score: "", studentFeedback: "", internalNotes: "" });
                              setEvalModal({
                                isOpen: true,
                                candidate: cand,
                                stageId: stage.id,
                                stageName: stage.name,
                                isFinalStage: isFinal,
                              });
                            }}
                          >
                            <X className="h-3 w-3 mr-0.5" /> Fail
                          </Button>

                          {isFinal ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 px-2 text-[10px] font-semibold"
                              onClick={() => {
                                setOfferModal({ isOpen: true, candidate: cand });
                              }}
                            >
                              <Award className="h-3 w-3 mr-0.5" /> Extend Offer
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="primary"
                              className="h-6 px-2 text-[10px] font-semibold"
                              onClick={() => {
                                setEvalForm({ status: "PASSED", score: "", studentFeedback: "", internalNotes: "" });
                                setEvalModal({
                                  isOpen: true,
                                  candidate: cand,
                                  stageId: stage.id,
                                  stageName: stage.name,
                                  isFinalStage: isFinal,
                                });
                              }}
                            >
                              <Check className="h-3 w-3 mr-0.5" /> Pass &bull; Next
                            </Button>
                          )}
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}

        {/* Column: Offers Extended */}
        <div className="w-72 shrink-0 rounded-xl border border-secondary/40 bg-secondary/5 flex flex-col max-h-[700px] shadow-sm">
          <div className="p-3 border-b border-secondary/30 bg-card rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-secondary" />
              <span className="font-bold text-xs text-secondary">Offers Extended</span>
            </div>
            <Badge variant="success" className="text-[10px] font-mono">
              {filteredCandidates.filter(
                (c: any) => c.status === "OFFER_EXTENDED" || c.status === "OFFER_ACCEPTED"
              ).length}
            </Badge>
          </div>

          <div className="p-2 space-y-2 overflow-y-auto flex-1">
            {filteredCandidates
              .filter((c: any) => c.status === "OFFER_EXTENDED" || c.status === "OFFER_ACCEPTED")
              .map((cand: any) => (
                <Card key={cand.id} className="p-3 bg-card border-secondary/30 shadow-sm space-y-1.5 text-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-text-primary block">{cand.student?.full_name}</span>
                      <span className="font-mono text-[10px] text-text-muted">
                        {cand.student?.enrollment_number} &bull; {cand.student?.department?.code}
                      </span>
                    </div>
                    <Badge variant={cand.status === "OFFER_ACCEPTED" ? "success" : "default"} className="text-[10px]">
                      {cand.status === "OFFER_ACCEPTED" ? "Accepted" : "Offered"}
                    </Badge>
                  </div>
                </Card>
              ))}
          </div>
        </div>

        {/* Column: Rejected / Dropped */}
        <div className="w-72 shrink-0 rounded-xl border border-border bg-card/40 flex flex-col max-h-[700px] shadow-sm">
          <div className="p-3 border-b border-border bg-card rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-text-muted" />
              <span className="font-bold text-xs text-text-muted">Dropped Candidates</span>
            </div>
            <Badge variant="outline" className="text-[10px] font-mono">
              {filteredCandidates.filter((c: any) => c.status === "REJECTED").length}
            </Badge>
          </div>

          <div className="p-2 space-y-2 overflow-y-auto flex-1">
            {filteredCandidates
              .filter((c: any) => c.status === "REJECTED")
              .map((cand: any) => (
                <Card key={cand.id} className="p-3 bg-card border-border opacity-70 space-y-1 text-xs">
                  <span className="font-medium text-text-primary block">{cand.student?.full_name}</span>
                  <span className="font-mono text-[10px] text-text-muted">
                    {cand.student?.enrollment_number} &bull; {cand.student?.department?.code}
                  </span>
                </Card>
              ))}
          </div>
        </div>
      </div>

      {/* Record Stage Evaluation Modal */}
      {evalModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-y-auto">
          <Card className="w-full max-w-md min-h-0 max-h-[calc(100dvh-2rem)] my-auto flex flex-col overflow-hidden shadow-2xl border-border bg-card">
            <CardHeader className="shrink-0 flex flex-row items-center justify-between pb-3 border-b border-border">
              <div>
                <CardTitle className="text-base font-bold font-heading">
                  Evaluate Candidate: {evalModal.candidate?.student?.full_name}
                </CardTitle>
                <CardDescription className="text-xs">
                  Recording outcome for {evalModal.stageName}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEvalModal({ ...evalModal, isOpen: false })}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <form onSubmit={handleRecordAdvance} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 pr-3 sm:pr-5 space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">Evaluation Result *</label>
                  <select
                    value={evalForm.status}
                    onChange={(e) => setEvalForm({ ...evalForm, status: e.target.value })}
                    className="w-full h-8 rounded-lg border border-border bg-input px-2.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  >
                    <option value="PASSED">Passed (Advance to Next Stage)</option>
                    <option value="FAILED">Failed (Drop from Recruitment)</option>
                    <option value="ON_HOLD">On Hold (Keep in Current Round)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">Score / Marks (Optional)</label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 85.5"
                    value={evalForm.score}
                    onChange={(e) => setEvalForm({ ...evalForm, score: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">Student-Visible Feedback</label>
                  <Input
                    placeholder="Feedback shared with the student on their portal..."
                    value={evalForm.studentFeedback}
                    onChange={(e) => setEvalForm({ ...evalForm, studentFeedback: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">Internal Notes (Confidential)</label>
                  <textarea
                    rows={2}
                    placeholder="Staff-only notes and interview observations..."
                    value={evalForm.internalNotes}
                    onChange={(e) => setEvalForm({ ...evalForm, internalNotes: e.target.value })}
                    className="w-full rounded-md border border-border bg-input p-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                </div>
              </CardContent>

              <div className="shrink-0 p-3.5 sm:p-4 border-t border-border bg-surface/50 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEvalModal({ ...evalModal, isOpen: false })}
                  disabled={isSubmittingEval}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" disabled={isSubmittingEval} isLoading={isSubmittingEval}>
                  {isSubmittingEval ? "Saving..." : "Save Evaluation"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Extend Placement Offer Modal */}
      {offerModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-y-auto">
          <Card className="w-full max-w-md min-h-0 max-h-[calc(100dvh-2rem)] my-auto flex flex-col overflow-hidden shadow-2xl border-secondary/40 bg-card">
            <CardHeader className="shrink-0 flex flex-row items-center justify-between pb-3 border-b border-border">
              <div>
                <CardTitle className="text-base font-bold font-heading text-secondary">
                  Extend Placement Offer
                </CardTitle>
                <CardDescription className="text-xs">
                  Candidate: {offerModal.candidate?.student?.full_name} ({offerModal.candidate?.student?.enrollment_number})
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOfferModal({ isOpen: false, candidate: null })}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <form onSubmit={handleCreateOffer} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 pr-3 sm:pr-5 space-y-3.5 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">Annual CTC Compensation (₹) *</label>
                  <Input
                    required
                    type="number"
                    placeholder="e.g. 1200000"
                    value={offerForm.compensationAmount}
                    onChange={(e) => setOfferForm({ ...offerForm, compensationAmount: e.target.value })}
                    className="h-8 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">Offer Type *</label>
                  <select
                    value={offerForm.offerType}
                    onChange={(e) => setOfferForm({ ...offerForm, offerType: e.target.value })}
                    className="w-full h-8 rounded-lg border border-border bg-input px-2.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  >
                    <option value="FULL_TIME">Full-Time Employee (FTE)</option>
                    <option value="INTERNSHIP">Internship</option>
                    <option value="INTERN_TO_FTE">Intern to FTE</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">Package Breakdown / Details</label>
                  <Input
                    placeholder="e.g. ₹10 LPA Base + ₹2 LPA Retention Bonus"
                    value={offerForm.compensationDetails}
                    onChange={(e) => setOfferForm({ ...offerForm, compensationDetails: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">Expected Joining Date</label>
                  <Input
                    type="date"
                    value={offerForm.joiningDate}
                    onChange={(e) => setOfferForm({ ...offerForm, joiningDate: e.target.value })}
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </CardContent>

              <div className="shrink-0 p-3.5 sm:p-4 border-t border-border bg-surface/50 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOfferModal({ isOpen: false, candidate: null })}
                  disabled={isSubmittingOffer}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="secondary" size="sm" disabled={isSubmittingOffer} isLoading={isSubmittingOffer}>
                  {isSubmittingOffer ? "Issuing..." : "Confirm & Extend Offer"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
