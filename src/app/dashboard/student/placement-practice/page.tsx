"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Timer,
  Award,
  Filter,
  Layers,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Play,
  Flag,
  HelpCircle,
  Compass,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/dialog-system";
import {
  PracticeCategory,
  PracticeDifficulty,
  PracticeMode,
  ClientPracticeQuestion,
  PracticeAttemptSummary,
} from "@/modules/students/services/placement-practice-service";

interface PracticeCategoryInfo {
  id: PracticeCategory;
  name: string;
  description: string;
  topics: string[];
}

export default function PlacementPracticePage() {
  const [loading, setLoading] = React.useState(true);
  const [summary, setSummary] = React.useState<PracticeAttemptSummary | null>(null);
  const [categories, setCategories] = React.useState<PracticeCategoryInfo[]>([]);
  const [activeTab, setActiveTab] = React.useState<"OVERVIEW" | "PRACTICE_MODE" | "REVISION">("OVERVIEW");

  // Practice Configuration State
  const [selectedCategory, setSelectedCategory] = React.useState<PracticeCategory>("QUANTITATIVE_APTITUDE");
  const [selectedTopic, setSelectedTopic] = React.useState<string>("Percentages");
  const [selectedDifficulty, setSelectedDifficulty] = React.useState<PracticeDifficulty>("INTERMEDIATE");
  const [selectedMode, setSelectedMode] = React.useState<PracticeMode>("TOPIC_PRACTICE");
  const [questionCount, setQuestionCount] = React.useState<number>(5);
  const [timeLimitMinutes, setTimeLimitMinutes] = React.useState<number>(10);

  // Active Practice Session State
  const [isPracticing, setIsPracticing] = React.useState(false);
  const [attemptId, setAttemptId] = React.useState<string | null>(null);
  const [questions, setQuestions] = React.useState<ClientPracticeQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, string[]>>({});
  const [markedForReview, setMarkedForReview] = React.useState<Record<string, boolean>>({});
  const [secondsRemaining, setSecondsRemaining] = React.useState<number | null>(null);
  const [sessionStartTime, setSessionStartTime] = React.useState<number>(0);

  // Evaluation Result State
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [resultsData, setResultsData] = React.useState<any | null>(null);

  // Revision state
  const [revisionQuestions, setRevisionQuestions] = React.useState<any[]>([]);

  // Load Dashboard Overview
  const loadDashboard = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/student/placement-practice");
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setSummary(json.data.summary);
          setCategories(json.data.categories || []);
          if (json.data.categories?.length > 0) {
            setSelectedCategory(json.data.categories[0].id);
            setSelectedTopic(json.data.categories[0].topics[0]);
          }
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Load Revision Questions
  const loadRevision = async () => {
    try {
      const res = await fetch("/api/student/placement-practice/revision");
      if (res.ok) {
        const json = await res.json();
        setRevisionQuestions(json.data || []);
      }
    } catch {
      // Fallback
    }
  };

  // Timer countdown
  const handleCompleteSessionRef = React.useRef<() => Promise<void>>(() => Promise.resolve());
  React.useEffect(() => {
    handleCompleteSessionRef.current = handleCompleteSession;
  });

  React.useEffect(() => {
    if (!isPracticing || secondsRemaining === null || secondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          handleCompleteSessionRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isPracticing, secondsRemaining]);

  // Start a new practice attempt
  const handleStartPractice = async (mode: PracticeMode, cat?: PracticeCategory, top?: string) => {
    try {
      setIsPracticing(true);
      setLoading(true);
      setResultsData(null);
      setCurrentQIndex(0);
      setAnswers({});
      setMarkedForReview({});

      const reqCategory = cat || selectedCategory;
      const reqTopic = top || selectedTopic;

      const res = await fetch("/api/student/placement-practice/attempt/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practiceMode: mode,
          category: reqCategory,
          topic: reqTopic,
          difficulty: selectedDifficulty,
          questionCount,
          timeLimitMinutes: mode === "TIMED_PRACTICE" || mode === "FULL_MOCK" ? timeLimitMinutes : undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setAttemptId(json.data.attemptId);
          setQuestions(json.data.questions || []);
          if (json.data.timeLimitSeconds) {
            setSecondsRemaining(json.data.timeLimitSeconds);
          } else {
            setSecondsRemaining(null);
          }
          setSessionStartTime(Date.now());
        }
      }
    } catch {
      toast.error("Failed to initialize practice session. Please try again.");
      setIsPracticing(false);
    } finally {
      setLoading(false);
    }
  };

  // Complete and submit session
  const handleCompleteSession = async () => {
    if (!attemptId || isSubmitting) return;
    try {
      setIsSubmitting(true);
      const totalDuration = Math.round((Date.now() - sessionStartTime) / 1000);

      const submissions = questions.map((q) => ({
        questionId: q.id,
        studentAnswer: answers[q.id] || [],
        timeSpentSeconds: Math.round(totalDuration / (questions.length || 1)),
      }));

      const res = await fetch("/api/student/placement-practice/attempt/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          submissions,
          totalDurationSeconds: totalDuration,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setResultsData(json.data);
        setIsPracticing(false);
        loadDashboard();
      }
    } catch {
      toast.error("Error submitting answers. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectOption = (questionId: string, optionId: string, isMultiple: boolean) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      if (isMultiple) {
        return {
          ...prev,
          [questionId]: current.includes(optionId)
            ? current.filter((id) => id !== optionId)
            : [...current, optionId],
        };
      } else {
        return {
          ...prev,
          [questionId]: [optionId],
        };
      }
    });
  };

  const toggleReviewFlag = (questionId: string) => {
    setMarkedForReview((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  // Format timer
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${rem.toString().padStart(2, "0")}`;
  };

  const currentQ = questions[currentQIndex];

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-text-primary tracking-tight">
              Placement Practice Centre
            </h1>
            <Badge variant="outline" className="border-primary/40 text-primary bg-[var(--color-primary-subtle)] text-xs font-mono font-semibold">
              <Sparkles className="h-3 w-3 mr-1 text-primary inline" /> Phase 03
            </Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Master aptitude, logical reasoning, verbal ability, and core computer science fundamentals with server-evaluated tests.
          </p>
        </div>

        {!isPracticing && (
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "OVERVIEW" ? "primary" : "outline"}
              size="sm"
              onClick={() => setActiveTab("OVERVIEW")}
            >
              <Compass className="h-4 w-4 mr-1.5" />
              Overview
            </Button>
            <Button
              variant={activeTab === "PRACTICE_MODE" ? "primary" : "outline"}
              size="sm"
              onClick={() => setActiveTab("PRACTICE_MODE")}
            >
              <Play className="h-4 w-4 mr-1.5" />
              Start Practice
            </Button>
            <Button
              variant={activeTab === "REVISION" ? "primary" : "outline"}
              size="sm"
              onClick={() => {
                setActiveTab("REVISION");
                loadRevision();
              }}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Revision Bank ({summary?.pendingRevisionCount || 0})
            </Button>
          </div>
        )}
      </div>

      {/* ACTIVE TEST PLAYER VIEW */}
      {isPracticing && currentQ && (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="border-b border-border py-4 px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono font-semibold text-primary border-primary/40">
                  {currentQ.category.replace(/_/g, " ")}
                </Badge>
                <span className="text-xs text-text-secondary font-mono">• {currentQ.topic}</span>
                <Badge variant="outline" className="text-[11px] font-mono text-secondary border-secondary/40">
                  {currentQ.difficulty}
                </Badge>
              </div>

              <div className="flex items-center gap-4">
                {secondsRemaining !== null && (
                  <div className={`flex items-center gap-1.5 font-mono text-sm font-bold px-3 py-1 rounded-md border ${
                    secondsRemaining < 60 ? "border-red-400 bg-red-50 text-red-600 animate-pulse" : "border-border bg-surface text-text-primary"
                  }`}>
                    <Timer className="h-4 w-4" />
                    <span>{formatTime(secondsRemaining)}</span>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleReviewFlag(currentQ.id)}
                  className={markedForReview[currentQ.id] ? "border-amber-400 bg-amber-50 text-amber-700" : ""}
                >
                  <Flag className="h-3.5 w-3.5 mr-1" />
                  {markedForReview[currentQ.id] ? "Marked for Review" : "Mark for Review"}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCompleteSession}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Evaluating..." : "Submit Test"}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Progress indicators */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-text-secondary font-mono">
                <span>Question {currentQIndex + 1} of {questions.length}</span>
                <span>{Math.round(((currentQIndex + 1) / questions.length) * 100)}% viewed</span>
              </div>
              <Progress value={((currentQIndex + 1) / questions.length) * 100} className="h-1.5" />
            </div>

            {/* Question Text */}
            <div className="p-4 rounded-xl bg-surface border border-border">
              <p className="text-base sm:text-lg font-medium text-text-primary leading-relaxed">
                {currentQ.questionText}
              </p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {currentQ.options.map((opt) => {
                const isSelected = (answers[currentQ.id] || []).includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOption(currentQ.id, opt.id, currentQ.questionType === "MCQ_MULTIPLE")}
                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                      isSelected
                        ? "border-primary bg-[var(--color-primary-subtle)] text-text-primary font-medium shadow-sm"
                        : "border-border bg-card hover:bg-surface text-text-secondary"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-mono border ${
                        isSelected ? "border-primary bg-primary text-white" : "border-border bg-surface text-text-secondary"
                      }`}>
                        {opt.id.replace("opt_", "")}
                      </div>
                      <span className="text-sm">{opt.text}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>

            {/* Question Palette & Nav */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-border">
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                {questions.map((q, idx) => {
                  const isAnswered = (answers[q.id] || []).length > 0;
                  const isMarked = markedForReview[q.id];
                  const isCurr = idx === currentQIndex;
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentQIndex(idx)}
                      className={`h-8 w-8 rounded-lg text-xs font-mono font-semibold transition-all border ${
                        isCurr
                          ? "ring-2 ring-primary ring-offset-1 border-primary bg-primary text-white"
                          : isMarked
                          ? "border-amber-400 bg-amber-50 text-amber-700"
                          : isAnswered
                          ? "border-secondary/50 bg-[var(--color-secondary-subtle)] text-secondary"
                          : "border-border bg-surface text-text-secondary"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
                  disabled={currentQIndex === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentQIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  disabled={currentQIndex === questions.length - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* RESULTS & BREAKDOWN VIEW */}
      {resultsData && !isPracticing && (
        <div className="space-y-6">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto h-12 w-12 rounded-full bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center mb-2">
                <Award className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-heading">Test Evaluation Report</CardTitle>
              <CardDescription>Server-computed placement assessment diagnostic results</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-surface border border-border text-center">
                <div>
                  <span className="text-[11px] font-mono uppercase text-text-secondary">Accuracy Score</span>
                  <div className="text-2xl font-bold font-heading text-text-primary mt-1">
                    {resultsData.scorePercentage}%
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-mono uppercase text-text-secondary">Correct Answers</span>
                  <div className="text-2xl font-bold font-heading text-secondary mt-1">
                    {resultsData.correctCount} / {resultsData.totalQuestions}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-mono uppercase text-text-secondary">Incorrect</span>
                  <div className="text-2xl font-bold font-heading text-red-600 mt-1">
                    {resultsData.incorrectCount}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] font-mono uppercase text-text-secondary">Duration</span>
                  <div className="text-2xl font-bold font-heading text-text-primary mt-1">
                    {resultsData.timeSpentSeconds}s
                  </div>
                </div>
              </div>

              {/* Explanations List */}
              <div className="space-y-4">
                <h3 className="text-base font-bold font-heading text-text-primary">Question-by-Question Solutions</h3>
                {resultsData.results?.map((res: any, idx: number) => (
                  <div
                    key={res.questionId || idx}
                    className={`p-4 rounded-xl border space-y-3 ${
                      res.isCorrect ? "border-secondary/30 bg-secondary/5" : "border-red-300 bg-red-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {res.isCorrect ? (
                          <Badge variant="outline" className="border-secondary text-secondary bg-secondary/10 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1 inline" /> Correct
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-red-400 text-red-600 bg-red-50 text-xs">
                            <XCircle className="h-3 w-3 mr-1 inline" /> Incorrect
                          </Badge>
                        )}
                        <span className="text-xs text-text-secondary font-mono">Q{idx + 1} • {res.topic}</span>
                      </div>
                    </div>

                    <p className="text-sm font-medium text-text-primary">{res.questionText}</p>

                    <div className="text-xs space-y-1.5 p-3 rounded-lg bg-card border border-border">
                      <div className="font-semibold text-text-primary">Explanation &amp; Solving Approach:</div>
                      <p className="text-text-secondary leading-relaxed">{res.explanation}</p>
                      {res.solvingApproach && (
                        <p className="text-primary font-mono text-[11px] mt-1">
                          💡 Tip: {res.solvingApproach}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => setResultsData(null)}>
                  Back to Practice
                </Button>
                <Button variant="primary" onClick={() => handleStartPractice(selectedMode)}>
                  Practice Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DASHBOARD OVERVIEW TAB */}
      {!isPracticing && !resultsData && activeTab === "OVERVIEW" && (
        <div className="space-y-8">
          {/* Metrics Tiles */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
                  Questions Attempted
                </CardTitle>
                <BookOpen className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-heading text-text-primary">
                  {summary?.totalAttempted || 0}
                </div>
                <p className="text-[11px] text-text-secondary mt-1">
                  Across all practice categories
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
                  Overall Accuracy
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-heading text-secondary">
                  {summary?.accuracyPercentage || 0}%
                </div>
                <p className="text-[11px] text-text-secondary mt-1">
                  {summary?.correctAnswers || 0} correct / {summary?.totalAttempted || 0} answered
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
                  Tests Completed
                </CardTitle>
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-heading text-text-primary">
                  {summary?.completedTests || 0}
                </div>
                <p className="text-[11px] text-text-secondary mt-1">
                  Avg score: {summary?.averageScorePercentage || 0}%
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-xs font-semibold text-text-secondary uppercase tracking-wider font-mono">
                  Practice Time
                </CardTitle>
                <Clock className="h-4 w-4 text-secondary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-heading text-text-primary">
                  {summary?.formattedPracticeTime || "0 mins"}
                </div>
                <p className="text-[11px] text-text-secondary mt-1">
                  Dedicated test preparation
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Practice Categories Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold font-heading text-text-primary">Practice Categories</h2>
                <p className="text-xs text-text-secondary">Select a curriculum stream to practice topic-by-topic.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {categories.map((cat) => (
                <Card key={cat.id} className="border-border bg-card shadow-sm hover:border-primary/40 transition-colors flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs font-mono font-semibold text-primary border-primary/40">
                        {cat.topics.length} Core Topics
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-primary hover:bg-primary/10"
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setSelectedTopic(cat.topics[0]);
                          setActiveTab("PRACTICE_MODE");
                        }}
                      >
                        Practice Stream <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                    <CardTitle className="text-base font-heading mt-2">{cat.name}</CardTitle>
                    <CardDescription className="text-xs">{cat.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1.5">
                      {cat.topics.slice(0, 6).map((top) => (
                        <button
                          key={top}
                          type="button"
                          onClick={() => {
                            setSelectedCategory(cat.id);
                            setSelectedTopic(top);
                            setActiveTab("PRACTICE_MODE");
                          }}
                          className="text-[11px] px-2.5 py-1 rounded-md bg-surface border border-border text-text-secondary hover:text-primary hover:border-primary/40 transition-colors"
                        >
                          {top}
                        </button>
                      ))}
                      {cat.topics.length > 6 && (
                        <span className="text-[11px] text-text-secondary px-2 py-1">
                          +{cat.topics.length - 6} more
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Quick Start Practice Modes */}
          <div className="p-6 rounded-2xl bg-surface border border-border space-y-4">
            <h2 className="text-base font-bold font-heading text-text-primary">Placement Practice Modes</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div
                onClick={() => {
                  setSelectedMode("TOPIC_PRACTICE");
                  setActiveTab("PRACTICE_MODE");
                }}
                className="p-4 rounded-xl bg-card border border-border hover:border-primary cursor-pointer transition-all space-y-2"
              >
                <div className="h-8 w-8 rounded-lg bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center">
                  <Layers className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold font-heading text-text-primary">Topic Practice</h3>
                <p className="text-xs text-text-secondary">Drill down on single topics (e.g. Percentages, DSA) without time pressure.</p>
              </div>

              <div
                onClick={() => {
                  setSelectedMode("TIMED_PRACTICE");
                  setActiveTab("PRACTICE_MODE");
                }}
                className="p-4 rounded-xl bg-card border border-border hover:border-secondary cursor-pointer transition-all space-y-2"
              >
                <div className="h-8 w-8 rounded-lg bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center">
                  <Timer className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold font-heading text-text-primary">Timed Practice</h3>
                <p className="text-xs text-text-secondary">Simulate actual test conditions with countdown timers and auto-submission.</p>
              </div>

              <div
                onClick={() => {
                  setSelectedMode("FULL_MOCK");
                  setActiveTab("PRACTICE_MODE");
                }}
                className="p-4 rounded-xl bg-card border border-border hover:border-primary cursor-pointer transition-all space-y-2"
              >
                <div className="h-8 w-8 rounded-lg bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center">
                  <Award className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold font-heading text-text-primary">Full Mock Test</h3>
                <p className="text-xs text-text-secondary">Mixed test combining Aptitude, Reasoning, and Technical questions.</p>
              </div>

              <div
                onClick={() => {
                  setActiveTab("REVISION");
                  loadRevision();
                }}
                className="p-4 rounded-xl bg-card border border-border hover:border-amber-400 cursor-pointer transition-all space-y-2"
              >
                <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <RotateCcw className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold font-heading text-text-primary">Revision Bank</h3>
                <p className="text-xs text-text-secondary">Review and re-attempt questions answered incorrectly in previous attempts.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* START PRACTICE CONFIGURATION TAB */}
      {!isPracticing && !resultsData && activeTab === "PRACTICE_MODE" && (
        <Card className="border-border bg-card shadow-sm max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-lg font-heading">Configure Practice Session</CardTitle>
            <CardDescription>Select mode, topic, and difficulty to launch your session</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mode selection */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase text-text-secondary font-semibold">1. Practice Mode</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["TOPIC_PRACTICE", "TIMED_PRACTICE", "FULL_MOCK", "REVISION_PRACTICE"] as PracticeMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSelectedMode(mode)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedMode === mode
                        ? "border-primary bg-[var(--color-primary-subtle)] text-text-primary font-semibold"
                        : "border-border bg-surface text-text-secondary"
                    }`}
                  >
                    <span className="text-xs block capitalize">{mode.replace(/_/g, " ").toLowerCase()}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Category selection */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase text-text-secondary font-semibold">2. Category</label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      setSelectedTopic(cat.topics[0]);
                    }}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedCategory === cat.id
                        ? "border-primary bg-[var(--color-primary-subtle)] text-text-primary font-semibold"
                        : "border-border bg-surface text-text-secondary"
                    }`}
                  >
                    <span className="text-xs block">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Topic selection */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase text-text-secondary font-semibold">3. Select Topic</label>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-border bg-surface text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {categories
                  .find((c) => c.id === selectedCategory)
                  ?.topics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
              </select>
            </div>

            {/* Difficulty selection */}
            <div className="space-y-2">
              <label className="text-xs font-mono uppercase text-text-secondary font-semibold">4. Difficulty</label>
              <div className="grid grid-cols-3 gap-2">
                {(["BEGINNER", "INTERMEDIATE", "ADVANCED"] as PracticeDifficulty[]).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setSelectedDifficulty(diff)}
                    className={`p-2.5 rounded-xl border text-center text-xs font-mono transition-all ${
                      selectedDifficulty === diff
                        ? "border-primary bg-primary text-white font-semibold"
                        : "border-border bg-surface text-text-secondary"
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full mt-4 justify-center"
              onClick={() => handleStartPractice(selectedMode)}
            >
              <Play className="h-4 w-4 mr-2" /> Start Practice Now
            </Button>
          </CardContent>
        </Card>
      )}

      {/* REVISION BANK TAB */}
      {!isPracticing && !resultsData && activeTab === "REVISION" && (
        <div className="space-y-6">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-heading">Revision Bank</CardTitle>
              <CardDescription>
                Questions previously answered incorrectly during practice tests. Re-attempt them to consolidate mastery.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {revisionQuestions.length === 0 ? (
                <div className="text-center py-12 text-text-secondary">
                  <CheckCircle2 className="h-10 w-10 text-secondary mx-auto mb-2" />
                  <p className="text-sm font-semibold text-text-primary">Revision Bank is Clear!</p>
                  <p className="text-xs mt-1">You have no pending incorrect answers to revise.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {revisionQuestions.map((q, idx) => (
                    <div key={q.id || idx} className="p-4 rounded-xl border border-border bg-surface space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono border-primary/40 text-primary">
                            {q.category?.replace(/_/g, " ")}
                          </Badge>
                          <span className="text-xs text-text-secondary font-mono">• {q.topic}</span>
                        </div>
                        <Badge variant="outline" className="text-xs font-mono text-amber-700 border-amber-300 bg-amber-50">
                          Needs Revision
                        </Badge>
                      </div>

                      <p className="text-sm font-medium text-text-primary">{q.questionText}</p>

                      <div className="p-3 rounded-lg bg-card border border-border text-xs space-y-1">
                        <span className="font-semibold text-text-primary">Explanation:</span>
                        <p className="text-text-secondary leading-relaxed">{q.explanation}</p>
                      </div>
                    </div>
                  ))}

                  <Button
                    variant="primary"
                    onClick={() => handleStartPractice("REVISION_PRACTICE")}
                  >
                    <Play className="h-4 w-4 mr-2" /> Re-attempt Revision Questions
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
