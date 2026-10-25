"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  QuestionTypeBadge,
  DifficultyBadge,
  LifecycleStatusBadge,
  ReviewStatusBadge,
} from "@/components/questions/question-type-badge";
import { AnswerKeyReviewModal } from "@/components/questions/answer-key-review-modal";
import { DuplicateAlertModal } from "@/components/questions/duplicate-alert-modal";
import {
  Plus,
  Upload,
  Layers,
  Search,
  Filter,
  ShieldAlert,
  CheckCircle2,
  Clock,
  BookOpen,
  ArrowRight,
  Send,
  Loader2,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { TableSkeleton } from "@/components/ui/page-skeletons";

export default function QuestionsDashboardPage() {
  const router = useRouter();
  const { role, isPlatformAdmin, isLoading: isLoadingAuth } = useAuthContext();
  const [questions, setQuestions] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const canManageQuestions = isPlatformAdmin || (role && ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"].includes(role));

  useEffect(() => {
    if (!isLoadingAuth) {
      if (role === "STUDENT") {
        router.replace("/dashboard/student");
      } else if (!canManageQuestions) {
        router.replace("/auth/access-denied");
      }
    }
  }, [role, canManageQuestions, isLoadingAuth, router]);

  // Filters
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Review Modal State
  const [reviewModalState, setReviewModalState] = useState<{
    isOpen: boolean;
    questionId: string;
    versionId: string;
    currentStatus: any;
  }>({
    isOpen: false,
    questionId: "",
    versionId: "",
    currentStatus: "UNREVIEWED",
  });

  // Duplicate Modal State
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);

  // Load Banks
  useEffect(() => {
    async function fetchBanks() {
      try {
        const res = await fetch("/api/questions/banks");
        if (res.ok) {
          const data = await res.json();
          setBanks(data);
        }
      } catch (err) {
        console.error("Failed to load banks", err);
      }
    }
    fetchBanks();
  }, []);

  // Fetch Questions
  const loadQuestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBank) params.set("bankId", selectedBank);
      if (selectedType) params.set("questionType", selectedType);
      if (selectedStatus) params.set("lifecycleStatus", selectedStatus);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/questions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
      }
    } catch (err) {
      console.error("Failed to fetch questions", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBank, selectedType, selectedStatus]);

  // Publish question action
  const handlePublish = async (questionId: string) => {
    try {
      const res = await fetch(`/api/questions/${questionId}/publish`, {
        method: "POST",
      });
      if (res.ok) {
        loadQuestions();
      } else {
        const err = await res.json();
        alert(err.error || "Cannot publish question.");
      }
    } catch (err) {
      console.error("Publish error", err);
    }
  };

  // KPIs
  const totalCount = questions.length;
  const verifiedCount = questions.filter(
    (q) => q.current_version?.review_status === "VERIFIED_CORRECT"
  ).length;
  const pendingCount = questions.filter(
    (q) => q.lifecycle_status === "PENDING_REVIEW" || q.current_version?.review_status === "UNREVIEWED"
  ).length;
  const publishedCount = questions.filter((q) => q.lifecycle_status === "PUBLISHED").length;

  if (isLoadingAuth || (loading && questions.length === 0)) {
    return (
      <TableSkeleton
        title="Question Bank Sentinel"
        subtitle="Curated collection of verified technical, aptitude, and verbal questions with multi-version tracking and leak protection."
        columns={5}
        rows={7}
      />
    );
  }

  if (!canManageQuestions) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight font-display">
            QuestionBank Sentinel
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Authoritative, version-controlled question authoring, answer key review, and duplicate detection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDuplicateModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            <ShieldAlert className="w-4 h-4" />
            Duplicate Alerts
          </Button>

          <Link href="/dashboard/questions/sets">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs">
              <Layers className="w-4 h-4" />
              Question Sets
            </Button>
          </Link>

          <Link href="/dashboard/questions/import">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs">
              <Upload className="w-4 h-4" />
              Import CSV
            </Button>
          </Link>

          <Link href="/dashboard/questions/new">
            <Button
              size="sm"
              className="bg-primary hover:bg-primary-hover text-white flex items-center gap-1.5 text-xs"
            >
              <Plus className="w-4 h-4" />
              New Question
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary uppercase">Total Questions</span>
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-text-primary mt-2">{totalCount}</div>
          <span className="text-xs text-text-secondary">Across college banks</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary uppercase">Verified Keys</span>
            <CheckCircle2 className="w-4 h-4 text-[#2E8F86]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#2E8F86] mt-2">{verifiedCount}</div>
          <span className="text-xs text-text-secondary">Staff verified</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary uppercase">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 mt-2">{pendingCount}</div>
          <span className="text-xs text-text-secondary">Awaiting answer verification</span>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary uppercase">Published</span>
            <Send className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold font-mono text-primary mt-2">{publishedCount}</div>
          <span className="text-xs text-text-secondary">Active for assessments</span>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-3 text-text-secondary" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadQuestions()}
              placeholder="Search prompts, keywords, topics..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="h-9 px-3 rounded-md bg-input border border-border text-xs focus:outline-none"
            >
              <option value="">All Question Banks</option>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-9 px-3 rounded-md bg-input border border-border text-xs focus:outline-none"
            >
              <option value="">All Types</option>
              <option value="SINGLE_CHOICE">Single Choice</option>
              <option value="MULTIPLE_SELECT">Multi-Select</option>
              <option value="NUMERIC">Numeric</option>
              <option value="SHORT_ANSWER">Short Answer</option>
              <option value="CODING">Coding</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 px-3 rounded-md bg-input border border-border text-xs focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <Button
              variant="outline"
              size="sm"
              onClick={loadQuestions}
              className="text-xs h-9"
            >
              Apply
            </Button>
          </div>
        </div>
      </Card>

      {/* Questions Table / List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">Question Repository</CardTitle>
          <span className="text-xs font-mono text-text-secondary">
            {questions.length} items loaded
          </span>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-text-secondary">
              Loading question bank repository...
            </div>
          ) : questions.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-text-secondary mx-auto opacity-40" />
              <p className="text-sm font-semibold text-text-primary">No Questions Found</p>
              <p className="text-xs text-text-secondary max-w-sm mx-auto">
                No questions match your filter criteria or none have been authored yet.
              </p>
              <Link href="/dashboard/questions/new">
                <Button size="sm" className="text-xs mt-2">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Author First Question
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {questions.map((q) => {
                const cur = q.current_version;
                const canPublish =
                  cur?.review_status === "VERIFIED_CORRECT" &&
                  q.lifecycle_status !== "PUBLISHED";

                return (
                  <div
                    key={q.id}
                    className="p-4 hover:bg-card/50 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <QuestionTypeBadge type={q.question_type} />
                        {cur?.difficulty && <DifficultyBadge difficulty={cur.difficulty} />}
                        <LifecycleStatusBadge status={q.lifecycle_status} />
                        {cur?.review_status && <ReviewStatusBadge status={cur.review_status} />}
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-card border border-border text-text-secondary">
                          v{cur?.version_number || 1}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-text-primary line-clamp-2">
                        {cur?.prompt || "No prompt available."}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-text-secondary">
                        {cur?.topic_tags && cur.topic_tags.length > 0 && (
                          <span>Tags: {cur.topic_tags.slice(0, 3).join(", ")}</span>
                        )}
                        <span>•</span>
                        <span>Created: {new Date(q.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setReviewModalState({
                            isOpen: true,
                            questionId: q.id,
                            versionId: cur?.id,
                            currentStatus: cur?.review_status || "UNREVIEWED",
                          })
                        }
                        className="text-xs h-8"
                      >
                        Review Key
                      </Button>

                      {canPublish && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => handlePublish(q.id)}
                          className="text-xs h-8 bg-[#2E8F86] hover:bg-[#267870] text-white"
                        >
                          Publish
                        </Button>
                      )}

                      <Link href={`/dashboard/questions/${q.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs h-8 flex items-center gap-1">
                          Details <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Answer Key Review Modal */}
      <AnswerKeyReviewModal
        isOpen={reviewModalState.isOpen}
        questionId={reviewModalState.questionId}
        versionId={reviewModalState.versionId}
        currentStatus={reviewModalState.currentStatus}
        onClose={() =>
          setReviewModalState({ ...reviewModalState, isOpen: false })
        }
        onSuccess={loadQuestions}
      />

      {/* Duplicate Alert Modal */}
      <DuplicateAlertModal
        isOpen={duplicateModalOpen}
        onClose={() => setDuplicateModalOpen(false)}
      />
    </div>
  );
}
