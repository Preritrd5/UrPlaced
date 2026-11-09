"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  BarChart3,
  BookOpen,
  Send,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Lightbulb,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/common/brand-loader";
import { FormattedAIResponse } from "@/components/ai/formatted-ai-response";
import type {
  MockInterviewSession,
  MockInterviewTurn,
  AnswerEvaluation,
} from "@/modules/students/services/mock-interview-service";

export default function MockInterviewSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const router = useRouter();

  const [session, setSession] = useState<MockInterviewSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active question index being viewed/answered (1-based)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number>(1);
  const [currentAnswer, setCurrentAnswer] = useState("");

  // Accordion toggle for completed session transcript
  const [expandedTurns, setExpandedTurns] = useState<Record<number, boolean>>({});

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/student/mock-interview/${sessionId}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to load interview session.");
      }
      const json = await res.json();
      const loadedSession: MockInterviewSession = json.data;
      setSession(loadedSession);

      // Default active question to the current question index of session
      if (loadedSession.status === "IN_PROGRESS") {
        setActiveQuestionIndex(loadedSession.currentQuestionIndex || 1);
        // Pre-fill answer if already started
        const activeTurn = loadedSession.turns?.find(
          (t) => t.questionIndex === (loadedSession.currentQuestionIndex || 1)
        );
        if (activeTurn && activeTurn.studentAnswer) {
          setCurrentAnswer(activeTurn.studentAnswer);
        } else {
          setCurrentAnswer("");
        }
      } else {
        // Expand first turn by default in completed view
        setExpandedTurns({ 1: true });
      }
    } catch (err: any) {
      setError(err.message || "Failed to load session details.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !currentAnswer.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/student/mock-interview/${sessionId}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionIndex: activeQuestionIndex,
          answerText: currentAnswer.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to submit and evaluate answer.");
      }

      // Reload updated session
      await loadSession();
      setCurrentAnswer("");
    } catch (err: any) {
      setError(err.message || "Evaluation error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleTurnAccordion = (index: number) => {
    setExpandedTurns((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 bg-[#EDECE7]">
        <BrandLoader size="lg" label="Loading interview workspace and rubric evaluator..." showLabel />
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 bg-[#EDECE7]">
        <div className="max-w-md w-full bg-[#F8F7F3] border border-[#B8B6AC]/40 rounded-2xl p-6 shadow-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="font-heading font-semibold text-lg text-[#24283A] mb-2">
            Unable to Load Interview
          </h2>
          <p className="text-sm text-[#292D40]/70 mb-6">{error}</p>
          <Button
            onClick={() => router.push("/dashboard/student/mock-interview")}
            className="w-full bg-[#5052C9] hover:bg-[#4345B0] text-white"
          >
            Return to Mock Interview Studio
          </Button>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const turns = session.turns || [];
  const currentTurn = turns.find((t) => t.questionIndex === activeQuestionIndex) || turns[turns.length - 1];
  const isTurnEvaluated = !!currentTurn?.evaluation;

  return (
    <div className="min-h-screen bg-[#EDECE7] text-[#24283A] pb-16 font-sans">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-20 bg-[#F8F7F3]/95 backdrop-blur border-b border-[#B8B6AC]/30 px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/student/mock-interview"
              className="p-2 rounded-lg hover:bg-[#EDECE7] text-[#292D40] transition"
              title="Return to studio"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-bold text-lg text-[#24283A]">
                  {session.targetRole}
                </h1>
                <Badge
                  variant="outline"
                  className="bg-[#5052C9]/10 text-[#5052C9] border-[#5052C9]/30 font-mono text-xs uppercase"
                >
                  {session.interviewType.replace("_", " ")}
                </Badge>
                <Badge
                  variant="outline"
                  className="bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30 font-mono text-xs uppercase"
                >
                  {session.difficulty}
                </Badge>
              </div>
              <p className="text-xs text-[#292D40]/70 font-mono">
                {session.status === "COMPLETED" ? "Session Completed" : `Question ${session.currentQuestionIndex} of ${session.totalQuestions}`}
                {session.targetDriveTitle ? ` • Drive: ${session.targetDriveTitle}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {session.status === "COMPLETED" ? (
              <Badge className="bg-[#2E8F86] text-white px-3 py-1 font-mono text-xs">
                Score: {session.overallScore ?? "—"}/100
              </Badge>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#292D40]/70">Progress</span>
                <div className="w-28 sm:w-36 h-2 rounded-full bg-[#EDECE7] overflow-hidden border border-[#B8B6AC]/40">
                  <div
                    className="h-full bg-[#5052C9] transition-all duration-300"
                    style={{
                      width: `${Math.round(((turns.filter((t) => t.evaluation).length) / session.totalQuestions) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs font-mono font-semibold text-[#5052C9]">
                  {turns.filter((t) => t.evaluation).length}/{session.totalQuestions}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* VIEW 1: FINAL REPORT (If Completed) */}
        {session.status === "COMPLETED" ? (
          <div className="space-y-6">
            {/* Celebration Score Banner */}
            <div className="bg-[#F8F7F3] border border-[#B8B6AC]/40 rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-6 h-6 text-[#2E8F86]" />
                    <span className="text-xs font-mono font-semibold tracking-wider text-[#2E8F86] uppercase">
                      Interview Performance Assessment
                    </span>
                  </div>
                  <h2 className="font-heading font-bold text-2xl sm:text-3xl text-[#24283A] mb-2">
                    Overall Score: {session.overallScore ?? 0}/100
                  </h2>
                  <p className="text-sm text-[#292D40]/80 max-w-2xl leading-relaxed">
                    {session.finalFeedbackSummary ||
                      "Detailed performance synthesis across all question turns and competencies."}
                  </p>
                  {session.suggestedNextLevel && (
                    <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#5052C9]/10 border border-[#5052C9]/20 text-[#5052C9] text-xs font-mono">
                      <Sparkles className="w-4 h-4" />
                      Suggested Next Practice Level: <strong>{session.suggestedNextLevel}</strong>
                    </div>
                  )}
                </div>

                {/* Score Dial / Summary */}
                <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[#EDECE7] border border-[#B8B6AC]/30 min-w-[200px]">
                  <span className="text-4xl font-mono font-bold text-[#5052C9]">
                    {session.overallScore ?? 0}%
                  </span>
                  <span className="text-xs font-mono text-[#292D40]/70 mt-1">
                    {(session.overallScore || 0) >= 85
                      ? "Advanced Ready"
                      : (session.overallScore || 0) >= 70
                      ? "Proficient"
                      : "Developing Readiness"}
                  </span>
                </div>
              </div>

              {/* 6 Rubric Dimension Bars */}
              <div className="mt-8 pt-6 border-t border-[#B8B6AC]/30">
                <h3 className="font-heading font-semibold text-sm text-[#24283A] mb-4">
                  Rubric Dimension Breakdown
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { label: "Relevance & Direct Answer", val: session.relevanceScore },
                    { label: "Technical Accuracy", val: session.technicalAccuracyScore },
                    { label: "Depth & Detail", val: session.depthScore },
                    { label: "Structure (STAR / Logic)", val: session.structureScore },
                    { label: "Practical Reasoning", val: session.practicalReasoningScore },
                    { label: "Communication & Clarity", val: session.communicationScore },
                  ].map((dim, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-white border border-[#B8B6AC]/30">
                      <div className="flex items-center justify-between text-xs font-medium text-[#24283A] mb-1.5">
                        <span>{dim.label}</span>
                        <span className="font-mono font-bold text-[#5052C9]">{dim.val ?? 0}/100</span>
                      </div>
                      <div className="h-1.5 w-full bg-[#EDECE7] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#5052C9]"
                          style={{ width: `${Math.min(100, Math.max(0, dim.val ?? 0))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Strengths & Weaknesses 2-Column */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Strengths */}
              <div className="bg-[#F8F7F3] border border-[#B8B6AC]/40 rounded-2xl p-6 shadow-sm">
                <h3 className="font-heading font-semibold text-base text-[#24283A] mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#2E8F86]" />
                  Demonstrated Strengths
                </h3>
                {session.strongAnswers && session.strongAnswers.length > 0 ? (
                  <ul className="space-y-2.5">
                    {session.strongAnswers.map((item: any, idx: number) => (
                      <li
                        key={idx}
                        className="text-xs sm:text-sm text-[#292D40] leading-relaxed flex items-start gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2E8F86] mt-2 flex-shrink-0" />
                        <span>{typeof item === "string" ? item : item.point || JSON.stringify(item)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#292D40]/60 italic">
                    Answered questions across the session. Continue practicing to establish distinct strengths.
                  </p>
                )}
              </div>

              {/* Weaknesses / Gaps */}
              <div className="bg-[#F8F7F3] border border-[#B8B6AC]/40 rounded-2xl p-6 shadow-sm">
                <h3 className="font-heading font-semibold text-base text-[#24283A] mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  Areas for Improvement
                </h3>
                {session.weakAnswers && session.weakAnswers.length > 0 ? (
                  <ul className="space-y-2.5">
                    {session.weakAnswers.map((item: any, idx: number) => (
                      <li
                        key={idx}
                        className="text-xs sm:text-sm text-[#292D40] leading-relaxed flex items-start gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-2 flex-shrink-0" />
                        <span>{typeof item === "string" ? item : item.point || JSON.stringify(item)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#292D40]/60 italic">
                    No critical structural weaknesses observed in this session.
                  </p>
                )}
              </div>
            </div>

            {/* Recommended Exercises */}
            {session.recommendedExercises && session.recommendedExercises.length > 0 && (
              <div className="bg-[#F8F7F3] border border-[#B8B6AC]/40 rounded-2xl p-6 shadow-sm">
                <h3 className="font-heading font-semibold text-base text-[#24283A] mb-3 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#5052C9]" />
                  Recommended Targeted Exercises
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {session.recommendedExercises.map((ex: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-white border border-[#B8B6AC]/30 text-xs sm:text-sm text-[#292D40] flex items-start gap-3"
                    >
                      <span className="w-6 h-6 rounded-lg bg-[#5052C9]/10 text-[#5052C9] font-mono text-xs flex items-center justify-center flex-shrink-0 font-bold">
                        {idx + 1}
                      </span>
                      <span>{typeof ex === "string" ? ex : ex.title || ex.exercise || JSON.stringify(ex)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Turn-by-Turn Question Transcript */}
            <div className="bg-[#F8F7F3] border border-[#B8B6AC]/40 rounded-2xl p-6 shadow-sm">
              <h3 className="font-heading font-semibold text-base text-[#24283A] mb-4">
                Interview Turn Transcript ({turns.length} Questions)
              </h3>
              <div className="space-y-4">
                {turns.map((turn) => {
                  const isExpanded = expandedTurns[turn.questionIndex] ?? false;
                  const ev = turn.evaluation;
                  return (
                    <div
                      key={turn.id}
                      className="border border-[#B8B6AC]/30 rounded-xl bg-white overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleTurnAccordion(turn.questionIndex)}
                        className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-[#EDECE7]/40 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-[#5052C9]/10 text-[#5052C9] font-mono text-xs font-bold flex items-center justify-center">
                            Q{turn.questionIndex}
                          </span>
                          <div>
                            <span className="font-medium text-sm text-[#24283A] line-clamp-1">
                              {turn.questionText}
                            </span>
                            <span className="text-xs text-[#292D40]/60 font-mono">
                              {turn.questionCategory}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {ev ? (
                            <Badge className="bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30 font-mono text-xs">
                              Score: {ev.overallScore}/100
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs font-mono">
                              Unanswered
                            </Badge>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-[#292D40]/60" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[#292D40]/60" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-5 pb-5 pt-2 border-t border-[#B8B6AC]/20 space-y-4 bg-[#FBFAF7]">
                          {/* Student Answer */}
                          <div>
                            <div className="text-xs font-mono font-semibold text-[#292D40]/70 uppercase tracking-wider mb-1">
                              Your Submitted Answer
                            </div>
                            <div className="p-3.5 rounded-lg bg-white border border-[#B8B6AC]/30 text-xs sm:text-sm text-[#24283A] whitespace-pre-wrap leading-relaxed">
                              {turn.studentAnswer || "No answer submitted."}
                            </div>
                          </div>

                          {/* Evaluation Breakdown if available */}
                          {ev && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                                {[
                                  { label: "Relevance", val: ev.relevanceScore },
                                  { label: "Technical", val: ev.technicalScore },
                                  { label: "Depth", val: ev.depthScore },
                                  { label: "Structure", val: ev.structureScore },
                                  { label: "Practical", val: ev.practicalReasoningScore },
                                  { label: "Clarity", val: ev.communicationScore },
                                ].map((score, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="p-2 rounded-lg bg-white border border-[#B8B6AC]/20 text-center"
                                  >
                                    <div className="text-[10px] text-[#292D40]/60 font-mono">
                                      {score.label}
                                    </div>
                                    <div className="text-sm font-mono font-bold text-[#5052C9]">
                                      {score.val}/100
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* What went well / what was missing */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {ev.whatWentWell && ev.whatWentWell.length > 0 && (
                                  <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200/60 text-xs text-emerald-900">
                                    <div className="font-semibold mb-1 flex items-center gap-1.5">
                                      <Check className="w-3.5 h-3.5" /> What Went Well
                                    </div>
                                    <ul className="list-disc pl-4 space-y-1">
                                      {ev.whatWentWell.map((w, wIdx) => (
                                        <li key={wIdx}>{w}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {ev.whatWasMissing && ev.whatWasMissing.length > 0 && (
                                  <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200/60 text-xs text-amber-900">
                                    <div className="font-semibold mb-1 flex items-center gap-1.5">
                                      <AlertCircle className="w-3.5 h-3.5" /> What Was Missing
                                    </div>
                                    <ul className="list-disc pl-4 space-y-1">
                                      {ev.whatWasMissing.map((m, mIdx) => (
                                        <li key={mIdx}>{m}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>

                              {/* Improved model answer formatted */}
                              {ev.improvedAnswerExample && (
                                <div>
                                  <div className="text-xs font-mono font-semibold text-[#5052C9] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5" /> Illustrative Model Response
                                  </div>
                                  <div className="p-4 rounded-xl bg-white border border-[#B8B6AC]/30 shadow-sm">
                                    <FormattedAIResponse content={ev.improvedAnswerExample} />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/student/mock-interview")}
                className="border-[#B8B6AC] hover:bg-[#EDECE7] text-[#24283A]"
              >
                Start New Practice Session
              </Button>
              <div className="flex gap-3">
                <Button
                  onClick={() => router.push("/dashboard/student/skill-gap")}
                  className="bg-[#2E8F86] hover:bg-[#267870] text-white"
                >
                  Analyze Skill Gaps
                </Button>
                <Button
                  onClick={() => router.push("/dashboard/student/career-passport")}
                  className="bg-[#5052C9] hover:bg-[#4345B0] text-white"
                >
                  Update Career Passport
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* VIEW 2: ACTIVE TURN WORKSPACE (In Progress) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Nav: Question Progress Step List */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-[#F8F7F3] border border-[#B8B6AC]/40 rounded-2xl p-5 shadow-sm">
                <h3 className="font-heading font-semibold text-sm text-[#24283A] mb-3">
                  Interview Questions ({turns.length} of {session.totalQuestions})
                </h3>
                <div className="space-y-2">
                  {turns.map((turn) => {
                    const isCurrent = turn.questionIndex === activeQuestionIndex;
                    const isDone = !!turn.evaluation;

                    return (
                      <button
                        key={turn.id}
                        type="button"
                        onClick={() => {
                          setActiveQuestionIndex(turn.questionIndex);
                          setCurrentAnswer(turn.studentAnswer || "");
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between ${
                          isCurrent
                            ? "bg-[#5052C9]/10 border-[#5052C9] text-[#5052C9]"
                            : isDone
                            ? "bg-white border-[#B8B6AC]/30 text-[#24283A] hover:bg-[#EDECE7]/40"
                            : "bg-[#FBFAF7] border-dashed border-[#B8B6AC]/40 text-[#292D40]/60"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-6 h-6 rounded-lg font-mono text-xs flex items-center justify-center font-bold ${
                              isDone
                                ? "bg-[#2E8F86] text-white"
                                : isCurrent
                                ? "bg-[#5052C9] text-white"
                                : "bg-[#EDECE7] text-[#292D40]/70"
                            }`}
                          >
                            {isDone ? <Check className="w-3.5 h-3.5" /> : turn.questionIndex}
                          </span>
                          <span className="text-xs font-medium line-clamp-1">
                            Q{turn.questionIndex}: {turn.questionCategory}
                          </span>
                        </div>
                        {isDone && turn.evaluation && (
                          <span className="text-xs font-mono font-bold text-[#2E8F86]">
                            {turn.evaluation.overallScore}/100
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tips Card */}
              <div className="bg-[#F8F7F3] border border-[#B8B6AC]/40 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#5052C9] uppercase tracking-wider mb-2">
                  <Lightbulb className="w-4 h-4" />
                  Interview Answer Tips
                </div>
                <ul className="text-xs text-[#292D40]/80 space-y-2 leading-relaxed">
                  <li>• <strong>Structure:</strong> Organize responses with clear context, action, and results.</li>
                  <li>• <strong>Technical Depth:</strong> State specific data structures, trade-offs, and edge cases.</li>
                  <li>• <strong>Honesty:</strong> If unsure, articulate how you would investigate or formulate the solution.</li>
                </ul>
              </div>
            </div>

            {/* Right Column: Active Question + Answer / Evaluation */}
            <div className="lg:col-span-8 space-y-6">
              {currentTurn && (
                <div className="bg-[#F8F7F3] border border-[#B8B6AC]/40 rounded-2xl p-6 sm:p-7 shadow-sm">
                  {/* Question Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-[#5052C9] text-white font-mono text-xs">
                        Question {currentTurn.questionIndex} of {session.totalQuestions}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-white border-[#B8B6AC]/40 font-mono text-xs text-[#292D40]"
                      >
                        {currentTurn.questionCategory}
                      </Badge>
                      {currentTurn.isFollowUp && (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-mono text-xs">
                          Follow-up Question
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Question Text */}
                  <h2 className="font-heading font-semibold text-lg sm:text-xl text-[#24283A] leading-relaxed mb-6">
                    {currentTurn.questionText}
                  </h2>

                  {/* If this question is NOT evaluated yet: Show Answer Input Box */}
                  {!isTurnEvaluated ? (
                    <form onSubmit={handleSubmitAnswer} className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-[#292D40]">
                            Your Response
                          </label>
                          <span className="text-[11px] font-mono text-[#292D40]/60">
                            {currentAnswer.length} / 5000 characters
                          </span>
                        </div>
                        <textarea
                          rows={8}
                          value={currentAnswer}
                          onChange={(e) => setCurrentAnswer(e.target.value)}
                          placeholder="Type your response clearly. Detail your technical approach, real-world examples, and trade-offs..."
                          maxLength={5000}
                          disabled={isSubmitting}
                          className="w-full px-4 py-3 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/40 text-[#24283A] placeholder-[#292D40]/40 text-sm focus:outline-none focus:ring-2 focus:ring-[#5052C9] transition disabled:opacity-50"
                        />
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-[#292D40]/60">
                          Takes ~3–5 seconds to evaluate across 6 competencies.
                        </span>
                        <Button
                          type="submit"
                          disabled={isSubmitting || !currentAnswer.trim()}
                          className="bg-[#5052C9] hover:bg-[#4345B0] text-white flex items-center gap-2"
                        >
                          {isSubmitting ? (
                            <>
                              <BrandLoader size="sm" />
                              Evaluating Answer...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Submit & Evaluate
                            </>
                          )}
                        </Button>
                      </div>
                    </form>
                  ) : (
                    /* If evaluated: Show Result Card */
                    <div className="space-y-6 pt-4 border-t border-[#B8B6AC]/30">
                      {/* Submitted Answer Box */}
                      <div>
                        <div className="text-xs font-mono font-semibold text-[#292D40]/70 uppercase tracking-wider mb-1.5">
                          Your Submitted Response
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-[#B8B6AC]/30 text-sm text-[#24283A] whitespace-pre-wrap leading-relaxed">
                          {currentTurn.studentAnswer}
                        </div>
                      </div>

                      {/* Evaluation Breakdown */}
                      {currentTurn.evaluation && (
                        <div className="p-5 rounded-xl bg-[#EDECE7]/60 border border-[#B8B6AC]/40 space-y-5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#B8B6AC]/30">
                            <div>
                              <div className="text-xs font-mono text-[#2E8F86] font-semibold uppercase">
                                Answer Assessment
                              </div>
                              <h3 className="font-heading font-bold text-lg text-[#24283A]">
                                Score: {currentTurn.evaluation.overallScore}/100
                              </h3>
                            </div>
                            <Badge
                              className={`px-3 py-1 font-mono text-xs ${
                                currentTurn.evaluation.overallScore >= 80
                                  ? "bg-[#2E8F86] text-white"
                                  : currentTurn.evaluation.overallScore >= 60
                                  ? "bg-[#5052C9] text-white"
                                  : "bg-amber-600 text-white"
                              }`}
                            >
                              {currentTurn.evaluation.overallScore >= 80
                                ? "Strong Response"
                                : currentTurn.evaluation.overallScore >= 60
                                ? "Satisfactory"
                                : "Needs Revision"}
                            </Badge>
                          </div>

                          {/* 6 Sub-scores */}
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                            {[
                              { label: "Relevance", val: currentTurn.evaluation.relevanceScore },
                              { label: "Technical", val: currentTurn.evaluation.technicalScore },
                              { label: "Depth", val: currentTurn.evaluation.depthScore },
                              { label: "Structure", val: currentTurn.evaluation.structureScore },
                              { label: "Practical", val: currentTurn.evaluation.practicalReasoningScore },
                              { label: "Clarity", val: currentTurn.evaluation.communicationScore },
                            ].map((sub, sIdx) => (
                              <div
                                key={sIdx}
                                className="p-2.5 rounded-lg bg-white border border-[#B8B6AC]/30 text-center"
                              >
                                <div className="text-[10px] text-[#292D40]/60 font-mono">
                                  {sub.label}
                                </div>
                                <div className="text-sm font-mono font-bold text-[#5052C9]">
                                  {sub.val}/100
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* What went well / what was missing */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {currentTurn.evaluation.whatWentWell &&
                              currentTurn.evaluation.whatWentWell.length > 0 && (
                                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1.5">
                                  <div className="font-semibold flex items-center gap-1.5 text-emerald-800">
                                    <Check className="w-4 h-4" /> What Went Well
                                  </div>
                                  <ul className="list-disc pl-4 space-y-1">
                                    {currentTurn.evaluation.whatWentWell.map((w, wIdx) => (
                                      <li key={wIdx}>{w}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                            {currentTurn.evaluation.whatWasMissing &&
                              currentTurn.evaluation.whatWasMissing.length > 0 && (
                                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                                  <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                                    <AlertCircle className="w-4 h-4" /> What Was Missing
                                  </div>
                                  <ul className="list-disc pl-4 space-y-1">
                                    {currentTurn.evaluation.whatWasMissing.map((m, mIdx) => (
                                      <li key={mIdx}>{m}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                          </div>

                          {/* Conceptual Errors if any */}
                          {currentTurn.evaluation.conceptualErrors &&
                            currentTurn.evaluation.conceptualErrors.length > 0 && (
                              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 space-y-1.5">
                                <div className="font-semibold flex items-center gap-1.5 text-red-800">
                                  <ShieldAlert className="w-4 h-4" /> Conceptual Misconceptions
                                </div>
                                <ul className="list-disc pl-4 space-y-1">
                                  {currentTurn.evaluation.conceptualErrors.map((errItem, eIdx) => (
                                    <li key={eIdx}>{errItem}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                          {/* Illustrative Model Response rendered via FormattedAIResponse */}
                          {currentTurn.evaluation.improvedAnswerExample && (
                            <div>
                              <div className="text-xs font-mono font-semibold text-[#5052C9] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4" /> Illustrative Model Response
                              </div>
                              <div className="p-5 rounded-xl bg-white border border-[#B8B6AC]/40 shadow-sm">
                                <FormattedAIResponse
                                  content={currentTurn.evaluation.improvedAnswerExample}
                                />
                              </div>
                            </div>
                          )}

                          {/* Next Question Navigation */}
                          <div className="pt-3 flex justify-end">
                            {activeQuestionIndex < session.totalQuestions ? (
                              <Button
                                onClick={() => {
                                  const nextIdx = activeQuestionIndex + 1;
                                  setActiveQuestionIndex(nextIdx);
                                  const nextTurn = turns.find((t) => t.questionIndex === nextIdx);
                                  setCurrentAnswer(nextTurn?.studentAnswer || "");
                                }}
                                className="bg-[#5052C9] hover:bg-[#4345B0] text-white flex items-center gap-2"
                              >
                                Advance to Question {activeQuestionIndex + 1}
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                            ) : (
                              <Button
                                onClick={loadSession}
                                className="bg-[#2E8F86] hover:bg-[#267870] text-white flex items-center gap-2"
                              >
                                View Final Interview Report
                                <Award className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
