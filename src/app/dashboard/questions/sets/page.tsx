"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuestionSetPurpose } from "@/types/database";
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
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { TableSkeleton } from "@/components/ui/page-skeletons";

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

  // Available Questions for Adding
  const [availableQuestions, setAvailableQuestions] = useState<any[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [points, setPoints] = useState("1.0");

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
        setAvailableQuestions(data.questions || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadSets();
    loadAvailableQuestions();
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

      if (res.ok) {
        setSelectedQuestionId("");
        loadSetDetail(activeSetId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLockAndPublish = async () => {
    if (!activeSetId) return;
    if (!confirm("Freeze and publish this question set as an immutable snapshot for assessment execution?")) {
      return;
    }

    try {
      const res = await fetch(`/api/questions/sets/${activeSetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "LOCK_AND_PUBLISH" }),
      });

      const data = await res.json();
      if (res.ok) {
        loadSets();
        loadSetDetail(activeSetId);
      } else {
        alert(data.error || "Failed to publish set.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoadingAuth || (loading && sets.length === 0)) {
    return (
      <TableSkeleton
        title="Question Sets & Blueprints"
        subtitle="Manage curated assessment question sets, purpose tags, and blueprint balance."
        columns={4}
        rows={6}
      />
    );
  }

  if (!canManageQuestions) {
    return null;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
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

        <Button
          onClick={() => setCreateModalOpen(true)}
          size="sm"
          className="bg-primary hover:bg-primary-hover text-white flex items-center gap-1.5 text-xs"
        >
          <Plus className="w-4 h-4" /> New Question Set
        </Button>
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
              <p className="p-4 text-xs text-text-secondary">Loading question sets...</p>
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
            <Card className="p-8 text-center text-sm text-text-secondary">
              Loading set details and questions...
            </Card>
          ) : !activeSetDetail?.set ? (
            <Card className="p-8 text-center text-sm text-text-secondary">
              Select or create a question set to manage questions.
            </Card>
          ) : (
            <>
              {/* Set Info Header Card */}
              <Card>
                <CardHeader className="flex flex-row items-start justify-between">
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
                  <CardHeader>
                    <CardTitle className="text-sm font-semibold">Add Question from Repository</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleAddItem} className="flex flex-col md:flex-row gap-3">
                      <select
                        value={selectedQuestionId}
                        onChange={(e) => setSelectedQuestionId(e.target.value)}
                        className="flex-1 h-9 px-3 rounded-md bg-input border border-border text-xs focus:outline-none"
                        required
                      >
                        <option value="">Select a question to add...</option>
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
                          <span className="font-mono font-bold text-primary shrink-0">
                            {item.points} pts
                          </span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-base font-bold text-text-primary">Create Question Set</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-text-secondary hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSet} className="space-y-4">
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

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
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
    </div>
  );
}
