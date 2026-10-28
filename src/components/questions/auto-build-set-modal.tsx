"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Wand2,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
  Layers,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Filter,
  Check,
  Sparkles,
} from "lucide-react";
import { QuestionType, QuestionDifficulty, QuestionSetPurpose } from "@/types/database";
import { STANDARD_SUBJECTS, normalizeSubjectName } from "@/modules/question-bank/services/subject-constants";
import { toast } from "@/components/ui/dialog-system";

export interface AutoBuildSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (targetSetId: string) => void;
  banks: Array<{ id: string; name: string; subject?: string; category?: string }>;
  currentSet?: { id: string; name: string; is_locked: boolean } | null;
}

interface SubjectItem {
  subject: string;
  count: number;
}

export function AutoBuildSetModal({
  isOpen,
  onClose,
  onSuccess,
  banks,
  currentSet,
}: AutoBuildSetModalProps) {
  // Step 1: Configuration, Step 2: Preview & Adjust
  const [step, setStep] = useState<"CONFIG" | "PREVIEW">("CONFIG");

  // Mode: SINGLE subject or MIXED subjects
  const [mode, setMode] = useState<"SINGLE" | "MIXED">("SINGLE");

  // Single Subject Mode State
  const [singleSubject, setSingleSubject] = useState<string>("Computer Networks");
  const [singleCount, setSingleCount] = useState<number>(30);

  // Mixed Subjects Mode State
  const [mixedSubjects, setMixedSubjects] = useState<SubjectItem[]>([
    { subject: "Computer Networks", count: 15 },
    { subject: "Database Management Systems", count: 15 },
    { subject: "Operating Systems", count: 10 },
    { subject: "Aptitude", count: 10 },
    { subject: "Verbal Ability", count: 10 },
  ]);

  // Filters & Composition
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [questionType, setQuestionType] = useState<string>("ALL");
  const [marksPerQuestion, setMarksPerQuestion] = useState<number>(1.0);

  // Difficulty Distribution (percentages)
  const [useDifficultyDist, setUseDifficultyDist] = useState<boolean>(false);
  const [easyPercent, setEasyPercent] = useState<number>(20);
  const [mediumPercent, setMediumPercent] = useState<number>(50);
  const [hardPercent, setHardPercent] = useState<number>(30);

  // Pre-flight Availability State
  const [availability, setAvailability] = useState<any | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState<boolean>(false);

  // Preview State
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [previewSummary, setPreviewSummary] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Target Destination
  const [targetType, setTargetType] = useState<"NEW_SET" | "EXISTING_SET">(
    currentSet && !currentSet.is_locked ? "EXISTING_SET" : "NEW_SET"
  );
  const [newSetName, setNewSetName] = useState<string>("");
  const [newSetDescription, setNewSetDescription] = useState<string>("");
  const [newSetPurpose, setNewSetPurpose] = useState<QuestionSetPurpose>("ASSESSMENT");
  const [committing, setCommitting] = useState<boolean>(false);

  // Extract all distinct subjects from available banks and standard constants
  const allKnownSubjects = Array.from(
    new Set([
      ...STANDARD_SUBJECTS.map((s) => s.canonicalName),
      ...banks.map((b) => normalizeSubjectName(b.subject || b.name)).filter(Boolean),
    ])
  );

  useEffect(() => {
    if (isOpen) {
      setStep("CONFIG");
      setTargetType(currentSet && !currentSet.is_locked ? "EXISTING_SET" : "NEW_SET");
      setNewSetName(
        mode === "SINGLE"
          ? `${singleSubject} Assessment ${new Date().toLocaleDateString()}`
          : `Mixed Placement Mock Test ${new Date().toLocaleDateString()}`
      );
      setPreviewError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentSet]);

  // Compute active target subjects array
  const activeSubjects: SubjectItem[] =
    mode === "SINGLE"
      ? [{ subject: singleSubject, count: Math.max(1, singleCount) }]
      : mixedSubjects.filter((s) => s.subject && s.count > 0);

  const totalQuestionsNeeded = activeSubjects.reduce((acc, s) => acc + (s.count || 0), 0);

  // Pre-flight availability check whenever subjects, filters, or bank change
  useEffect(() => {
    if (!isOpen || step !== "CONFIG") return;

    let isCancelled = false;
    const checkAvail = async () => {
      setCheckingAvailability(true);
      try {
        const res = await fetch("/api/questions/sets/auto-build/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            subjects: activeSubjects,
            bankId: selectedBankId || undefined,
            topic: topicFilter.trim() || undefined,
            questionType: questionType !== "ALL" ? questionType : undefined,
            difficultyDistribution: useDifficultyDist
              ? { EASY: easyPercent, MEDIUM: mediumPercent, HARD: hardPercent }
              : undefined,
            excludeSetId: targetType === "EXISTING_SET" && currentSet ? currentSet.id : undefined,
          }),
        });

        const data = await res.json().catch(() => null);
        if (data && !isCancelled) {
          setAvailability(data);
        }
      } catch (err) {
        console.error("Failed to check availability", err);
      } finally {
        if (!isCancelled) setCheckingAvailability(false);
      }
    };

    const timer = setTimeout(checkAvail, 300);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    step,
    mode,
    singleSubject,
    singleCount,
    mixedSubjects,
    selectedBankId,
    topicFilter,
    questionType,
    useDifficultyDist,
    easyPercent,
    mediumPercent,
    hardPercent,
    targetType,
  ]);

  if (!isOpen) return null;

  // Add a new subject row in mixed mode
  const handleAddMixedSubject = () => {
    const unused = allKnownSubjects.find(
      (subj) => !mixedSubjects.some((m) => m.subject.toLowerCase() === subj.toLowerCase())
    );
    setMixedSubjects([
      ...mixedSubjects,
      { subject: unused || allKnownSubjects[0] || "Computer Networks", count: 10 },
    ]);
  };

  const handleRemoveMixedSubject = (idx: number) => {
    if (mixedSubjects.length <= 1) return;
    setMixedSubjects(mixedSubjects.filter((_, i) => i !== idx));
  };

  const handleUpdateMixedSubject = (idx: number, field: "subject" | "count", value: any) => {
    const updated = [...mixedSubjects];
    updated[idx] = { ...updated[idx], [field]: field === "count" ? Math.max(1, parseInt(value, 10) || 1) : value };
    setMixedSubjects(updated);
  };

  // Generate preview
  const handleBuildPreview = async () => {
    setLoadingPreview(true);
    setPreviewError(null);

    try {
      if (useDifficultyDist) {
        const sum = easyPercent + mediumPercent + hardPercent;
        if (sum !== 100) {
          throw new Error(`Difficulty distribution percentages must sum to 100% (current sum: ${sum}%).`);
        }
      }

      const dist = useDifficultyDist
        ? { EASY: easyPercent, MEDIUM: mediumPercent, HARD: hardPercent }
        : undefined;

      const res = await fetch("/api/questions/sets/auto-build/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          subjects: activeSubjects,
          bankId: selectedBankId || undefined,
          topic: topicFilter.trim() || undefined,
          questionType: questionType !== "ALL" ? questionType : undefined,
          difficultyDistribution: dist,
          defaultPoints: marksPerQuestion,
          excludeSetId: targetType === "EXISTING_SET" && currentSet ? currentSet.id : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate preview.");
      }

      setPreviewItems(data.previewItems || []);
      setPreviewSummary(data.summary || null);
      setStep("PREVIEW");
    } catch (err: any) {
      setPreviewError(err.message || "Failed to generate test preview.");
    } finally {
      setLoadingPreview(false);
    }
  };

  // Swap / Replace item in preview
  const handleSwapItem = async (item: any) => {
    setSwappingId(item.question_id);
    try {
      const alreadySelected = previewItems.map((p) => p.question_id);
      const res = await fetch("/api/questions/sets/auto-build/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentQuestionId: item.question_id,
          subject: item.subject,
          difficulty: item.difficulty,
          questionType: questionType !== "ALL" ? questionType : undefined,
          alreadySelectedIds: alreadySelected,
        }),
      });

      const data = await res.json();
      if (res.ok && data.replacement) {
        setPreviewItems((prev) =>
          prev.map((p) =>
            p.question_id === item.question_id
              ? { ...data.replacement, points: item.points }
              : p
          )
        );
      } else {
        toast.error(data.error || "No alternative eligible questions found.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to swap question.");
    } finally {
      setSwappingId(null);
    }
  };

  // Remove item from preview
  const handleRemovePreviewItem = (qId: string) => {
    setPreviewItems((prev) => prev.filter((p) => p.question_id !== qId));
  };

  // Update points for an individual question in preview
  const handleUpdateItemPoints = (qId: string, pts: number) => {
    setPreviewItems((prev) =>
      prev.map((p) => (p.question_id === qId ? { ...p, points: Math.max(0.5, pts) } : p))
    );
  };

  // Commit and save set
  const handleCommitSet = async () => {
    if (previewItems.length === 0) return;
    setCommitting(true);
    setPreviewError(null);

    try {
      const res = await fetch("/api/questions/sets/auto-build/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          setId: targetType === "EXISTING_SET" ? currentSet?.id : undefined,
          setName: newSetName.trim() || undefined,
          setDescription: newSetDescription.trim() || undefined,
          purpose: newSetPurpose,
          items: previewItems.map((item, idx) => ({
            question_id: item.question_id,
            version_id: item.version_id,
            points: item.points,
            sequence_order: idx + 1,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save Question Set.");
      }

      onSuccess(data.set?.id || currentSet?.id);
      onClose();
    } catch (err: any) {
      setPreviewError(err.message || "Failed to save Question Set.");
    } finally {
      setCommitting(false);
    }
  };

  const totalPreviewMarks = previewItems.reduce(
    (acc, it) => acc + (parseFloat(it.points) || 1.0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#F8F7F3] text-[#24283A] w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl shadow-2xl border border-[#DDDCD5] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DDDCD5] px-6 py-4 bg-[#F8F7F3]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Wand2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-[#24283A] font-display">
                Auto-Build Question Set
              </h2>
              <p className="text-xs text-[#292D40]/70">
                {step === "CONFIG"
                  ? "Configure criteria to automatically compose a balanced, verified question set"
                  : "Review, adjust marks, and confirm your auto-composed question blueprint"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={committing || loadingPreview}
            className="text-[#292D40]/60 hover:text-[#24283A] p-1 rounded-md transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(92vh-140px)]">
          {previewError && (
            <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Configuration Notice</p>
                <p>{previewError}</p>
              </div>
            </div>
          )}

          {step === "CONFIG" ? (
            /* ================= STEP 1: CONFIGURATION ================= */
            <div className="space-y-6">
              {/* Mode Switcher */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-[#24283A] uppercase tracking-wider">
                  Test Subject Mode
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMode("SINGLE")}
                    className={`p-3.5 rounded-lg border text-left transition-all ${
                      mode === "SINGLE"
                        ? "bg-primary/10 border-primary shadow-sm"
                        : "bg-[#FBFAF7] border-[#DDDCD5] hover:bg-[#EDECE7]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#24283A]">Single Subject Test</span>
                      {mode === "SINGLE" && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-[11px] text-[#292D40]/70 mt-1">
                      Subject-specific exam (e.g. Computer Networks only, 30 questions).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode("MIXED")}
                    className={`p-3.5 rounded-lg border text-left transition-all ${
                      mode === "MIXED"
                        ? "bg-primary/10 border-primary shadow-sm"
                        : "bg-[#FBFAF7] border-[#DDDCD5] hover:bg-[#EDECE7]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#24283A]">Mixed-Subject Mock Test</span>
                      {mode === "MIXED" && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-[11px] text-[#292D40]/70 mt-1">
                      Multi-subject mock test (e.g. CN + DBMS + OS + Aptitude + Verbal).
                    </p>
                  </button>
                </div>
              </div>

              {/* Subject Configuration */}
              {mode === "SINGLE" ? (
                <div className="p-4 rounded-lg bg-[#EDECE7]/50 border border-[#DDDCD5] space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#24283A]">Choose Subject</Label>
                      <select
                        value={singleSubject}
                        onChange={(e) => setSingleSubject(e.target.value)}
                        className="w-full h-9 px-3 rounded-md bg-[#FBFAF7] border border-[#DDDCD5] text-xs font-medium text-[#24283A] focus:outline-none"
                      >
                        {allKnownSubjects.map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-[#24283A]">Questions Needed</Label>
                      <Input
                        type="number"
                        min="1"
                        max="200"
                        value={singleCount}
                        onChange={(e) => setSingleCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="bg-[#FBFAF7] border-[#DDDCD5] text-xs h-9"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg bg-[#EDECE7]/50 border border-[#DDDCD5] space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-[#24283A]">
                      Subject Distribution ({totalQuestionsNeeded} Total Questions)
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddMixedSubject}
                      className="text-xs h-7 text-primary border-primary/30 hover:bg-primary/10"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Subject
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {mixedSubjects.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-[#FBFAF7] p-2.5 rounded-md border border-[#DDDCD5]">
                        <select
                          value={item.subject}
                          onChange={(e) => handleUpdateMixedSubject(idx, "subject", e.target.value)}
                          className="flex-1 h-8 px-2.5 rounded bg-white border border-[#DDDCD5] text-xs font-medium text-[#24283A] focus:outline-none"
                        >
                          {allKnownSubjects.map((sub) => (
                            <option key={sub} value={sub}>
                              {sub}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1.5 w-32">
                          <Input
                            type="number"
                            min="1"
                            max="100"
                            value={item.count}
                            onChange={(e) => handleUpdateMixedSubject(idx, "count", e.target.value)}
                            className="bg-white border-[#DDDCD5] text-xs h-8 w-20 text-center font-mono font-bold"
                          />
                          <span className="text-[11px] text-[#292D40]/60">qs</span>
                        </div>

                        {mixedSubjects.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMixedSubject(idx)}
                            className="text-[#292D40]/40 hover:text-red-600 p-1"
                            aria-label={`Remove subject ${item.subject}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Filters & Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#24283A]">Question Bank Filter</Label>
                  <select
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="w-full h-9 px-3 rounded-md bg-[#FBFAF7] border border-[#DDDCD5] text-xs text-[#24283A] focus:outline-none"
                  >
                    <option value="">All Relevant Question Banks</option>
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.subject || b.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#24283A]">Question Type</Label>
                  <select
                    value={questionType}
                    onChange={(e) => setQuestionType(e.target.value)}
                    className="w-full h-9 px-3 rounded-md bg-[#FBFAF7] border border-[#DDDCD5] text-xs text-[#24283A] focus:outline-none"
                  >
                    <option value="ALL">All Question Types</option>
                    <option value="SINGLE_CHOICE">Single Choice MCQ</option>
                    <option value="MULTIPLE_SELECT">Multi-Select</option>
                    <option value="NUMERIC">Numeric</option>
                    <option value="SHORT_ANSWER">Short Answer</option>
                    <option value="CODING">Coding</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-[#24283A]">Marks Per Question</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="100"
                    value={marksPerQuestion}
                    onChange={(e) => setMarksPerQuestion(parseFloat(e.target.value) || 1.0)}
                    className="bg-[#FBFAF7] border-[#DDDCD5] text-xs h-9"
                  />
                </div>
              </div>

              {/* Difficulty Distribution Accordion */}
              <div className="border border-[#DDDCD5] rounded-lg p-3 bg-[#FBFAF7] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-[#24283A]">Difficulty Distribution</span>
                    <p className="text-[11px] text-[#292D40]/60">
                      Balance question difficulty by exact percentage (deterministic integer quotas)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {useDifficultyDist && (
                      <span
                        className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                          easyPercent + mediumPercent + hardPercent === 100
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        Total: {easyPercent + mediumPercent + hardPercent}%{" "}
                        {easyPercent + mediumPercent + hardPercent === 100 ? "(Valid)" : "(Must be 100%)"}
                      </span>
                    )}
                    <input
                      type="checkbox"
                      id="useDifficulty"
                      checked={useDifficultyDist}
                      onChange={(e) => setUseDifficultyDist(e.target.checked)}
                      className="rounded border-[#DDDCD5] text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                  </div>
                </div>

                {useDifficultyDist && (
                  <div className="grid grid-cols-3 gap-3 pt-1 border-t border-[#DDDCD5]">
                    <div>
                      <Label className="text-[11px] font-semibold text-emerald-700">Easy %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={easyPercent}
                        onChange={(e) => setEasyPercent(parseInt(e.target.value, 10) || 0)}
                        className="bg-white border-[#DDDCD5] text-xs h-8 font-mono text-center"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-amber-700">Medium %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={mediumPercent}
                        onChange={(e) => setMediumPercent(parseInt(e.target.value, 10) || 0)}
                        className="bg-white border-[#DDDCD5] text-xs h-8 font-mono text-center"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-rose-700">Hard %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={hardPercent}
                        onChange={(e) => setHardPercent(parseInt(e.target.value, 10) || 0)}
                        className="bg-white border-[#DDDCD5] text-xs h-8 font-mono text-center"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Pre-flight Inventory Feedback Box */}
              <div className="p-4 rounded-lg border border-[#DDDCD5] bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#24283A] uppercase tracking-wider">
                      Inventory Availability
                    </span>
                    {checkingAvailability && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                  </div>

                  {availability && (
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        availability.isSatisfiable
                          ? "bg-[#2E8F86]/10 text-[#2E8F86] border border-[#2E8F86]/20"
                          : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {availability.isSatisfiable
                        ? "Criteria Fully Satisfiable"
                        : `Shortage of ${availability.totalShortage} questions`}
                    </span>
                  )}
                </div>

                {availability?.subjects && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 text-xs">
                    {availability.subjects.map((sub: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded border ${
                          sub.shortage > 0
                            ? "bg-red-50/60 border-red-200 text-red-900"
                            : "bg-[#FBFAF7] border-[#DDDCD5] text-[#24283A]"
                        }`}
                      >
                        <p className="font-semibold truncate">{sub.subject}</p>
                        <div className="flex items-center justify-between mt-1 text-[11px]">
                          <span className="text-[#292D40]/70">
                            Requested: <strong className="font-mono">{sub.requested}</strong>
                          </span>
                          <span>
                            Eligible: <strong className="font-mono text-[#2E8F86]">{sub.available}</strong>
                          </span>
                        </div>
                        {sub.requestedByDifficulty && (
                          <div className="mt-1 pt-1 border-t border-[#DDDCD5]/50 text-[10px] space-y-0.5">
                            <div className="flex justify-between text-[#292D40]/70 font-mono">
                              <span>Req: E:{sub.requestedByDifficulty.EASY} M:{sub.requestedByDifficulty.MEDIUM} H:{sub.requestedByDifficulty.HARD}</span>
                            </div>
                            <div className="flex justify-between font-mono">
                              <span className={sub.difficultyShortage?.EASY ? "text-red-700 font-bold" : "text-[#2E8F86]"}>
                                E:{sub.byDifficulty.EASY}
                              </span>
                              <span className={sub.difficultyShortage?.MEDIUM ? "text-red-700 font-bold" : "text-[#2E8F86]"}>
                                M:{sub.byDifficulty.MEDIUM}
                              </span>
                              <span className={sub.difficultyShortage?.HARD ? "text-red-700 font-bold" : "text-[#2E8F86]"}>
                                H:{sub.byDifficulty.HARD}
                              </span>
                            </div>
                          </div>
                        )}
                        {sub.shortage > 0 && (
                          <p className="text-[11px] font-semibold text-red-700 mt-1">
                            Missing {sub.shortage} question(s)
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {availability?.shortageMessages && availability.shortageMessages.length > 0 && (
                  <div className="p-2.5 bg-red-50 text-red-800 text-xs rounded border border-red-200 space-y-1 mt-2">
                    {availability.shortageMessages.map((msg: string, i: number) => (
                      <p key={i} className="text-[11px] font-medium leading-relaxed">
                        • {msg}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ================= STEP 2: PREVIEW & CUSTOMIZATION ================= */
            <div className="space-y-5">
              {/* Summary Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-lg bg-[#EDECE7]/60 border border-[#DDDCD5]">
                <div>
                  <span className="text-[11px] font-semibold text-[#292D40]/60 uppercase">Selected Questions</span>
                  <p className="text-xl font-bold font-mono text-[#24283A]">{previewItems.length}</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-[#292D40]/60 uppercase">Total Marks</span>
                  <p className="text-xl font-bold font-mono text-[#5052C9]">{totalPreviewMarks} pts</p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-[#292D40]/60 uppercase">Subject Scope</span>
                  <p className="text-xs font-semibold text-[#2E8F86] truncate mt-1">
                    {Object.keys(previewSummary?.subjectCounts || {}).join(", ") || "Mixed"}
                  </p>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-[#292D40]/60 uppercase">Difficulty Ratio</span>
                  <p className="text-xs font-mono font-medium text-[#24283A] mt-1">
                    E:{previewSummary?.difficultyCounts?.EASY || 0} | M:
                    {previewSummary?.difficultyCounts?.MEDIUM || 0} | H:
                    {previewSummary?.difficultyCounts?.HARD || 0}
                  </p>
                </div>
              </div>

              {/* Target Destination Switcher */}
              <div className="p-3.5 rounded-lg bg-white border border-[#DDDCD5] space-y-3">
                <Label className="text-xs font-semibold text-[#24283A] uppercase tracking-wider">
                  Save Target
                </Label>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="targetType"
                      value="NEW_SET"
                      checked={targetType === "NEW_SET"}
                      onChange={() => setTargetType("NEW_SET")}
                      className="text-primary focus:ring-primary"
                    />
                    Create as New Question Set
                  </label>

                  {currentSet && !currentSet.is_locked && (
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="targetType"
                        value="EXISTING_SET"
                        checked={targetType === "EXISTING_SET"}
                        onChange={() => setTargetType("EXISTING_SET")}
                        className="text-primary focus:ring-primary"
                      />
                      Add to Current Unlocked Set: <strong>{currentSet.name}</strong>
                    </label>
                  )}
                </div>

                {targetType === "NEW_SET" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#DDDCD5]">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-[#24283A]">Question Set Name</Label>
                      <Input
                        value={newSetName}
                        onChange={(e) => setNewSetName(e.target.value)}
                        placeholder="e.g. Computer Networks Mid-Term 2026"
                        className="bg-[#FBFAF7] border-[#DDDCD5] text-xs h-8"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-[#24283A]">Purpose</Label>
                      <select
                        value={newSetPurpose}
                        onChange={(e) => setNewSetPurpose(e.target.value as QuestionSetPurpose)}
                        className="w-full h-8 px-2.5 rounded bg-[#FBFAF7] border border-[#DDDCD5] text-xs font-medium text-[#24283A] focus:outline-none"
                      >
                        <option value="ASSESSMENT">Assessment / Official Exam</option>
                        <option value="PRACTICE">Student Practice</option>
                        <option value="DIAGNOSTIC">Diagnostic Evaluation</option>
                        <option value="COMPANY_PREP">Company-Specific Prep</option>
                        <option value="INTERVIEW">Technical Interview Pool</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Previewed Questions Sequence List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#292D40]/70">
                  <span className="font-semibold text-[#24283A]">
                    Composed Question Sequence ({previewItems.length} items)
                  </span>
                  <span>Click Swap to replace with another eligible question</span>
                </div>

                <div className="border border-[#DDDCD5] rounded-lg divide-y divide-[#DDDCD5] max-h-72 overflow-y-auto bg-white">
                  {previewItems.map((item, idx) => (
                    <div key={item.question_id} className="p-3 text-xs flex items-center justify-between gap-3 hover:bg-[#FBFAF7]">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <span className="font-mono font-bold text-[#292D40]/50 w-6">#{idx + 1}</span>
                        <div className="space-y-1 min-w-0 flex-1">
                          <p className="font-medium text-[#24283A] line-clamp-1">{item.prompt}</p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="px-1.5 py-0.5 rounded bg-[#2E8F86]/10 text-[#2E8F86] font-semibold border border-[#2E8F86]/20">
                              {item.subject}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-[#FBFAF7] text-[#292D40] border border-[#DDDCD5] font-mono">
                              {item.question_type}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono font-semibold ${
                                item.difficulty === "HARD"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : item.difficulty === "EASY"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {item.difficulty}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="100"
                            value={item.points}
                            onChange={(e) => handleUpdateItemPoints(item.question_id, parseFloat(e.target.value) || 1.0)}
                            className="w-14 h-7 text-xs text-center font-mono font-bold bg-[#FBFAF7] border-[#DDDCD5]"
                          />
                          <span className="text-[11px] text-[#292D40]/60">pts</span>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSwapItem(item)}
                          disabled={swappingId === item.question_id}
                          className="h-7 px-2 text-xs text-primary hover:bg-primary/10 flex items-center gap-1"
                          title="Swap with another eligible question"
                        >
                          {swappingId === item.question_id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          Swap
                        </Button>

                        <button
                          type="button"
                          onClick={() => handleRemovePreviewItem(item.question_id)}
                          className="text-[#292D40]/40 hover:text-red-600 p-1 rounded"
                          title="Remove question"
                          aria-label={`Remove question #${idx + 1}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#DDDCD5] bg-[#F8F7F3]">
          {step === "CONFIG" ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="text-xs border-[#DDDCD5] text-[#24283A] hover:bg-[#EDECE7]"
              >
                Cancel
              </Button>

              <Button
                size="sm"
                onClick={handleBuildPreview}
                disabled={
                  loadingPreview ||
                  checkingAvailability ||
                  (availability && !availability.isSatisfiable) ||
                  (useDifficultyDist && easyPercent + mediumPercent + hardPercent !== 100)
                }
                className="bg-primary hover:bg-primary-hover text-white flex items-center gap-1.5 text-xs font-semibold shadow-sm"
              >
                {loadingPreview ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Selecting Eligible Questions...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    Preview Test ({totalQuestionsNeeded} Questions)
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("CONFIG")}
                disabled={committing}
                className="text-xs border-[#DDDCD5] text-[#24283A] hover:bg-[#EDECE7] flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Criteria
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={committing}
                  className="text-xs border-[#DDDCD5] text-[#24283A] hover:bg-[#EDECE7]"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCommitSet}
                  disabled={committing || previewItems.length === 0}
                  className="bg-[#2E8F86] hover:bg-[#267870] text-white flex items-center gap-1.5 text-xs font-semibold shadow-sm"
                >
                  {committing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving Question Set...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      {targetType === "NEW_SET"
                        ? `Create Question Set (${previewItems.length} Qs, ${totalPreviewMarks} pts)`
                        : `Add to ${currentSet?.name || "Set"} (${previewItems.length} Qs)`}
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
