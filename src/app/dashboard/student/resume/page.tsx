"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Download,
  Trash2,
  Star,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  Clock,
  Check,
  AlertCircle,
  FileCheck,
  Cpu,
  Loader2,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import type { ResumeRecord } from "@/modules/students/services/resume-storage-service";
import type { ResumeScanRecord } from "@/modules/students/services/resume-scanner-service";

export default function StudentResumePage() {
  const auth = useAuthContext();
  const router = useRouter();

  const [resumes, setResumes] = React.useState<ResumeRecord[]>([]);
  const [selectedResumeId, setSelectedResumeId] = React.useState<string | null>(null);
  const [activeScan, setActiveScan] = React.useState<ResumeScanRecord | null>(null);
  const [scanHistory, setScanHistory] = React.useState<ResumeScanRecord[]>([]);

  const [loading, setLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);
  const [resumeToDelete, setResumeToDelete] = React.useState<ResumeRecord | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchResumes = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/student/resumes");
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        setResumes(json.data);
        if (json.data.length > 0 && !selectedResumeId) {
          const primary = json.data.find((r: ResumeRecord) => r.isPrimary) || json.data[0];
          setSelectedResumeId(primary.id);
        }
      }
    } catch (err: any) {
      console.error("[ResumePage] Fetch resumes error:", err);
      setError(err.message || "Failed to load resumes");
    } finally {
      setLoading(false);
    }
  }, [selectedResumeId]);

  // Fetch scan history when selected resume changes
  const fetchScanHistory = React.useCallback(async (resumeId: string) => {
    try {
      const res = await fetch(`/api/student/resumes/${resumeId}/history`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setScanHistory(json.data);
          if (json.data.length > 0) {
            setActiveScan(json.data[0]);
          } else {
            setActiveScan(null);
          }
        }
      }
    } catch (err) {
      console.warn("[ResumePage] Error fetching scan history:", err);
    }
  }, []);

  React.useEffect(() => {
    if (!auth.isLoading) {
      if (!auth.isAuthenticated) {
        router.push("/auth/signin");
        return;
      }
      fetchResumes();
    }
  }, [auth.isLoading, auth.isAuthenticated, router, fetchResumes]);

  React.useEffect(() => {
    if (selectedResumeId) {
      fetchScanHistory(selectedResumeId);
    }
  }, [selectedResumeId, fetchScanHistory]);

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      setError(null);
      setSuccessMsg(null);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/student/resumes", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to upload resume document");
      }

      const json = await res.json();
      if (json.success && json.data) {
        setSuccessMsg(`Resume "${file.name}" uploaded and parsed successfully!`);
        await fetchResumes();
        setSelectedResumeId(json.data.id);
      }
    } catch (err: any) {
      console.error("[ResumePage] Upload error:", err);
      setError(err.message || "Failed to upload resume document");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSetPrimary = async (resumeId: string) => {
    try {
      const res = await fetch(`/api/student/resumes/${resumeId}/primary`, {
        method: "POST",
      });
      if (res.ok) {
        setSuccessMsg("Primary resume updated successfully.");
        await fetchResumes();
      }
    } catch (err) {
      console.error("Failed to set primary resume:", err);
    }
  };

  const handleDownload = async (resumeId: string) => {
    try {
      const res = await fetch(`/api/student/resumes/${resumeId}/download`);
      if (res.ok) {
        const json = await res.json();
        if (json.signedUrl) {
          window.open(json.signedUrl, "_blank");
        }
      }
    } catch (err) {
      console.error("Failed to download resume:", err);
    }
  };

  const handleConfirmDelete = async () => {
    if (!resumeToDelete) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/student/resumes/${resumeToDelete.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSuccessMsg(`Resume "${resumeToDelete.fileName}" was permanently deleted.`);
        if (selectedResumeId === resumeToDelete.id) {
          setSelectedResumeId(null);
          setActiveScan(null);
        }
        setResumeToDelete(null);
        await fetchResumes();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson.error || "Failed to delete resume.");
      }
    } catch (err: any) {
      console.error("Failed to delete resume:", err);
      setError(err.message || "Failed to delete resume.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleScan = async (resumeId: string) => {
    try {
      setScanning(true);
      setError(null);

      const res = await fetch(`/api/student/resumes/${resumeId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to analyze resume");
      }

      const json = await res.json();
      if (json.success && json.data) {
        setActiveScan(json.data);
        await fetchScanHistory(resumeId);
        setSuccessMsg("AI ATS scan completed successfully!");
      }
    } catch (err: any) {
      console.error("[ResumePage] Scan error:", err);
      setError(err.message || "Failed to analyze resume");
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const selectedResume = resumes.find((r) => r.id === selectedResumeId) || resumes[0];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-text-secondary font-mono mb-1">
            <Link href="/dashboard/student" className="hover:text-primary transition-colors">
              Student Dashboard
            </Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-text-primary">Resume Intelligence</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary font-heading">
            AI Resume &amp; ATS Scanner
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary">
            Upload your resumes, evaluate ATS parseability, inspect content gaps, and receive non-hallucinated improvements.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span>{uploading ? "Uploading..." : "Upload New Resume"}</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-800 dark:text-teal-300 flex items-center gap-2.5 text-xs font-medium animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger flex items-center gap-2.5 text-xs font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload & Resumes Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Resumes List & Upload Dropzone */}
        <div className="space-y-4 lg:col-span-1">
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold font-heading">Your Resumes</CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {resumes.length} {resumes.length === 1 ? "Version" : "Versions"}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Select a resume version to review or run an ATS scan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {resumes.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 text-center border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-xl cursor-pointer space-y-2 bg-surface/30"
                >
                  <Upload className="h-6 w-6 text-text-muted mx-auto" />
                  <p className="text-xs font-semibold text-text-primary">Upload your first resume</p>
                  <p className="text-[11px] text-text-muted">PDF or DOCX up to 10MB</p>
                </div>
              ) : (
                resumes.map((r) => {
                  const isSelected = r.id === selectedResumeId;
                  return (
                    <div
                      key={r.id}
                      onClick={() => setSelectedResumeId(r.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-card hover:border-primary/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <span className="text-xs font-bold text-text-primary truncate">
                            {r.fileName}
                          </span>
                        </div>
                        {r.isPrimary && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
                            Primary
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-text-muted font-mono pt-1 border-t border-border/40">
                        <span>{(r.fileSizeBytes / 1024).toFixed(0)} KB &bull; {r.fileType.toUpperCase()}</span>
                        <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        {!r.isPrimary && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSetPrimary(r.id);
                            }}
                            className="p-1 hover:text-primary text-text-muted text-[10px] flex items-center gap-0.5"
                            title="Set as Primary"
                          >
                            <Star className="h-3 w-3" />
                            <span>Set Primary</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(r.id);
                          }}
                          className="p-1 hover:text-text-primary text-text-muted"
                          title="Download Document"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setResumeToDelete(r);
                          }}
                          className="p-1 hover:text-status-danger text-text-muted transition-colors rounded"
                          title="Delete Resume"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: ATS Diagnostic & Scan Evaluation */}
        <div className="space-y-6 lg:col-span-2">
          {selectedResume ? (
            <div className="space-y-6">
              {/* Scan Trigger Bar */}
              <Card className="border-border bg-card">
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-bold font-heading text-text-primary">
                        ATS Diagnostic for {selectedResume.fileName}
                      </h3>
                    </div>
                    <p className="text-xs text-text-secondary">
                      Evaluate standard ATS parseability, evidence-backed competencies, and bullet point clarity.
                    </p>
                  </div>

                  <Button
                    type="button"
                    onClick={() => handleScan(selectedResume.id)}
                    disabled={scanning}
                    className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shrink-0"
                  >
                    {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cpu className="h-4 w-4" />}
                    <span>{scanning ? "Evaluating ATS..." : "Run AI ATS Scan"}</span>
                  </Button>
                </CardContent>
              </Card>

              {/* Scan Results Display */}
              {activeScan ? (
                <div className="space-y-6 animate-in fade-in">
                  {/* Scores Grid */}
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Card className="border-border bg-card">
                      <CardContent className="p-4 space-y-1">
                        <span className="text-[10px] font-mono text-text-muted uppercase">Overall Quality</span>
                        <div className="text-2xl font-extrabold font-heading text-primary">
                          {activeScan.overallQualityScore}/100
                        </div>
                        <p className="text-[10px] text-text-secondary">Weighted diagnostic</p>
                      </CardContent>
                    </Card>

                    <Card className="border-border bg-card">
                      <CardContent className="p-4 space-y-1">
                        <span className="text-[10px] font-mono text-text-muted uppercase">Parseability</span>
                        <div className="text-2xl font-extrabold font-heading text-secondary">
                          {activeScan.parseabilityScore}%
                        </div>
                        <p className="text-[10px] text-text-secondary">Layout readability</p>
                      </CardContent>
                    </Card>

                    <Card className="border-border bg-card">
                      <CardContent className="p-4 space-y-1">
                        <span className="text-[10px] font-mono text-text-muted uppercase">Content Quality</span>
                        <div className="text-2xl font-extrabold font-heading text-text-primary">
                          {activeScan.contentQualityScore}%
                        </div>
                        <p className="text-[10px] text-text-secondary">Action verbs &amp; clarity</p>
                      </CardContent>
                    </Card>

                    <Card className="border-border bg-card">
                      <CardContent className="p-4 space-y-1">
                        <span className="text-[10px] font-mono text-text-muted uppercase">Skills Evidence</span>
                        <div className="text-2xl font-extrabold font-heading text-teal-600">
                          {activeScan.skillsCoverageScore || 70}%
                        </div>
                        <p className="text-[10px] text-text-secondary">Substantiated skills</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Summary & Mandatory Disclaimer */}
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider font-mono text-text-secondary">
                        Executive Summary &amp; Compliance
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-text-primary leading-relaxed">
                        {activeScan.analysisSummary}
                      </p>

                      <div className="p-3 rounded-lg bg-surface border border-border/60 text-[11px] text-text-muted italic flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 shrink-0 text-secondary" />
                        <span>
                          UrPlaced AI Resume Assessment — an estimated diagnostic, not an employer ATS guarantee.
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sections Identified vs Missing */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card className="border-border bg-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider font-mono text-teal-600 flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5" />
                          <span>Detected Standard Sections</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1.5">
                          {activeScan.detectedSections.map((s, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-border bg-card">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider font-mono text-danger flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>Missing Recommended Sections</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {activeScan.missingSections.length === 0 ? (
                          <span className="text-xs text-text-muted italic">All core sections present!</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {activeScan.missingSections.map((s, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs bg-danger/10 text-danger border-danger/30">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* High Impact Issues & Weaknesses */}
                  {activeScan.issues.length > 0 && (
                    <Card className="border-border bg-card">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider font-mono text-text-primary">
                          Identified ATS Risks &amp; Formatting Issues
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {activeScan.issues.map((issue, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl border border-border bg-surface/40 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-text-primary font-heading">
                                {issue.title}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] uppercase font-mono ${
                                  issue.severity === "high"
                                    ? "bg-danger/10 text-danger border-danger/30"
                                    : issue.severity === "medium"
                                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                                    : "bg-surface text-text-muted"
                                }`}
                              >
                                {issue.severity}
                              </Badge>
                            </div>
                            <p className="text-xs text-text-secondary">{issue.explanation}</p>
                            <p className="text-[11px] text-primary font-medium">
                              <strong>Recommendation:</strong> {issue.recommendation}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {/* Bullet Point Improvement Suggestions (Non-Hallucinated) */}
                  {activeScan.improvementSuggestions.length > 0 && (
                    <Card className="border-border bg-card">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider font-mono text-text-primary">
                          Targeted Bullet Point Rewrites (Preserving Authentic Evidence)
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Bracketed items like <code className="text-primary font-mono">[Specify user count]</code> indicate metrics you should supply.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {activeScan.improvementSuggestions.map((sugg, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl border border-border bg-surface/30 space-y-2">
                            <div className="text-[11px] font-mono text-text-muted font-bold">
                              SECTION: {sugg.section}
                            </div>
                            {sugg.originalText && (
                              <div className="p-2.5 rounded-lg bg-surface border border-border/40 text-xs text-text-secondary">
                                <span className="text-[10px] font-mono text-text-muted block">ORIGINAL:</span>
                                {sugg.originalText}
                              </div>
                            )}
                            <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-xs text-text-primary">
                              <span className="text-[10px] font-mono text-primary font-bold block">RECOMMENDED REWRITE:</span>
                              {sugg.suggestedText}
                            </div>
                            <p className="text-[11px] text-text-secondary italic">{sugg.explanation}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <div className="p-10 text-center border border-border bg-card rounded-2xl space-y-3">
                  <Cpu className="h-8 w-8 text-text-muted mx-auto" />
                  <h4 className="text-sm font-bold font-heading text-text-primary">
                    No ATS Scan Recorded For This Version
                  </h4>
                  <p className="text-xs text-text-secondary max-w-md mx-auto">
                    Click &quot;Run AI ATS Scan&quot; above to evaluate this resume against enterprise parsing engines and collegiate recruitment standards.
                  </p>
                  <Button
                    type="button"
                    onClick={() => handleScan(selectedResume.id)}
                    disabled={scanning}
                    className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5"
                  >
                    <Cpu className="h-4 w-4" />
                    <span>Run Diagnostic Now</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center border border-border bg-card rounded-2xl space-y-3">
              <FileText className="h-10 w-10 text-text-muted mx-auto" />
              <h3 className="text-base font-bold font-heading text-text-primary">No Resumes Uploaded</h3>
              <p className="text-xs text-text-secondary max-w-sm mx-auto">
                Upload your resume in PDF or DOCX format to inspect ATS score diagnostics and match with campus opportunities.
              </p>
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-primary text-white text-xs gap-1.5"
              >
                <Upload className="h-4 w-4" />
                <span>Upload Resume Document</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Elegant Branded Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={Boolean(resumeToDelete)}
        onClose={() => {
          if (!isDeleting) setResumeToDelete(null);
        }}
        title="Delete Resume Document"
        itemName={resumeToDelete?.fileName}
        description="Are you sure you want to permanently delete this resume? All associated ATS diagnostic scans, parseability scores, and improvement recommendations will be permanently removed. This action cannot be undone."
        confirmLabel="Permanently Delete"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
