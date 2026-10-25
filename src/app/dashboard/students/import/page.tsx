"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Layers,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { ProfileSkeleton } from "@/components/ui/page-skeletons";

export default function StudentImportPage() {
  const router = useRouter();
  const { role, isLoading: isLoadingAuth } = useAuthContext();
  const [csvContent, setCsvContent] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [commitResult, setCommitResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canManageStudents = role && ["PLACEMENT_HEAD", "PLACEMENT_STAFF"].includes(role);

  useEffect(() => {
    if (!isLoadingAuth) {
      if (role === "STUDENT") {
        router.replace("/dashboard/student");
      } else if (!canManageStudents) {
        router.replace("/auth/access-denied");
      }
    }
  }, [role, canManageStudents, isLoadingAuth, router]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content || "");
      setPreviewResult(null);
      setCommitResult(null);
      setErrorMessage(null);
    };
    reader.readAsText(file);
  }

  async function handleValidate() {
    if (!csvContent.trim()) {
      setErrorMessage("Please paste or upload CSV content before validating.");
      return;
    }

    setIsValidating(true);
    setErrorMessage(null);
    setCommitResult(null);

    try {
      const res = await fetch("/api/placement/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "preview", csvContent }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to validate CSV data.");
      }

      setPreviewResult(data);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsValidating(false);
    }
  }

  async function handleCommit() {
    if (!previewResult || previewResult.validRows.length === 0) return;

    setIsCommitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/placement/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "commit", csvContent }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to commit student import.");
      }

      setCommitResult(data);
      setPreviewResult(null);
      setCsvContent("");
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsCommitting(false);
    }
  }

  if (isLoadingAuth) {
    return <ProfileSkeleton />;
  }

  if (!canManageStudents) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 px-2">
              <Link href="/dashboard/students">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-extrabold tracking-tight font-heading text-text-primary">
              Student Bulk Ingestion
            </h1>
          </div>
          <p className="text-xs text-text-secondary pl-8">
            Import student academic cohorts with row-level validation, collision detection, and pre-commit preview.
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <a href="/api/placement/students/import" download>
            <Download className="h-4 w-4 mr-1.5" /> Download CSV Template
          </a>
        </Button>
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Import Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {commitResult && (
        <Alert variant="success" className="bg-[rgba(46,143,134,0.08)] border-secondary/30">
          <CheckCircle2 className="h-4 w-4 text-secondary" />
          <AlertTitle className="text-secondary font-semibold">Import Succeeded</AlertTitle>
          <AlertDescription className="text-text-primary">
            Successfully imported <strong>{commitResult.importedCount}</strong> student records into the college roster.
            <div className="mt-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/dashboard/students">View Student Directory</Link>
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* CSV Input Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upload or Paste CSV</CardTitle>
          <CardDescription>
            Headers must match: <code>enrollment_number, full_name, email, department_code, graduation_year, degree, cgpa, tenth_percentage, twelfth_percentage, active_backlogs, total_backlogs, skills</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-input hover:bg-card cursor-pointer text-xs font-medium text-text-primary transition-colors">
              <Upload className="h-3.5 w-3.5" />
              <span>Choose CSV File</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <span className="text-xs text-text-muted">or paste raw CSV text below:</span>
          </div>

          <textarea
            rows={8}
            value={csvContent}
            onChange={(e) => {
              setCsvContent(e.target.value);
              setPreviewResult(null);
            }}
            placeholder="enrollment_number,full_name,email,department_code,graduation_year,degree,cgpa,tenth_percentage,twelfth_percentage,active_backlogs,total_backlogs,skills&#10;EN2026001,Ananya Roy,ananya@college.edu,CSE,2026,B.Tech,8.95,92.0,88.5,0,0,Java;Python;SQL"
            className="w-full rounded-lg border border-border bg-input p-3 text-xs font-mono text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleValidate}
              disabled={isValidating || !csvContent.trim()}
              isLoading={isValidating}
            >
              {isValidating ? "Validating Records..." : "Validate & Preview Rows"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pre-commit Preview Breakdown */}
      {previewResult && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <span className="text-[11px] font-mono uppercase text-text-muted">Total Rows</span>
                <div className="text-xl font-bold font-heading text-text-primary">
                  {previewResult.totalRows}
                </div>
              </CardContent>
            </Card>

            <Card className="border-secondary/30 bg-[rgba(46,143,134,0.03)]">
              <CardContent className="pt-4 pb-4">
                <span className="text-[11px] font-mono uppercase text-secondary font-semibold">Valid Rows</span>
                <div className="text-xl font-bold font-heading text-secondary">
                  {previewResult.validCount}
                </div>
              </CardContent>
            </Card>

            <Card className="border-red-500/20 bg-red-500/5">
              <CardContent className="pt-4 pb-4">
                <span className="text-[11px] font-mono uppercase text-red-600 font-semibold">Row Errors</span>
                <div className="text-xl font-bold font-heading text-red-600">
                  {previewResult.errorCount}
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="pt-4 pb-4">
                <span className="text-[11px] font-mono uppercase text-amber-700 font-semibold">Collisions</span>
                <div className="text-xl font-bold font-heading text-amber-700">
                  {previewResult.duplicateCount}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Validation Errors Table if any */}
          {previewResult.errors.length > 0 && (
            <Card className="border-red-500/30">
              <CardHeader className="py-3 bg-red-500/5 border-b border-border">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <CardTitle className="text-sm font-semibold text-red-700">
                    Row-Level Validation Failures ({previewResult.errors.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-input text-text-muted font-mono border-b border-border">
                    <tr>
                      <th className="py-2 px-3 w-16">Row #</th>
                      <th className="py-2 px-3 w-36">Field</th>
                      <th className="py-2 px-3">Failure Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {previewResult.errors.map((err: any, idx: number) => (
                      <tr key={idx} className="hover:bg-input/50">
                        <td className="py-2 px-3 font-mono font-bold text-red-600">{err.rowNumber}</td>
                        <td className="py-2 px-3 font-mono text-text-secondary">{err.field}</td>
                        <td className="py-2 px-3 text-text-primary">{err.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Valid Preview Sample Table */}
          {previewResult.validCount > 0 && (
            <Card>
              <CardHeader className="py-3 border-b border-border flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm">Ready to Ingest ({previewResult.validCount} valid)</CardTitle>
                  <CardDescription>Preview of parsed student rows ready for batch insertion</CardDescription>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleCommit}
                  disabled={isCommitting}
                  isLoading={isCommitting}
                >
                  {!isCommitting && <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                  {isCommitting ? "Ingesting Students..." : `Confirm & Commit (${previewResult.validCount})`}
                </Button>
              </CardHeader>
              <CardContent className="p-0 max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-input text-text-muted font-mono border-b border-border">
                    <tr>
                      <th className="py-2 px-3">Enrollment ID</th>
                      <th className="py-2 px-3">Student Name</th>
                      <th className="py-2 px-3">Email</th>
                      <th className="py-2 px-3">Dept</th>
                      <th className="py-2 px-3">CGPA</th>
                      <th className="py-2 px-3">Backlogs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {previewResult.validRows.slice(0, 10).map((row: any, idx: number) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-mono">{row.enrollmentNumber}</td>
                        <td className="py-2 px-3 font-semibold">{row.fullName}</td>
                        <td className="py-2 px-3 font-mono text-text-muted">{row.email}</td>
                        <td className="py-2 px-3 font-mono">{row.departmentCode}</td>
                        <td className="py-2 px-3 font-mono font-bold text-secondary">
                          {row.cgpa.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 font-mono">{row.activeBacklogs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewResult.validRows.length > 10 && (
                  <div className="p-2.5 text-center text-[11px] text-text-muted font-mono bg-input/30 border-t border-border">
                    + {previewResult.validRows.length - 10} more valid records
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
