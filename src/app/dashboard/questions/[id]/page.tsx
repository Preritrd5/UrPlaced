"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  QuestionTypeBadge,
  DifficultyBadge,
  LifecycleStatusBadge,
  ReviewStatusBadge,
} from "@/components/questions/question-type-badge";
import { AnswerKeyReviewModal } from "@/components/questions/answer-key-review-modal";
import { QuestionForm } from "@/components/questions/question-form";
import {
  ArrowLeft,
  History,
  CheckCircle2,
  AlertCircle,
  Archive,
  Edit3,
  Calendar,
  Send,
  Code2,
  FileText,
} from "lucide-react";

export default function QuestionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const [question, setQuestion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const loadQuestion = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/questions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setQuestion(data);
      } else {
        const err = await res.json();
        setError(err.error || "Question not found.");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handlePublish = async () => {
    try {
      const res = await fetch(`/api/questions/${id}/publish`, {
        method: "POST",
      });
      if (res.ok) {
        loadQuestion();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to publish question.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleArchive = async () => {
    if (!confirm("Are you sure you want to archive this question? Existing assessment links will be preserved.")) {
      return;
    }
    try {
      const res = await fetch(`/api/questions/${id}?action=ARCHIVE`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadQuestion();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-sm text-text-secondary">
        Loading question record and version history...
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/questions">
          <Button variant="ghost" size="sm" className="text-xs">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Question Bank
          </Button>
        </Link>
        <Card className="p-8 text-center text-red-600">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p className="font-semibold">{error || "Question not found."}</p>
        </Card>
      </div>
    );
  }

  const versions: any[] = question.versions || [];
  const cur = versions.find((v) => v.id === question.current_version_id) || versions[0];
  const canPublish = cur?.review_status === "VERIFIED_CORRECT" && question.lifecycle_status !== "PUBLISHED";

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/questions"
            className="p-2 rounded-md hover:bg-card text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <QuestionTypeBadge type={question.question_type} />
              {cur?.difficulty && <DifficultyBadge difficulty={cur.difficulty} />}
              <LifecycleStatusBadge status={question.lifecycle_status} />
              {cur?.review_status && <ReviewStatusBadge status={cur.review_status} />}
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-card border border-border text-text-secondary">
                v{cur?.version_number || 1}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              Bank: <span className="font-semibold text-text-primary">{question.bank?.name}</span> ({question.bank?.category})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReviewModalOpen(true)}
            className="text-xs h-8"
          >
            Review Answer Key
          </Button>

          {canPublish && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handlePublish}
              className="text-xs h-8 bg-[#2E8F86] hover:bg-[#267870] text-white flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Publish
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs h-8 flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" /> {isEditing ? "Cancel Revision" : "Create Revision"}
          </Button>

          {question.lifecycle_status !== "ARCHIVED" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleArchive}
              className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-1"
            >
              <Archive className="w-3.5 h-3.5" /> Archive
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <Card className="p-6">
          <h2 className="text-lg font-bold text-text-primary mb-4 font-display">
            Authoring Revision (Creates Immutable Revision Upon Save)
          </h2>
          <QuestionForm initialData={question} isEditing={true} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Content (2 cols) */}
          <div className="md:col-span-2 space-y-6">
            {/* Prompt Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Question Prompt
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-md bg-input border border-border text-sm leading-relaxed whitespace-pre-wrap font-sans text-text-primary">
                  {cur?.prompt}
                </div>

                {cur?.topic_tags && cur.topic_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {cur.topic_tags.map((t: string, i: number) => (
                      <span
                        key={i}
                        className="text-[11px] font-mono px-2 py-0.5 rounded bg-card border border-border text-text-secondary"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Answer Key & Options Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2E8F86]" /> Answer Key & Solution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Single Choice Options */}
                {question.question_type === "SINGLE_CHOICE" && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-text-secondary">Options:</p>
                    {(cur?.options || []).map((opt: any, idx: number) => {
                      const isCorrect = cur?.answer_key?.correct_option_id === opt.id;
                      return (
                        <div
                          key={opt.id}
                          className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
                            isCorrect
                              ? "border-[#2E8F86] bg-[#2E8F86]/10 text-text-primary font-medium"
                              : "border-border bg-input text-text-secondary"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs">
                              {String.fromCharCode(65 + idx)}.
                            </span>
                            <span>{opt.text}</span>
                          </div>
                          {isCorrect && (
                            <span className="text-xs font-semibold text-[#2E8F86] flex items-center gap-1">
                              ✓ Correct Answer
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Multiple Select Options */}
                {question.question_type === "MULTIPLE_SELECT" && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-text-secondary">Options:</p>
                    {(cur?.options || []).map((opt: any, idx: number) => {
                      const isCorrect = (cur?.answer_key?.correct_option_ids || []).includes(opt.id);
                      return (
                        <div
                          key={opt.id}
                          className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
                            isCorrect
                              ? "border-[#2E8F86] bg-[#2E8F86]/10 text-text-primary font-medium"
                              : "border-border bg-input text-text-secondary"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs">
                              {String.fromCharCode(65 + idx)}.
                            </span>
                            <span>{opt.text}</span>
                          </div>
                          {isCorrect && (
                            <span className="text-xs font-semibold text-[#2E8F86] flex items-center gap-1">
                              ✓ Correct Choice
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Numeric */}
                {question.question_type === "NUMERIC" && (
                  <div className="p-4 rounded-lg bg-input border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-secondary">Accepted Value:</span>
                      <span className="text-base font-bold font-mono text-text-primary">
                        {cur?.answer_key?.value}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">Tolerance (+/-):</span>
                      <span className="font-mono text-text-primary">{cur?.answer_key?.tolerance || 0}</span>
                    </div>
                  </div>
                )}

                {/* Short Answer */}
                {question.question_type === "SHORT_ANSWER" && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-input border border-border space-y-1">
                      <span className="text-xs font-semibold text-text-secondary">Evaluation Rubric:</span>
                      <p className="text-xs text-text-primary whitespace-pre-wrap">{cur?.answer_key?.rubric}</p>
                    </div>
                    {cur?.answer_key?.sample_answer && (
                      <div className="p-3 rounded-lg bg-input border border-border space-y-1">
                        <span className="text-xs font-semibold text-text-secondary">Sample Benchmark Answer:</span>
                        <p className="text-xs text-text-primary whitespace-pre-wrap">{cur?.answer_key?.sample_answer}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Coding Test Cases */}
                {question.question_type === "CODING" && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-text-secondary">Code Verification Test Cases:</p>
                    {(cur?.answer_key?.test_cases || []).map((tc: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-input border border-border space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold">
                            Test Case #{i + 1} {tc.is_hidden ? "(Hidden Verification)" : "(Public Example)"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 font-mono">
                          <div className="p-2 rounded bg-card border border-border">
                            <span className="text-[10px] uppercase text-text-secondary block">stdin</span>
                            <span>{tc.input}</span>
                          </div>
                          <div className="p-2 rounded bg-card border border-border">
                            <span className="text-[10px] uppercase text-text-secondary block">stdout</span>
                            <span>{tc.expected_output}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Explanation */}
                {cur?.explanation && (
                  <div className="p-3 rounded-lg bg-card border border-border space-y-1">
                    <span className="text-xs font-semibold text-text-secondary">Explanation & Mistake Feedback:</span>
                    <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">{cur?.explanation}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Metadata & Version History (1 col) */}
          <div className="space-y-6">
            {/* Version History Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <History className="w-4 h-4 text-primary" /> Version Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative pl-4 border-l-2 border-border space-y-4">
                  {versions.map((ver: any) => {
                    const isCurrent = ver.id === question.current_version_id;
                    return (
                      <div key={ver.id} className="relative">
                        <span
                          className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 ${
                            isCurrent
                              ? "bg-primary border-primary"
                              : "bg-background border-border"
                          }`}
                        />
                        <div className="text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-text-primary">
                              Version {ver.version_number} {isCurrent && "(Current)"}
                            </span>
                            <ReviewStatusBadge status={ver.review_status} />
                          </div>
                          <p className="text-text-secondary text-[11px]">
                            {ver.change_summary || "Revision updated"}
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] text-text-secondary font-mono">
                            <Calendar className="w-3 h-3" />
                            {new Date(ver.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Content Provenance Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Provenance & Licensing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <span className="text-text-secondary block">Source Type:</span>
                  <span className="font-semibold text-text-primary">{cur?.source_type}</span>
                </div>
                <div>
                  <span className="text-text-secondary block">License:</span>
                  <span className="font-semibold text-text-primary">{cur?.license_type}</span>
                </div>
                <div>
                  <span className="text-text-secondary block">Fingerprint (SHA-256):</span>
                  <span className="font-mono text-[10px] text-text-secondary break-all">
                    {cur?.fingerprint}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Answer Key Review Modal */}
      <AnswerKeyReviewModal
        isOpen={reviewModalOpen}
        questionId={question.id}
        versionId={cur?.id}
        currentStatus={cur?.review_status || "UNREVIEWED"}
        onClose={() => setReviewModalOpen(false)}
        onSuccess={loadQuestion}
      />
    </div>
  );
}
