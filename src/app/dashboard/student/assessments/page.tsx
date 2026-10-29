"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Clock,
  Award,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
  BookOpen,
  Send,
  MessageSquare,
  HelpCircle,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/dialog-system";

export default function StudentAssessmentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"ASSIGNED" | "PRACTICE" | "BEHAVIORAL">("ASSIGNED");

  // Assigned Assessments State
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [startingAttemptId, setStartingAttemptId] = useState<string | null>(null);

  // Practice Catalogue State
  const [catalogue, setCatalogue] = useState<any | null>(null);
  const [loadingCatalogue, setLoadingCatalogue] = useState(false);

  // Behavioral Draft State
  const [behavioralDrafts, setBehavioralDrafts] = useState<any[]>([]);
  const [behavioralPrompt, setBehavioralPrompt] = useState(
    "Describe a challenging technical project you worked on. How did you resolve an unexpected failure?"
  );
  const [behavioralCategory, setBehavioralCategory] = useState("HR_INTERVIEW");
  const [behavioralResponse, setBehavioralResponse] = useState("");
  const [selfReflection, setSelfReflection] = useState("");
  const [savingBehavioral, setSavingBehavioral] = useState(false);

  useEffect(() => {
    loadAssignedAssessments();
  }, []);

  useEffect(() => {
    if (activeTab === "PRACTICE" && !catalogue) {
      loadPracticeCatalogue();
    } else if (activeTab === "BEHAVIORAL" && behavioralDrafts.length === 0) {
      loadBehavioralDrafts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, catalogue, behavioralDrafts.length]);

  async function loadAssignedAssessments() {
    try {
      setLoadingAssignments(true);
      const res = await fetch("/api/student/assessments");
      if (res.ok) {
        const data = await res.json();
        setAssignments(data);
      }
    } catch {
      // Handled silently
    } finally {
      setLoadingAssignments(false);
    }
  }

  async function loadPracticeCatalogue() {
    try {
      setLoadingCatalogue(true);
      const res = await fetch("/api/student/practice/catalogue");
      if (res.ok) {
        const data = await res.json();
        setCatalogue(data);
      }
    } finally {
      setLoadingCatalogue(false);
    }
  }

  async function loadBehavioralDrafts() {
    try {
      const res = await fetch("/api/student/practice/behavioral");
      if (res.ok) {
        const data = await res.json();
        setBehavioralDrafts(data);
      }
    } catch {
      // Handled silently
    }
  }

  async function handleStartAssessment(assessmentId: string) {
    try {
      setStartingAttemptId(assessmentId);
      const res = await fetch(`/api/student/assessments/${assessmentId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Unable to start assessment.");
        return;
      }

      router.push(`/dashboard/student/assessments/${assessmentId}/take`);
    } catch (err: any) {
      toast.error(err.message || "Failed to start assessment.");
    } finally {
      setStartingAttemptId(null);
    }
  }

  async function handleSaveBehavioral(e: React.FormEvent) {
    e.preventDefault();
    if (!behavioralPrompt || !behavioralResponse) {
      toast.warning("Please provide both a prompt and your response.");
      return;
    }

    try {
      setSavingBehavioral(true);
      const res = await fetch("/api/student/practice/behavioral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: behavioralPrompt,
          category: behavioralCategory,
          response_text: behavioralResponse,
          self_reflection: selfReflection || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save draft");
      }

      setBehavioralResponse("");
      setSelfReflection("");
      loadBehavioralDrafts();
      toast.success("Behavioral reflection response saved successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save reflection.");
    } finally {
      setSavingBehavioral(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary font-heading">
              Student Preparation Hub
            </h1>
            <Badge variant="secondary">Candidate Workspace</Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Access assigned timed assessments, untimed topic drills, and structured behavioral & GD frameworks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">Back to Overview</Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-2 overflow-x-auto scrollbar-none max-w-full">
        <button
          onClick={() => setActiveTab("ASSIGNED")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeTab === "ASSIGNED"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Assigned Assessments ({assignments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("PRACTICE")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeTab === "PRACTICE"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Practice Drills & Topics</span>
        </button>

        <button
          onClick={() => setActiveTab("BEHAVIORAL")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeTab === "BEHAVIORAL"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>HR & Group Discussion Prep</span>
        </button>
      </div>

      {/* Tab 1: Assigned Assessments */}
      {activeTab === "ASSIGNED" && (
        <div className="space-y-6">
          {loadingAssignments ? (
            <div className="py-12 text-center text-text-muted">Loading assigned assessments...</div>
          ) : assignments.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <CheckCircle2 className="h-10 w-10 text-secondary mx-auto mb-3" />
                <h3 className="text-base font-semibold text-text-primary">All Clear!</h3>
                <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                  You have no pending assigned assessments scheduled right now. Explore the Practice Drills or HR Prep tabs to continue your preparation.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {assignments.map((item) => (
                <Card key={item.assignmentId} className="flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge
                        variant={
                          item.windowStatus === "OPEN"
                            ? "default"
                            : item.windowStatus === "UPCOMING"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {item.windowStatus}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {item.purpose}
                      </Badge>
                    </div>

                    <CardTitle className="text-base font-bold text-text-primary mt-2">
                      {item.title}
                    </CardTitle>
                    <CardDescription className="text-xs line-clamp-2">
                      {item.description || "Official placement assessment activity."}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    <div className="grid grid-cols-2 gap-2 text-xs text-text-secondary border-t border-border pt-3">
                      <div>
                        <span className="text-text-muted block text-[10px] uppercase font-mono">Duration</span>
                        <span className="font-medium text-text-primary">
                          {item.timeLimitMinutes ? `${item.timeLimitMinutes} mins` : "Untimed"}
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[10px] uppercase font-mono">Attempts</span>
                        <span className="font-medium text-text-primary">
                          {item.attemptsCount} / {item.allowedAttempts} taken
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[10px] uppercase font-mono">Pass Mark</span>
                        <span className="font-medium text-text-primary">{item.passPercentage}%</span>
                      </div>
                      <div>
                        <span className="text-text-muted block text-[10px] uppercase font-mono">Best Score</span>
                        <span className="font-medium text-text-primary">
                          {item.highestScore !== null ? `${item.highestScore}%` : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
                      {item.hasActiveAttempt ? (
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full text-xs"
                          asChild
                        >
                          <Link href={`/dashboard/student/assessments/${item.assessmentId}/take`}>
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Resume In-Progress Attempt
                          </Link>
                        </Button>
                      ) : item.canAttempt ? (
                        <Button
                          variant="primary"
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => handleStartAssessment(item.assessmentId)}
                          disabled={startingAttemptId === item.assessmentId}
                        >
                          <Play className="h-3.5 w-3.5 mr-1.5" />
                          {startingAttemptId === item.assessmentId
                            ? "Preparing Workspace..."
                            : item.attemptsCount > 0
                            ? `Retake Assessment (${item.attemptsCount + 1}/${item.allowedAttempts})`
                            : "Start Assessment"}
                        </Button>
                      ) : (
                        <div className="text-[11px] text-text-muted italic w-full text-center py-1">
                          {item.windowStatus === "UPCOMING"
                            ? `Window opens: ${new Date(item.windowStart).toLocaleString()}`
                            : item.windowStatus === "CLOSED"
                            ? "Assessment window has concluded"
                            : "Maximum attempts reached"}
                        </div>
                      )}

                      {item.latestAttempt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-xs text-text-secondary"
                          asChild
                        >
                          <Link href={`/dashboard/student/attempts/${item.latestAttempt.id}/review`}>
                            <Award className="h-3.5 w-3.5 mr-1.5 text-secondary" /> View Attempt Review
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Practice Drills & Topics */}
      {activeTab === "PRACTICE" && (
        <div className="space-y-6">
          {loadingCatalogue ? (
            <div className="py-12 text-center text-text-muted">Loading practice catalogue...</div>
          ) : !catalogue ? (
            <div className="py-12 text-center text-text-muted">Catalogue unavailable.</div>
          ) : (
            <>
              {/* Question Sets */}
              <div>
                <h3 className="text-base font-bold text-text-primary font-heading mb-3">
                  Self-Paced Practice Question Sets
                </h3>
                {catalogue.practiceSets.length === 0 ? (
                  <p className="text-xs text-text-muted">No published practice sets available right now.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {catalogue.practiceSets.map((ps: any) => (
                      <Card key={ps.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary" className="text-[10px]">{ps.purpose}</Badge>
                            <span className="text-xs text-text-muted font-mono">{ps.questionCount} questions</span>
                          </div>
                          <CardTitle className="text-sm font-bold mt-2">{ps.name}</CardTitle>
                          <CardDescription className="text-xs">{ps.description || "Untimed practice drill"}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                            <Link href="/dashboard/questions">Open Question Bank Explorer</Link>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* Canonical Skills */}
              <div className="border-t border-border pt-6">
                <h3 className="text-base font-bold text-text-primary font-heading mb-3">
                  Canonical Skill Drills
                </h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {catalogue.skills.map((skill: any) => (
                    <Card key={skill.id} className="p-4">
                      <span className="text-[10px] font-mono text-secondary uppercase block">{skill.category}</span>
                      <h4 className="text-sm font-semibold text-text-primary mt-1">{skill.name}</h4>
                      <p className="text-[11px] text-text-muted line-clamp-2 mt-1">{skill.description || "Core placement preparation topic."}</p>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 3: HR & Group Discussion Prep */}
      {activeTab === "BEHAVIORAL" && (
        <div className="space-y-8">
          {/* STAR Framework Explanation */}
          <Card className="border-secondary/30 bg-[rgba(46,143,134,0.03)]">
            <CardHeader>
              <CardTitle className="text-base font-bold text-text-primary flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-secondary" /> The STAR Method for Behavioral Interviews
              </CardTitle>
              <CardDescription className="text-xs">
                Master candidate storytelling for HR, managerial, and situational interview rounds.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                <div className="p-3 bg-card rounded-md border border-border">
                  <span className="font-bold text-secondary font-mono text-sm block">S - Situation</span>
                  <p className="text-text-secondary mt-1">Set the context. What project, team, or challenge were you facing?</p>
                </div>
                <div className="p-3 bg-card rounded-md border border-border">
                  <span className="font-bold text-secondary font-mono text-sm block">T - Task</span>
                  <p className="text-text-secondary mt-1">Define your exact role and the target objective you had to achieve.</p>
                </div>
                <div className="p-3 bg-card rounded-md border border-border">
                  <span className="font-bold text-secondary font-mono text-sm block">A - Action</span>
                  <p className="text-text-secondary mt-1">Highlight specific steps, leadership, tools, and technical decisions you made.</p>
                </div>
                <div className="p-3 bg-card rounded-md border border-border">
                  <span className="font-bold text-secondary font-mono text-sm block">R - Result</span>
                  <p className="text-text-secondary mt-1">Quantify outcomes: performance gains, delivery on time, or key learnings.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Group Discussion Strategy Guide */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold text-text-primary flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Campus Group Discussion (GD) Tactics
              </CardTitle>
              <CardDescription className="text-xs">
                Strategies for active consensus-building, professional etiquette, and constructive rebuttals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-text-secondary">
              <div className="flex gap-2">
                <span className="font-bold text-primary min-w-[120px]">Opening the Topic:</span>
                <p>Only initiate if confident in the theme. Define key parameters to structure discussion; do not dominate.</p>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary min-w-[120px]">Constructive Rebuttal:</span>
                <p>Acknowledge first: &quot;I appreciate your point regarding X; however, we must also consider factor Y...&quot;</p>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary min-w-[120px]">Managing Clutter:</span>
                <p>If participants talk over one another, intervene calmly: &quot;Friends, let us hear each other out one by one.&quot;</p>
              </div>
              <div className="flex gap-2">
                <span className="font-bold text-primary min-w-[120px]">Summary & Close:</span>
                <p>Summarize both viewpoints objectively without introducing new claims in the final round.</p>
              </div>
            </CardContent>
          </Card>

          {/* Interactive Draft Builder */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold text-text-primary">
                Draft a Structured Response
              </CardTitle>
              <CardDescription className="text-xs">
                Practice formulating your STAR stories. Your drafts remain private to your student account for revision.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveBehavioral} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <Label htmlFor="prompt" className="text-xs font-medium">Interview Question / Situation Prompt</Label>
                    <Input
                      id="prompt"
                      value={behavioralPrompt}
                      onChange={(e) => setBehavioralPrompt(e.target.value)}
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="cat" className="text-xs font-medium">Category</Label>
                    <select
                      id="cat"
                      value={behavioralCategory}
                      onChange={(e) => setBehavioralCategory(e.target.value)}
                      className="w-full mt-1 border border-border rounded-md px-3 py-2 text-sm bg-input text-text-primary"
                    >
                      <option value="HR_INTERVIEW">HR Interview</option>
                      <option value="GROUP_DISCUSSION">Group Discussion</option>
                      <option value="SITUATIONAL">Situational</option>
                    </select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="resp" className="text-xs font-medium">Structured Response (STAR Format)</Label>
                  <Textarea
                    id="resp"
                    rows={4}
                    value={behavioralResponse}
                    onChange={(e) => setBehavioralResponse(e.target.value)}
                    placeholder="Situation: ... Task: ... Action: ... Result: ..."
                    className="mt-1 font-sans text-xs"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="refl" className="text-xs font-medium">Self-Reflection & Key Learnings (Optional)</Label>
                  <Input
                    id="refl"
                    value={selfReflection}
                    onChange={(e) => setSelfReflection(e.target.value)}
                    placeholder="e.g. Needs clearer metrics on project turnaround time"
                    className="mt-1 text-xs"
                  />
                </div>

                <div className="flex justify-end">
                  <Button type="submit" variant="primary" size="sm" disabled={savingBehavioral}>
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    {savingBehavioral ? "Saving..." : "Save Response Draft"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Saved Drafts List */}
          {behavioralDrafts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-bold text-text-primary font-heading">
                Your Saved Interview Drafts ({behavioralDrafts.length})
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                {behavioralDrafts.map((draft) => (
                  <Card key={draft.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] font-mono">{draft.category}</Badge>
                      <span className="text-[10px] text-text-muted">{new Date(draft.created_at).toLocaleDateString()}</span>
                    </div>
                    <h4 className="text-xs font-semibold text-text-primary">{draft.prompt}</h4>
                    <p className="text-xs text-text-secondary whitespace-pre-wrap bg-input p-2 rounded border border-border">
                      {draft.response_text}
                    </p>
                    {draft.self_reflection && (
                      <p className="text-[11px] text-secondary italic">
                        Reflection: {draft.self_reflection}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
