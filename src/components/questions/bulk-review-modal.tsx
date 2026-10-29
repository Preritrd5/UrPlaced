"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Loader2,
  BookOpen,
  Filter,
  FileCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export interface BulkReviewFilters {
  bankId?: string;
  bankName?: string;
  subject?: string;
  topic?: string;
  questionType?: string;
  difficulty?: string;
  search?: string;
}

export interface BulkAcceptResultData {
  success: boolean;
  totalMatched: number;
  acceptedCount: number;
  skippedCount: number;
  failedCount: number;
  skippedDetails: Array<{
    questionId: string;
    promptSnippet: string;
    reason: string;
  }>;
  error?: string;
}

interface BulkReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  filters: BulkReviewFilters;
  eligibleCount: number;
}

export function BulkReviewModal({
  isOpen,
  onClose,
  onSuccess,
  filters,
  eligibleCount,
}: BulkReviewModalProps) {
  const [reviewNotes, setReviewNotes] = useState("Bulk verified and accepted by Placement Head");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<BulkAcceptResultData | null>(null);
  const [showSkippedList, setShowSkippedList] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReviewNotes("Bulk verified and accepted by Placement Head");
      setIsSubmitting(false);
      setErrorMsg(null);
      setResult(null);
      setShowSkippedList(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmAcceptAll = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/questions/bulk-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankId: filters.bankId || undefined,
          subject: filters.subject || undefined,
          topic: filters.topic || undefined,
          questionType: filters.questionType || undefined,
          difficulty: filters.difficulty || undefined,
          search: filters.search || undefined,
          reviewNotes: reviewNotes.trim() || undefined,
        }),
      });

      const data: BulkAcceptResultData = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to bulk review questions.");
      }

      setResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during bulk review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#F8F7F3] text-[#24283A] w-full max-w-xl max-h-[92dvh] flex flex-col rounded-xl shadow-xl border border-[#DDDCD5] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DDDCD5] px-4 sm:px-6 py-3.5 sm:py-4 bg-[#F8F7F3] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
            <div className="p-2 rounded-lg bg-[#2E8F86]/10 text-[#2E8F86] border border-[#2E8F86]/20 shrink-0">
              <CheckCheck className="w-5 h-5 text-[#2E8F86]" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#24283A] font-display truncate">
                Bulk Review & Accept Questions
              </h2>
              <p className="text-xs text-[#292D40]/70 truncate">
                Verify answer keys and approve questions matching active filter scope
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-[#292D40]/60 hover:text-[#24283A] p-1 rounded-md transition-colors disabled:opacity-50 shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto max-h-[calc(92dvh-130px)]">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200 flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Bulk Review Error</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {!result ? (
            <>
              {/* Review Scope Card */}
              <div className="p-4 rounded-lg bg-[#EDECE7]/60 border border-[#DDDCD5] space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#292D40] uppercase tracking-wider">
                  <Filter className="w-3.5 h-3.5 text-[#5052C9]" /> Active Review Scope
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#292D40]/60">Question Bank:</span>
                    <p className="font-medium text-[#24283A] truncate">
                      {filters.bankName || "All Question Banks"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#292D40]/60">Subject:</span>
                    <p className="font-medium text-[#24283A] truncate">
                      {filters.subject || "All Subjects"}
                    </p>
                  </div>
                  {filters.topic && (
                    <div>
                      <span className="text-[#292D40]/60">Topic Tag:</span>
                      <p className="font-medium text-[#24283A] truncate">{filters.topic}</p>
                    </div>
                  )}
                  {filters.questionType && (
                    <div>
                      <span className="text-[#292D40]/60">Type:</span>
                      <p className="font-medium text-[#24283A]">{filters.questionType}</p>
                    </div>
                  )}
                  {filters.difficulty && (
                    <div>
                      <span className="text-[#292D40]/60">Difficulty:</span>
                      <p className="font-medium text-[#24283A]">{filters.difficulty}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status & Eligibility Banner */}
              <div className="p-4 rounded-lg bg-[#2E8F86]/10 border border-[#2E8F86]/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-[#2E8F86]" />
                    <span className="text-sm font-bold text-[#24283A]">
                      {eligibleCount} Candidate Question{eligibleCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#2E8F86] text-white">
                    Ready for Review
                  </span>
                </div>
                <p className="text-xs text-[#292D40]/80 leading-relaxed">
                  Questions will transition from <span className="font-semibold text-[#24283A]">Unreviewed</span> to{" "}
                  <span className="font-semibold text-[#2E8F86]">Verified Correct</span> and their lifecycle status
                  will be set to <span className="font-semibold text-[#5052C9]">Approved</span>, making them available
                  for Question Sets. Questions will <span className="font-semibold text-[#24283A]">not</span> be published automatically.
                </p>
              </div>

              {/* Audit Notes Input */}
              <div className="space-y-1.5">
                <Label htmlFor="reviewNotes" className="text-xs font-semibold text-[#24283A]">
                  Review & Audit Notes
                </Label>
                <Input
                  id="reviewNotes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="e.g. Verified by Department Head for 2026 Recruitment Drive"
                  className="bg-[#FBFAF7] border-[#DDDCD5] text-xs text-[#24283A]"
                  disabled={isSubmitting}
                />
                <p className="text-[11px] text-[#292D40]/60">
                  Recorded in the immutable version history along with your reviewer identity.
                </p>
              </div>

              {eligibleCount === 0 && (
                <div className="p-3 bg-amber-50 text-amber-800 text-xs rounded-lg border border-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    No unreviewed questions found matching this filter scope. Adjust filters or author new questions.
                  </span>
                </div>
              )}
            </>
          ) : (
            /* Results View */
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-[#2E8F86]/10 border border-[#2E8F86]/20 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#2E8F86] shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-[#24283A]">Bulk Review Completed</h3>
                  <p className="text-xs text-[#292D40]/80">
                    Questions have been evaluated and verified in according with Sentinel standards.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-[#FBFAF7] border border-[#DDDCD5] text-center">
                  <span className="text-[11px] font-semibold text-[#292D40]/60 uppercase">Accepted</span>
                  <p className="text-2xl font-bold font-mono text-[#2E8F86] mt-1">
                    {result.acceptedCount}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#FBFAF7] border border-[#DDDCD5] text-center">
                  <span className="text-[11px] font-semibold text-[#292D40]/60 uppercase">Skipped</span>
                  <p className="text-2xl font-bold font-mono text-amber-600 mt-1">
                    {result.skippedCount}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#FBFAF7] border border-[#DDDCD5] text-center">
                  <span className="text-[11px] font-semibold text-[#292D40]/60 uppercase">Failed</span>
                  <p className="text-2xl font-bold font-mono text-red-600 mt-1">
                    {result.failedCount}
                  </p>
                </div>
              </div>

              {result.skippedDetails && result.skippedDetails.length > 0 && (
                <div className="border border-[#DDDCD5] rounded-lg overflow-hidden bg-[#FBFAF7]">
                  <button
                    type="button"
                    onClick={() => setShowSkippedList(!showSkippedList)}
                    className="w-full flex items-center justify-between p-3 text-xs font-semibold text-[#24283A] hover:bg-[#EDECE7]/40 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      View Skipped Details ({result.skippedDetails.length})
                    </span>
                    {showSkippedList ? (
                      <ChevronUp className="w-4 h-4 text-[#292D40]/60" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#292D40]/60" />
                    )}
                  </button>

                  {showSkippedList && (
                    <div className="p-3 border-t border-[#DDDCD5] max-h-48 overflow-y-auto space-y-2 text-xs">
                      {result.skippedDetails.map((item, idx) => (
                        <div key={idx} className="p-2 rounded bg-[#EDECE7]/50 border border-[#DDDCD5]/60">
                          <p className="font-medium text-[#24283A] line-clamp-1">{item.promptSnippet}</p>
                          <p className="text-[11px] text-amber-800 mt-0.5">{item.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-[#DDDCD5] bg-[#F8F7F3] shrink-0">
          {!result ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSubmitting}
                className="text-xs border-[#DDDCD5] text-[#24283A] hover:bg-[#EDECE7] w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmAcceptAll}
                disabled={isSubmitting || eligibleCount === 0}
                className="bg-[#2E8F86] hover:bg-[#267870] text-white flex items-center justify-center gap-1.5 text-xs font-semibold shadow-sm w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Accepting Questions...
                  </>
                ) : (
                  <>
                    <CheckCheck className="w-3.5 h-3.5" />
                    Accept All ({eligibleCount})
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={handleFinish}
              className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs font-semibold"
            >
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
