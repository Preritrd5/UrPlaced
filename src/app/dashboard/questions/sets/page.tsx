"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuestionSetPurpose } from "@/types/database";
import { AutoBuildSetModal } from "@/components/questions/auto-build-set-modal";
import { BulkAddQuestionsModal } from "@/components/questions/bulk-add-questions-modal";
import {
  ArrowLeft,
  Plus,
  Layers,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Calendar,
  X,
  Send,
  Trash2,
  Wand2,
} from "lucide-react";
import { BrandLoader } from "@/components/common/brand-loader";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { TableSkeleton, QuestionBankSkeleton } from "@/components/ui/page-skeletons";
import { SkeletonCard } from "@/components/ui/skeleton";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { toast, confirmDialog } from "@/components/ui/dialog-system";

export default function QuestionSetsPage() {
  const router = useRouter();
  const { role, isPlatformAdmin, isLoading: isLoadingAuth } = useAuthContext();
  const [sets, setSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [activeSetDetail, setActiveSetDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [setName, setSetName] = useState("");
  const [setDescription, setSetDescription] = useState("");
  const [setPurpose, setSetPurpose] = useState<QuestionSetPurpose>("ASSESSMENT");
  const [createLoading, setCreateLoading] = useState(false);

  // Auto-Build and Bulk Add Modals
  const [autoBuildModalOpen, setAutoBuildModalOpen] = useState(false);
  const [bulkAddModalOpen, setBulkAddModalOpen] = useState(false);
  const [banks, setBanks] = useState<any[]>([]);

  // Available Questions for Adding
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [points, setPoints] = useState("1.0");

  // Delete Set & Remove Item State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);

  const loadSets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/questions/sets");
      if (res.ok) {
        const data = await res.json();
        setSets(data);
        if (data.length > 0 && !activeSetId) {
          setActiveSetId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSetDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/questions/sets/${id}`);
      if (res.ok) {
        const data = await res.json();
        setActiveSetDetail(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadAvailableQuestions = async () => {
    try {
      const res = await fetch("/api/questions?limit=100");
      if (res.ok) {
        const data = await res.json();
        // Invariant: Question must BOTH have verified answer key AND approved/published lifecycle
        const eligible = (data.questions || []).filter(
          (q: any) =>
            q.current_version?.review_status === "VERIFIED_CORRECT" &&
            ["APPROVED", "PUBLISHED"].includes(q.lifecycle_status)
        );
        setAvailableQuestions(eligible);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadBanks = async () => {
    try {
      const res = await fetch("/api/questions/banks");
      if (res.ok) {
        const data = await res.json();
        setBanks(data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSets();
    loadAvailableQuestions();
    loadBanks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeSetId) {
      loadSetDetail(activeSetId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSetId]);

  const handleCreateSet = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);

    try {
      const res = await fetch("/api/questions/sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: setName,
          description: setDescription,
          purpose: setPurpose,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setCreateModalOpen(false);
        setSetName("");
        setSetDescription("");
        loadSets();
        setActiveSetId(data.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSetId || !selectedQuestionId) return;

    try {
      const res = await fetch(`/api/questions/sets/${activeSetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_ITEMS",
          items: [
            {
              question_id: selectedQuestionId,
              points: parseFloat(points) || 1.0,
            },
          ],
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSelectedQuestionId("");
        toast.success("Question added to set.");
        loadSetDetail(activeSetId);
      } else {
        toast.error(data.error || "Failed to add question to set.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to add question to set.");
    }
  };

  const handleLockAndPublish = async () => {
    if (!activeSetId) return;
    const confirmed = await confirmDialog({
      title: "Freeze & Publish Question Set",
      description: "Freeze and publish this question set as an immutable snapshot for assessment execution? Once locked, questions cannot be removed.",
      confirmText: "Freeze & Publish",
      variant: "primary",
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/questions/sets/${activeSetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "LOCK_AND_PUBLISH" }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Question set frozen and published successfully.");
        loadSets();
        loadSetDetail(activeSetId);
      } else {
        toast.error(data.error || "Failed to publish set.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to publish set.");
    }
  };

  const handleConfirmDeleteSet = async () => {
    if (!activeSetId) return;
    setDeleteLoading(true);

    try {
      const res = await fetch(`/api/questions/sets/${activeSetId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok) {
        setDeleteModalOpen(false);
        setActiveSetDetail(null);
        toast.success(data.message || (data.archived ? "Question set safely retired and archived." : "Question set deleted successfully."));
        const remainingSets = sets.filter((s) => s.id !== activeSetId);
        setSets(remainingSets);
        setActiveSetId(remainingSets.length > 0 ? remainingSets[0].id : null);
        loadSets();
      } else {
        toast.error(data.error || "Failed to delete question set.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete question set.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!activeSetId) return;
    setRemovingItemId(itemId);

    try {
      const res = await fetch(`/api/questions/sets/${activeSetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REMOVE_ITEM", itemId }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success("Question removed from set.");
        loadSetDetail(activeSetId);
        loadAvailableQuestions();
      } else {
        toast.error(data.error || "Failed to remove question from set.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to remove question from set.");
    } finally {
      setRemovingItemId(null);
    }
  };

  if (isLoadingAuth || (loading && sets.length === 0)) {
    return <QuestionBankSkeleton />;
  }

  if (!canManageQuestions) {
    return null;
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/questions"
            className="p-2 rounded-md hover:bg-card text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight font-display flex items-center gap-2">
              <Layers className="w-6 h-6 text-primary" />
              Question Sets & Assessment Blueprints
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Assemble versioned question bundles and freeze them into reproducible assessment snapshots.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => setAutoBuildModalOpen(true)}
            size="sm"
            variant="outline"
            className="flex items-center gap-1.5 text-xs text-primary border-primary/30 hover:bg-primary/10 font-semibold"
          >
            <Wand2 className="w-4 h-4 text-primary" /> Auto-Build Question Set
          </Button>

          {activeSetDetail?.set && !activeSetDetail.set.is_locked && (
            <Button
              type="button"
              onClick={() => setBulkAddModalOpen(true)}
              size="sm"
              variant="outline"
              className="flex items-center gap-1.5 text-xs text-[#2E8F86] border-[#2E8F86]/40 hover:bg-[#2E8F86]/10 font-semibold"
            >
              <Plus className="w-4 h-4 text-[#2E8F86]" /> Bulk Add Questions
            </Button>
          )}

          <Button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            size="sm"
            className="bg-primary hover:bg-primary-hover text-white flex items-center gap-1.5 text-xs"
          >
            <Plus className="w-4 h-4" /> New Question Set
          </Button>
        </div>
      </div>

      {/* Main Grid: Left sets list, Right active set inspector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sets List (1 col) */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Question Sets ({sets.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border">
            {loading ? (
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <SkeletonCard key={i} className="h-16" />
                ))}
              </div>
            ) : sets.length === 0 ? (
              <p className="p-4 text-xs text-text-secondary">No question sets found. Create your first set.</p>
            ) : (
              sets.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setActiveSetId(s.id)}
                  className={`p-3 text-xs cursor-pointer transition-colors ${
                    activeSetId === s.id ? "bg-primary/10 border-l-4 border-primary" : "hover:bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-text-primary line-clamp-1">{s.name}</span>
                    <Badge variant={s.status === "PUBLISHED" ? "secondary" : "outline"}>
                      {s.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-text-secondary text-[11px]">
                    <span>Purpose: {s.purpose}</span>
                    <span className="flex items-center gap-1">
                      {s.is_locked ? <Lock className="w-3 h-3 text-[#2E8F86]" /> : <Unlock className="w-3 h-3 text-amber-500" />}
                      v{s.version_number}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Set Details & Item Builder (2 cols) */}
        <div className="md:col-span-2 space-y-6">
          {detailLoading ? (
            <Card className="p-6">
              <QuestionBankSkeleton />
            </Card>
          ) : !activeSetDetail?.set ? (
            <Card className="p-8 text-center text-sm text-text-secondary">
              Select or create a question set to manage questions.
            </Card>
          ) : (
            <>
              {/* Set Info Header Card */}
              <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-text-primary font-display">
                        {activeSetDetail.set.name}
                      </h2>
                      <Badge variant={activeSetDetail.set.status === "PUBLISHED" ? "secondary" : "outline"}>
                        {activeSetDetail.set.status}
                      </Badge>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-card border border-border">
                        Snapshot v{activeSetDetail.set.version_number}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary">
                      {activeSetDetail.set.description || "No description provided."}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {canManageQuestions && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteModalOpen(true)}
                        className="text-xs h-8 text-status-danger hover:bg-[var(--color-danger-subtle)] hover:text-status-danger flex items-center gap-1.5"
                        title={activeSetDetail.set.is_locked || activeSetDetail.set.status === "PUBLISHED" ? "Retire Question Set" : "Delete Question Set"}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> {activeSetDetail.set.is_locked || activeSetDetail.set.status === "PUBLISHED" ? "Retire Set" : "Delete Set"}
                      </Button>
                    )}
                    {!activeSetDetail.set.is_locked && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={handleLockAndPublish}
                        disabled={activeSetDetail.items.length === 0}
                        className="bg-[#2E8F86] hover:bg-[#267870] text-white text-xs flex items-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5" /> Lock & Publish Snapshot
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-xs text-text-secondary border-t border-border pt-3">
                    <span>Purpose: <strong>{activeSetDetail.set.purpose}</strong></span>
                    <span>•</span>
                    <span>Total Questions: <strong>{activeSetDetail.items.length}</strong></span>
                    <span>•</span>
                    <span>
                      Total Score:{" "}
                      <strong>
                        {activeSetDetail.items.reduce((acc: number, item: any) => acc + (parseFloat(item.points) || 0), 0)} pts
                      </strong>
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Add Question to Set Form (if not locked) */}
              {!activeSetDetail.set.is_locked && (
                <Card>
                  <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3">
                    <div>
                      <CardTitle className="text-sm font-semibold">Assemble Questions</CardTitle>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Build with Auto-Build, Bulk Add across banks, or individual addition.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setAutoBuildModalOpen(true)}
                        className="text-xs h-7 text-primary border-primary/30 hover:bg-primary/10 font-semibold flex items-center gap-1"
                      >
                        <Wand2 className="w-3.5 h-3.5" /> Auto-Build
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setBulkAddModalOpen(true)}
                        className="text-xs h-7 text-[#2E8F86] border-[#2E8F86]/30 hover:bg-[#2E8F86]/10 font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Bulk Add
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="border-t border-border pt-3">
                      <p className="text-xs font-semibold text-text-secondary mb-2">
                        Quick Add Single Question:
                      </p>
                      {availableQuestions.length === 0 ? (
                        <div className="p-3.5 rounded-md bg-amber-50 text-amber-800 text-xs border border-amber-200 space-y-1">
                          <p className="font-semibold">No verified questions available to add.</p>
                          <p>
                            Only questions with a verified answer key (<span className="font-mono font-semibold">VERIFIED_CORRECT</span>) and an approved or published lifecycle status can be added to Question Sets.{" "}
                            <Link href="/dashboard/questions" className="font-semibold underline text-[#5052C9]">
                              Review questions in QuestionBank Sentinel
                            </Link>
                          </p>
                        </div>
                      ) : (
                        <form onSubmit={handleAddItem} className="flex flex-col md:flex-row gap-3">
                          <select
                            value={selectedQuestionId}
                            onChange={(e) => setSelectedQuestionId(e.target.value)}
                            className="flex-1 h-9 px-3 rounded-md bg-input border border-border text-xs focus:outline-none"
                            required
                          >
                            <option value="">Select a verified question to add...</option>
                            {availableQuestions.map((q) => (
                              <option key={q.id} value={q.id}>
                                [{q.question_type}] {q.current_version?.prompt?.slice(0, 70)}...
                              </option>
                            ))}
                          </select>

                          <div className="w-24">
                            <Input
                              type="number"
                              step="0.5"
                              min="0.5"
                              value={points}
                              onChange={(e) => setPoints(e.target.value)}
                              placeholder="Points"
                              className="h-9 text-xs"
                              required
                            />
                          </div>

                          <Button
                            type="submit"
                            disabled={!selectedQuestionId}
                            className="bg-primary hover:bg-primary-hover text-white text-xs h-9 px-4 shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add
                          </Button>
                        </form>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Items List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">Included Questions Sequence</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {activeSetDetail.items.length === 0 ? (
                    <p className="p-6 text-center text-xs text-text-secondary">
                      No questions attached to this set yet. Add questions above to build your blueprint.
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {activeSetDetail.items.map((item: any, idx: number) => (
                        <div key={item.id} className="p-3.5 text-xs flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <span className="font-mono font-bold text-text-secondary w-6">
                              #{item.sequence_order || idx + 1}
                            </span>
                            <div className="space-y-0.5 min-w-0">
                              <p className="font-medium text-text-primary line-clamp-1">
                                {item.version?.prompt || "No prompt content"}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                                <span className="font-mono">Type: {item.question?.question_type}</span>
                                <span>•</span>
                                <span className="font-mono">v{item.version?.version_number} (Immutable)</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono font-bold text-primary">
                              {item.points} pts
                            </span>
                            {!activeSetDetail.set.is_locked && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(item.id)}
                                disabled={removingItemId === item.id}
                                className="h-7 w-7 p-0 text-text-muted hover:text-status-danger hover:bg-[var(--color-danger-subtle)]"
                                title="Remove question from set"
                                aria-label={`Remove question #${item.sequence_order || idx + 1} from set`}
                              >
                                {removingItemId === item.id ? (
                                  <BrandLoader size="button" />
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Create Set Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-hidden">
          <div className="bg-card w-full max-w-md min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden rounded-xl shadow-2xl border border-border">
            <div className="flex items-center justify-between border-b border-border p-4 sm:p-6 pb-3 shrink-0">
              <h3 className="text-base font-bold text-text-primary">Create Question Set</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSet} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pr-3 sm:pr-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Set Title *
                  </label>
                  <Input
                    value={setName}
                    onChange={(e) => setSetName(e.target.value)}
                    placeholder="e.g. TCS Ninja Diagnostic Assessment A"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Purpose *
                  </label>
                  <select
                    value={setPurpose}
                    onChange={(e) => setSetPurpose(e.target.value as QuestionSetPurpose)}
                    className="w-full h-10 px-3 rounded-md bg-input border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="ASSESSMENT">Assessment / Exam</option>
                    <option value="PRACTICE">Self-Paced Practice</option>
                    <option value="DIAGNOSTIC">Diagnostic Baseline</option>
                    <option value="COMPANY_PREP">Company-Specific Prep</option>
                    <option value="INTERVIEW">Technical Interview Drill</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Description
                  </label>
                  <textarea
                    value={setDescription}
                    onChange={(e) => setSetDescription(e.target.value)}
                    placeholder="Target cohort, difficulty calibration, duration guidance..."
                    rows={3}
                    className="w-full p-2.5 rounded-md bg-input border border-border text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="shrink-0 p-3.5 sm:p-4 border-t border-border bg-surface/50 flex items-center justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createLoading || !setName}
                  className="bg-primary hover:bg-primary-hover text-white text-xs font-semibold"
                >
                  {createLoading ? "Creating..." : "Create Set"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Retire Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleConfirmDeleteSet}
        title={activeSetDetail?.set?.is_locked || activeSetDetail?.set?.status === "PUBLISHED" ? "Retire Question Set" : "Delete Question Set"}
        description={
          activeSetDetail?.set?.is_locked || activeSetDetail?.set?.status === "PUBLISHED"
            ? `Are you sure you want to retire "${activeSetDetail?.set?.name}"? Published question set snapshots will be archived from active blueprints to protect existing assessments and candidate audit history.`
            : `Are you sure you want to delete the question set "${activeSetDetail?.set?.name}"? All question associations within this draft set will be permanently removed. This action cannot be undone.`
        }
        confirmText={activeSetDetail?.set?.is_locked || activeSetDetail?.set?.status === "PUBLISHED" ? "Retire Question Set" : "Delete Question Set"}
        isLoading={deleteLoading}
      />

      {/* Auto-Build Question Set Modal */}
      <AutoBuildSetModal
        isOpen={autoBuildModalOpen}
        onClose={() => setAutoBuildModalOpen(false)}
        onSuccess={(targetSetId) => {
          loadSets();
          setActiveSetId(targetSetId);
          loadSetDetail(targetSetId);
          loadAvailableQuestions();
        }}
        banks={banks}
        currentSet={activeSetDetail?.set}
      />

      {/* Bulk Add Questions Modal */}
      {activeSetDetail?.set && (
        <BulkAddQuestionsModal
          isOpen={bulkAddModalOpen}
          onClose={() => setBulkAddModalOpen(false)}
          onSuccess={(targetSetId) => {
            loadSets();
            loadSetDetail(targetSetId);
            loadAvailableQuestions();
          }}
          targetSet={activeSetDetail.set}
          banks={banks}
        />
      )}
    </div>
  );
}
