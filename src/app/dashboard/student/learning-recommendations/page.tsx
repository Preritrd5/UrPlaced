"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles,
  Compass,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Target,
  BookOpen,
  Bot,
  User,
  Layers,
  ChevronRight,
  Check,
  X,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  LearningRecommendation,
  RoadmapStep,
  RecommendationCategory,
} from "@/modules/students/services/learning-recommendations-service";

export default function LearningRecommendationsPage() {
  const [loading, setLoading] = React.useState(true);
  const [recommendations, setRecommendations] = React.useState<LearningRecommendation[]>([]);
  const [activeCount, setActiveCount] = React.useState(0);
  const [completedCount, setCompletedCount] = React.useState(0);
  const [topPriority, setTopPriority] = React.useState<LearningRecommendation | null>(null);

  // Roadmap State
  const [targetRole, setTargetRole] = React.useState("Software Developer");
  const [roadmap, setRoadmap] = React.useState<{
    targetRole: string;
    completedStepsCount: number;
    totalStepsCount: number;
    overallProgressPercentage: number;
    steps: RoadmapStep[];
  } | null>(null);

  // Filter tab
  const [activeTab, setActiveTab] = React.useState<"ALL" | RecommendationCategory>("ALL");

  // Load Recommendations
  const loadData = React.useCallback(async (role: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/student/learning-recommendations?role=${encodeURIComponent(role)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setRecommendations(json.data.recommendations || []);
          setActiveCount(json.data.activeCount || 0);
          setCompletedCount(json.data.completedCount || 0);
          setTopPriority(json.data.topPriorityRecommendation || null);
          setRoadmap(json.data.roadmap || null);
        }
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData(targetRole);
  }, [loadData, targetRole]);

  // Update status (completed, in progress, dismissed)
  const handleUpdateStatus = async (
    recommendationId: string,
    status: "IN_PROGRESS" | "COMPLETED" | "DISMISSED"
  ) => {
    try {
      const res = await fetch(`/api/student/learning-recommendations/${recommendationId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setRecommendations((prev) =>
          prev.map((r) => (r.id === recommendationId ? { ...r, status } : r))
        );
        if (topPriority?.id === recommendationId) {
          setTopPriority((prev) => (prev ? { ...prev, status } : null));
        }
      }
    } catch {
      // Continue
    }
  };

  const filteredRecommendations = recommendations.filter((r) => {
    if (r.status === "DISMISSED") return false;
    if (activeTab === "ALL") return true;
    return r.category === activeTab;
  });

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-text-primary tracking-tight">
              Personalized Learning Recommendations
            </h1>
            <Badge variant="outline" className="border-primary/40 text-primary bg-[var(--color-primary-subtle)] text-xs font-mono font-semibold">
              <Sparkles className="h-3 w-3 mr-1 text-primary inline" /> Grounded Intelligence
            </Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Prioritized placement actions synthesized from your profile completeness, ATS diagnostics, assessment attempts, and mock interview rubrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono border-secondary/40 text-secondary bg-[var(--color-secondary-subtle)] px-3 py-1">
            {activeCount} Active Actions
          </Badge>
          <Badge variant="outline" className="text-xs font-mono border-border text-text-secondary px-3 py-1">
            {completedCount} Completed
          </Badge>
        </div>
      </div>

      {/* TOP PRIORITY ACTION HERO CARD */}
      {topPriority && topPriority.status !== "COMPLETED" && (
        <Card className="border-primary/40 bg-gradient-to-r from-card to-[var(--color-primary-subtle)]/30 shadow-md">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Badge className="bg-primary text-white text-xs font-mono font-semibold px-2.5 py-0.5">
                ★ Highest Priority Action
              </Badge>
              <span className="text-[11px] font-mono text-text-secondary">
                Source: {topPriority.supportingEvidence?.source}
              </span>
            </div>
            <CardTitle className="text-lg sm:text-xl font-heading mt-2 text-text-primary">
              {topPriority.title}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm text-text-secondary leading-relaxed">
              {topPriority.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-3 sm:grid-cols-2 p-3.5 rounded-xl bg-card border border-border text-xs">
              <div>
                <span className="font-semibold text-text-primary block mb-0.5">Why This Was Recommended:</span>
                <p className="text-text-secondary leading-relaxed">{topPriority.reasonRecommended}</p>
              </div>
              <div>
                <span className="font-semibold text-secondary block mb-0.5">Expected Learning Outcome:</span>
                <p className="text-text-secondary leading-relaxed">{topPriority.expectedOutcome}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <Button asChild variant="primary" size="sm">
                  <Link href={topPriority.destinationRoute}>
                    <span>{topPriority.suggestedAction}</span>
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateStatus(topPriority.id, "COMPLETED")}
                >
                  <Check className="h-3.5 w-3.5 mr-1 text-secondary" />
                  Mark Completed
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-text-secondary hover:text-red-600"
                onClick={() => handleUpdateStatus(topPriority.id, "DISMISSED")}
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ACTIONABLE LEARNING ROADMAP SECTION */}
      {roadmap && (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-heading">
                    Structured Placement Roadmap
                  </CardTitle>
                  <Badge variant="outline" className="text-xs font-mono text-primary border-primary/40">
                    {roadmap.overallProgressPercentage}% Complete
                  </Badge>
                </div>
                <CardDescription className="text-xs mt-0.5">
                  Step-by-step milestones aligned to your target career role.
                </CardDescription>
              </div>

              {/* Role Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-text-secondary">Target Role:</span>
                <select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="p-1.5 rounded-lg border border-border bg-surface text-xs font-medium text-text-primary focus:outline-none"
                >
                  <option value="Software Developer">Software Developer</option>
                  <option value="Data Analyst">Data Analyst</option>
                  <option value="Cloud / DevOps Engineer">Cloud / DevOps Engineer</option>
                  <option value="Full Stack Developer">Full Stack Developer</option>
                </select>
              </div>
            </div>

            <Progress value={roadmap.overallProgressPercentage} className="h-2 mt-4" />
          </CardHeader>

          <CardContent className="space-y-4 pt-0">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {roadmap.steps.map((step) => (
                <div
                  key={step.stepNumber}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                    step.isCompleted
                      ? "border-secondary/40 bg-[var(--color-secondary-subtle)] text-text-primary"
                      : step.isCurrent
                      ? "border-primary bg-[var(--color-primary-subtle)] ring-1 ring-primary text-text-primary shadow-sm"
                      : "border-border bg-surface text-text-secondary opacity-75"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider">
                        Step {step.stepNumber} • {step.category}
                      </span>
                      {step.isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-secondary" />
                      ) : step.isCurrent ? (
                        <Badge variant="outline" className="text-[9px] font-mono border-primary text-primary px-1">
                          Current Focus
                        </Badge>
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-text-secondary" />
                      )}
                    </div>
                    <h4 className="text-xs font-bold font-heading line-clamp-1">{step.title}</h4>
                    <p className="text-[11px] text-text-secondary leading-snug line-clamp-2">
                      {step.description}
                    </p>
                  </div>

                  <Button asChild variant={step.isCurrent ? "primary" : "outline"} size="sm" className="w-full text-xs h-7">
                    <Link href={step.suggestedRoute}>
                      <span>{step.isCompleted ? "Review Topic" : "Start Step"}</span>
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* FILTER TABS & ALL RECOMMENDATIONS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "ALL", label: "All Recommendations" },
              { id: "SKILL_IMPROVEMENT", label: "Skill Gaps" },
              { id: "PRACTICE_IMPROVEMENT", label: "Practice Centre" },
              { id: "CAREER_PREPARATION", label: "Profile & Resume" },
              { id: "INTERVIEW_IMPROVEMENT", label: "Mock Interview" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                  activeTab === tab.id
                    ? "border-primary bg-[var(--color-primary-subtle)] text-primary font-semibold"
                    : "border-border bg-card text-text-secondary hover:bg-surface"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recommendations List */}
        <div className="grid gap-4 md:grid-cols-2">
          {filteredRecommendations.map((rec) => (
            <Card
              key={rec.id}
              className={`border-border bg-card shadow-sm hover:border-primary/40 transition-colors flex flex-col justify-between ${
                rec.status === "COMPLETED" ? "opacity-60 bg-surface" : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-mono font-semibold ${
                        rec.priority === "HIGH"
                          ? "border-red-400 bg-red-50 text-red-600"
                          : rec.priority === "MEDIUM"
                          ? "border-amber-400 bg-amber-50 text-amber-700"
                          : "border-border text-text-secondary"
                      }`}
                    >
                      {rec.priority} Priority
                    </Badge>
                    <span className="text-[11px] font-mono text-text-secondary">
                      {rec.category.replace(/_/g, " ")}
                    </span>
                  </div>

                  {rec.status === "COMPLETED" && (
                    <Badge variant="outline" className="border-secondary text-secondary bg-secondary/10 text-xs">
                      <CheckCircle2 className="h-3 w-3 mr-1 inline" /> Completed
                    </Badge>
                  )}
                </div>

                <CardTitle className="text-base font-heading mt-2">{rec.title}</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  {rec.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="p-3 rounded-lg bg-surface border border-border text-xs space-y-1">
                  <div className="flex items-center justify-between text-text-secondary text-[11px] font-mono">
                    <span>Evidence: {rec.supportingEvidence?.source}</span>
                    <span className="font-semibold text-primary">{rec.supportingEvidence?.metric}</span>
                  </div>
                  <p className="text-text-primary text-[11px] leading-relaxed pt-1 border-t border-border/50">
                    💡 <span className="font-semibold">Why:</span> {rec.reasonRecommended}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                  <Button asChild variant="outline" size="sm" className="text-xs flex-1 justify-between">
                    <Link href={rec.destinationRoute}>
                      <span>{rec.suggestedAction}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>

                  {rec.status !== "COMPLETED" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-secondary hover:bg-secondary/10"
                      onClick={() => handleUpdateStatus(rec.id, "COMPLETED")}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
