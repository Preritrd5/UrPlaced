"use strict";
"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  FileQuestion,
  Save,
  HelpCircle,
  FolderPlus,
} from "lucide-react";
import { BrandLoader } from "@/components/common/brand-loader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateQuestionBankModal } from "@/components/questions/create-question-bank-modal";

interface AIGenerateQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  banks: { id: string; name: string; subject?: string; category: string }[];
  onGeneratedSuccess?: () => void;
}

export function AIGenerateQuestionModal({
  isOpen,
  onClose,
  banks,
  onGeneratedSuccess,
}: AIGenerateQuestionModalProps) {
  const [localBanks, setLocalBanks] = useState(banks);
  const [bankId, setBankId] = useState(banks[0]?.id || "");
  const [createBankModalOpen, setCreateBankModalOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [subtopic, setSubtopic] = useState("");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [questionType, setQuestionType] = useState<
    "SINGLE_CHOICE" | "MULTIPLE_SELECT" | "NUMERIC" | "SHORT_ANSWER" | "CODING"
  >("SINGLE_CHOICE");
  const [countInput, setCountInput] = useState("3");
  const [referenceNotes, setReferenceNotes] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedDrafts, setGeneratedDrafts] = useState<any[]>([]);
  const [savedCount, setSavedCount] = useState(0);

  const numericCount = parseInt(countInput, 10);
  const isCountValid =
    countInput.trim() !== "" &&
    !isNaN(numericCount) &&
    Number.isInteger(Number(countInput)) &&
    numericCount >= 1 &&
    numericCount <= 20;

  const countValidationMessage = (() => {
    if (countInput.trim() === "") return "Please enter question quantity (1-20).";
    if (isNaN(numericCount) || !Number.isInteger(Number(countInput))) return "Quantity must be a whole number.";
    if (numericCount < 1) return "Minimum quantity is 1 question.";
    if (numericCount > 20) return "Maximum quantity is 20 questions per request.";
    return null;
  })();

  useEffect(() => {
    setLocalBanks(banks);
    if (banks.length > 0 && !bankId) {
      setBankId(banks[0].id);
    }
  }, [banks, bankId]);

  if (!isOpen) return null;

  const handleGenerate = async (saveDirectlyAsDraft = false) => {
    if (!topic.trim()) {
      setError("Please specify a topic or subject.");
      return;
    }

    if (!isCountValid) {
      setError(countValidationMessage || "Please enter a valid question quantity between 1 and 20.");
      return;
    }

    if (saveDirectlyAsDraft && !bankId) {
      setError("Please select or create a target Question Bank before saving questions.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedDrafts([]);

    try {
      const res = await fetch("/api/ai/questions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          subtopic: subtopic.trim() || undefined,
          bankId: bankId || undefined,
          difficulty,
          questionType,
          count: numericCount,
          referenceNotes: referenceNotes.trim() || undefined,
          saveAsDraft: saveDirectlyAsDraft,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate questions.");
      }

      setGeneratedDrafts(data.questions || []);
      if (saveDirectlyAsDraft) {
        setSavedCount(data.questions?.filter((q: any) => q.isSavedAsDraft).length || 0);
        if (onGeneratedSuccess) onGeneratedSuccess();
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during generation.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#24283A]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden">
      <div className="bg-[#F8F7F3] border border-[#DDDCD5] rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col min-h-0 max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-[#DDDCD5] flex items-center justify-between gap-2 bg-[#FBFAF7] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span className="p-2 rounded-lg bg-[#5052C9]/10 text-[#5052C9] shrink-0">
              <Sparkles className="w-5 h-5 text-[#5052C9]" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-xl font-bold font-outfit text-[#24283A] truncate">
                AI Question Intelligence Generator
              </h2>
              <p className="text-xs text-[#292D40]/70 font-inter line-clamp-1 sm:line-clamp-none">
                Create structured, validated assessment drafts with duplicate detection and quality controls.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#292D40]/50 hover:text-[#24283A] p-1.5 rounded-lg hover:bg-[#EDECE7] transition-colors shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 pr-3 sm:pr-5 overflow-y-auto space-y-4 sm:space-y-6 flex-1 min-h-0">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {savedCount > 0 && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>
                  Successfully saved {savedCount} question draft(s) with Draft / Unreviewed status. You can review them in the Question Bank.
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7 border-emerald-300 text-emerald-900 bg-white hover:bg-emerald-50 shrink-0"
                onClick={() => {
                  onClose();
                  if (typeof window !== "undefined") {
                    window.location.href = `/dashboard/questions?bankId=${bankId}`;
                  }
                }}
              >
                Review in Question Bank
              </Button>
            </div>
          )}

          {/* Form Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {localBanks.length === 0 ? (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#24283A] font-inter">
                  Target Question Bank *
                </label>
                <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center justify-between gap-2">
                  <span>No banks found. Create one first.</span>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCreateBankModalOpen(true)}
                    className="text-xs h-7 bg-[#5052C9] hover:bg-[#4345B0] text-white flex items-center gap-1 shrink-0"
                  >
                    <FolderPlus className="w-3.5 h-3.5" /> + Create Bank
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#24283A] font-inter">
                    Target Question Bank *
                  </label>
                  <button
                    type="button"
                    onClick={() => setCreateBankModalOpen(true)}
                    className="text-[11px] font-semibold text-[#5052C9] hover:text-[#4345B0] flex items-center gap-1 transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" /> + New Bank
                  </button>
                </div>
                <select
                  value={bankId}
                  onChange={(e) => setBankId(e.target.value)}
                  className="w-full p-2.5 text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5052C9]/30 text-[#24283A]"
                >
                  {localBanks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.subject || b.category} ({b.category})
                    </option>
                  ))}
                </select>
                {(() => {
                  const activeB = localBanks.find((b) => b.id === bankId);
                  return activeB ? (
                    <p className="text-[11px] text-[#292D40]/70 mt-1 font-inter">
                      Subject: <span className="font-semibold text-[#24283A]">{activeB.subject || activeB.name}</span>
                    </p>
                  ) : null;
                })()}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#24283A] mb-1 font-inter">
                Topic / Concept *
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Binary Search Trees, Permutations, Deadlocks"
                className="w-full p-2.5 text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5052C9]/30 text-[#24283A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#24283A] mb-1 font-inter">
                Subtopic (Optional)
              </label>
              <input
                type="text"
                value={subtopic}
                onChange={(e) => setSubtopic(e.target.value)}
                placeholder="e.g. In-order traversal, Circular buffer"
                className="w-full p-2.5 text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5052C9]/30 text-[#24283A]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-[#24283A] mb-1 font-inter">
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as any)}
                  className="w-full p-2.5 text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5052C9]/30 text-[#24283A]"
                >
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#24283A] mb-1 font-inter">
                  Type
                </label>
                <select
                  value={questionType}
                  onChange={(e) => setQuestionType(e.target.value as any)}
                  className="w-full p-2.5 text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5052C9]/30 text-[#24283A]"
                >
                  <option value="SINGLE_CHOICE">Single Choice (MCQ)</option>
                  <option value="MULTIPLE_SELECT">Multiple Select</option>
                  <option value="NUMERIC">Numeric</option>
                  <option value="CODING">Coding Problem</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#24283A] mb-1 font-inter">
              Syllabus Context or Reference Notes (Optional)
            </label>
            <textarea
              value={referenceNotes}
              onChange={(e) => setReferenceNotes(e.target.value)}
              placeholder="Provide constraints, sample syllabus notes, or company test patterns..."
              rows={2}
              className="w-full p-2.5 text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5052C9]/30 text-[#24283A]"
            />
          </div>

          {/* Generated Previews */}
          {generatedDrafts.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-[#DDDCD5]">
              <h3 className="text-sm font-bold text-[#24283A] font-outfit flex items-center gap-1.5">
                <FileQuestion className="w-4 h-4 text-[#5052C9]" />
                Generated Question Drafts ({generatedDrafts.length})
              </h3>

              {generatedDrafts.map((draft, idx) => (
                <div
                  key={idx}
                  className="bg-[#FBFAF7] border border-[#DDDCD5] p-4 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-[#5052C9]/30 text-[#5052C9]">
                        {draft.question.difficulty}
                      </Badge>
                      <Badge variant="outline" className="text-xs border-[#DDDCD5] text-[#292D40]">
                        {draft.question.questionType}
                      </Badge>
                      {draft.isSavedAsDraft && (
                        <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                          Saved as Draft
                        </Badge>
                      )}
                    </div>

                    {draft.duplicateWarning?.isPossibleDuplicate && (
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Possible Duplicate Found
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm font-medium text-[#24283A] font-inter">
                    {draft.question.prompt}
                  </p>

                  {/* Options */}
                  {draft.question.options && draft.question.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {draft.question.options.map((opt: any) => {
                        const isCorrect = draft.question.answerKey?.correctOptionId === opt.id;
                        return (
                          <div
                            key={opt.id}
                            className={`p-2 rounded-lg border flex items-center gap-2 ${
                              isCorrect
                                ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-medium"
                                : "bg-white border-[#DDDCD5] text-[#24283A]"
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full bg-[#EDECE7] flex items-center justify-center text-[10px] font-bold">
                              {opt.id.replace("opt-", "").toUpperCase()}
                            </span>
                            <span>{opt.text}</span>
                            {isCorrect && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 ml-auto" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Explanation */}
                  <div className="p-3 bg-[#EDECE7]/50 rounded-lg text-xs text-[#292D40] space-y-1">
                    <span className="font-semibold text-[#24283A]">Explanation:</span>
                    <p className="leading-relaxed">{draft.question.explanation}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-3 sm:p-4 border-t border-[#DDDCD5] bg-[#FBFAF7] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <label htmlFor="ai-question-count-input" className="text-xs font-semibold text-[#24283A] font-inter shrink-0">
                Number of Questions:
              </label>
              <input
                id="ai-question-count-input"
                type="number"
                min={1}
                max={20}
                step={1}
                value={countInput}
                onChange={(e) => setCountInput(e.target.value)}
                placeholder="Enter quantity"
                disabled={isLoading}
                className={`w-28 p-1.5 text-xs bg-white border rounded-md text-[#24283A] font-inter focus:outline-none focus:ring-2 focus:ring-[#5052C9]/30 ${
                  !isCountValid ? "border-red-400 focus:ring-red-300" : "border-[#B8B6AC]"
                }`}
              />
              <span className="text-[11px] text-[#292D40]/60 font-mono">(1 - 20)</span>
            </div>
            {!isCountValid && countValidationMessage && (
              <span className="text-[11px] text-red-600 font-inter">
                {countValidationMessage}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="text-xs border-[#DDDCD5] flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerate(false)}
              disabled={isLoading || !topic.trim() || !isCountValid}
              className="text-xs border-[#5052C9] text-[#5052C9] hover:bg-[#5052C9]/10 flex-1 sm:flex-initial"
            >
              {isLoading ? <BrandLoader size="button" className="mr-1" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
              Preview Drafts
            </Button>
            <Button
              size="sm"
              onClick={() => handleGenerate(true)}
              disabled={isLoading || !topic.trim() || !isCountValid}
              className="text-xs bg-[#5052C9] hover:bg-[#4345B0] text-white w-full sm:w-auto"
            >
              {isLoading ? (
                <BrandLoader size="button" className="mr-1" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1" />
              )}
              Generate & Save Drafts
            </Button>
          </div>
        </div>
      </div>

      {/* Create Question Bank Modal */}
      <CreateQuestionBankModal
        isOpen={createBankModalOpen}
        onClose={() => setCreateBankModalOpen(false)}
        onSuccess={(newBank) => {
          setLocalBanks((prev) => [newBank, ...prev.filter((b) => b.id !== newBank.id)]);
          setBankId(newBank.id);
          setError(null);
          if (onGeneratedSuccess) onGeneratedSuccess();
        }}
      />
    </div>
  );
}
