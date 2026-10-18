"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  FileText,
  Globe,
  Plus,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  RefreshCw,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface DriveIntelligenceTabProps {
  driveId: string;
  companyId: string;
  companyName: string;
  roleTitle?: string;
  driveTitle: string;
}

export function DriveIntelligenceTab({
  driveId,
  companyId,
  companyName,
  roleTitle,
  driveTitle,
}: DriveIntelligenceTabProps) {
  const [sources, setSources] = useState<any[]>([]);
  const [requirements, setRequirements] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [canonicalSkills, setCanonicalSkills] = useState<any[]>([]);
  const [coverage, setCoverage] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Add source state
  const [showAddSource, setShowAddSource] = useState(false);
  const [sourceForm, setSourceForm] = useState({
    title: "",
    publisher: "",
    sourceType: "PLACEMENT_NOTICE",
    canonicalUrl: "",
    rawContent: "",
    accessClassification: "TENANT_CONFIDENTIAL",
  });
  const [isIngestingUrl, setIsIngestingUrl] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedProposals, setExtractedProposals] = useState<any[]>([]);

  // Mapping form state
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [mappingForm, setMappingForm] = useState({
    requirementId: "",
    skillId: "",
    importance: "MANDATORY",
    mappingRationale: "",
  });

  const loadIntelligenceData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sourcesRes, reqsRes, mappingsRes, skillsRes, coverageRes] = await Promise.all([
        fetch(`/api/placement/drives/${driveId}/intelligence/sources`),
        fetch(`/api/placement/drives/${driveId}/intelligence/requirements`),
        fetch(`/api/placement/drives/${driveId}/intelligence/mappings`),
        fetch("/api/placement/skills"),
        fetch(`/api/placement/drives/${driveId}/intelligence/coverage`),
      ]);

      if (sourcesRes.ok) setSources(await sourcesRes.json());
      if (reqsRes.ok) setRequirements(await reqsRes.json());
      if (mappingsRes.ok) setMappings(await mappingsRes.json());
      if (skillsRes.ok) setCanonicalSkills(await skillsRes.json());
      if (coverageRes.ok) setCoverage(await coverageRes.json());
    } catch (err: any) {
      setError(err.message || "Failed to load DriveFit intelligence data.");
    } finally {
      setIsLoading(false);
    }
  }, [driveId]);

  useEffect(() => {
    loadIntelligenceData();
  }, [loadIntelligenceData]);

  // Handle URL Ingestion with SSRF Protection
  async function handleIngestUrl() {
    if (!sourceForm.canonicalUrl) return;
    setIsIngestingUrl(true);
    setError(null);
    try {
      const res = await fetch(`/api/placement/drives/${driveId}/intelligence/ingest-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceForm.canonicalUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to ingest URL.");

      setSourceForm((prev) => ({
        ...prev,
        title: prev.title || data.title,
        rawContent: data.text,
        publisher: prev.publisher || new URL(sourceForm.canonicalUrl).hostname,
      }));
      setSuccess("Source URL securely ingested and content sanitized.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsIngestingUrl(false);
    }
  }

  // Handle AI/Rule-based Extraction
  async function handleExtractRequirements() {
    if (!sourceForm.rawContent) {
      setError("Please provide source text or ingest a URL first.");
      return;
    }
    setIsExtracting(true);
    setError(null);
    try {
      const res = await fetch(`/api/placement/drives/${driveId}/intelligence/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sourceForm.rawContent,
          companyName,
          roleTitle,
          driveTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Extraction failed.");

      setExtractedProposals(data.proposals || []);
      setSuccess(
        `Extraction completed (${data.provider}): ${data.proposals?.length || 0} structured requirements proposed for review.`
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsExtracting(false);
    }
  }

  // Save Source and Proposed Requirements
  async function handleSaveSource() {
    if (!sourceForm.title || !sourceForm.publisher) {
      setError("Source title and publisher are required.");
      return;
    }

    try {
      // 1. Create Source
      const sourceRes = await fetch(`/api/placement/drives/${driveId}/intelligence/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sourceForm,
          companyId,
        }),
      });
      const sourceData = await sourceRes.json();
      if (!sourceRes.ok) throw new Error(sourceData.error || "Failed to create source.");

      // 2. Save extracted proposals if any
      if (extractedProposals.length > 0) {
        await fetch(`/api/placement/drives/${driveId}/intelligence/requirements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            sourceId: sourceData.id,
            requirements: extractedProposals,
          }),
        });
      }

      setSuccess("Recruitment source and structured requirements recorded successfully.");
      setShowAddSource(false);
      setExtractedProposals([]);
      setSourceForm({
        title: "",
        publisher: "",
        sourceType: "PLACEMENT_NOTICE",
        canonicalUrl: "",
        rawContent: "",
        accessClassification: "TENANT_CONFIDENTIAL",
      });
      await loadIntelligenceData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Verify Requirement
  async function handleVerifyRequirement(reqId: string, status: "VERIFIED" | "REJECTED") {
    try {
      const res = await fetch(`/api/placement/drives/${driveId}/intelligence/requirements/${reqId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to verify requirement.");
      await loadIntelligenceData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Toggle Publication to Students
  async function handleTogglePublish(reqId: string, currentPublished: boolean) {
    try {
      const res = await fetch(`/api/placement/drives/${driveId}/intelligence/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirementIds: [reqId],
          isPublished: !currentPublished,
        }),
      });
      if (!res.ok) throw new Error("Failed to update publication status.");
      await loadIntelligenceData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Create Skill Mapping
  async function handleCreateMapping(e: React.FormEvent) {
    e.preventDefault();
    if (!mappingForm.requirementId || !mappingForm.skillId || !mappingForm.mappingRationale) {
      setError("Please fill all mapping fields.");
      return;
    }

    try {
      const res = await fetch(`/api/placement/drives/${driveId}/intelligence/mappings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mappingForm),
      });
      if (!res.ok) throw new Error("Failed to map requirement to skill.");

      setSuccess("Requirement mapped to canonical skill.");
      setShowAddMapping(false);
      setMappingForm({
        requirementId: "",
        skillId: "",
        importance: "MANDATORY",
        mappingRationale: "",
      });
      await loadIntelligenceData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Delete Skill Mapping
  async function handleDeleteMapping(mappingId: string) {
    try {
      const res = await fetch(
        `/api/placement/drives/${driveId}/intelligence/mappings?mappingId=${mappingId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete mapping.");
      await loadIntelligenceData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-text-muted space-y-2">
        <Sparkles className="h-6 w-6 mx-auto animate-pulse text-primary" />
        <p className="text-xs">Loading DriveFit Intelligence...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Notice</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="bg-[rgba(46,143,134,0.08)] border-secondary/30">
          <CheckCircle className="h-4 w-4 text-secondary" />
          <AlertTitle className="text-secondary font-semibold">Success</AlertTitle>
          <AlertDescription className="text-text-primary">{success}</AlertDescription>
        </Alert>
      )}

      {/* 1. DriveFit Readiness & Requirement Coverage Summary Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-card to-background shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-bold font-heading text-text-primary">
                  DriveFit Preparation Readiness
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-text-secondary mt-1">
                Deterministic curriculum alignment between verified recruitment requirements and study resources.
              </CardDescription>
            </div>
            <Button asChild variant="primary" size="sm">
              <Link href={`/dashboard/drives/${driveId}/prep`} target="_blank">
                <Eye className="h-4 w-4 mr-1.5" /> Open Student Prep View
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-md bg-background border border-border">
            <div>
              <p className="text-[11px] font-medium text-text-muted">Total Requirements</p>
              <p className="text-xl font-bold font-mono text-text-primary mt-0.5">
                {coverage?.totalRequirements || 0}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-text-muted">Mapped to Skills</p>
              <p className="text-xl font-bold font-mono text-text-primary mt-0.5">
                {coverage?.mappedRequirementsCount || 0}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-text-muted">With Practice Materials</p>
              <p className="text-xl font-bold font-mono text-text-primary mt-0.5">
                {coverage?.mappedWithResourcesCount || 0}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-text-muted">Requirement Coverage</p>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold font-mono text-primary">
                  {coverage?.coveragePercentage || 0}%
                </span>
                <Badge variant={coverage?.coveragePercentage >= 75 ? "success" : "secondary"}>
                  {coverage?.coveragePercentage >= 75 ? "Well Covered" : "Needs Mapping"}
                </Badge>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-text-muted italic mt-2.5">
            * Note: Coverage represents the proportion of requirements mapped to preparation materials. It does NOT
            claim or predict student hiring probabilities.
          </p>
        </CardContent>
      </Card>

      {/* 2. Sources & Evidence Management Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold font-heading text-text-primary">
              Sources &amp; Evidence Library ({sources.length})
            </CardTitle>
            <CardDescription className="text-xs text-text-secondary">
              Official company career portals, placement cell notices, and reported recruitment documents.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddSource(!showAddSource)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {showAddSource ? "Cancel" : "Add Source / Notice"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddSource && (
            <div className="p-4 border border-primary/30 rounded-md bg-input space-y-4">
              <h4 className="text-xs font-bold font-heading text-text-primary uppercase tracking-wider">
                Register New Source &amp; Extract Requirements
              </h4>

              {/* URL Ingestion with SSRF Protection */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  Remote Source URL (With SSRF Security Guard)
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://company.com/careers/job-opening"
                    value={sourceForm.canonicalUrl}
                    onChange={(e) => setSourceForm({ ...sourceForm, canonicalUrl: e.target.value })}
                    className="text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleIngestUrl}
                    disabled={isIngestingUrl || !sourceForm.canonicalUrl}
                  >
                    {isIngestingUrl ? "Fetching..." : "Fetch & Ingest"}
                  </Button>
                </div>
                <p className="text-[11px] text-text-muted">
                  Protected against SSRF attacks. Blocks localhost, private subnets (RFC 1918), and cloud metadata.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Source Title *</label>
                  <Input
                    placeholder="e.g. Official Campus Placement Notice 2026"
                    value={sourceForm.title}
                    onChange={(e) => setSourceForm({ ...sourceForm, title: e.target.value })}
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Publisher / Organization *</label>
                  <Input
                    placeholder="e.g. Google University Programs / Placement Cell"
                    value={sourceForm.publisher}
                    onChange={(e) => setSourceForm({ ...sourceForm, publisher: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Source Type</label>
                  <select
                    value={sourceForm.sourceType}
                    onChange={(e) => setSourceForm({ ...sourceForm, sourceType: e.target.value })}
                    className="w-full text-xs h-9 rounded-md border border-border bg-input px-3 text-text-primary"
                  >
                    <option value="PLACEMENT_NOTICE">College Placement Notice (Drive-Specific)</option>
                    <option value="OFFICIAL_JD">Official Job Description</option>
                    <option value="OFFICIAL_WEBSITE">Company Official Website</option>
                    <option value="STUDENT_REPORT">Reported Candidate Experience</option>
                    <option value="MANUAL_ENTRY">Manual Coordinator Entry</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Access Classification</label>
                  <select
                    value={sourceForm.accessClassification}
                    onChange={(e) => setSourceForm({ ...sourceForm, accessClassification: e.target.value as any })}
                    className="w-full text-xs h-9 rounded-md border border-border bg-input px-3 text-text-primary"
                  >
                    <option value="TENANT_CONFIDENTIAL">Tenant Confidential (College Staff &amp; Students)</option>
                    <option value="PUBLIC">Public / Verified Official</option>
                    <option value="RESTRICTED">Restricted (Staff Eyes Only)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-text-secondary">Source Document / Notice Text</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary"
                    onClick={handleExtractRequirements}
                    disabled={isExtracting || !sourceForm.rawContent}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    {isExtracting ? "Extracting..." : "Extract Requirements"}
                  </Button>
                </div>
                <textarea
                  rows={4}
                  placeholder="Paste the official notice, eligibility circular, or job description here..."
                  value={sourceForm.rawContent}
                  onChange={(e) => setSourceForm({ ...sourceForm, rawContent: e.target.value })}
                  className="w-full text-xs rounded-md border border-border bg-input p-3 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Extracted Proposals Preview */}
              {extractedProposals.length > 0 && (
                <div className="p-3 rounded-md bg-background border border-primary/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Proposed Structured Requirements ({extractedProposals.length})
                    </span>
                    <Badge variant="secondary">Pending Review</Badge>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {extractedProposals.map((prop, idx) => (
                      <div key={idx} className="p-2 rounded bg-card text-xs flex items-center justify-between border border-border">
                        <div>
                          <span className="font-semibold text-text-primary">{prop.title}</span>
                          <span className="ml-2 text-[10px] text-text-muted">({prop.category})</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {prop.evidenceLevel}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="ghost" size="sm" onClick={() => setShowAddSource(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveSource}>
                  Save Source &amp; Requirements
                </Button>
              </div>
            </div>
          )}

          {/* Sources List */}
          {sources.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted bg-background rounded-md border border-dashed border-border">
              No recruitment sources added yet. Add an official notice or job description to begin.
            </div>
          ) : (
            <div className="space-y-2">
              {sources.map((src) => (
                <div
                  key={src.id}
                  className="p-3 rounded-md border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-text-primary">{src.title}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {src.source_type}
                      </Badge>
                      <Badge
                        variant={
                          src.verification_status === "VERIFIED"
                            ? "success"
                            : src.verification_status === "REJECTED"
                            ? "danger"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {src.verification_status}
                      </Badge>
                    </div>
                    <p className="text-text-muted text-[11px]">
                      Publisher: {src.publisher} • Checked: {new Date(src.last_checked_at).toLocaleDateString()}
                    </p>
                  </div>
                  {src.canonical_url && (
                    <a
                      href={src.canonical_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-xs flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" /> View Source
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Structured Requirements & Evidence Claims Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold font-heading text-text-primary">
              Structured Recruitment Requirements ({requirements.length})
            </CardTitle>
            <CardDescription className="text-xs text-text-secondary">
              Review, verify, and publish evidence-backed criteria to the student portal.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {requirements.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted bg-background rounded-md border border-dashed border-border">
              No structured requirements extracted yet. Extract them from your sources above.
            </div>
          ) : (
            <div className="space-y-3">
              {requirements.map((req) => (
                <div
                  key={req.id}
                  className={`p-3.5 rounded-md border text-xs space-y-2 transition-colors ${
                    req.has_conflict
                      ? "border-amber-400 bg-amber-500/5"
                      : req.verification_status === "VERIFIED"
                      ? "border-secondary/30 bg-card"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-text-primary">{req.title}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {req.category}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        Scope: {req.scope_level}
                      </Badge>
                      <Badge
                        variant={
                          req.evidence_level === "OFFICIAL"
                            ? "success"
                            : req.evidence_level === "REPORTED"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {req.evidence_level} Evidence
                      </Badge>
                      <Badge
                        variant={
                          req.verification_status === "VERIFIED"
                            ? "success"
                            : req.verification_status === "REJECTED"
                            ? "danger"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {req.verification_status}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {req.verification_status !== "VERIFIED" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-secondary hover:text-secondary"
                          onClick={() => handleVerifyRequirement(req.id, "VERIFIED")}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" /> Verify
                        </Button>
                      ) : (
                        <Button
                          variant={req.is_published_to_students ? "secondary" : "outline"}
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handleTogglePublish(req.id, req.is_published_to_students)}
                        >
                          {req.is_published_to_students ? "Published to Students" : "Publish to Students"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {req.description && <p className="text-text-secondary text-xs">{req.description}</p>}

                  {req.source_excerpt && (
                    <div className="p-2 rounded bg-background text-[11px] text-text-muted italic border-l-2 border-primary">
                      &quot;{req.source_excerpt}&quot;
                    </div>
                  )}

                  {req.has_conflict && (
                    <div className="p-2 rounded bg-amber-500/10 border border-amber-400 text-amber-900 text-xs flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        Conflicting data detected between sources.
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Requirement-to-Skill Mapping Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-bold font-heading text-text-primary">
              Requirement-to-Skill Mapping Matrix ({mappings.length})
            </CardTitle>
            <CardDescription className="text-xs text-text-secondary">
              Connect drive requirements to canonical curriculum skills and preparation resources.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddMapping(!showAddMapping)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {showAddMapping ? "Cancel" : "Map Requirement to Skill"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showAddMapping && (
            <form onSubmit={handleCreateMapping} className="p-4 border border-primary/30 rounded-md bg-input space-y-3">
              <h4 className="text-xs font-bold font-heading text-text-primary uppercase tracking-wider">
                Create Requirement-to-Skill Link
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Select Drive Requirement *</label>
                  <select
                    value={mappingForm.requirementId}
                    onChange={(e) => setMappingForm({ ...mappingForm, requirementId: e.target.value })}
                    className="w-full text-xs h-9 rounded-md border border-border bg-input px-3 text-text-primary"
                    required
                  >
                    <option value="">-- Choose Requirement --</option>
                    {requirements.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title} ({r.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Target Canonical Skill *</label>
                  <select
                    value={mappingForm.skillId}
                    onChange={(e) => setMappingForm({ ...mappingForm, skillId: e.target.value })}
                    className="w-full text-xs h-9 rounded-md border border-border bg-input px-3 text-text-primary"
                    required
                  >
                    <option value="">-- Choose Curriculum Skill --</option>
                    {canonicalSkills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.category})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Importance</label>
                  <select
                    value={mappingForm.importance}
                    onChange={(e) => setMappingForm({ ...mappingForm, importance: e.target.value })}
                    className="w-full text-xs h-9 rounded-md border border-border bg-input px-3 text-text-primary"
                  >
                    <option value="MANDATORY">Mandatory / Core Evaluated</option>
                    <option value="PREFERRED">Preferred Competency</option>
                    <option value="RECOMMENDED">Recommended Preparation</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-text-secondary">Mapping Rationale *</label>
                  <Input
                    placeholder="e.g. Critical for online assessment section 2 coding problems"
                    value={mappingForm.mappingRationale}
                    onChange={(e) => setMappingForm({ ...mappingForm, mappingRationale: e.target.value })}
                    className="text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowAddMapping(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Save Skill Mapping
                </Button>
              </div>
            </form>
          )}

          {/* Mappings List */}
          {mappings.length === 0 ? (
            <div className="p-6 text-center text-xs text-text-muted bg-background rounded-md border border-dashed border-border">
              No skills mapped yet. Connect requirements to curriculum topics above.
            </div>
          ) : (
            <div className="space-y-2">
              {mappings.map((map) => (
                <div
                  key={map.id}
                  className="p-3 rounded-md border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <span className="font-bold text-text-primary">{map.skill?.name}</span>
                      <ArrowRight className="h-3 w-3 text-text-muted" />
                      <span className="text-text-secondary">{map.requirementTitle}</span>
                      <Badge
                        variant={
                          map.importance === "MANDATORY"
                            ? "default"
                            : map.importance === "PREFERRED"
                            ? "secondary"
                            : "outline"
                        }
                        className="text-[10px]"
                      >
                        {map.importance}
                      </Badge>
                    </div>
                    <p className="text-text-muted text-[11px] italic">
                      Rationale: {map.mapping_rationale}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:bg-red-50 h-7 text-xs"
                    onClick={() => handleDeleteMapping(map.id)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
