"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandLoader } from "@/components/common/brand-loader";
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
import { AIGenerateQuestionModal } from "@/components/questions/ai-generate-question-modal";
import { CreateQuestionBankModal } from "@/components/questions/create-question-bank-modal";
import { BulkReviewModal } from "@/components/questions/bulk-review-modal";
import {
  Plus,
  Upload,
  Layers,
  Search,
  Filter,
  ShieldAlert,
  CheckCircle2,
  CheckCheck,
  Clock,
  BookOpen,
  ArrowRight,
  Send,
  Sparkles,
  FolderPlus,
  Trash2,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { TableSkeleton, QuestionBankSkeleton } from "@/components/ui/page-skeletons";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { toast } from "@/components/ui/dialog-system";

export default function QuestionsDashboardPage() {
  const router = useRouter();
  const { role, isPlatformAdmin, isLoading: isLoadingAuth, tenant } = useAuthContext();
  const [questions, setQuestions] = useState<any[]>([]);
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const canUseAIGeneration =
    isPlatformAdmin || (tenant?.entitlements ? tenant.entitlements["ai_question_generator"] !== false : true);
  const canUseCustomSets =
    isPlatformAdmin || (tenant?.entitlements ? tenant.entitlements["custom_question_sets"] !== false : true);

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
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Review Modal State
  const [reviewModalState, setReviewModalState] = useState<{
    isOpen: boolean;
    questionId: string;
    versionId: string;
    currentStatus: any;
    question?: any;
  }>({
    isOpen: false,
    questionId: "",
    versionId: "",
    currentStatus: "UNREVIEWED",
    question: null,
  });

  // Duplicate Modal State
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [createBankModalOpen, setCreateBankModalOpen] = useState(false);
  const [bulkReviewModalOpen, setBulkReviewModalOpen] = useState(false);
  const [eligibleReviewCount, setEligibleReviewCount] = useState<number>(0);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [banksError, setBanksError] = useState<string | null>(null);

  // Authoritative Server-Side Repository Stats
  const [repositoryStats, setRepositoryStats] = useState<{
    totalQuestions: number;
    verifiedKeys: number;
    pendingReview: number;
    published: number;
    archived: number;
  } | null>(null);

  // Delete All Questions Action State
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [deleteAllLoading, setDeleteAllLoading] = useState(false);

  // Load Banks
  const fetchBanks = async () => {
    setLoadingBanks(true);
    setBanksError(null);
    try {
      const res = await fetch("/api/questions/banks");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setBanksError(
          errData.error ||
          (res.status === 403
            ? "You do not have permission to view Question Banks."
            : "Failed to load Question Banks.")
        );
        return;
      }
      const data = await res.json();
      setBanks(data || []);
    } catch (err: any) {
      setBanksError(err.message || "Failed to load Question Banks.");
    } finally {
      setLoadingBanks(false);
    }
  };

  useEffect(() => {
    fetchBanks();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const bId = params.get("bankId");
      if (bId) {
        setSelectedBank(bId);
      }
    }
  }, []);

  // Fetch Questions
  const loadQuestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBank) params.set("bankId", selectedBank);
      if (selectedSubject) params.set("subject", selectedSubject);
      if (selectedType) params.set("questionType", selectedType);
      if (selectedStatus) params.set("lifecycleStatus", selectedStatus);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/questions?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || []);
        if (data.stats) {
          setRepositoryStats(data.stats);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("Failed to fetch questions", errData);
        setQuestions([]);
        toast.error(errData.error || "Failed to load questions from repository.");
      }
    } catch (err: any) {
      console.error("Failed to fetch questions", err);
      toast.error(err.message || "Failed to load questions from repository.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch Eligible Review Count
  const fetchEligibleReviewCount = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedBank) params.set("bankId", selectedBank);
      if (selectedSubject) params.set("subject", selectedSubject);
      if (selectedType) params.set("questionType", selectedType);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/questions/bulk-review?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEligibleReviewCount(data.eligibleCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch eligible review count", err);
    }
  };

  useEffect(() => {
    loadQuestions();
    fetchEligibleReviewCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBank, selectedSubject, selectedType, selectedStatus]);

  // Publish question action
  const handlePublish = async (questionId: string) => {
    try {
      const res = await fetch(`/api/questions/${questionId}/publish`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("Question published successfully.");
        loadQuestions();
      } else {
        const err = await res.json();
        toast.error(err.error || "Cannot publish question.");
      }
    } catch (err) {
      console.error("Publish error", err);
      toast.error("Failed to publish question.");
    }
  };

  // Delete draft question action
  const [questionToDelete, setQuestionToDelete] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleConfirmDeleteQuestion = async () => {
    if (!questionToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/questions/${questionToDelete.id}?action=DELETE`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setQuestionToDelete(null);
        toast.success(data.message || (data.archived ? "Question safely archived." : "Question deleted successfully."));
        loadQuestions();
        fetchEligibleReviewCount();
      } else {
        toast.error(data.error || "Failed to delete question.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete question.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmDeleteAllQuestions = async () => {
    setDeleteAllLoading(true);
    try {
      const res = await fetch("/api/questions/bulk-delete", {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setDeleteAllModalOpen(false);
        toast.success(data.message || `Successfully removed ${data.deletedCount || 0} question(s).`);
        loadQuestions();
        fetchEligibleReviewCount();
      } else {
        toast.error(data.error || "Failed to bulk-delete questions.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to bulk-delete questions.");
    } finally {
      setDeleteAllLoading(false);
    }
  };

  // KPIs: Authoritative server-side repository metrics with local fallback
  const totalCount = repositoryStats !== null ? repositoryStats.totalQuestions : questions.length;
  const verifiedCount =
    repositoryStats !== null
      ? repositoryStats.verifiedKeys
      : questions.filter((q) => q.current_version?.review_status === "VERIFIED_CORRECT").length;
  const pendingCount =
    repositoryStats !== null
      ? repositoryStats.pendingReview
      : questions.filter(
          (q) => q.lifecycle_status === "PENDING_REVIEW" || q.current_version?.review_status === "UNREVIEWED"
        ).length;
  const publishedCount =
    repositoryStats !== null
      ? repositoryStats.published
      : questions.filter((q) => q.lifecycle_status === "PUBLISHED").length;
  const distinctSubjects = Array.from(
    new Set(banks.map((b) => b.subject || b.name).filter(Boolean))
  ) as string[];

  if (isLoadingAuth || (loading && questions.length === 0)) {
    return <QuestionBankSkeleton />;
  }

  if (!canManageQuestions) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
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
            onClick={() => setBulkReviewModalOpen(true)}
            disabled={eligibleReviewCount === 0}
            className="flex items-center gap-1.5 text-xs text-[#2E8F86] border-[#2E8F86]/40 hover:bg-[#2E8F86]/10 disabled:opacity-50"
            title={
              eligibleReviewCount > 0
                ? `Review and accept all ${eligibleReviewCount} eligible unreviewed question(s)`
                : "No eligible unreviewed questions found in active filter scope"
            }
          >
            <CheckCheck className="w-4 h-4 text-[#2E8F86]" />
            Accept All ({eligibleReviewCount})
          </Button>

          <Button
            size="sm"
            onClick={() => setCreateBankModalOpen(true)}
            className="bg-primary hover:bg-primary-hover text-white flex items-center gap-1.5 text-xs font-semibold shadow-sm"
          >
            <FolderPlus className="w-4 h-4" />
            + Create Question Bank
          </Button>

          {canUseAIGeneration ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAiModalOpen(true)}
              className="flex items-center gap-1.5 text-xs text-[#5052C9] border-[#5052C9]/30 hover:bg-[#5052C9]/10"
            >
              <Sparkles className="w-4 h-4 text-[#5052C9]" />
              AI Generate
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled
              title="AI Question Generation is not included in the college's current subscription plan."
              className="flex items-center gap-1.5 text-xs opacity-50 cursor-not-allowed border-dashed text-text-secondary"
            >
              <Sparkles className="w-4 h-4 text-text-secondary" />
              AI Generate (Locked)
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDuplicateModalOpen(true)}
            className="flex items-center gap-1.5 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            <ShieldAlert className="w-4 h-4" />
            Duplicate Alerts
          </Button>

          {canUseCustomSets && (
            <Link href="/dashboard/questions/sets">
              <Button variant="outline" size="sm" className="flex items-center gap-1.5 text-xs">
                <Layers className="w-4 h-4" />
                Question Sets
              </Button>
            </Link>
          )}

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

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDeleteAllModalOpen(true)}
            disabled={totalCount === 0 && questions.length === 0}
            className="flex items-center gap-1.5 text-xs text-status-danger border-status-danger/30 hover:bg-[var(--color-danger-subtle)] hover:text-status-danger disabled:opacity-50"
            title="Delete or archive all questions belonging to your college"
          >
            <Trash2 className="w-4 h-4 text-status-danger" />
            Delete All Questions
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-text-secondary uppercase">Total Questions</span>
            <BookOpen className="w-4 h-4 text-primary shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-text-primary mt-1.5 sm:mt-2">{totalCount}</div>
          <span className="text-[11px] sm:text-xs text-text-secondary truncate block">Across college banks</span>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-text-secondary uppercase">Verified Keys</span>
            <CheckCircle2 className="w-4 h-4 text-[#2E8F86] shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[#2E8F86] mt-1.5 sm:mt-2">{verifiedCount}</div>
          <span className="text-[11px] sm:text-xs text-text-secondary truncate block">Staff verified</span>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-text-secondary uppercase">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-600 mt-1.5 sm:mt-2">{pendingCount}</div>
          <span className="text-[11px] sm:text-xs text-text-secondary truncate block">Awaiting answer verification</span>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold text-text-secondary uppercase">Published</span>
            <Send className="w-4 h-4 text-primary shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-primary mt-1.5 sm:mt-2">{publishedCount}</div>
          <span className="text-[11px] sm:text-xs text-text-secondary truncate block">Active for assessments</span>
        </Card>
      </div>

      {/* Filters Bar */}
      <Card className="p-3.5 sm:p-4">
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3">
          <div className="relative flex-1 w-full min-w-0">
            <Search className="w-4 h-4 absolute left-3 top-3 text-text-secondary" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  loadQuestions();
                  fetchEligibleReviewCount();
                }
              }}
              placeholder="Search prompts, keywords, topics..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto shrink-0">
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="h-9 px-3 rounded-md bg-input border border-border text-xs focus:outline-none flex-1 sm:flex-initial min-w-[120px]"
            >
              <option value="">All Subjects</option>
              {distinctSubjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>

            <select
              value={selectedBank}
              onChange={(e) => setSelectedBank(e.target.value)}
              className="h-9 px-3 rounded-md bg-input border border-border text-xs focus:outline-none flex-1 sm:flex-initial min-w-[140px]"
            >
              <option value="">All Question Banks</option>
              {banks
                .filter((b) => !selectedSubject || (b.subject || b.name) === selectedSubject)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.subject || b.category}
                  </option>
                ))}
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-9 px-3 rounded-md bg-input border border-border text-xs focus:outline-none flex-1 sm:flex-initial min-w-[120px]"
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
              className="h-9 px-3 rounded-md bg-input border border-border text-xs focus:outline-none flex-1 sm:flex-initial min-w-[120px]"
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
              className="text-xs h-9 w-full sm:w-auto font-medium"
              onClick={() => {
                loadQuestions();
                fetchEligibleReviewCount();
              }}
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
            <div className="p-4">
              <QuestionBankSkeleton />
            </div>
          ) : questions.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-text-secondary mx-auto opacity-40" />
              <p className="text-sm font-semibold text-text-primary">No Questions Found</p>
              <p className="text-xs text-text-secondary max-w-sm mx-auto">
                {banksError
                  ? `Note: ${banksError}`
                  : banks.length === 0 && !loadingBanks
                  ? "You don't have any Question Banks yet. Create a Question Bank first before authoring questions or importing CSV files."
                  : "No questions match your filter criteria or none have been authored yet."}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                {banksError ? (
                  <Button size="sm" variant="outline" className="text-xs" onClick={fetchBanks}>
                    Retry Loading Banks
                  </Button>
                ) : banks.length === 0 && !loadingBanks ? (
                  <Button
                    size="sm"
                    className="text-xs"
                    onClick={() => setCreateBankModalOpen(true)}
                  >
                    <FolderPlus className="w-3.5 h-3.5 mr-1" /> Create First Question Bank
                  </Button>
                ) : (
                  <Link href="/dashboard/questions/new">
                    <Button size="sm" className="text-xs">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Author First Question
                    </Button>
                  </Link>
                )}
              </div>
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
                        {q.bank && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-[#2E8F86]/10 text-[#2E8F86] border border-[#2E8F86]/20">
                            <BookOpen className="w-3 h-3 text-[#2E8F86]" />
                            {q.bank.subject || q.bank.name}
                          </span>
                        )}
                        {cur?.source_type === "AI_GENERATED" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            <Sparkles className="w-3 h-3 text-primary" /> AI Generated
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-card text-text-secondary border border-border">
                            College Authored
                          </span>
                        )}
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-card border border-border text-text-secondary">
                          v{cur?.version_number || 1}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-text-primary line-clamp-2">
                        {cur?.prompt || "No prompt available."}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
                        {q.bank && (
                          <span>Bank: <span className="font-medium text-text-primary">{q.bank.name}</span></span>
                        )}
                        {cur?.topic_tags && cur.topic_tags.length > 0 && (
                          <span>Topics: <span className="font-medium text-text-primary">{cur.topic_tags.join(", ")}</span></span>
                        )}
                        <span>•</span>
                        <span>Created: {new Date(q.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
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
                            question: {
                              prompt: cur?.prompt,
                              questionType: q.question_type,
                              options: cur?.options,
                              answerKey: cur?.answer_key,
                              explanation: cur?.explanation,
                              difficulty: cur?.difficulty,
                              sourceType: cur?.source_type,
                            },
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

                      {canManageQuestions && q.lifecycle_status !== "ARCHIVED" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setQuestionToDelete(q)}
                          className="h-8 w-8 p-0 text-text-muted hover:text-status-danger hover:bg-[var(--color-danger-subtle)]"
                          title="Delete question"
                          aria-label="Delete question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
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
        question={reviewModalState.question}
        onClose={() =>
          setReviewModalState({ ...reviewModalState, isOpen: false })
        }
        onSuccess={() => {
          loadQuestions();
          fetchEligibleReviewCount();
        }}
      />

      {/* Bulk Review & Accept All Modal */}
      <BulkReviewModal
        isOpen={bulkReviewModalOpen}
        onClose={() => setBulkReviewModalOpen(false)}
        onSuccess={() => {
          loadQuestions();
          fetchEligibleReviewCount();
        }}
        filters={{
          bankId: selectedBank || undefined,
          bankName: banks.find((b) => b.id === selectedBank)?.name,
          subject: selectedSubject || undefined,
          questionType: selectedType || undefined,
          search: searchQuery || undefined,
        }}
        eligibleCount={eligibleReviewCount}
      />

      {/* Duplicate Alert Modal */}
      <DuplicateAlertModal
        isOpen={duplicateModalOpen}
        onClose={() => setDuplicateModalOpen(false)}
      />

      {/* AI Question Intelligence Generator Modal */}
      <AIGenerateQuestionModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        banks={banks}
        onGeneratedSuccess={loadQuestions}
      />

      {/* Create Question Bank Modal */}
      <CreateQuestionBankModal
        isOpen={createBankModalOpen}
        onClose={() => setCreateBankModalOpen(false)}
        onSuccess={(newBank) => {
          fetchBanks();
          setSelectedBank(newBank.id);
          loadQuestions();
        }}
      />

      {/* Delete Question Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={!!questionToDelete}
        onOpenChange={(open: boolean) => {
          if (!open) setQuestionToDelete(null);
        }}
        onConfirm={handleConfirmDeleteQuestion}
        title="Delete Question"
        description="Are you sure you want to delete this question? Unreferenced questions will be permanently deleted from the repository. Questions referenced in blueprints or historical assessments will be safely retired to preserve audit integrity."
        confirmText="Delete Question"
        isLoading={deleteLoading}
      />

      {/* Delete All Questions Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteAllModalOpen}
        onOpenChange={setDeleteAllModalOpen}
        onConfirm={handleConfirmDeleteAllQuestions}
        title="Delete All Questions"
        description="Are you sure you want to delete all questions for your college workspace? Unreferenced questions will be permanently deleted from the repository. Questions referenced in blueprints, published assessments, or student attempt histories will be safely archived to protect historical records. This operation is irreversible for permanently deleted questions."
        confirmText="Delete All Questions"
        isLoading={deleteAllLoading}
      />
    </div>
  );
}
