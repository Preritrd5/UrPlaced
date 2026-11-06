"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowLeft,
  Clock,
  Sparkles,
  BookOpen,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailViewSkeleton } from "@/components/ui/page-skeletons";

export default function AttemptReviewPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = use(params);

  const [reviewData, setReviewData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  async function loadReview() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/student/attempts/${attemptId}/result`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load attempt result.");
      }
      setReviewData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <DetailViewSkeleton />;
  }

  if (error || !reviewData) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
        <h2 className="text-base font-bold text-text-primary">Unable to Access Report</h2>
        <p className="text-xs text-text-secondary">{error || "Review not found."}</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/student/assessments">Back to Assessments</Link>
        </Button>
      </div>
    );
  }

  const { isReleased, attempt, breakdown } = reviewData;
  const isPassed = Boolean(breakdown.isPassed);

  const getOptionDisplay = (options: any, rawVal: any): string => {
    if (rawVal === null || rawVal === undefined || rawVal === "") return "None";
    const idStr = String(rawVal).trim();
    if (Array.isArray(options)) {
      const match = options.find(
        (opt: any) =>
          opt &&
          (String(opt.id).toLowerCase() === idStr.toLowerCase() ||
            String(opt.text).trim().toLowerCase() === idStr.toLowerCase())
      );
      if (match) {
        return match.text || match.option_text || match.label || idStr;
      }
    }
    return idStr;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="p-0 h-auto">
            <Link href="/dashboard/student/assessments" className="text-text-muted hover:text-text-primary">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Link>
          </Button>
          <span className="text-text-muted">&bull;</span>
          <span className="text-xs font-mono text-text-secondary">Attempt #{attempt.attempt_number}</span>
        </div>

        <Badge variant={isPassed ? "default" : "outline"} className={isPassed ? "bg-secondary text-white" : ""}>
          {isPassed ? "Assessment Passed" : "Did Not Qualify"}
        </Badge>
      </div>

      {/* Score Summary Card */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold font-heading text-text-primary">
                {breakdown.assessmentTitle}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Completed on {new Date(attempt.submitted_at || attempt.created_at).toLocaleString()}
              </CardDescription>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold font-heading text-text-primary">
                {breakdown.scorePercentage}%
              </span>
              <span className="text-xs text-text-muted">
                ({breakdown.earnedPoints} / {breakdown.totalPoints} pts)
              </span>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-input rounded-lg border border-border text-xs">
            <div>
              <span className="text-text-muted block text-[10px] uppercase font-mono">Passing Cutoff</span>
              <span className="font-semibold text-text-primary">{breakdown.passPercentage}%</span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase font-mono">Status</span>
              <span className="font-semibold text-text-primary">{attempt.status}</span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase font-mono">Submission Mode</span>
              <span className={`font-semibold ${breakdown.submissionReason && breakdown.submissionReason !== "MANUAL" ? "text-amber-700" : "text-text-primary"}`}>
                {breakdown.submissionReason || "MANUAL"}
              </span>
            </div>
            <div>
              <span className="text-text-muted block text-[10px] uppercase font-mono">Review Status</span>
              <span className="font-semibold text-text-primary">
                {isReleased ? "Released" : "Provisional"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Audit Banner if Auto-Submitted due to Violation or Timeout */}
      {breakdown.submissionReason && breakdown.submissionReason !== "MANUAL" && (
        <div className="flex items-start gap-3 p-4 bg-amber-50/80 border border-amber-300 rounded-lg text-xs text-amber-950">
          <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1 w-full">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-amber-900">
                {breakdown.submissionReason === "TIMEOUT"
                  ? "Assessment Finalized: Duration Expired"
                  : "Assessment Auto-Submitted on Examination Security Trigger"}
              </h4>
              <Badge variant="outline" className="text-[10px] border-amber-400 bg-amber-100 text-amber-900 font-mono">
                {breakdown.submissionReason}
              </Badge>
            </div>
            <p className="text-amber-800 leading-relaxed">
              {breakdown.submissionReason === "TIMEOUT"
                ? "The allotted time limit expired during this session. Your responses were automatically finalized and evaluated."
                : `This attempt was automatically submitted and permanently locked following an examination violation (${breakdown.submissionReason.replace("AUTO:", "")}). All answers saved prior to this event were preserved and scored.`}
            </p>
            {breakdown.violations && breakdown.violations.length > 0 && (
              <div className="mt-2 pt-2 border-t border-amber-200 space-y-1">
                <span className="text-[10px] font-mono uppercase text-amber-800 block font-semibold">Recorded Audit Events:</span>
                {breakdown.violations.map((v: any) => (
                  <div key={v.id} className="flex items-center justify-between text-[11px] font-mono text-amber-900">
                    <span>{v.violation_type} {v.metadata?.reason ? `— ${v.metadata.reason}` : ""}</span>
                    <span>{new Date(v.created_at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Release Policy Notice Banner if Masked */}
      {!isReleased && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
          <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold">Answer Keys Masked During Active Assessment Window</h4>
            <p className="text-amber-800">
              Per college exam policy, question answer keys and explanations remain securely protected while the assessment window is open. Detailed reviews will unlock automatically once the evaluation concludes.
            </p>
          </div>
        </div>
      )}

      {/* Question Breakdown */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-text-primary font-heading">
          Question-Level Performance Breakdown
        </h3>

        {breakdown.questions.map((q: any, idx: number) => {
          const isCorrect = q.isCorrect;
          const isManual = q.scoringStatus === "MANUAL_REVIEW_REQUIRED";

          return (
            <Card key={q.questionId} className="p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-text-muted">
                    Question {idx + 1}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {q.questionType}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  {isManual ? (
                    <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-300">
                      Manual Review Pending
                    </Badge>
                  ) : isCorrect ? (
                    <Badge variant="default" className="text-[10px] bg-secondary text-white flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Correct (+{q.pointsAwarded} pts)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-red-600 border-red-300 bg-red-50 flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> Incorrect ({q.pointsAwarded} pts)
                    </Badge>
                  )}
                </div>
              </div>

              {/* Prompt */}
              <div className="text-xs sm:text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                {q.prompt}
              </div>

              {/* Student Response Display */}
              <div className="text-xs p-3 rounded-md bg-input border border-border space-y-1">
                <span className="text-[10px] font-mono uppercase text-text-muted block">Your Answer</span>
                <div className="text-text-primary font-medium">
                  {q.questionType === "SINGLE_CHOICE" ? (
                    <span>
                      {q.studentAnswerText && q.studentAnswerText !== "None"
                        ? q.studentAnswerText
                        : getOptionDisplay(
                            q.options,
                            q.studentAnswer?.selected_option ?? q.studentAnswer?.selected_option_id
                          )}
                    </span>
                  ) : q.questionType === "MULTIPLE_SELECT" ? (
                    <span>
                      {q.studentAnswerText && q.studentAnswerText !== "None"
                        ? q.studentAnswerText
                        : Array.isArray(q.studentAnswer?.selected_options) && q.studentAnswer.selected_options.length > 0
                        ? q.studentAnswer.selected_options.map((opt: string) => getOptionDisplay(q.options, opt)).join(", ")
                        : "None"}
                    </span>
                  ) : q.questionType === "NUMERIC" ? (
                    <span>Entered: {q.studentAnswer?.numeric_value ?? q.studentAnswer?.value ?? "None"}</span>
                  ) : q.questionType === "SHORT_ANSWER" ? (
                    <p className="whitespace-pre-wrap">{q.studentAnswer?.text || "No response submitted."}</p>
                  ) : q.questionType === "CODING" ? (
                    <pre className="font-mono text-[11px] whitespace-pre-wrap">{q.studentAnswer?.code || "No code submitted."}</pre>
                  ) : (
                    <span>Recorded</span>
                  )}
                </div>
              </div>

              {/* Released Explanations & Correct Keys */}
              {isReleased && (q.answerKey || q.explanation) && (
                <div className="text-xs p-3 rounded-md bg-[rgba(80,82,201,0.04)] border border-primary/20 space-y-2">
                  <div className="flex items-center gap-1.5 text-primary font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> Authoritative Solution
                  </div>
                  <div className="text-text-secondary space-y-1.5">
                    {q.questionType === "SINGLE_CHOICE" && (
                      <p>
                        <span className="font-semibold text-text-primary">Correct Choice: </span>
                        {q.correctAnswerText ||
                          getOptionDisplay(
                            q.options,
                            q.answerKey?.correct_option_id ?? q.answerKey?.correct_option ?? q.answerKey?.correctOptionId
                          )}
                      </p>
                    )}
                    {q.questionType === "MULTIPLE_SELECT" && (
                      <p>
                        <span className="font-semibold text-text-primary">Correct Choices: </span>
                        {q.correctAnswerText ||
                          (Array.isArray(q.answerKey?.correct_option_ids)
                            ? q.answerKey.correct_option_ids
                            : Array.isArray(q.answerKey?.correct_options)
                            ? q.answerKey.correct_options
                            : []
                          ).map((opt: string) => getOptionDisplay(q.options, opt)).join(", ")}
                      </p>
                    )}
                    {q.questionType === "NUMERIC" && (q.answerKey?.value !== undefined || q.answerKey?.correct_value !== undefined) && (
                      <p>
                        <span className="font-semibold text-text-primary">Correct Value: </span>
                        {q.answerKey?.value ?? q.answerKey?.correct_value}
                        {q.answerKey?.tolerance ? ` (±${q.answerKey.tolerance})` : ""}
                      </p>
                    )}
                    {q.explanation && (
                      <div className="mt-2 pt-2 border-t border-primary/10 text-text-secondary">
                        <span className="font-semibold text-text-primary block mb-0.5">Explanation:</span>
                        <p className="whitespace-pre-wrap">{q.explanation}</p>
                      </div>
                    )}
                  </div>

                  {!isCorrect && !isManual && (
                    <div className="pt-2 border-t border-primary/10 text-[11px] text-secondary flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Flagged for Mistake Bank targeted revision drill.
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
