"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Layers,
  X,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Check,
  Plus,
  BookOpen,
} from "lucide-react";
import { BrandLoader } from "@/components/common/brand-loader";
import { QuestionType, QuestionDifficulty } from "@/types/database";
import { STANDARD_SUBJECTS, normalizeSubjectName } from "@/modules/question-bank/services/subject-constants";

export interface BulkAddQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (targetSetId: string) => void;
  targetSet: { id: string; name: string; is_locked: boolean };
  banks: Array<{ id: string; name: string; subject?: string; category?: string }>;
}

export function BulkAddQuestionsModal({
  isOpen,
  onClose,
  onSuccess,
  targetSet,
  banks,
}: BulkAddQuestionsModalProps) {
  // Filters
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [topicFilter, setTopicFilter] = useState<string>("");
  const [questionType, setQuestionType] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Repository Data
  const [questions, setQuestions] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [alreadyInSetTotal, setAlreadyInSetTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selection Map: questionId -> { points: number, version_id: string, subject: string, prompt: string }
  const [selectedMap, setSelectedMap] = useState<
    Map<string, { points: number; version_id: string; subject: string; prompt: string }>
  >(new Map());

  // Bulk marks rule
  const [defaultMarks, setDefaultMarks] = useState<number>(1.0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Distinct subjects
  const allKnownSubjects = Array.from(
    new Set([
      ...STANDARD_SUBJECTS.map((s) => s.canonicalName),
      ...banks.map((b) => normalizeSubjectName(b.subject || b.name)).filter(Boolean),
    ])
  );

  const fetchQuestions = async () => {
    if (!isOpen) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const params = new URLSearchParams();
      if (selectedBankId) params.set("bankId", selectedBankId);
      if (selectedSubject) params.set("subject", selectedSubject);
      if (topicFilter.trim()) params.set("topic", topicFilter.trim());
      if (questionType) params.set("questionType", questionType);
      if (difficulty) params.set("difficulty", difficulty);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());
      params.set("excludeSetId", targetSet.id);
      params.set("limit", "100");

      const res = await fetch(`/api/questions/sets/eligible-pool?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load eligible questions.");
      }

      const data = await res.json();
      setQuestions(data.questions || []);
      setTotalCount(data.total || 0);
      setAlreadyInSetTotal(data.alreadyInSetCount || 0);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to load questions repository.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedMap(new Map());
      fetchQuestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedBankId, selectedSubject, questionType, difficulty]);

  if (!isOpen) return null;

  // Toggle single question selection
  const handleToggleQuestion = (q: any) => {
    if (q.alreadyInSet) return;

    setSelectedMap((prev) => {
      const copy = new Map(prev);
      if (copy.has(q.id)) {
        copy.delete(q.id);
      } else {
        copy.set(q.id, {
          points: defaultMarks,
          version_id: q.version_id,
          subject: q.subject,
          prompt: q.prompt,
        });
      }
      return copy;
    });
  };

  // Select all selectable on current visible page
  const handleSelectVisiblePage = () => {
    setSelectedMap((prev) => {
      const copy = new Map(prev);
      questions.forEach((q) => {
        if (!q.alreadyInSet) {
          copy.set(q.id, {
            points: defaultMarks,
            version_id: q.version_id,
            subject: q.subject,
            prompt: q.prompt,
          });
        }
      });
      return copy;
    });
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedMap(new Map());
  };

  // Apply default marks to all currently selected
  const handleApplyMarksToSelected = () => {
    const validMarks = Math.max(0.5, defaultMarks);
    setSelectedMap((prev) => {
      const copy = new Map(prev);
      copy.forEach((val, key) => {
        copy.set(key, { ...val, points: validMarks });
      });
      return copy;
    });
  };

  // Update points for a single question
  const handleUpdateItemPoints = (qId: string, pts: number) => {
    setSelectedMap((prev) => {
      const copy = new Map(prev);
      const existing = copy.get(qId);
      if (existing) {
        copy.set(qId, { ...existing, points: Math.max(0.5, pts) });
      }
      return copy;
    });
  };

  // Commit selected questions to set
  const handleCommitAddSelected = async () => {
    if (selectedMap.size === 0) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const itemsToAdd = Array.from(selectedMap.entries()).map(([qId, val], idx) => ({
        question_id: qId,
        version_id: val.version_id,
        points: val.points,
        sequence_order: idx + 1,
      }));

      const res = await fetch(`/api/questions/sets/${targetSet.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_ITEMS",
          items: itemsToAdd,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add selected questions to set.");
      }

      onSuccess(targetSet.id);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add selected questions to set.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = selectedMap.size;
  const totalSelectedMarks = Array.from(selectedMap.values()).reduce(
    (acc, it) => acc + (it.points || 1.0),
    0
  );

  // Group selected by subject
  const selectedSubjectsBreakdown: Record<string, number> = {};
  selectedMap.forEach((it) => {
    selectedSubjectsBreakdown[it.subject] = (selectedSubjectsBreakdown[it.subject] || 0) + 1;
  });

  return (
    <div className="fixed inset-0 z-50 flex min-h-full items-start justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="bg-[#F8F7F3] text-[#24283A] w-full max-w-4xl min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col rounded-xl shadow-2xl border border-[#DDDCD5] overflow-hidden my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DDDCD5] px-4 sm:px-6 py-3.5 sm:py-4 bg-[#F8F7F3] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
            <div className="p-2 rounded-lg bg-[#2E8F86]/10 text-[#2E8F86] border border-[#2E8F86]/20 shrink-0">
              <Layers className="w-5 h-5 text-[#2E8F86]" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#24283A] font-display truncate">
                Bulk Add Questions to Set
              </h2>
              <p className="text-xs text-[#292D40]/70 truncate">
                Target Set: <strong className="text-[#24283A]">{targetSet.name}</strong> • Multi-select verified questions across subject banks
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
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg border border-red-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Notice</p>
                <p>{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="p-3.5 rounded-lg bg-[#EDECE7]/60 border border-[#DDDCD5] space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#292D40] uppercase tracking-wider">
              <Filter className="w-3.5 h-3.5 text-[#5052C9]" /> Repository Filters
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="h-8 px-2.5 rounded bg-[#FBFAF7] border border-[#DDDCD5] text-[#24283A] focus:outline-none"
              >
                <option value="">All Subjects</option>
                {allKnownSubjects.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>

              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="h-8 px-2.5 rounded bg-[#FBFAF7] border border-[#DDDCD5] text-[#24283A] focus:outline-none"
              >
                <option value="">All Question Banks</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
                className="h-8 px-2.5 rounded bg-[#FBFAF7] border border-[#DDDCD5] text-[#24283A] focus:outline-none"
              >
                <option value="">All Types</option>
                <option value="SINGLE_CHOICE">Single Choice</option>
                <option value="MULTIPLE_SELECT">Multi-Select</option>
                <option value="NUMERIC">Numeric</option>
                <option value="SHORT_ANSWER">Short Answer</option>
                <option value="CODING">Coding</option>
              </select>

              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="h-8 px-2.5 rounded bg-[#FBFAF7] border border-[#DDDCD5] text-[#24283A] focus:outline-none"
              >
                <option value="">All Difficulties</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#292D40]/50" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchQuestions()}
                  placeholder="Search prompts, topics, keywords..."
                  className="pl-8 text-xs h-8 bg-[#FBFAF7] border-[#DDDCD5]"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchQuestions}
                className="h-8 text-xs border-[#DDDCD5]"
              >
                Apply
              </Button>
            </div>
          </div>

          {/* Selection Controls & Bulk Marks Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-lg border border-[#DDDCD5]">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSelectVisiblePage}
                className="text-xs h-7 border-[#DDDCD5]"
              >
                Select Visible Page
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
                disabled={selectedCount === 0}
                className="text-xs h-7 text-[#292D40]/60 hover:text-red-600"
              >
                Clear Selection
              </Button>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#2E8F86]/10 text-[#2E8F86] border border-[#2E8F86]/20">
                {selectedCount} Selected ({totalSelectedMarks} pts)
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#292D40]/70 font-semibold">Bulk Marks:</span>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                max="100"
                value={defaultMarks}
                onChange={(e) => setDefaultMarks(parseFloat(e.target.value) || 1.0)}
                className="w-16 h-7 text-xs text-center font-mono font-bold bg-[#FBFAF7] border-[#DDDCD5]"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleApplyMarksToSelected}
                disabled={selectedCount === 0}
                className="text-xs h-7 border-[#DDDCD5]"
              >
                Apply to Selected
              </Button>
            </div>
          </div>

          {/* Selected Breakdown Chips if any */}
          {selectedCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#292D40]/80">
              <span className="font-semibold text-[#24283A]">Selected by Subject:</span>
              {Object.entries(selectedSubjectsBreakdown).map(([sub, count]) => (
                <span
                  key={sub}
                  className="px-2 py-0.5 rounded bg-[#EDECE7] border border-[#DDDCD5] font-medium"
                >
                  {sub}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          )}

          {/* Questions Selection List */}
          <div className="border border-[#DDDCD5] rounded-lg divide-y divide-[#DDDCD5] max-h-72 overflow-y-auto bg-white">
            {loading ? (
              <div className="p-8 text-center text-xs text-[#292D40]/60">
                <BrandLoader size="inline" className="mx-auto mb-1.5" />
                Loading eligible questions...
              </div>
            ) : questions.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#292D40]/60">
                No eligible verified questions match current filter criteria.
              </div>
            ) : (
              questions.map((q) => {
                const isSelected = selectedMap.has(q.id);
                const currentPts = selectedMap.get(q.id)?.points || defaultMarks;

                return (
                  <div
                    key={q.id}
                    onClick={() => handleToggleQuestion(q)}
                    className={`p-3 text-xs flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      q.alreadyInSet
                        ? "bg-[#EDECE7]/40 opacity-60 cursor-not-allowed"
                        : isSelected
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-[#FBFAF7]"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected || q.alreadyInSet}
                        disabled={q.alreadyInSet}
                        onChange={() => handleToggleQuestion(q)}
                        className="rounded border-[#DDDCD5] text-primary focus:ring-primary w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                        onClick={(e) => e.stopPropagation()}
                      />

                      <div className="space-y-1 min-w-0 flex-1">
                        <p className="font-medium text-[#24283A] line-clamp-1">{q.prompt}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="px-1.5 py-0.5 rounded bg-[#2E8F86]/10 text-[#2E8F86] font-semibold border border-[#2E8F86]/20">
                            {q.subject}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-[#FBFAF7] text-[#292D40] border border-[#DDDCD5] font-mono">
                            {q.question_type}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded font-mono font-semibold ${
                              q.difficulty === "HARD"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : q.difficulty === "EASY"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {q.difficulty}
                          </span>
                          {q.bank_name && (
                            <span className="text-[#292D40]/60">Bank: {q.bank_name}</span>
                          )}
                          {q.alreadyInSet && (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                              Already in Set
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div
                        className="flex items-center gap-1 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="100"
                          value={currentPts}
                          onChange={(e) =>
                            handleUpdateItemPoints(q.id, parseFloat(e.target.value) || 1.0)
                          }
                          className="w-14 h-7 text-xs text-center font-mono font-bold bg-[#FBFAF7] border-[#DDDCD5]"
                        />
                        <span className="text-[11px] text-[#292D40]/60">pts</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4 border-t border-[#DDDCD5] bg-[#F8F7F3] shrink-0">
          <div className="text-xs text-[#292D40]/70 text-center sm:text-left">
            {alreadyInSetTotal > 0 && (
              <span>({alreadyInSetTotal} question(s) already in set excluded)</span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
              onClick={handleCommitAddSelected}
              disabled={isSubmitting || selectedCount === 0}
              className="bg-[#2E8F86] hover:bg-[#267870] text-white flex items-center justify-center gap-1.5 text-xs font-semibold shadow-sm w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <BrandLoader size="button" className="mr-1.5" />
                  Adding Questions...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Add {selectedCount} Selected Question{selectedCount === 1 ? "" : "s"} ({totalSelectedMarks} pts)
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
