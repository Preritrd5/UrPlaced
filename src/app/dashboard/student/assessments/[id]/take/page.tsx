"use client";

import React, { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  Flag,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Send,
  Code2,
  FileText,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function AssessmentTakingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: assessmentId } = use(params);
  const router = useRouter();

  const [workspace, setWorkspace] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);

  // Autosave sequence tracker per question
  const [sequenceMap, setSequenceMap] = useState<Record<string, number>>({});
  const [answersMap, setAnswersMap] = useState<Record<string, any>>({});
  const [flagsMap, setFlagsMap] = useState<Record<string, boolean>>({});
  const [autosaveStatus, setAutosaveStatus] = useState<"SAVED" | "SAVING" | "ERROR">("SAVED");

  // Timer State
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Submit Modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    initWorkspace();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  async function initWorkspace() {
    try {
      setLoading(true);
      setError(null);

      // Start or resume attempt
      const res = await fetch(`/api/student/assessments/${assessmentId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load assessment.");
      }

      // Fetch full attempt state
      const stateRes = await fetch(`/api/student/attempts/${data.attempt.id}`);
      const stateData = await stateRes.json();
      if (!stateRes.ok) {
        throw new Error(stateData.error || "Failed to load attempt state.");
      }

      setWorkspace(stateData);

      // Initialize answers, flags, and sequences from saved response state
      const ans: Record<string, any> = {};
      const flg: Record<string, boolean> = {};
      const seq: Record<string, number> = {};

      stateData.questions.forEach((q: any) => {
        if (q.savedResponse) {
          ans[q.questionId] = q.savedResponse.payload || {};
          flg[q.questionId] = Boolean(q.savedResponse.isFlagged);
          seq[q.questionId] = Number(q.savedResponse.saveSequence || 1);
        } else {
          ans[q.questionId] = {};
          flg[q.questionId] = false;
          seq[q.questionId] = 1;
        }
      });

      setAnswersMap(ans);
      setFlagsMap(flg);
      setSequenceMap(seq);

      // Setup server timer
      if (stateData.remainingSeconds != null) {
        setRemainingSeconds(stateData.remainingSeconds);
        timerRef.current = setInterval(() => {
          setRemainingSeconds((prev) => {
            if (prev == null || prev <= 1) {
              clearInterval(timerRef.current!);
              handleTimeExpired(data.attempt.id);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err: any) {
      setError(err.message || "Failed to initialize workspace.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTimeExpired(attemptId: string) {
    alert("Time limit expired! Your assessment has been automatically submitted.");
    try {
      await fetch(`/api/student/attempts/${attemptId}/submit`, { method: "POST" });
    } finally {
      router.push(`/dashboard/student/attempts/${attemptId}/review`);
    }
  }

  async function saveCurrentAnswer(
    qId: string,
    vId: string,
    newPayload: any,
    isFlagged: boolean
  ) {
    if (!workspace) return;
    const currentSeq = (sequenceMap[qId] || 1) + 1;
    setSequenceMap((prev) => ({ ...prev, [qId]: currentSeq }));
    setAutosaveStatus("SAVING");

    const hasContent =
      newPayload.selected_option !== undefined ||
      (Array.isArray(newPayload.selected_options) && newPayload.selected_options.length > 0) ||
      newPayload.numeric_value !== undefined ||
      (typeof newPayload.text === "string" && newPayload.text.trim().length > 0) ||
      (typeof newPayload.code === "string" && newPayload.code.trim().length > 0);

    try {
      const res = await fetch(`/api/student/attempts/${workspace.attempt.id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: qId,
          versionId: vId,
          responsePayload: newPayload,
          saveSequence: currentSeq,
          isFlagged,
          isAnswered: hasContent,
        }),
      });

      if (!res.ok) {
        setAutosaveStatus("ERROR");
      } else {
        setAutosaveStatus("SAVED");
      }
    } catch {
      setAutosaveStatus("ERROR");
    }
  }

  function handleSingleChoiceSelect(qId: string, vId: string, optionId: string) {
    const updated = { selected_option: optionId };
    setAnswersMap((prev) => ({ ...prev, [qId]: updated }));
    saveCurrentAnswer(qId, vId, updated, flagsMap[qId] || false);
  }

  function handleMultipleSelectToggle(qId: string, vId: string, optionId: string) {
    const currentOptions: string[] = answersMap[qId]?.selected_options || [];
    const updatedOptions = currentOptions.includes(optionId)
      ? currentOptions.filter((o) => o !== optionId)
      : [...currentOptions, optionId];

    const updated = { selected_options: updatedOptions };
    setAnswersMap((prev) => ({ ...prev, [qId]: updated }));
    saveCurrentAnswer(qId, vId, updated, flagsMap[qId] || false);
  }

  function handleNumericChange(qId: string, vId: string, val: string) {
    const updated = { numeric_value: val };
    setAnswersMap((prev) => ({ ...prev, [qId]: updated }));
    saveCurrentAnswer(qId, vId, updated, flagsMap[qId] || false);
  }

  function handleTextChange(qId: string, vId: string, text: string) {
    const updated = { text };
    setAnswersMap((prev) => ({ ...prev, [qId]: updated }));
    saveCurrentAnswer(qId, vId, updated, flagsMap[qId] || false);
  }

  function handleCodeChange(qId: string, vId: string, code: string) {
    const updated = { code, language: answersMap[qId]?.language || "python" };
    setAnswersMap((prev) => ({ ...prev, [qId]: updated }));
    saveCurrentAnswer(qId, vId, updated, flagsMap[qId] || false);
  }

  function handleToggleFlag(qId: string, vId: string) {
    const nextFlag = !flagsMap[qId];
    setFlagsMap((prev) => ({ ...prev, [qId]: nextFlag }));
    saveCurrentAnswer(qId, vId, answersMap[qId] || {}, nextFlag);
  }

  async function handleFinalSubmit() {
    if (!workspace) return;
    try {
      setSubmitting(true);
      const res = await fetch(`/api/student/attempts/${workspace.attempt.id}/submit`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }
      router.push(`/dashboard/student/attempts/${workspace.attempt.id}/review`);
    } catch (err: any) {
      alert(err.message);
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-3">
        <Clock className="h-8 w-8 text-primary animate-pulse" />
        <h2 className="text-base font-semibold text-text-primary">Initializing Secure Workspace...</h2>
        <p className="text-xs text-text-muted">Synchronizing server timer & question sets.</p>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-4">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-text-primary">Unable to Access Assessment</h2>
        <p className="text-xs text-text-secondary">{error || "Assessment unavailable."}</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/student/assessments")}>
          Return to Hub
        </Button>
      </div>
    );
  }

  const currentQ = workspace.questions[activeQuestionIndex];
  const totalQuestions = workspace.questions.length;

  const answeredCount = workspace.questions.filter((q: any) => {
    const payload = answersMap[q.questionId];
    if (!payload) return false;
    return (
      payload.selected_option !== undefined ||
      (Array.isArray(payload.selected_options) && payload.selected_options.length > 0) ||
      payload.numeric_value !== undefined ||
      (typeof payload.text === "string" && payload.text.trim().length > 0) ||
      (typeof payload.code === "string" && payload.code.trim().length > 0)
    );
  }).length;

  const flaggedCount = Object.values(flagsMap).filter(Boolean).length;

  // Format Timer
  const formatTimer = (seconds: number | null) => {
    if (seconds == null) return "Untimed";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const isLowTime = remainingSeconds != null && remainingSeconds < 300; // < 5 mins

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Navbar */}
      <div className="sticky top-0 z-40 bg-card/95 backdrop-blur border border-border rounded-lg p-3 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-secondary shrink-0" />
          <div>
            <h2 className="text-sm font-bold text-text-primary line-clamp-1">
              {workspace.assessment.title}
            </h2>
            <div className="flex items-center gap-2 text-[11px] text-text-muted">
              <span>Attempt #{workspace.attempt.attempt_number}</span>
              <span>&bull;</span>
              <span>Pass Mark: {workspace.assessment.passPercentage}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {/* Autosave Pill */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono">
            {autosaveStatus === "SAVING" ? (
              <span className="text-amber-600 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" /> Saving...
              </span>
            ) : autosaveStatus === "ERROR" ? (
              <span className="text-red-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Sync Issue
              </span>
            ) : (
              <span className="text-secondary flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Saved
              </span>
            )}
          </div>

          {/* Countdown Clock */}
          {remainingSeconds != null && (
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs font-bold border ${
                isLowTime
                  ? "bg-red-50 text-red-700 border-red-300 animate-pulse"
                  : "bg-input text-text-primary border-border"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>{formatTimer(remainingSeconds)}</span>
            </div>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowSubmitModal(true)}
            className="text-xs font-semibold"
          >
            <Send className="h-3.5 w-3.5 mr-1.5" /> Finish Test
          </Button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left / Center: Question Canvas */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="p-6">
            {/* Question Meta Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-text-muted">
                  Question {activeQuestionIndex + 1} of {totalQuestions}
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {currentQ.questionType}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {currentQ.points} pt{currentQ.points > 1 ? "s" : ""}
                </Badge>
                {currentQ.negativePoints > 0 && (
                  <Badge variant="outline" className="text-[10px] text-red-600">
                    -{currentQ.negativePoints} on error
                  </Badge>
                )}
              </div>

              <button
                onClick={() => handleToggleFlag(currentQ.questionId, currentQ.versionId)}
                className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded transition-colors ${
                  flagsMap[currentQ.questionId]
                    ? "bg-amber-100 text-amber-800 font-semibold"
                    : "text-text-secondary hover:bg-input"
                }`}
              >
                <Flag className="h-3.5 w-3.5" />
                <span>{flagsMap[currentQ.questionId] ? "Flagged for Review" : "Flag"}</span>
              </button>
            </div>

            {/* Prompt Body */}
            <div className="py-6 text-sm text-text-primary font-body whitespace-pre-wrap leading-relaxed">
              {currentQ.prompt}
            </div>

            {/* Interactive Response Area */}
            <div className="pt-2 border-t border-border">
              {/* Single Choice Options */}
              {currentQ.questionType === "SINGLE_CHOICE" && (
                <div className="space-y-2">
                  {(currentQ.options || []).map((opt: any) => {
                    const isSelected = answersMap[currentQ.questionId]?.selected_option === opt.id;
                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleSingleChoiceSelect(currentQ.questionId, currentQ.versionId, opt.id)}
                        className={`flex items-center gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? "border-primary bg-[rgba(80,82,201,0.06)] text-text-primary font-medium"
                            : "border-border hover:bg-input text-text-secondary"
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? "border-primary" : "border-border"
                          }`}
                        >
                          {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                        <span className="text-xs sm:text-sm">{opt.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Multiple Select Options */}
              {currentQ.questionType === "MULTIPLE_SELECT" && (
                <div className="space-y-2">
                  <p className="text-[11px] text-text-muted mb-2 italic">Select all applicable options:</p>
                  {(currentQ.options || []).map((opt: any) => {
                    const selectedList: string[] = answersMap[currentQ.questionId]?.selected_options || [];
                    const isSelected = selectedList.includes(opt.id);
                    return (
                      <div
                        key={opt.id}
                        onClick={() => handleMultipleSelectToggle(currentQ.questionId, currentQ.versionId, opt.id)}
                        className={`flex items-center gap-3 p-3.5 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? "border-primary bg-[rgba(80,82,201,0.06)] text-text-primary font-medium"
                            : "border-border hover:bg-input text-text-secondary"
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected ? "border-primary bg-primary text-white" : "border-border"
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="h-3 w-3" />}
                        </div>
                        <span className="text-xs sm:text-sm">{opt.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Numeric Input */}
              {currentQ.questionType === "NUMERIC" && (
                <div className="max-w-xs space-y-2">
                  <Label htmlFor="numericInput" className="text-xs font-medium text-text-secondary">
                    Enter Numerical Value:
                  </Label>
                  <Input
                    id="numericInput"
                    type="number"
                    step="any"
                    value={answersMap[currentQ.questionId]?.numeric_value ?? ""}
                    onChange={(e) => handleNumericChange(currentQ.questionId, currentQ.versionId, e.target.value)}
                    placeholder="e.g. 42 or 3.1415"
                    className="font-mono text-sm"
                  />
                </div>
              )}

              {/* Short Answer */}
              {currentQ.questionType === "SHORT_ANSWER" && (
                <div className="space-y-2">
                  <Label htmlFor="shortAnswer" className="text-xs font-medium text-text-secondary">
                    Your Response:
                  </Label>
                  <Textarea
                    id="shortAnswer"
                    rows={6}
                    value={answersMap[currentQ.questionId]?.text ?? ""}
                    onChange={(e) => handleTextChange(currentQ.questionId, currentQ.versionId, e.target.value)}
                    placeholder="Type your response with concise clarity..."
                    className="font-sans text-xs sm:text-sm"
                  />
                </div>
              )}

              {/* Coding Question */}
              {currentQ.questionType === "CODING" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="codingArea" className="text-xs font-medium flex items-center gap-1.5">
                      <Code2 className="h-4 w-4 text-primary" /> Solution Code
                    </Label>
                    <span className="text-[11px] text-text-muted font-mono">Python / JS / Java</span>
                  </div>
                  <Textarea
                    id="codingArea"
                    rows={12}
                    value={answersMap[currentQ.questionId]?.code ?? ""}
                    onChange={(e) => handleCodeChange(currentQ.questionId, currentQ.versionId, e.target.value)}
                    placeholder="# Write your solution here...&#10;def solution():&#10;    pass"
                    className="font-mono text-xs bg-card leading-relaxed"
                  />
                </div>
              )}
            </div>

            {/* Navigation Footer */}
            <div className="flex items-center justify-between pt-6 border-t border-border mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={activeQuestionIndex === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>

              <div className="flex items-center gap-2">
                {activeQuestionIndex < totalQuestions - 1 ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setActiveQuestionIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                  >
                    Next <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setShowSubmitModal(true)}
                  >
                    Review & Submit <Send className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Right Sidebar: Question Palette & Metrics */}
        <div className="space-y-4">
          <Card className="p-4">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="text-xs font-mono uppercase text-text-secondary">
                Question Palette
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 space-y-4">
              {/* Grid of question buttons */}
              <div className="grid grid-cols-5 gap-2">
                {workspace.questions.map((q: any, idx: number) => {
                  const isAnswered = Boolean(
                    answersMap[q.questionId]?.selected_option !== undefined ||
                    (answersMap[q.questionId]?.selected_options && answersMap[q.questionId]?.selected_options.length > 0) ||
                    answersMap[q.questionId]?.numeric_value !== undefined ||
                    (answersMap[q.questionId]?.text && answersMap[q.questionId]?.text.trim().length > 0) ||
                    (answersMap[q.questionId]?.code && answersMap[q.questionId]?.code.trim().length > 0)
                  );
                  const isFlagged = Boolean(flagsMap[q.questionId]);
                  const isActive = idx === activeQuestionIndex;

                  let btnStyle = "border-border bg-card text-text-secondary";
                  if (isActive) {
                    btnStyle = "border-primary ring-2 ring-primary/30 font-bold";
                  } else if (isFlagged) {
                    btnStyle = "border-amber-400 bg-amber-50 text-amber-800 font-semibold";
                  } else if (isAnswered) {
                    btnStyle = "border-secondary/50 bg-[rgba(46,143,134,0.1)] text-secondary font-semibold";
                  }

                  return (
                    <button
                      key={q.questionId}
                      onClick={() => setActiveQuestionIndex(idx)}
                      className={`h-9 rounded-md border text-xs font-mono flex items-center justify-center transition-all ${btnStyle}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              {/* Status Legend */}
              <div className="border-t border-border pt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-secondary" /> Answered
                  </span>
                  <span className="font-mono font-bold">{answeredCount}</span>
                </div>
                <div className="flex items-center justify-between text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Flagged
                  </span>
                  <span className="font-mono font-bold">{flaggedCount}</span>
                </div>
                <div className="flex items-center justify-between text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-border" /> Unanswered
                  </span>
                  <span className="font-mono font-bold">{totalQuestions - answeredCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-lg font-bold">Submit Assessment Attempt?</CardTitle>
              <p className="text-xs text-text-secondary mt-1">
                Please verify your responses before concluding the test session.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center p-3 bg-input rounded-md border border-border text-xs">
                <div>
                  <span className="text-secondary font-bold text-base block font-mono">{answeredCount}</span>
                  <span className="text-text-muted">Answered</span>
                </div>
                <div>
                  <span className="text-amber-600 font-bold text-base block font-mono">{flaggedCount}</span>
                  <span className="text-text-muted">Flagged</span>
                </div>
                <div>
                  <span className="text-text-primary font-bold text-base block font-mono">
                    {totalQuestions - answeredCount}
                  </span>
                  <span className="text-text-muted">Unanswered</span>
                </div>
              </div>

              {totalQuestions - answeredCount > 0 && (
                <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>You still have unanswered questions. Unanswered questions will receive 0 points.</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSubmitModal(false)}
                  disabled={submitting}
                >
                  Return to Test
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleFinalSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Evaluating..." : "Confirm & Submit"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
