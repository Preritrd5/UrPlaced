"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  ShieldCheck,
  Send,
  FolderPlus,
  AlertCircle,
} from "lucide-react";
import { BrandLoader } from "@/components/common/brand-loader";
import { CreateQuestionBankModal } from "@/components/questions/create-question-bank-modal";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { ProfileSkeleton } from "@/components/ui/page-skeletons";

export default function QuestionImportPage() {
  const router = useRouter();
  const { role, isPlatformAdmin, isLoading: isLoadingAuth } = useAuthContext();
  const [banks, setBanks] = useState<any[]>([]);
  const [selectedBankId, setSelectedBankId] = useState("");
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [createBankModalOpen, setCreateBankModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const [commitStatus, setCommitStatus] = useState<any | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const canManageQuestions = isPlatformAdmin || (role && ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"].includes(role));

  useEffect(() => {
    if (!isLoadingAuth) {
      if (role === "STUDENT") {
        router.replace("/dashboard/student");
      } else if (!canManageQuestions) {
        router.replace("/auth/access-denied");
      }
    }
  }, [role, canManageQuestions, isLoadingAuth, router]);

  // Load Banks
  const fetchBanks = async () => {
    setLoadingBanks(true);
    setBanksError(null);
    try {
      const res = await fetch("/api/questions/banks");
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("You do not have permission to access Question Banks.");
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load Question Banks.");
      }
      const data = await res.json();
      setBanks(data || []);
      if (data && data.length > 0) {
        setSelectedBankId((current) => {
          return data.some((b: any) => b.id === current) ? current : data[0].id;
        });
      } else {
        setSelectedBankId("");
      }
    } catch (err: any) {
      console.error("Failed to load question banks", err);
      setBanksError(err.message || "Failed to load Question Banks.");
    } finally {
      setLoadingBanks(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  // Handle File Upload & Pre-commit Preview
  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setGeneralError("Please choose a CSV file to upload.");
      return;
    }
    if (!selectedBankId) {
      setGeneralError(
        banks.length === 0
          ? "Please create a Question Bank before importing questions."
          : "Please select a target Question Bank."
      );
      return;
    }

    setLoading(true);
    setGeneralError(null);
    setPreviewResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bankId", selectedBankId);

    try {
      const res = await fetch("/api/questions/import/preview", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Preview failed.");
      }

      setPreviewResult(data);
    } catch (err: any) {
      setGeneralError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Explicit Confirmation Commit
  const handleCommit = async () => {
    if (!previewResult || !previewResult.rows) return;

    setLoading(true);
    setGeneralError(null);

    try {
      const res = await fetch("/api/questions/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankId: selectedBankId,
          fileName: previewResult.fileName,
          items: previewResult.rows,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Import commit failed.");
      }

      setCommitStatus(data);
    } catch (err: any) {
      setGeneralError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingAuth) {
    return <ProfileSkeleton />;
  }

  if (!canManageQuestions) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/questions"
            className="p-2 rounded-md hover:bg-card text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight font-display flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6 text-primary" />
              Batch Question Import
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Pre-commit CSV structural validation, duplicate detection, and formula-injection defense.
            </p>
          </div>
        </div>

        <a href="/api/questions/import/template" download>
          <Button variant="outline" size="sm" className="text-xs flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Download Template
          </Button>
        </a>
      </div>

      {generalError && (
        <div className="p-4 rounded-md bg-red-50 text-red-700 text-sm border border-red-200">
          {generalError}
        </div>
      )}

      {/* Success View */}
      {commitStatus && (
        <Card className="p-8 text-center space-y-4 border-[#2E8F86]/40 bg-[#2E8F86]/5">
          <CheckCircle2 className="w-12 h-12 text-[#2E8F86] mx-auto" />
          <h2 className="text-xl font-bold text-text-primary font-display">
            Import Committed Successfully!
          </h2>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            {commitStatus.committedCount} questions imported into the target bank with <strong>Pending Review</strong> status.
            {commitStatus.duplicateAlertCount > 0 && (
              <span className="block mt-1 text-amber-700 font-medium">
                {commitStatus.duplicateAlertCount} duplicate candidate alerts generated for staff review.
              </span>
            )}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setCommitStatus(null);
                setPreviewResult(null);
                setFile(null);
              }}
            >
              Import Another File
            </Button>
            <Button
              className="bg-primary hover:bg-primary-hover text-white flex items-center gap-1.5"
              onClick={() => router.push(selectedBankId ? `/dashboard/questions?bankId=${selectedBankId}` : "/dashboard/questions")}
            >
              <span>Review Imported Questions</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Upload & Preview Step */}
      {!previewResult && !commitStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Step 1: Upload Question CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePreview} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="target-question-bank-select"
                    className="block text-xs font-semibold text-text-secondary"
                  >
                    Target Question Bank *
                  </label>
                  {banks.length > 0 && !loadingBanks && !banksError && (
                    <button
                      type="button"
                      onClick={() => setCreateBankModalOpen(true)}
                      className="text-[11px] font-semibold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
                    >
                      <FolderPlus className="w-3.5 h-3.5" /> + New Bank
                    </button>
                  )}
                </div>
                <p className="text-xs text-text-secondary">
                  Choose the Question Bank where your imported questions will be saved.
                </p>

                {loadingBanks ? (
                  <div className="h-10 px-3 rounded-md bg-input border border-border text-xs text-text-secondary flex items-center justify-center">
                    <BrandLoader size="button" label="Loading Question Banks..." />
                  </div>
                ) : banksError ? (
                  <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Failed to load Question Banks</span>
                    </div>
                    <p className="text-[11px] text-red-600">{banksError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={fetchBanks}
                      className="h-7 text-xs px-2 mt-1"
                    >
                      Retry
                    </Button>
                  </div>
                ) : banks.length === 0 ? (
                  <div className="p-4 rounded-xl bg-input/70 border border-dashed border-border text-center space-y-2">
                    <div className="flex items-center justify-center gap-1.5 text-text-primary text-sm font-semibold">
                      <FolderPlus className="w-4 h-4 text-primary" />
                      <span>Create a Question Bank before importing</span>
                    </div>
                    <p className="text-xs text-text-secondary max-w-md mx-auto">
                      Your uploaded questions need a destination bank. Create one here, then continue with your CSV import.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setCreateBankModalOpen(true)}
                      className="text-xs h-8 bg-primary hover:bg-primary-hover text-white flex items-center justify-center gap-1.5 font-semibold mx-auto"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      + Create Question Bank
                    </Button>
                  </div>
                ) : (
                  <select
                    id="target-question-bank-select"
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  >
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} — {b.subject || b.category} ({b.category})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Choose CSV File *
                </label>
                <div className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-input/40 hover:bg-input transition-colors">
                  <Upload className="w-8 h-8 text-text-secondary mx-auto mb-2 opacity-60" />
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-hover cursor-pointer"
                  />
                  {file && (
                    <p className="mt-2 text-xs font-semibold text-text-primary">
                      Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-text-secondary flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-[#2E8F86]" /> Pre-commit preview validates all rows before writing to database.
                </span>
                <Button
                  type="submit"
                  disabled={loading || !file}
                  isLoading={loading}
                  className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold"
                >
                  {loading ? "Validating..." : "Analyze & Preview CSV"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Preview & Confirmation Step */}
      {previewResult && !commitStatus && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <span className="text-xs font-semibold text-text-secondary uppercase">Total Rows</span>
              <div className="text-2xl font-bold font-mono text-text-primary mt-1">
                {previewResult.totalRows}
              </div>
            </Card>

            <Card className="p-4">
              <span className="text-xs font-semibold text-[#2E8F86] uppercase">Valid Rows</span>
              <div className="text-2xl font-bold font-mono text-[#2E8F86] mt-1">
                {previewResult.validRows}
              </div>
            </Card>

            <Card className="p-4">
              <span className="text-xs font-semibold text-red-600 uppercase">Invalid Rows</span>
              <div className="text-2xl font-bold font-mono text-red-600 mt-1">
                {previewResult.invalidRows}
              </div>
            </Card>

            <Card className="p-4">
              <span className="text-xs font-semibold text-amber-600 uppercase">Duplicate Alerts</span>
              <div className="text-2xl font-bold font-mono text-amber-600 mt-1">
                {previewResult.duplicateRows}
              </div>
              {(previewResult.existingDuplicateRows > 0 || previewResult.intraFileDuplicateRows > 0) && (
                <span className="text-[10px] text-text-secondary mt-1 block">
                  {previewResult.existingDuplicateRows > 0 && `${previewResult.existingDuplicateRows} existing in college`}
                  {previewResult.existingDuplicateRows > 0 && previewResult.intraFileDuplicateRows > 0 && " • "}
                  {previewResult.intraFileDuplicateRows > 0 && `${previewResult.intraFileDuplicateRows} in file`}
                </span>
              )}
            </Card>
          </div>

          {/* General Errors if any */}
          {previewResult.generalErrors?.length > 0 && (
            <div className="p-4 rounded-md bg-red-50 text-red-700 text-xs border border-red-200 space-y-1">
              <span className="font-bold">File-Level Errors:</span>
              <ul className="list-disc list-inside">
                {previewResult.generalErrors.map((err: string, i: number) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">Row-by-Row Structural Inspector</CardTitle>
              <span className="text-xs text-text-secondary">
                File: {previewResult.fileName}
              </span>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-card/60">
                    <th className="p-3 font-semibold text-text-secondary w-12">#</th>
                    <th className="p-3 font-semibold text-text-secondary w-28">Type</th>
                    <th className="p-3 font-semibold text-text-secondary">Prompt Excerpt</th>
                    <th className="p-3 font-semibold text-text-secondary w-24">Difficulty</th>
                    <th className="p-3 font-semibold text-text-secondary w-28">Status</th>
                    <th className="p-3 font-semibold text-text-secondary w-64">Diagnostics</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previewResult.rows.map((row: any) => (
                    <tr
                      key={row.rowNumber}
                      className={row.isValid ? "hover:bg-card/40" : "bg-red-50/50"}
                    >
                      <td className="p-3 font-mono font-bold text-text-secondary">
                        {row.rowNumber}
                      </td>
                      <td className="p-3 font-mono">{row.question_type}</td>
                      <td className="p-3 text-text-primary line-clamp-1 max-w-xs">
                        {row.prompt}
                      </td>
                      <td className="p-3 font-mono">{row.difficulty}</td>
                      <td className="p-3">
                        {row.isValid ? (
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3" /> Valid
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-red-400 text-red-700 bg-red-50 flex items-center gap-1 w-fit">
                            <XCircle className="w-3 h-3" /> Error
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 text-[11px]">
                        {row.errors.length > 0 && (
                          <p className="text-red-600 font-medium">{row.errors.join("; ")}</p>
                        )}
                        {row.warnings.length > 0 && (
                          <p className="text-amber-700">{row.warnings.join("; ")}</p>
                        )}
                        {row.errors.length === 0 && row.warnings.length === 0 && (
                          <span className="text-text-secondary italic">Clean record</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Action Footer */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-card rounded-xl border border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreviewResult(null)}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Cancel & Pick Another File
            </Button>

            <Button
              type="button"
              disabled={loading || previewResult.validRows === 0}
              isLoading={loading}
              onClick={handleCommit}
              className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold flex items-center justify-center gap-1.5 w-full sm:w-auto"
            >
              {!loading && <Send className="w-3.5 h-3.5" />}
              {loading
                ? "Committing..."
                : `Commit ${previewResult.validRows} Valid Questions (Pending Review)`}
            </Button>
          </div>
        </div>
      )}

      {/* Create Question Bank Modal */}
      <CreateQuestionBankModal
        isOpen={createBankModalOpen}
        onClose={() => setCreateBankModalOpen(false)}
        onSuccess={(newBank) => {
          setBanks((prev) => [newBank, ...prev.filter((b) => b.id !== newBank.id)]);
          setSelectedBankId(newBank.id);
          setBanksError(null);
          setGeneralError(null);
        }}
      />
    </div>
  );
}
