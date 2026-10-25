"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Flag,
  Calendar,
  Clock,
  Award,
  ChevronRight,
  TrendingUp,
  ShieldAlert,
  Send,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DetailViewSkeleton } from "@/components/ui/page-skeletons";

export default function MistakeTargetDetailPage({
  params,
}: {
  params: Promise<{ targetId: string }>;
}) {
  const { targetId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);

  // Reflection form state
  const [reasonCategory, setReasonCategory] = useState<string>("CONCEPT_NOT_UNDERSTOOD");
  const [reflectionText, setReflectionText] = useState<string>("");
  const [savingReflection, setSavingReflection] = useState(false);
  const [reflectionSaved, setReflectionSaved] = useState(false);

  // Practice / Retest Drill State
  const [loadingPractice, setLoadingPractice] = useState(false);
  const [practiceQuestions, setPracticeQuestions] = useState<any[]>([]);
  const [currentPracticeIndex, setCurrentPracticeIndex] = useState(0);
  const [selectedPracticeOption, setSelectedPracticeOption] = useState<string | null>(null);
  const [submittingRetest, setSubmittingRetest] = useState(false);
  const [retestResult, setRetestResult] = useState<any | null>(null);

  // Defect Report Modal State
  const [showDefectModal, setShowDefectModal] = useState(false);
  const [defectType, setDefectType] = useState("INCORRECT_ANSWER_KEY");
  const [defectDescription, setDefectDescription] = useState("");
  const [submittingDefect, setSubmittingDefect] = useState(false);

  useEffect(() => {
    loadTargetDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  async function loadTargetDetail() {
    try {
      setLoading(true);
      const res = await fetch(`/api/student/mistakes/${targetId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.target?.student_reason_category) {
          setReasonCategory(json.target.student_reason_category);
        }
        if (json.target?.student_reflection) {
          setReflectionText(json.target.student_reflection);
        }

        // Auto-load retest practice questions
        loadRetestPractice();
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadRetestPractice() {
    try {
      setLoadingPractice(true);
      const res = await fetch(`/api/student/mistakes/${targetId}/practice?limit=3`);
      if (res.ok) {
        const json = await res.json();
        setPracticeQuestions(json.recommendations || []);
      }
    } finally {
      setLoadingPractice(false);
    }
  }

  async function handleSaveReflection(e: React.FormEvent) {
    e.preventDefault();
    if (!reflectionText.trim()) return;

    try {
      setSavingReflection(true);
      const res = await fetch(`/api/student/mistakes/${targetId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REFLECTION_SAVED",
          reasonCategory,
          reflection: reflectionText.trim(),
        }),
      });

      if (res.ok) {
        setReflectionSaved(true);
        setTimeout(() => setReflectionSaved(false), 3000);
        loadTargetDetail();
      }
    } finally {
      setSavingReflection(false);
    }
  }

  async function handleSubmitRetest() {
    if (!selectedPracticeOption) return;
    const currentQ = practiceQuestions[currentPracticeIndex];
    if (!currentQ) return;

    try {
      setSubmittingRetest(true);
      const res = await fetch(`/api/student/mistakes/${targetId}/retest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQ.questionId,
          versionId: currentQ.versionId,
          responsePayload: { selected_option: selectedPracticeOption },
        }),
      });

      if (res.ok) {
        const evalRes = await res.json();
        setRetestResult(evalRes);
      }
    } finally {
      setSubmittingRetest(false);
    }
  }

  async function handleSubmitDefect(e: React.FormEvent) {
    e.preventDefault();
    if (!defectDescription.trim() || !data?.target) return;

    try {
      setSubmittingDefect(true);
      const res = await fetch("/api/student/mistakes/defects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: data.target.question_id,
          versionId: data.target.version_id,
          defectType,
          description: defectDescription.trim(),
        }),
      });

      if (res.ok) {
        setShowDefectModal(false);
        setDefectDescription("");
        alert("Defect report submitted. Placement staff will review it, and your mistake will not unfairly penalize your mastery score.");
        loadTargetDetail();
      }
    } finally {
      setSubmittingDefect(false);
    }
  }

  if (loading) {
    return <DetailViewSkeleton />;
  }

  if (!data) {
    return (
      <div className="py-16 text-center text-text-muted space-y-3">
        <p className="text-sm">Mistake target details could not be found or have been resolved.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard/student/mistakes">Return to Mistake Bank</Link>
        </Button>
      </div>
    );
  }

  const target = data.target;
  const qv = target.question_versions;
  const skill = target.canonical_skills;
  const options = (qv?.options as any)?.options || (Array.isArray(qv?.options) ? qv?.options : []);
  const answerKey = (qv?.answer_key as any) || {};
  const correctChoice = answerKey.correct_option;

  // Most recent submitted payload from occurrences
  const latestOcc = data.occurrences?.[0];
  const studentSubmittedChoice =
    latestOcc?.submitted_payload?.selected_option ??
    (Array.isArray(latestOcc?.submitted_payload?.selected_options)
      ? latestOcc?.submitted_payload?.selected_options[0]
      : null);

  const currentPracticeQ = practiceQuestions[currentPracticeIndex];

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Top Breadcrumb & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/student/mistakes" className="flex items-center gap-1 text-text-secondary">
              <ArrowLeft className="h-4 w-4" />
              <span>Mistake Bank</span>
            </Link>
          </Button>
          <span className="text-text-muted">/</span>
          <span className="text-sm font-semibold text-text-primary">Review & Retest Drill</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
            onClick={() => setShowDefectModal(true)}
          >
            <Flag className="h-3.5 w-3.5 mr-1" />
            Report Question Issue
          </Button>

          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/student/mastery" className="flex items-center gap-1.5 text-xs">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span>Skill Radar</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Target Status Overview Header */}
      <Card className="bg-[#EDECE7]/30 border-border">
        <CardContent className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-primary font-mono">
                Stage {target.revision_stage}/5 Spaced Retention
              </Badge>
              {skill && (
                <Badge variant="secondary" className="font-mono">
                  {skill.name}
                </Badge>
              )}
              <Badge variant="outline" className="font-mono">
                {qv?.difficulty || "MEDIUM"}
              </Badge>
            </div>
            <p className="text-xs text-text-secondary pt-1">
              Next revision scheduled for:{" "}
              <strong className="text-text-primary">
                {new Date(target.next_due_at).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </strong>{" "}
              • Observed across <strong className="text-text-primary">{target.occurrence_count}</strong> assessment attempt(s).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-xs text-text-muted block">Mastery Status</span>
              <span className="text-sm font-bold text-text-primary">{target.status.replace("_", " ")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid: Question Review & Reflection */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Column: Original Question & Explanation */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-heading text-text-primary">
                Original Question & Submission
              </CardTitle>
              <Badge variant="outline">{target.primary_reason}</Badge>
            </div>
            <CardDescription className="text-xs text-text-secondary">
              Review what you answered and see the verified explanation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Prompt */}
            <div className="p-3 bg-[#EDECE7]/40 rounded-md border border-border text-sm font-medium text-text-primary whitespace-pre-wrap">
              {qv?.prompt}
            </div>

            {/* Multiple Choice Options */}
            {options.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary">Options:</label>
                <div className="space-y-1.5">
                  {options.map((opt: any, idx: number) => {
                    const isStudentChoice = opt.id === studentSubmittedChoice;
                    const isCorrectAnswer = opt.id === correctChoice;

                    return (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-md text-xs border transition-colors flex items-center justify-between ${
                          isCorrectAnswer
                            ? "bg-emerald-50 border-emerald-500 text-emerald-900 font-medium"
                            : isStudentChoice
                            ? "bg-rose-50 border-rose-500 text-rose-900 line-through"
                            : "bg-[#FBFAF7] border-border text-text-secondary"
                        }`}
                      >
                        <span>
                          <strong className="mr-1.5">{opt.id}.</strong> {opt.text}
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {isCorrectAnswer && (
                            <Badge className="bg-emerald-600 text-white text-[10px] py-0 px-1.5">
                              Correct Key
                            </Badge>
                          )}
                          {isStudentChoice && !isCorrectAnswer && (
                            <Badge variant="danger" className="text-[10px] py-0 px-1.5">
                              Your Answer
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Official Step-by-Step Explanation */}
            <div className="p-3 bg-[#2E8F86]/10 rounded-md border border-[#2E8F86]/30 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#2E8F86]">
                <BookOpen className="h-4 w-4" />
                <span>Verified Explanation & Concepts</span>
              </div>
              <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">
                {qv?.explanation || "No written explanation provided for this question."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Structured Self-Reflection (STAR/Root-Cause) */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader>
              <CardTitle className="text-base font-heading text-text-primary">
                Root-Cause Reflection
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Diagnose why you missed this question to reinforce retention and prevent recurrence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveReflection} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">
                    Primary Root Cause Category
                  </label>
                  <select
                    value={reasonCategory}
                    onChange={(e) => setReasonCategory(e.target.value)}
                    className="w-full text-xs rounded-md border border-border bg-input px-3 py-2 text-text-primary font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="CONCEPT_NOT_UNDERSTOOD">Concept Not Understood</option>
                    <option value="FORMULA_FACT_FORGOTTEN">Formula or Fact Forgotten</option>
                    <option value="CALCULATION_MISTAKE">Calculation / Syntax Mistake</option>
                    <option value="MISREAD_QUESTION">Misread Question or Constraints</option>
                    <option value="TIME_PRESSURE">Rushed Under Time Pressure</option>
                    <option value="CONFUSED_CHOICES">Confused by Distractor Choices</option>
                    <option value="GUESSED">Blind Guessed</option>
                    <option value="CARELESS_ERROR">Careless Slip</option>
                    <option value="OTHER">Other Reason</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">
                    Personal Reflection & Learnings
                  </label>
                  <Textarea
                    rows={4}
                    value={reflectionText}
                    onChange={(e) => setReflectionText(e.target.value)}
                    placeholder="e.g. I forgot that binary search requires a sorted array. In the future I will check array preconditions first..."
                    className="bg-input text-xs text-text-primary"
                  />
                  <p className="text-[11px] text-text-muted">
                    Writing a short self-explanation doubles retention during the revision cycle.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button type="submit" size="sm" disabled={savingReflection || !reflectionText.trim()}>
                    {savingReflection ? "Saving..." : "Save Reflection"}
                  </Button>

                  {reflectionSaved && (
                    <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Reflection saved!
                    </span>
                  )}
                </div>
              </form>
            </CardContent>
          </div>

          {/* Past Observations */}
          <div className="p-4 border-t border-border bg-[#EDECE7]/20 text-xs space-y-1">
            <span className="font-semibold text-text-secondary block">Historical Occurrences:</span>
            {data.occurrences?.map((occ: any, i: number) => (
              <div key={occ.id} className="text-text-muted flex justify-between">
                <span>
                  #{i + 1} {occ.assessment_attempts?.assessments?.title || "Assessment"}
                </span>
                <span>
                  {new Date(occ.occurred_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Section: Mastery Retest Drill with NEW Questions (The Non-Negotiable Invariant) */}
      <Card className="border-primary/40 bg-card">
        <CardHeader className="border-b border-border bg-primary/5 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <CardTitle className="text-base font-heading text-text-primary">
                  Mastery Retest Drill (New, Unrevealed Question)
                </CardTitle>
                <Badge className="bg-primary text-white">Non-Negotiable Invariant</Badge>
              </div>
              <CardDescription className="text-xs text-text-secondary">
                Answering the original question whose answer is revealed does NOT establish mastery. Mastery strictly requires independent correct answers on NEW questions testing the same canonical skill.
              </CardDescription>
            </div>

            {practiceQuestions.length > 0 && (
              <Badge variant="outline" className="font-mono text-xs self-start sm:self-center">
                Question {currentPracticeIndex + 1} of {practiceQuestions.length}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-5">
          {loadingPractice ? (
            <div className="py-8 text-center text-text-muted">Loading new practice questions for this skill...</div>
          ) : practiceQuestions.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-secondary mx-auto" />
              <p className="text-sm font-medium text-text-primary">No Additional Retest Questions Currently Available</p>
              <p className="text-xs text-text-secondary max-w-md mx-auto">
                All approved questions for this canonical skill have already been attempted. Your reflection has been saved and scheduled for review.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Question Card */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span className="font-semibold text-primary">{currentPracticeQ.matchReason}</span>
                  <Badge variant="outline" className="text-[11px] font-mono">
                    {currentPracticeQ.difficulty}
                  </Badge>
                </div>

                <div className="p-4 bg-[#EDECE7]/40 rounded-md border border-border text-sm font-medium text-text-primary whitespace-pre-wrap">
                  {currentPracticeQ.prompt}
                </div>
              </div>

              {/* Options Selector */}
              {currentPracticeQ.options?.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-text-secondary">
                    Select your answer:
                  </label>
                  <div className="space-y-2">
                    {currentPracticeQ.options.map((opt: any) => {
                      const isSelected = selectedPracticeOption === opt.id;
                      return (
                        <button
                          key={opt.id}
                          disabled={retestResult !== null}
                          onClick={() => setSelectedPracticeOption(opt.id)}
                          className={`w-full text-left p-3 rounded-md text-xs border transition-all flex items-center justify-between ${
                            isSelected
                              ? "bg-primary/10 border-primary text-text-primary font-medium"
                              : "bg-[#FBFAF7] border-border text-text-secondary hover:border-primary/50"
                          }`}
                        >
                          <span>
                            <strong className="mr-2 font-mono text-primary">{opt.id}.</strong>
                            {opt.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!retestResult ? (
                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    disabled={!selectedPracticeOption || submittingRetest}
                    onClick={handleSubmitRetest}
                  >
                    {submittingRetest ? "Evaluating..." : "Submit Retest Answer"}
                  </Button>
                </div>
              ) : (
                /* Immediate Retest Evaluation Feedback Banner */
                <div
                  className={`p-4 rounded-md border space-y-3 ${
                    retestResult.isCorrect
                      ? "bg-emerald-50 border-emerald-500 text-emerald-950"
                      : "bg-rose-50 border-rose-500 text-rose-950"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {retestResult.isCorrect ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          <span className="font-bold text-sm text-emerald-900">
                            Correct! New Retest Evidence Recorded
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-rose-600" />
                          <span className="font-bold text-sm text-rose-900">
                            Incorrect. Regressed to Stage 1
                          </span>
                        </>
                      )}
                    </div>

                    <Badge className="bg-text-primary text-white font-mono text-xs">
                      Mastery: {retestResult.masteryStatus.replace("_", " ")}
                    </Badge>
                  </div>

                  <p className="text-xs leading-relaxed whitespace-pre-wrap">
                    {retestResult.explanation || "No explanation provided for this practice question."}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                    <span>
                      Advanced to <strong>Stage {retestResult.newRevisionStage}/5</strong>. Next due:{" "}
                      <strong>
                        {new Date(retestResult.nextDueAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </strong>
                    </span>

                    {currentPracticeIndex < practiceQuestions.length - 1 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setCurrentPracticeIndex(currentPracticeIndex + 1);
                          setSelectedPracticeOption(null);
                          setRetestResult(null);
                        }}
                      >
                        Next Practice Question
                      </Button>
                    ) : (
                      <Button size="sm" asChild>
                        <Link href="/dashboard/student/mastery">View Updated Skill Radar</Link>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Defect Reporting Modal */}
      {showDefectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-xl bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-heading text-text-primary flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                Report Question Issue
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Suspect an incorrect answer key or ambiguous wording? Submit a report so staff can review it without unfairly penalizing your mastery record.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmitDefect}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Defect Type</label>
                  <select
                    value={defectType}
                    onChange={(e) => setDefectType(e.target.value)}
                    className="w-full text-xs rounded-md border border-border bg-input px-3 py-2 text-text-primary font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="INCORRECT_ANSWER_KEY">Incorrect Answer Key</option>
                    <option value="AMBIGUOUS_PROMPT">Ambiguous / Vague Prompt</option>
                    <option value="MISSING_INVALID_OPTION">Missing or Invalid Option</option>
                    <option value="ERRONEOUS_EXPLANATION">Erroneous Explanation</option>
                    <option value="WRONG_SKILL_MAPPING">Wrong Canonical Skill</option>
                    <option value="OTHER">Other Defect</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">
                    Explain the defect in detail
                  </label>
                  <Textarea
                    required
                    rows={4}
                    value={defectDescription}
                    onChange={(e) => setDefectDescription(e.target.value)}
                    placeholder="e.g. The correct answer for question 4 should be option B because the time complexity of quicksort in average case is O(n log n), not O(n^2)..."
                    className="bg-input text-xs text-text-primary"
                  />
                </div>
              </CardContent>

              <div className="flex justify-end gap-2 p-4 border-t border-border bg-[#EDECE7]/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDefectModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submittingDefect || !defectDescription.trim()}
                >
                  {submittingDefect ? "Submitting..." : "Submit Report"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
