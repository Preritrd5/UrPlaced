"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { QuestionType, QuestionDifficulty, BankCategory } from "@/types/database";
import { QuestionValidator, McqOption } from "@/modules/question-bank/services/question-validator";
import { CreateQuestionBankModal } from "@/components/questions/create-question-bank-modal";
import { Plus, Trash2, AlertCircle, CheckCircle2, Eye, Sparkles, FolderPlus, Loader2 } from "lucide-react";

interface QuestionFormProps {
  initialData?: any;
  isEditing?: boolean;
}

export function QuestionForm({ initialData, isEditing = false }: QuestionFormProps) {
  const router = useRouter();
  const [banks, setBanks] = useState<any[]>([]);
  const [selectedBankId, setSelectedBankId] = useState(initialData?.bank_id || "");
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [createBankModalOpen, setCreateBankModalOpen] = useState(false);
  const [questionType, setQuestionType] = useState<QuestionType>(
    initialData?.question_type || "SINGLE_CHOICE"
  );
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>(
    initialData?.current_version?.difficulty || "MEDIUM"
  );
  const [prompt, setPrompt] = useState(initialData?.current_version?.prompt || "");
  const [explanation, setExplanation] = useState(
    initialData?.current_version?.explanation || ""
  );
  const [topicTags, setTopicTags] = useState(
    initialData?.current_version?.topic_tags?.join(", ") || ""
  );

  // MCQ Options State
  const [options, setOptions] = useState<McqOption[]>(
    initialData?.current_version?.options || [
      { id: "opt_1", text: "" },
      { id: "opt_2", text: "" },
      { id: "opt_3", text: "" },
      { id: "opt_4", text: "" },
    ]
  );
  const [correctOptionId, setCorrectOptionId] = useState<string>(
    initialData?.current_version?.answer_key?.correct_option_id || "opt_1"
  );
  const [correctOptionIds, setCorrectOptionIds] = useState<string[]>(
    initialData?.current_version?.answer_key?.correct_option_ids || ["opt_1"]
  );

  // Numeric State
  const [numericValue, setNumericValue] = useState<string>(
    initialData?.current_version?.answer_key?.value !== undefined
      ? String(initialData.current_version.answer_key.value)
      : ""
  );
  const [numericTolerance, setNumericTolerance] = useState<string>(
    initialData?.current_version?.answer_key?.tolerance !== undefined
      ? String(initialData.current_version.answer_key.tolerance)
      : "0"
  );

  // Short Answer State
  const [rubric, setRubric] = useState<string>(
    initialData?.current_version?.answer_key?.rubric || ""
  );
  const [sampleAnswer, setSampleAnswer] = useState<string>(
    initialData?.current_version?.answer_key?.sample_answer || ""
  );

  // Coding State
  const [testCases, setTestCases] = useState<Array<{ input: string; expected_output: string; is_hidden: boolean }>>(
    initialData?.current_version?.answer_key?.test_cases || [
      { input: "", expected_output: "", is_hidden: false },
      { input: "", expected_output: "", is_hidden: true },
    ]
  );

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Load Banks
  const fetchBanks = async () => {
    setLoadingBanks(true);
    setBanksError(null);
    try {
      const res = await fetch("/api/questions/banks");
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("You do not have permission to access Question Banks.");
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load Question Banks.");
      }
      const data = await res.json();
      setBanks(data || []);
      if (data && data.length > 0) {
        setSelectedBankId((current: string) => {
          return data.some((b: any) => b.id === current) ? current : data[0].id;
        });
      } else {
        setSelectedBankId("");
      }
    } catch (err: any) {
      console.error("Failed to load question banks", err);
      setBanksError(err.message || "Failed to load Question Banks.");
    } finally {
      setLoadingBanks(false);
    }
  };

  useEffect(() => {
    fetchBanks();
  }, []);

  // Construct answer key
  const buildAnswerKey = () => {
    switch (questionType) {
      case "SINGLE_CHOICE":
        return { correct_option_id: correctOptionId };
      case "MULTIPLE_SELECT":
        return { correct_option_ids: correctOptionIds };
      case "NUMERIC":
        return {
          value: parseFloat(numericValue) || 0,
          tolerance: parseFloat(numericTolerance) || 0,
        };
      case "SHORT_ANSWER":
        return {
          rubric: rubric.trim(),
          sample_answer: sampleAnswer.trim() || undefined,
        };
      case "CODING":
        return {
          test_cases: testCases,
        };
      default:
        return {};
    }
  };

  // Instant Validation
  const validation = QuestionValidator.validate({
    question_type: questionType,
    prompt,
    difficulty,
    options: ["SINGLE_CHOICE", "MULTIPLE_SELECT"].includes(questionType) ? options : undefined,
    answer_key: buildAnswerKey(),
    explanation,
  });

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.isValid) {
      setStatusMessage({
        type: "error",
        text: validation.errors[0] || "Please resolve validation errors before saving.",
      });
      return;
    }

    if (!selectedBankId && !isEditing) {
      setStatusMessage({ type: "error", text: "Please select a target Question Bank." });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    const payload = {
      bank_id: selectedBankId,
      question_type: questionType,
      prompt,
      difficulty,
      options: ["SINGLE_CHOICE", "MULTIPLE_SELECT"].includes(questionType) ? options : undefined,
      answer_key: buildAnswerKey(),
      explanation: explanation.trim() || null,
      topic_tags: topicTags
        .split(",")
        .map((t: string) => t.trim().toLowerCase())
        .filter((t: string) => t.length > 0),
    };

    try {
      const url = isEditing ? `/api/questions/${initialData.id}` : "/api/questions";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save question.");
      }

      setStatusMessage({
        type: "success",
        text: isEditing
          ? "Question revision created successfully!"
          : "Question authored successfully into draft queue!",
      });

      setTimeout(() => {
        router.push("/dashboard/questions");
        router.refresh();
      }, 1200);
    } catch (err: any) {
      setStatusMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      {statusMessage && (
        <div
          className={`p-4 rounded-md flex items-center gap-3 text-sm font-medium ${
            statusMessage.type === "success"
              ? "bg-[#2E8F86]/10 text-[#2E8F86] border border-[#2E8F86]/30"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Meta configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Question Setup & Classification</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {!isEditing && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="question-bank-select"
                  className="block text-xs font-semibold text-text-secondary"
                >
                  Question Bank *
                </label>
                {banks.length > 0 && !loadingBanks && !banksError && (
                  <button
                    type="button"
                    onClick={() => setCreateBankModalOpen(true)}
                    className="text-[11px] font-semibold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" /> + New Bank
                  </button>
                )}
              </div>

              {loadingBanks ? (
                <div className="h-10 px-3 rounded-md bg-input border border-border text-xs text-text-secondary flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Loading Question Banks...</span>
                </div>
              ) : banksError ? (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Failed to load Question Banks</span>
                  </div>
                  <p className="text-[11px] text-red-600">{banksError}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchBanks}
                    className="h-7 text-xs px-2 mt-1"
                  >
                    Retry
                  </Button>
                </div>
              ) : banks.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-input/70 border border-dashed border-border text-center space-y-2">
                  <div className="flex items-center justify-center gap-1.5 text-text-primary text-xs font-semibold">
                    <FolderPlus className="w-4 h-4 text-primary" />
                    <span>No Question Banks yet</span>
                  </div>
                  <p className="text-[11px] text-text-secondary leading-relaxed">
                    Create a Question Bank first to organize your questions.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setCreateBankModalOpen(true)}
                    className="w-full text-xs h-8 bg-primary hover:bg-primary-hover text-white flex items-center justify-center gap-1.5 font-semibold"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    + Create Question Bank
                  </Button>
                </div>
              ) : (
                <select
                  id="question-bank-select"
                  value={selectedBankId}
                  onChange={(e) => setSelectedBankId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                >
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.category})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Question Type *
            </label>
            <select
              value={questionType}
              onChange={(e) => setQuestionType(e.target.value as QuestionType)}
              disabled={isEditing}
              className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            >
              <option value="SINGLE_CHOICE">Single Choice (MCQ)</option>
              <option value="MULTIPLE_SELECT">Multiple Select</option>
              <option value="NUMERIC">Numeric Answer</option>
              <option value="SHORT_ANSWER">Short Answer / Subjective</option>
              <option value="CODING">Coding Problem</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Difficulty *
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
              className="w-full h-10 px-3 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Prompt Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Problem Prompt (Markdown Supported)</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            {showPreview ? "Edit Mode" : "Preview"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {showPreview ? (
            <div className="p-4 rounded-md bg-card border border-border min-h-[140px] text-sm whitespace-pre-wrap font-mono">
              {prompt || <span className="text-text-secondary italic">No prompt entered yet.</span>}
            </div>
          ) : (
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter the problem statement, code snippet, or question text..."
              rows={5}
              className="w-full p-3 rounded-md bg-input border border-border text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            />
          )}

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Topic Tags (comma-separated)
            </label>
            <Input
              value={topicTags}
              onChange={(e) => setTopicTags(e.target.value)}
              placeholder="e.g. dynamic-programming, graph-theory, sql-joins"
            />
          </div>
        </CardContent>
      </Card>

      {/* Answer Key & Options Section based on Question Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Answer Key & Verification Parameters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* MCQ SINGLE CHOICE */}
          {questionType === "SINGLE_CHOICE" && (
            <div className="space-y-3">
              <p className="text-xs text-text-secondary">
                Add at least two options and mark the single correct answer radio button.
              </p>
              {options.map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="correct_option"
                    checked={correctOptionId === opt.id}
                    onChange={() => setCorrectOptionId(opt.id)}
                    className="w-4 h-4 text-primary focus:ring-primary cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-text-secondary w-6">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <Input
                    value={opt.text}
                    onChange={(e) => {
                      const next = [...options];
                      next[idx].text = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + idx)} text`}
                    className="flex-1"
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const next = options.filter((_, i) => i !== idx);
                        setOptions(next);
                        if (correctOptionId === opt.id && next.length > 0) {
                          setCorrectOptionId(next[0].id);
                        }
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOptions([...options, { id: `opt_${Date.now()}`, text: "" }])
                }
                className="text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Option
              </Button>
            </div>
          )}

          {/* MCQ MULTIPLE SELECT */}
          {questionType === "MULTIPLE_SELECT" && (
            <div className="space-y-3">
              <p className="text-xs text-text-secondary">
                Select one or more checkboxes corresponding to correct choices.
              </p>
              {options.map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={correctOptionIds.includes(opt.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setCorrectOptionIds([...correctOptionIds, opt.id]);
                      } else {
                        setCorrectOptionIds(correctOptionIds.filter((id) => id !== opt.id));
                      }
                    }}
                    className="w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-text-secondary w-6">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <Input
                    value={opt.text}
                    onChange={(e) => {
                      const next = [...options];
                      next[idx].text = e.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Option ${String.fromCharCode(65 + idx)} text`}
                    className="flex-1"
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const next = options.filter((_, i) => i !== idx);
                        setOptions(next);
                        setCorrectOptionIds(correctOptionIds.filter((id) => id !== opt.id));
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOptions([...options, { id: `opt_${Date.now()}`, text: "" }])
                }
                className="text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Option
              </Button>
            </div>
          )}

          {/* NUMERIC */}
          {questionType === "NUMERIC" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Expected Numerical Value *
                </label>
                <Input
                  type="number"
                  step="any"
                  value={numericValue}
                  onChange={(e) => setNumericValue(e.target.value)}
                  placeholder="e.g. 42 or 3.1415"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Acceptable Tolerance (+/-)
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={numericTolerance}
                  onChange={(e) => setNumericTolerance(e.target.value)}
                  placeholder="0 (exact match)"
                />
              </div>
            </div>
          )}

          {/* SHORT ANSWER */}
          {questionType === "SHORT_ANSWER" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Evaluation Rubric / Scoring Key *
                </label>
                <textarea
                  value={rubric}
                  onChange={(e) => setRubric(e.target.value)}
                  placeholder="Define criteria or essential points required for full marks..."
                  rows={3}
                  className="w-full p-2.5 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Reference Sample Answer
                </label>
                <textarea
                  value={sampleAnswer}
                  onChange={(e) => setSampleAnswer(e.target.value)}
                  placeholder="Model answer for evaluator benchmark..."
                  rows={2}
                  className="w-full p-2.5 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}

          {/* CODING */}
          {questionType === "CODING" && (
            <div className="space-y-4">
              <p className="text-xs text-text-secondary">
                Configure test cases for code execution. Public test cases are shown to candidates; hidden test cases verify edge cases.
              </p>
              {testCases.map((tc, idx) => (
                <div key={idx} className="p-3 rounded-md bg-card border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-text-primary">
                      Test Case #{idx + 1} {tc.is_hidden ? "(Hidden Verification)" : "(Public Example)"}
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tc.is_hidden}
                          onChange={(e) => {
                            const next = [...testCases];
                            next[idx].is_hidden = e.target.checked;
                            setTestCases(next);
                          }}
                          className="rounded text-primary focus:ring-primary"
                        />
                        Hidden Case
                      </label>
                      {testCases.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setTestCases(testCases.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-700 h-7 px-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <textarea
                      value={tc.input}
                      onChange={(e) => {
                        const next = [...testCases];
                        next[idx].input = e.target.value;
                        setTestCases(next);
                      }}
                      placeholder="Standard Input (stdin)..."
                      rows={2}
                      className="w-full p-2 rounded bg-input border border-border font-mono text-xs"
                    />
                    <textarea
                      value={tc.expected_output}
                      onChange={(e) => {
                        const next = [...testCases];
                        next[idx].expected_output = e.target.value;
                        setTestCases(next);
                      }}
                      placeholder="Expected Output (stdout)..."
                      rows={2}
                      className="w-full p-2 rounded bg-input border border-border font-mono text-xs"
                    />
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setTestCases([...testCases, { input: "", expected_output: "", is_hidden: true }])
                }
                className="text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Test Case
              </Button>
            </div>
          )}

          {/* Explanation */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-text-secondary mb-1">
              Detailed Solution & Explanation
            </label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Explain why the answer is correct and clarify common misconceptions..."
              rows={3}
              className="w-full p-2.5 rounded-md bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </CardContent>
      </Card>

      {/* Live Validation Warnings */}
      {(validation.errors.length > 0 || validation.warnings.length > 0) && (
        <div className="p-4 rounded-md bg-card border border-border space-y-2">
          {validation.errors.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Validation Errors ({validation.errors.length})
              </span>
              <ul className="list-disc list-inside text-xs text-red-600 space-y-0.5">
                {validation.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          {validation.warnings.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Quality Recommendations ({validation.warnings.length})
              </span>
              <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5">
                {validation.warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Submit Button */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dashboard/questions")}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || !validation.isValid}
          className="bg-primary hover:bg-primary-hover text-white px-6 font-medium"
        >
          {loading ? "Saving..." : isEditing ? "Save Revision" : "Create Question"}
        </Button>
      </div>
    </form>

    {/* Create Question Bank Modal */}
    <CreateQuestionBankModal
      isOpen={createBankModalOpen}
      onClose={() => setCreateBankModalOpen(false)}
      onSuccess={(newBank) => {
        setBanks((prev) => [newBank, ...prev.filter((b) => b.id !== newBank.id)]);
        setSelectedBankId(newBank.id);
        setBanksError(null);
      }}
    />
  </>
);
}
