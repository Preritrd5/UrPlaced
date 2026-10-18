"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Users,
  Award,
  AlertCircle,
  PlusCircle,
  Save,
  Check,
  X,
  Play,
  StopCircle,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DriveIntelligenceTab } from "@/components/drives/drive-intelligence-tab";

interface DriveDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function DriveDetailPage({ params }: DriveDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<
    "overview" | "criteria" | "stages" | "candidates" | "offers" | "intelligence"
  >("overview");
  const [drive, setDrive] = useState<any | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Criteria form state
  const [criteriaForm, setCriteriaForm] = useState({
    minCgpa: "7.00",
    minTenthPercentage: "60.0",
    minTwelfthPercentage: "60.0",
    maxActiveBacklogs: "0",
    maxTotalBacklogs: "2",
    allowedDepartments: [] as string[],
    allowedGraduationYears: [2026],
  });

  // Stage form state
  const [newStage, setNewStage] = useState({
    name: "",
    stageType: "ONLINE_TEST",
    stageOrder: 1,
    description: "",
    isStudentVisible: true,
  });

  // New offer form state
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [offerForm, setOfferForm] = useState({
    compensationAmount: "",
    compensationDetails: "",
    offerType: "FULL_TIME",
  });

  const loadDriveData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [driveRes, candRes, offersRes, deptsRes] = await Promise.all([
        fetch(`/api/placement/drives/${id}`),
        fetch(`/api/placement/drives/${id}/candidates`),
        fetch(`/api/placement/drives/${id}/offers`),
        fetch("/api/placement/departments"),
      ]);

      if (driveRes.ok) {
        const d = await driveRes.json();
        setDrive(d);
        if (d.criteria) {
          setCriteriaForm({
            minCgpa: d.criteria.min_cgpa?.toString() || "7.00",
            minTenthPercentage: d.criteria.min_tenth_percentage?.toString() || "",
            minTwelfthPercentage: d.criteria.min_twelfth_percentage?.toString() || "",
            maxActiveBacklogs: d.criteria.max_active_backlogs?.toString() || "0",
            maxTotalBacklogs: d.criteria.max_total_backlogs?.toString() || "",
            allowedDepartments: d.criteria.allowed_departments || [],
            allowedGraduationYears: d.criteria.allowed_graduation_years || [2026],
          });
        }
        setNewStage((prev) => ({
          ...prev,
          stageOrder: (d.stages?.length || 0) + 1,
        }));
      }

      if (candRes.ok) setCandidates(await candRes.json());
      if (offersRes.ok) setOffers(await offersRes.json());
      if (deptsRes.ok) setDepartments(await deptsRes.json());
    } catch {
      // Handle error silently
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDriveData();
  }, [loadDriveData]);

  async function handleStatusTransition(targetStatus: string, reason?: string) {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch(`/api/placement/drives/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Status update failed.");

      setActionSuccess(`Drive status updated to ${targetStatus}`);
      await loadDriveData();
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  async function handleSaveCriteria(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/placement/drives/${id}/criteria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minCgpa: criteriaForm.minCgpa,
          minTenthPercentage: criteriaForm.minTenthPercentage || null,
          minTwelfthPercentage: criteriaForm.minTwelfthPercentage || null,
          maxActiveBacklogs: criteriaForm.maxActiveBacklogs,
          maxTotalBacklogs: criteriaForm.maxTotalBacklogs || null,
          allowedDepartments: criteriaForm.allowedDepartments,
          allowedGraduationYears: criteriaForm.allowedGraduationYears,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update criteria.");

      setActionSuccess("Eligibility criteria saved successfully.");
      await loadDriveData();
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  async function handleAddStage(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/placement/drives/${id}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStage),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add stage.");

      setActionSuccess(`Stage '${newStage.name}' added.`);
      setNewStage({
        name: "",
        stageType: "TECHNICAL_INTERVIEW",
        stageOrder: (drive?.stages?.length || 0) + 2,
        description: "",
        isStudentVisible: true,
      });
      await loadDriveData();
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  async function handleRecordEvaluation(applicationId: string, stageId: string, status: string) {
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/placement/drives/${id}/stage-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          stageId,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Evaluation failed.");

      setActionSuccess("Candidate evaluation recorded.");
      await loadDriveData();
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  async function handleCreateOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCandidate) return;

    setActionError(null);
    setActionSuccess(null);

    const cand = candidates.find((c) => c.id === selectedCandidate);
    if (!cand) return;

    try {
      const res = await fetch(`/api/placement/drives/${id}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: cand.student_id,
          applicationId: cand.id,
          offerType: offerForm.offerType,
          compensationAmount: offerForm.compensationAmount,
          compensationDetails: offerForm.compensationDetails,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record offer.");

      setActionSuccess(`Placement offer recorded for ${cand.student?.full_name}.`);
      setSelectedCandidate(null);
      await loadDriveData();
    } catch (err: any) {
      setActionError(err.message);
    }
  }

  if (isLoading) {
    return (
      <div className="p-12 text-center text-text-muted space-y-2">
        <Briefcase className="h-8 w-8 mx-auto animate-pulse text-primary" />
        <p className="text-xs">Loading recruitment drive command center...</p>
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="h-8 px-2">
            <Link href="/dashboard/drives">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-extrabold tracking-tight font-heading text-text-primary">
                {drive.title}
              </h1>
              <Badge
                variant={
                  drive.status === "REGISTRATION_OPEN"
                    ? "success"
                    : drive.status === "IN_PROGRESS"
                    ? "default"
                    : drive.status === "DRAFT"
                    ? "secondary"
                    : "outline"
                }
              >
                {drive.status}
              </Badge>
            </div>
            <p className="text-xs text-text-secondary flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-text-muted shrink-0" />
              <span>{drive.company?.name}</span> &bull; <span>{drive.role_title}</span> &bull; <span>{drive.recruitment_type}</span>
            </p>
          </div>
        </div>

        {/* State Machine Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {drive.status === "DRAFT" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleStatusTransition("PUBLISHED")}
            >
              <Check className="h-4 w-4 mr-1.5" /> Publish Drive
            </Button>
          )}

          {drive.status === "PUBLISHED" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleStatusTransition("REGISTRATION_OPEN")}
            >
              <Play className="h-4 w-4 mr-1.5" /> Open Registrations
            </Button>
          )}

          {drive.status === "REGISTRATION_OPEN" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleStatusTransition("IN_PROGRESS")}
            >
              <Play className="h-4 w-4 mr-1.5" /> Start Drive (In Progress)
            </Button>
          )}

          {drive.status === "IN_PROGRESS" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleStatusTransition("COMPLETED")}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" /> Mark Completed
            </Button>
          )}

          {drive.status !== "COMPLETED" && drive.status !== "CANCELLED" && drive.status !== "ARCHIVED" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50"
              onClick={() => {
                const reason = prompt("Enter cancellation reason:");
                if (reason) handleStatusTransition("CANCELLED", reason);
              }}
            >
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
          )}
        </div>
      </div>

      {actionError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Action Error</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {actionSuccess && (
        <Alert variant="success" className="bg-[rgba(46,143,134,0.08)] border-secondary/30">
          <CheckCircle2 className="h-4 w-4 text-secondary" />
          <AlertTitle className="text-secondary font-semibold">Success</AlertTitle>
          <AlertDescription className="text-text-primary">{actionSuccess}</AlertDescription>
        </Alert>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-border gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Overview &amp; Details
        </button>
        <button
          onClick={() => setActiveTab("criteria")}
          className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "criteria"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Eligibility Criteria
        </button>
        <button
          onClick={() => setActiveTab("stages")}
          className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "stages"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Pipeline Stages ({drive.stages?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("candidates")}
          className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "candidates"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Registered Candidates ({candidates.length})
        </button>
        <button
          onClick={() => setActiveTab("offers")}
          className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "offers"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Placement Offers ({offers.length})
        </button>
        <button
          onClick={() => setActiveTab("intelligence")}
          className={`py-2 px-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === "intelligence"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          DriveFit Intelligence
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid gap-6 sm:grid-cols-3">
          <Card className="sm:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Job Role &amp; Opportunity Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div>
                <span className="font-semibold text-text-secondary block mb-1">Description</span>
                <p className="text-text-primary leading-relaxed bg-input p-3 rounded-lg border border-border">
                  {drive.job_description || "No job description provided."}
                </p>
              </div>

              {drive.internal_notes && (
                <div>
                  <span className="font-semibold text-text-secondary block mb-1">
                    Internal Placement Notes (Confidential)
                  </span>
                  <p className="text-text-primary leading-relaxed bg-input p-3 rounded-lg border border-border">
                    {drive.internal_notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Drive Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-mono uppercase text-text-muted block">Compensation</span>
                <span className="font-mono font-bold text-secondary text-sm">
                  {drive.compensation_range || "Undisclosed"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-text-muted block">Work Mode</span>
                <span className="font-medium">{drive.location || "On-Campus / Hybrid"}</span>
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase text-text-muted block">Cycle</span>
                <span>{drive.academic_year?.name || "Current Year"}</span>
              </div>
              {drive.registration_deadline && (
                <div>
                  <span className="text-[10px] font-mono uppercase text-text-muted block">Registration Closes</span>
                  <span className="font-mono text-text-primary">
                    {new Date(drive.registration_deadline).toLocaleString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Eligibility Criteria Editor */}
      {activeTab === "criteria" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configurable Eligibility Criteria</CardTitle>
            <CardDescription>
              Deterministic rules evaluated for candidate registrations and DriveFit qualification.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveCriteria} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Minimum CGPA *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    required
                    value={criteriaForm.minCgpa}
                    onChange={(e) => setCriteriaForm({ ...criteriaForm, minCgpa: e.target.value })}
                    className="font-mono font-bold text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Min 10th Percentage (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={criteriaForm.minTenthPercentage}
                    onChange={(e) => setCriteriaForm({ ...criteriaForm, minTenthPercentage: e.target.value })}
                    className="font-mono text-xs"
                    placeholder="e.g. 60.0"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Min 12th Percentage (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={criteriaForm.minTwelfthPercentage}
                    onChange={(e) => setCriteriaForm({ ...criteriaForm, minTwelfthPercentage: e.target.value })}
                    className="font-mono text-xs"
                    placeholder="e.g. 60.0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Max Allowed Active Backlogs</label>
                  <Input
                    type="number"
                    min="0"
                    required
                    value={criteriaForm.maxActiveBacklogs}
                    onChange={(e) => setCriteriaForm({ ...criteriaForm, maxActiveBacklogs: e.target.value })}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Max History Backlogs (Optional)</label>
                  <Input
                    type="number"
                    min="0"
                    value={criteriaForm.maxTotalBacklogs}
                    onChange={(e) => setCriteriaForm({ ...criteriaForm, maxTotalBacklogs: e.target.value })}
                    className="font-mono text-xs"
                    placeholder="Leave empty for unlimited"
                  />
                </div>
              </div>

              {/* Allowed Departments Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary block">
                  Eligible Academic Departments (Leave unselected for all departments)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {departments.map((d) => {
                    const isSelected = criteriaForm.allowedDepartments.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setCriteriaForm({
                              ...criteriaForm,
                              allowedDepartments: criteriaForm.allowedDepartments.filter((id) => id !== d.id),
                            });
                          } else {
                            setCriteriaForm({
                              ...criteriaForm,
                              allowedDepartments: [...criteriaForm.allowedDepartments, d.id],
                            });
                          }
                        }}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center justify-between ${
                          isSelected
                            ? "border-primary bg-[var(--color-primary-subtle)] text-primary font-semibold"
                            : "border-border bg-input text-text-secondary hover:bg-card"
                        }`}
                      >
                        <span>{d.code} &bull; {d.name}</span>
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <Button type="submit" variant="primary" size="sm">
                  <Save className="h-4 w-4 mr-1.5" /> Save Criteria
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Tab 3: Pipeline Stages */}
      {activeTab === "stages" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recruitment Pipeline Rounds</CardTitle>
              <CardDescription>Ordered sequence of candidate evaluation stages</CardDescription>
            </CardHeader>
            <CardContent>
              {(!drive.stages || drive.stages.length === 0) ? (
                <div className="text-center py-6 text-text-muted text-xs">
                  No stages defined yet. Add the first stage below.
                </div>
              ) : (
                <div className="space-y-2">
                  {drive.stages.map((stage: any) => (
                    <div
                      key={stage.id}
                      className="p-3 rounded-lg border border-border bg-input flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-6 w-6 rounded-full bg-primary text-white font-mono text-xs flex items-center justify-center font-bold">
                          {stage.stage_order}
                        </span>
                        <div>
                          <div className="font-semibold text-xs text-text-primary">{stage.name}</div>
                          <span className="text-[10px] text-text-muted font-mono">{stage.stage_type}</span>
                        </div>
                      </div>
                      <Badge variant={stage.is_student_visible ? "success" : "secondary"} className="text-[10px]">
                        {stage.is_student_visible ? "Student Visible" : "Internal Only"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Add Stage Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add Recruitment Stage</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddStage} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-semibold text-text-primary">Stage Name *</label>
                    <Input
                      required
                      placeholder="e.g. Technical Interview Round 1"
                      value={newStage.name}
                      onChange={(e) => setNewStage({ ...newStage, name: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-primary">Stage Type *</label>
                    <select
                      value={newStage.stageType}
                      onChange={(e) => setNewStage({ ...newStage, stageType: e.target.value as any })}
                      className="w-full h-9 rounded-lg border border-border bg-input px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                    >
                      <option value="ONLINE_TEST">Online Aptitude / Test</option>
                      <option value="CODING_TEST">Coding Assessment</option>
                      <option value="TECHNICAL_INTERVIEW">Technical Interview</option>
                      <option value="GROUP_DISCUSSION">Group Discussion</option>
                      <option value="HR_INTERVIEW">HR Interview</option>
                      <option value="FINAL_SELECTION">Final Selection</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" variant="secondary" size="sm">
                    <PlusCircle className="h-4 w-4 mr-1.5" /> Add Stage
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 4: Registered Candidates */}
      {activeTab === "candidates" && (
        <Card>
          <CardHeader className="py-4 border-b border-border">
            <CardTitle className="text-base">Candidate Applications ({candidates.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {candidates.length === 0 ? (
              <div className="text-center py-10 text-text-muted text-xs">
                No students have registered for this drive yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-input text-text-secondary font-mono border-b border-border uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Roll ID</th>
                      <th className="py-2.5 px-3">Dept</th>
                      <th className="py-2.5 px-3">CGPA</th>
                      <th className="py-2.5 px-3">Current Stage</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Quick Evaluation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {candidates.map((cand) => (
                      <tr key={cand.id} className="hover:bg-input/50">
                        <td className="py-2.5 px-3 font-semibold text-text-primary">
                          {cand.student?.full_name}
                        </td>
                        <td className="py-2.5 px-3 font-mono">{cand.student?.enrollment_number}</td>
                        <td className="py-2.5 px-3 font-mono">{cand.student?.department?.code}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-secondary">
                          {cand.student?.cgpa?.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-text-secondary">
                          {cand.current_stage?.name || "Initial"}
                        </td>
                        <td className="py-2.5 px-3">
                          <Badge variant="default" className="text-[10px]">
                            {cand.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {cand.current_stage_id && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] text-green-700 hover:bg-green-50"
                                onClick={() => handleRecordEvaluation(cand.id, cand.current_stage_id, "PASSED")}
                              >
                                Pass
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 px-2 text-[10px] text-red-600 hover:bg-red-50"
                                onClick={() => handleRecordEvaluation(cand.id, cand.current_stage_id, "FAILED")}
                              >
                                Fail
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-6 px-2 text-[10px]"
                                onClick={() => setSelectedCandidate(cand.id)}
                              >
                                Extend Offer
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab 5: Placement Offers */}
      {activeTab === "offers" && (
        <div className="space-y-6">
          {/* Modal / Form to Record Offer */}
          {selectedCandidate && (
            <Card className="border-secondary/40 bg-[rgba(46,143,134,0.03)]">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base text-secondary">
                    Extend Placement Offer to {candidates.find((c) => c.id === selectedCandidate)?.student?.full_name}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedCandidate(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateOffer} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-text-primary">
                        Annual Compensation / CTC (₹)
                      </label>
                      <Input
                        type="number"
                        placeholder="e.g. 1200000"
                        value={offerForm.compensationAmount}
                        onChange={(e) => setOfferForm({ ...offerForm, compensationAmount: e.target.value })}
                        className="font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-text-primary">
                        Offer Type
                      </label>
                      <select
                        value={offerForm.offerType}
                        onChange={(e) => setOfferForm({ ...offerForm, offerType: e.target.value as any })}
                        className="w-full h-9 rounded-lg border border-border bg-input px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                      >
                        <option value="FULL_TIME">Full-Time (FTE)</option>
                        <option value="INTERNSHIP">Internship</option>
                        <option value="INTERN_TO_FTE">Intern to FTE</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-primary">
                      Compensation Details / Package Breakdown
                    </label>
                    <Input
                      placeholder="e.g. ₹10 LPA Base + ₹2 LPA Joining Bonus"
                      value={offerForm.compensationDetails}
                      onChange={(e) => setOfferForm({ ...offerForm, compensationDetails: e.target.value })}
                      className="text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setSelectedCandidate(null)}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="secondary" size="sm">
                      <Award className="h-4 w-4 mr-1.5" /> Confirm Offer
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Offers Table */}
          <Card>
            <CardHeader className="py-4 border-b border-border">
              <CardTitle className="text-base">Offers Extended for this Drive ({offers.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {offers.length === 0 ? (
                <div className="text-center py-10 text-text-muted text-xs">
                  No offers extended for this drive yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {offers.map((offer) => (
                    <div key={offer.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-xs text-text-primary">
                          {offer.student?.full_name} ({offer.student?.enrollment_number})
                        </div>
                        <p className="text-[11px] text-text-secondary">
                          {offer.student?.department?.code} &bull; Type: {offer.offer_type}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {offer.compensation_amount && (
                          <span className="font-mono font-bold text-xs text-secondary">
                            ₹{(offer.compensation_amount / 100000).toFixed(1)} LPA
                          </span>
                        )}
                        <Badge variant="success" className="text-[10px]">
                          {offer.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 6: DriveFit Intelligence */}
      {activeTab === "intelligence" && (
        <DriveIntelligenceTab
          driveId={id}
          companyId={drive.company_id}
          companyName={drive.company?.name || "Company"}
          roleTitle={drive.role_title}
          driveTitle={drive.title}
        />
      )}
    </div>
  );
}
