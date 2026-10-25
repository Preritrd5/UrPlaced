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
              <span className="text-text-muted block text-[10px] uppercase font-mono">Scoring Type</span>
              <span className="font-semibold text-text-primary">{breakdown.scoringStatus}</span>
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
              <div className="flex items-center justify-between pb-3 border-b border-border">
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
                    <span>Option ID: {q.studentAnswer?.selected_option || "None"}</span>
                  ) : q.questionType === "MULTIPLE_SELECT" ? (
                    <span>Options: {Array.isArray(q.studentAnswer?.selected_options) ? q.studentAnswer.selected_options.join(", ") : "None"}</span>
                  ) : q.questionType === "NUMERIC" ? (
                    <span>Entered: {q.studentAnswer?.numeric_value ?? "None"}</span>
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
              {isReleased && q.answerKey && (
                <div className="text-xs p-3 rounded-md bg-[rgba(80,82,201,0.04)] border border-primary/20 space-y-2">
                  <div className="flex items-center gap-1.5 text-primary font-semibold">
                    <CheckCircle2 className="h-4 w-4" /> Authoritative Solution
                  </div>
                  <div className="text-text-secondary">
                    {q.answerKey.correct_option && (
                      <p><span className="font-medium">Correct Choice:</span> {q.answerKey.correct_option}</p>
                    )}
                    {Array.isArray(q.answerKey.correct_options) && (
                      <p><span className="font-medium">Correct Choices:</span> {q.answerKey.correct_options.join(", ")}</p>
                    )}
                    {q.answerKey.correct_value !== undefined && (
                      <p><span className="font-medium">Correct Value:</span> {q.answerKey.correct_value}</p>
                    )}
                    {q.explanation && (
                      <div className="mt-2 pt-2 border-t border-primary/10 text-text-secondary">
                        <span className="font-medium text-text-primary block mb-0.5">Explanation:</span>
                        <p>{q.explanation}</p>
                      </div>
                    )}
                  </div>

                  {!isCorrect && !isManual && (
                    <div className="pt-2 border-t border-primary/10 text-[11px] text-secondary flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" /> Flagged for Phase 08 Mistake Bank targeted revision drill.
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
