"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AnswerKeyReviewStatus, QuestionType } from "@/types/database";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Code,
  Check,
  FileText,
  HelpCircle,
  Sparkles,
} from "lucide-react";

export interface QuestionReviewPreview {
  prompt?: string;
  questionType?: QuestionType;
  options?: Array<{ id: string; text: string }>;
  answerKey?: Record<string, any>;
  explanation?: string | null;
  difficulty?: string;
  sourceType?: string;
}

interface AnswerKeyReviewModalProps {
  questionId: string;
  versionId: string;
  currentStatus: AnswerKeyReviewStatus;
  question?: QuestionReviewPreview | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AnswerKeyReviewModal({
  questionId,
  versionId,
  currentStatus,
  question,
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

  useEffect(() => {
    setSelectedStatus(currentStatus === "UNREVIEWED" ? "VERIFIED_CORRECT" : currentStatus);
    setReviewNotes("");
    setError(null);
  }, [currentStatus, isOpen]);

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

  const answerKey = question?.answerKey || {};
  const questionType = question?.questionType;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl shadow-xl border border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-text-primary font-display">
              Review & Verify Answer Key
            </h3>
            {question?.sourceType === "AI_GENERATED" && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="w-3 h-3 text-primary" /> AI Generated
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-700 text-xs border border-red-200">
              {error}
            </div>
          )}

          {/* Question Details Section */}
          {question && (
            <div className="space-y-4 rounded-lg bg-input/50 border border-border p-4">
              <div className="flex items-center justify-between text-xs text-text-secondary border-b border-border pb-2">
                <span className="font-semibold text-text-primary">
                  Question Content & Expected Answers
                </span>
                <div className="flex items-center gap-2">
                  {question.questionType && (
                    <span className="font-mono px-2 py-0.5 rounded bg-card border border-border">
                      {question.questionType}
                    </span>
                  )}
                  {question.difficulty && (
                    <span className="font-mono px-2 py-0.5 rounded bg-card border border-border">
                      {question.difficulty}
                    </span>
                  )}
                </div>
              </div>

              {/* Prompt */}
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                  Prompt
                </label>
                <div className="mt-1 text-sm text-text-primary font-medium whitespace-pre-wrap bg-card p-3 rounded-md border border-border">
                  {question.prompt || "No prompt provided."}
                </div>
              </div>

              {/* Multiple Choice Options */}
              {(questionType === "SINGLE_CHOICE" || questionType === "MULTIPLE_SELECT") &&
                Array.isArray(question.options) &&
                question.options.length > 0 && (
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                      Options & Answer Key
                    </label>
                    <div className="mt-1.5 space-y-2">
                      {question.options.map((opt, idx) => {
                        const isSingleCorrect =
                          answerKey.correct_option_id === opt.id ||
                          answerKey.correct_option_id === opt.id?.toLowerCase();
                        const isMultiCorrect =
                          Array.isArray(answerKey.correct_option_ids) &&
                          (answerKey.correct_option_ids.includes(opt.id) ||
                            answerKey.correct_option_ids.includes(opt.id?.toLowerCase()));
                        const isCorrect = isSingleCorrect || isMultiCorrect;

                        return (
                          <div
                            key={opt.id || idx}
                            className={`flex items-start justify-between p-2.5 rounded-md text-xs border transition-colors ${
                              isCorrect
                                ? "border-[#2E8F86] bg-[#2E8F86]/10 text-text-primary font-medium"
                                : "border-border bg-card text-text-secondary"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold uppercase w-5 text-text-secondary">
                                {opt.id}.
                              </span>
                              <span>{opt.text}</span>
                            </div>
                            {isCorrect && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2E8F86] shrink-0">
                                <Check className="w-3.5 h-3.5" /> Correct Key
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Numeric Answer */}
              {questionType === "NUMERIC" && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                    Numeric Expected Answer
                  </label>
                  <div className="mt-1 p-3 rounded-md bg-card border border-border text-xs flex items-center gap-4">
                    <span>
                      Correct Value:{" "}
                      <strong className="font-mono text-sm text-[#2E8F86]">
                        {answerKey.value ?? "N/A"}
                      </strong>
                    </span>
                    {answerKey.tolerance !== undefined && (
                      <span className="text-text-secondary">
                        Tolerance: ±<strong className="font-mono">{answerKey.tolerance}</strong>
                      </span>
                    )}
                    {answerKey.unit && (
                      <span className="text-text-secondary">
                        Unit: <strong className="font-mono">{answerKey.unit}</strong>
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Short Answer Rubric */}
              {questionType === "SHORT_ANSWER" && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                    Short Answer Rubric & Reference
                  </label>
                  <div className="p-3 rounded-md bg-card border border-border text-xs space-y-1.5">
                    {answerKey.sample_answer && (
                      <div>
                        <span className="font-semibold text-text-primary">Sample Answer: </span>
                        <p className="mt-0.5 text-text-secondary">{answerKey.sample_answer}</p>
                      </div>
                    )}
                    {answerKey.rubric && (
                      <div>
                        <span className="font-semibold text-text-primary">Evaluation Rubric: </span>
                        <p className="mt-0.5 text-text-secondary">{answerKey.rubric}</p>
                      </div>
                    )}
                    {Array.isArray(answerKey.keywords) && answerKey.keywords.length > 0 && (
                      <div>
                        <span className="font-semibold text-text-primary">Mandatory Keywords: </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {answerKey.keywords.map((kw: string, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-input border border-border font-mono text-[11px]"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Coding Test Cases */}
              {questionType === "CODING" && (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                    Coding Test Cases
                  </label>
                  <div className="p-3 rounded-md bg-card border border-border text-xs space-y-2">
                    {Array.isArray(answerKey.test_cases) && answerKey.test_cases.length > 0 ? (
                      answerKey.test_cases.map((tc: any, i: number) => (
                        <div
                          key={i}
                          className="p-2 rounded bg-input border border-border font-mono text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between text-text-secondary">
                            <span>Test Case #{i + 1}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                tc.is_hidden
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {tc.is_hidden ? "Hidden Assessment Case" : "Public Example"}
                            </span>
                          </div>
                          <div>Input: <span className="text-text-primary">{tc.input}</span></div>
                          <div>Expected: <span className="text-[#2E8F86] font-bold">{tc.expected_output}</span></div>
                        </div>
                      ))
                    ) : (
                      <p className="text-text-secondary italic">No test cases specified.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Explanation */}
              {question.explanation && (
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                    Explanation
                  </label>
                  <div className="mt-1 text-xs text-text-secondary bg-card p-3 rounded-md border border-border">
                    {question.explanation}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Verification Form */}
          <form id="review-verify-form" onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full p-2.5 rounded-md bg-input border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 text-text-primary"
              />
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-card">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} size="sm">
            Cancel
          </Button>
          <Button
            type="submit"
            form="review-verify-form"
            disabled={loading}
            size="sm"
            className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold"
          >
            {loading ? "Submitting..." : "Confirm Review"}
          </Button>
        </div>
      </div>
    </div>
  );
}
