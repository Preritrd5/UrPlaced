"use client";

import React, { useState, useEffect, useRef, use, useCallback } from "react";
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
  ShieldAlert,
  Maximize2,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AssessmentTakeSkeleton } from "@/components/ui/page-skeletons";
import { toast, alertDialog } from "@/components/ui/dialog-system";

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

  // Fullscreen state & gate
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  // Autosave sequence tracker per question
  const [sequenceMap, setSequenceMap] = useState<Record<string, number>>({});
  const [answersMap, setAnswersMap] = useState<Record<string, any>>({});
  const [flagsMap, setFlagsMap] = useState<Record<string, boolean>>({});
  const [autosaveStatus, setAutosaveStatus] = useState<"SAVED" | "SAVING" | "ERROR">("SAVED");

  // Timer State
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Submit Modal & State
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Security Flags & refs to prevent false violations
  const isSubmittingRef = useRef(false);
  const hasAutoSubmittedRef = useRef(false);
  const [autoSubmitNotice, setAutoSubmitNotice] = useState<{
    violationType: string;
    message: string;
  } | null>(null);

  // 1. Initialize Workspace
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
        body: JSON.stringify({
          client_meta: {
            fullscreen_requested: true,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load assessment.");
      }

      // If attempt is already submitted/expired, redirect immediately to review
      if (data.attempt && ["SUBMITTED", "SCORED", "RESULT_RELEASED", "EXPIRED"].includes(data.attempt.status)) {
        router.push(`/dashboard/student/attempts/${data.attempt.id}/review`);
        return;
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

      if (stateData.remainingSeconds != null) {
        setRemainingSeconds(stateData.remainingSeconds);
      }

      // Check current fullscreen status
      if (typeof document !== "undefined" && document.fullscreenElement) {
        setIsFullscreen(true);
      }
    } catch (err: any) {
      setError(err.message || "Failed to initialize workspace.");
    } finally {
      setLoading(false);
    }
  }

  // 2. Countdown Timer: ONLY ticks down when isFullscreen is TRUE and workspace is active
  useEffect(() => {
    if (loading || !workspace || !isFullscreen || hasAutoSubmittedRef.current || isSubmittingRef.current) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (remainingSeconds != null && remainingSeconds > 0) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev == null || prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleTimeExpired(workspace.attempt.id);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen, loading, workspace]);

  // 3. Trigger Auto-Submission on Security Violation
  const handleAutoSubmit = useCallback(
    async (violationType: string, reasonMessage: string) => {
      if (isSubmittingRef.current || hasAutoSubmittedRef.current || !workspace) {
        return;
      }

      hasAutoSubmittedRef.current = true;
      isSubmittingRef.current = true;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setAutoSubmitNotice({
        violationType,
        message: reasonMessage,
      });

      // Exit fullscreen if still active
      if (typeof document !== "undefined" && document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          // ignore error
        }
      }

      try {
        // Send violation report to backend (backend auto-finalizes and scores attempt)
        await fetch(`/api/student/attempts/${workspace.attempt.id}/violation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            violationType,
            metadata: {
              reason: reasonMessage,
              timestamp: new Date().toISOString(),
              remainingSeconds,
            },
            autoSubmit: true,
          }),
        });
      } catch (err) {
        console.error("Failed to post violation to server:", err);
      }
    },
    [workspace, remainingSeconds]
  );

  // 4. Fullscreen Request Handler
  async function requestFullscreenGate() {
    try {
      setFullscreenError(null);
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen();
      } else if ((document.documentElement as any).msRequestFullscreen) {
        await (document.documentElement as any).msRequestFullscreen();
      }
      setIsFullscreen(true);
    } catch (err: any) {
      setFullscreenError("Browser rejected fullscreen request. Please allow fullscreen permissions in your browser bar and try again.");
    }
  }

  // 5. Security & Violation Event Listeners
  useEffect(() => {
    if (!workspace || loading) return;

    // Fullscreen change listener
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);

      // If exiting fullscreen during active exam (not deliberate submit)
      if (!active && !isSubmittingRef.current && !hasAutoSubmittedRef.current) {
        handleAutoSubmit(
          "FULLSCREEN_EXIT",
          "Assessment window exited full-screen mode. In accordance with examination security policy, your test has been automatically submitted."
        );
      }
    };

    // Visibility change listener (tab switch or minimization)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (!isSubmittingRef.current && !hasAutoSubmittedRef.current) {
          handleAutoSubmit(
            "TAB_SWITCH",
            "Browser tab was switched or minimized during the active assessment session. Your attempt has been automatically finalized."
          );
        }
      }
    };

    // Window blur listener
    const handleWindowBlur = () => {
      if (!isSubmittingRef.current && !hasAutoSubmittedRef.current) {
        // Window lost focus
        handleAutoSubmit(
          "WINDOW_BLUR",
          "Browser window lost focus. Multi-tasking during active examinations is prohibited."
        );
      }
    };

    // Pagehide / BeforeUnload beacon
    const handlePageHide = () => {
      if (!isSubmittingRef.current && !hasAutoSubmittedRef.current && workspace?.attempt?.id) {
        const payload = JSON.stringify({
          violationType: "NAVIGATION_AWAY",
          metadata: { reason: "User navigated away or closed examination window" },
          autoSubmit: true,
        });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(
            `/api/student/attempts/${workspace.attempt.id}/violation`,
            new Blob([payload], { type: "application/json" })
          );
        }
      }
    };

    // Clipboard and context menu restrictions
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      toast.warning("Right-click context menu is disabled during the assessment.");
    };

    const handleCopyCutPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      toast.warning("Clipboard operations (copy/cut/paste) are prohibited during examinations.");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        ["c", "v", "x", "p", "u", "s"].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        toast.warning("Prohibited shortcut disabled during assessment.");
      }
      if (e.key === "F12") {
        e.preventDefault();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("copy", handleCopyCutPaste);
    window.addEventListener("cut", handleCopyCutPaste);
    window.addEventListener("paste", handleCopyCutPaste);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("copy", handleCopyCutPaste);
      window.removeEventListener("cut", handleCopyCutPaste);
      window.removeEventListener("paste", handleCopyCutPaste);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [workspace, loading, handleAutoSubmit]);

  // 6. Time Expired Handler
  async function handleTimeExpired(attemptId: string) {
    if (isSubmittingRef.current || hasAutoSubmittedRef.current) return;
    isSubmittingRef.current = true;
    hasAutoSubmittedRef.current = true;

    if (typeof document !== "undefined" && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {}
    }

    try {
      await fetch(`/api/student/attempts/${attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionReason: "TIMEOUT" }),
      });
      await alertDialog({
        title: "Allotted Duration Expired",
        description: "Your assessment duration has reached zero. Your answers have been safely submitted and evaluated.",
        confirmText: "View Assessment Results",
        variant: "warning",
      });
    } finally {
      router.push(`/dashboard/student/attempts/${attemptId}/review`);
    }
  }

  // 7. Answer Autosave Function
  async function saveCurrentAnswer(
    qId: string,
    vId: string,
    newPayload: any,
    isFlagged: boolean
  ) {
    if (!workspace || isSubmittingRef.current || hasAutoSubmittedRef.current) return;
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

  // 8. Final Manual Submit Handler
  async function handleFinalSubmit() {
    if (!workspace || isSubmittingRef.current) return;
    try {
      setSubmitting(true);
      isSubmittingRef.current = true;

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      // Exit fullscreen mode on intentional submission
      if (typeof document !== "undefined" && document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          // ignore
        }
      }

      const res = await fetch(`/api/student/attempts/${workspace.attempt.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionReason: "MANUAL" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }
      router.push(`/dashboard/student/attempts/${workspace.attempt.id}/review`);
    } catch (err: any) {
      toast.error(err.message || "Submission failed.");
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (loading) {
    return <AssessmentTakeSkeleton />;
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

  // Auto-Submission Violation Modal overlay
  if (autoSubmitNotice) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-hidden">
        <Card className="w-full max-w-lg min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden border-red-500/50 bg-card shadow-2xl animate-in fade-in duration-200">
          <CardHeader className="text-center pb-3 shrink-0 border-b border-border">
            <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
              <ShieldAlert className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-xl font-bold font-heading text-red-900 dark:text-red-300">
              Assessment Terminated: Security Violation
            </CardTitle>
            <p className="text-xs text-text-muted mt-1 uppercase font-mono tracking-wider">
              Violation Code: {autoSubmitNotice.violationType}
            </p>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pr-3 sm:pr-5 space-y-4">
            <div className="p-3.5 bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs text-red-950 dark:text-red-200 space-y-2 leading-relaxed rounded-lg">
              <p className="font-medium">{autoSubmitNotice.message}</p>
              <p className="text-[11px] text-red-800 dark:text-red-300">
                All answers saved prior to this violation have been securely preserved and submitted for scoring. Re-entry to this assessment attempt is permanently locked.
              </p>
            </div>
          </CardContent>
          <div className="shrink-0 p-3.5 sm:p-4 border-t border-border bg-surface/50">
            <Button
              variant="primary"
              size="default"
              className="w-full font-semibold"
              onClick={() => router.push(`/dashboard/student/attempts/${workspace.attempt.id}/review`)}
            >
              Proceed to Attempt Review & Breakdown
            </Button>
          </div>
        </Card>
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
    <div className="space-y-4 max-w-7xl mx-auto pb-12 select-none" onContextMenu={(e) => e.preventDefault()}>
      {/* FULLSCREEN GATE OVERLAY: Displayed if browser drops out of fullscreen before exam is submitted */}
      {!isFullscreen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md overflow-hidden">
          <Card className="w-full max-w-lg min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden border-primary/40 bg-card shadow-2xl animate-in zoom-in-95 duration-150">
            <CardHeader className="text-center pb-2 shrink-0 border-b border-border">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Maximize2 className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-xl font-bold font-heading text-text-primary">
                Full-Screen Mode Required
              </CardTitle>
              <p className="text-xs text-text-secondary mt-1">
                UrPlaced examination security rules require active full-screen mode.
              </p>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pr-3 sm:pr-5 space-y-4">
              <div className="p-3.5 bg-input rounded-lg border border-border text-xs text-text-secondary space-y-2">
                <div className="flex items-center gap-2 text-text-primary font-medium">
                  <Lock className="h-4 w-4 text-primary" />
                  <span>Exam Integrity Active</span>
                </div>
                <p>
                  Your assessment timer is paused until full-screen mode is re-engaged. Questions are secured to prevent unauthorized access.
                </p>
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                  Notice: Once inside the assessment, exiting full-screen or switching tabs will result in automatic submission.
                </p>
              </div>

              {fullscreenError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{fullscreenError}</span>
                </div>
              )}
            </CardContent>
            <div className="shrink-0 p-3.5 sm:p-4 border-t border-border bg-surface/50">
              <Button
                variant="primary"
                size="default"
                onClick={requestFullscreenGate}
                className="w-full font-semibold shadow-md"
              >
                <Maximize2 className="h-4 w-4 mr-2" /> Enter Full-Screen to Continue
              </Button>
            </div>
          </Card>
        </div>
      )}

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
              <span>&bull;</span>
              <span className="text-secondary font-medium flex items-center gap-1">
                <Lock className="h-3 w-3" /> Full-Screen Secured
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4 w-full sm:w-auto shrink-0">
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
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-border">
              <div className="flex flex-wrap items-center gap-2">
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

            {/* Prompt Body (Select None protected) */}
            <div className="py-6 text-sm text-text-primary font-body whitespace-pre-wrap leading-relaxed select-none">
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
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-5 gap-2">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-hidden">
          <Card className="w-full max-w-md min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden shadow-2xl">
            <CardHeader className="shrink-0 pb-3 border-b border-border">
              <CardTitle className="text-lg font-bold">Submit Assessment Attempt?</CardTitle>
              <p className="text-xs text-text-secondary mt-1">
                Please verify your responses before concluding the test session.
              </p>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pr-3 sm:pr-5 space-y-4">
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
            </CardContent>
            <div className="shrink-0 p-3.5 sm:p-4 border-t border-border bg-surface/50 flex justify-end gap-2">
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
          </Card>
        </div>
      )}
    </div>
  );
}
