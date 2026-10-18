"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { AnswerKeyReviewStatus } from "@/types/database";
import { CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";

interface AnswerKeyReviewModalProps {
  questionId: string;
  versionId: string;
  currentStatus: AnswerKeyReviewStatus;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AnswerKeyReviewModal({
  questionId,
  versionId,
  currentStatus,
  isOpen,
  onClose,
  onSuccess,
}: AnswerKeyReviewModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<AnswerKeyReviewStatus>(
    currentStatus === "UNREVIEWED" ? "VERIFIED_CORRECT" : currentStatus
  );
  const [reviewNotes, setReviewNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/questions/${questionId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId,
          reviewStatus: selectedStatus,
          reviewNotes: reviewNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit review.");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-lg rounded-xl shadow-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-lg font-bold text-text-primary">Review & Verify Answer Key</h3>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-50 text-red-700 text-xs border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2">
              Verification Outcome
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedStatus("VERIFIED_CORRECT")}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition-colors ${
                  selectedStatus === "VERIFIED_CORRECT"
                    ? "border-[#2E8F86] bg-[#2E8F86]/10 text-[#2E8F86]"
                    : "border-border hover:bg-input text-text-secondary"
                }`}
              >
                <CheckCircle2 className="w-5 h-5 mb-1" />
                Verified Correct
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus("NEEDS_REVISION")}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition-colors ${
                  selectedStatus === "NEEDS_REVISION"
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-border hover:bg-input text-text-secondary"
                }`}
              >
                <AlertTriangle className="w-5 h-5 mb-1" />
                Needs Revision
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus("REJECTED")}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition-colors ${
                  selectedStatus === "REJECTED"
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-border hover:bg-input text-text-secondary"
                }`}
              >
                <XCircle className="w-5 h-5 mb-1" />
                Reject Answer
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Reviewer Notes / Feedback
            </label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Provide comments, source justification, or reasons for requested revision..."
              rows={3}
              className="w-full p-2.5 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold"
            >
              {loading ? "Submitting..." : "Confirm Review"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
