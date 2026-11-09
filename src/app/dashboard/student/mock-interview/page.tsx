"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Target,
  BarChart3,
  Award,
  BookOpen,
  Briefcase,
  Layers,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/common/brand-loader";
import type {
  MockInterviewSession,
  InterviewType,
  InterviewDifficulty,
} from "@/modules/students/services/mock-interview-service";

const INTERVIEW_MODES: Array<{
  type: InterviewType;
  title: string;
  description: string;
  icon: string;
}> = [
  {
    type: "TECHNICAL",
    title: "Technical Knowledge",
    description: "Core algorithms, data structures, system design, and role-specific architecture.",
    icon: "💻",
  },
  {
    type: "PROJECT_BASED",
    title: "Project Architecture",
    description: "Deep-dive inquiry into your actual portfolio projects, trade-offs, and challenges.",
    icon: "🏗️",
  },
  {
    type: "BEHAVIOURAL",
    title: "Behavioural (STAR)",
    description: "Conflict resolution, leadership, deadline pressures, and real-world collaboration.",
    icon: "🤝",
  },
  {
    type: "HR",
    title: "HR & Culture Fit",
    description: "Personal introduction, professional ambitions, work ethics, and team expectations.",
    icon: "🎯",
  },
  {
    type: "COMPANY_SPECIFIC",
    title: "Company & Drive Specific",
    description: "Grounded practice tailored to current campus placement hiring criteria.",
    icon: "🏢",
  },
];

export default function MockInterviewDashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<MockInterviewSession[]>([]);
  const [drives, setDrives] = useState<Array<{ id: string; title: string; companyName: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Setup modal
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedType, setSelectedType] = useState<InterviewType>("TECHNICAL");
  const [targetRole, setTargetRole] = useState("Software Developer");
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>("INTERMEDIATE");
  const [totalQuestions, setTotalQuestions] = useState(4);
  const [selectedDriveId, setSelectedDriveId] = useState("");

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sessionsRes, drivesRes] = await Promise.all([
        fetch("/api/student/mock-interview"),
        fetch("/api/student/drives"),
      ]);

      if (sessionsRes.ok) {
        const sJson = await sessionsRes.json();
        setSessions(sJson.data || []);
      } else {
        const sJson = await sessionsRes.json().catch(() => null);
        if (sJson?.error && sessionsRes.status !== 404) {
          console.warn("[MockInterview] loadSessions notice:", sJson.error);
        }
      }

      if (drivesRes.ok) {
        const dJson = await drivesRes.json();
        setDrives(
          (dJson.data || []).map((d: any) => ({
            id: d.id,
            title: d.title,
            companyName: d.companies?.name || "Company",
          }))
        );
      }
    } catch (err: any) {
      setError(err.message || "Failed to load interview history.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetRole.trim() || isStarting) return;

    setIsStarting(true);
    setError(null);

    try {
      const res = await fetch("/api/student/mock-interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewType: selectedType,
          targetRole: targetRole.trim(),
          difficulty,
          totalQuestions,
          targetDriveId: selectedDriveId || undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Failed to start interview session.");
      }

      router.push(`/dashboard/student/mock-interview/${json.data.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to initialize interview.");
      setIsStarting(false);
    }
  };

  // Stats calculation
  const completedSessions = sessions.filter((s) => s.status === "COMPLETED");
  const averageScore =
    completedSessions.length > 0
      ? Math.round(
          completedSessions.reduce((acc, s) => acc + (s.overallScore || 0), 0) /
            completedSessions.length
        )
      : null;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <BrandLoader size="lg" />
        <p className="text-sm font-medium text-[#292D40]/70 font-inter">
          Loading AI Mock Interview Studio...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 font-inter">
      {/* Header Banner */}
      <div className="bg-[#F8F7F3] border border-[#DDDCD5] p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-2 rounded-xl bg-[#5052C9]/10 text-[#5052C9]">
              <Bot className="w-5 h-5" />
            </span>
            <h1 className="text-xl md:text-2xl font-bold font-outfit text-[#24283A]">
              AI Mock Interview Studio
            </h1>
            <Badge className="bg-[#5052C9] text-white text-[11px]">Phase 02</Badge>
          </div>
          <p className="text-sm text-[#292D40]/75 max-w-2xl">
            Simulate realistic, multi-turn campus placement interviews. Answer technical, behavioral,
            and project questions one-by-one, receive instant 6-dimension rubric evaluations, and review improved model answers.
          </p>
        </div>

        <Button
          onClick={() => setShowSetupModal(true)}
          className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs font-semibold shadow-sm shrink-0"
        >
          <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
          Start Practice Session
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-[#F8F7F3] border border-[#B8B6AC] text-[#24283A] text-sm flex items-start justify-between gap-2.5 shadow-sm">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-[#5052C9] mt-0.5" />
            <p className="text-xs text-[#24283A]">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs font-medium text-[#747683] hover:text-[#24283A] px-2 py-0.5 rounded transition shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#FBFAF7] border border-[#DDDCD5] p-4 rounded-2xl shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-[#747683] uppercase tracking-wider block">
            Practice Sessions
          </span>
          <span className="text-2xl font-bold font-outfit text-[#24283A]">
            {completedSessions.length} Completed
          </span>
          <span className="text-[11px] text-[#747683] block">
            {sessions.filter((s) => s.status === "IN_PROGRESS").length} in-progress
          </span>
        </div>

        <div className="bg-[#FBFAF7] border border-[#DDDCD5] p-4 rounded-2xl shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-[#747683] uppercase tracking-wider block">
            Average Interview Score
          </span>
          <span className="text-2xl font-bold font-outfit text-[#5052C9]">
            {averageScore !== null ? `${averageScore}%` : "—"}
          </span>
          <span className="text-[11px] text-[#747683] block">
            Across 6 evaluation criteria
          </span>
        </div>

        <div className="bg-[#FBFAF7] border border-[#DDDCD5] p-4 rounded-2xl shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-[#747683] uppercase tracking-wider block">
            Advisory Evaluation
          </span>
          <span className="text-2xl font-bold font-outfit text-[#2E8F86]">
            Strict Rubric
          </span>
          <span className="text-[11px] text-[#747683] block">
            Zero employer hallucination
          </span>
        </div>
      </div>

      {/* Interview Modes Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold font-outfit text-[#24283A] uppercase tracking-wider">
          Practice Interview Modes
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {INTERVIEW_MODES.map((mode) => (
            <div
              key={mode.type}
              onClick={() => {
                setSelectedType(mode.type);
                setShowSetupModal(true);
              }}
              className="bg-[#FBFAF7] hover:bg-[#F8F7F3] border border-[#DDDCD5] p-4 rounded-2xl shadow-xs cursor-pointer transition-all space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{mode.icon}</span>
                <Badge variant="outline" className="border-[#DDDCD5] text-[10px] group-hover:border-[#5052C9] group-hover:text-[#5052C9]">
                  {mode.type.replace("_", " ")}
                </Badge>
              </div>
              <h3 className="text-xs font-bold font-outfit text-[#24283A]">
                {mode.title}
              </h3>
              <p className="text-[11px] text-[#747683] leading-relaxed">
                {mode.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* History Table */}
      <div className="bg-[#F8F7F3] border border-[#DDDCD5] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold font-outfit text-[#24283A] uppercase tracking-wider">
            Your Interview Session History ({sessions.length})
          </h2>
        </div>

        {sessions.length === 0 ? (
          <div className="p-12 text-center bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl space-y-2">
            <Bot className="w-8 h-8 text-[#747683] mx-auto" />
            <p className="text-sm font-bold text-[#24283A]">No practice sessions recorded yet</p>
            <p className="text-xs text-[#747683]">
              Launch an interview above to simulate real collegiate placement rounds.
            </p>
          </div>
        ) : (
          <div className="bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#EDECE7] text-[#24283A] font-outfit font-semibold border-b border-[#DDDCD5]">
                  <tr>
                    <th className="p-3.5 pl-4">Target Role</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Difficulty</th>
                    <th className="p-3.5">Questions</th>
                    <th className="p-3.5">Overall Score</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDDCD5]">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-[#F8F7F3] transition-colors">
                      <td className="p-3.5 pl-4 font-bold text-[#24283A]">
                        {s.targetRole}
                        {s.targetDriveTitle && (
                          <span className="block text-[10px] text-[#747683] font-normal">
                            {s.targetDriveTitle}
                          </span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <Badge variant="outline" className="text-[10px] border-[#DDDCD5]">
                          {s.interviewType.replace("_", " ")}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-[#747683]">{s.difficulty}</td>
                      <td className="p-3.5 font-mono text-[#24283A]">
                        {s.currentQuestionIndex}/{s.totalQuestions}
                      </td>
                      <td className="p-3.5">
                        {s.overallScore !== null ? (
                          <Badge className="bg-[#5052C9] text-white text-[10px] font-bold">
                            {s.overallScore}%
                          </Badge>
                        ) : s.status === "IN_PROGRESS" ? (
                          <Badge variant="outline" className="border-amber-400 text-amber-700 text-[10px]">
                            In Progress
                          </Badge>
                        ) : (
                          <span className="text-[#747683]">—</span>
                        )}
                      </td>
                      <td className="p-3.5 text-[#747683]">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 pr-4 text-right">
                        <Link href={`/dashboard/student/mock-interview/${s.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-[#5052C9] hover:bg-[#EDECE7]"
                          >
                            {s.status === "COMPLETED" ? "Review Report" : "Resume Session"}
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* SETUP SESSION MODAL */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FBFAF7] border border-[#DDDCD5] rounded-3xl shadow-xl max-w-lg w-full p-6 space-y-4 font-inter">
            <div className="flex items-center justify-between pb-2 border-b border-[#DDDCD5]">
              <h3 className="text-base font-bold font-outfit text-[#24283A] flex items-center gap-2">
                <Bot className="w-4 h-4 text-[#5052C9]" />
                Configure Mock Interview Session
              </h3>
              <button
                onClick={() => setShowSetupModal(false)}
                className="text-[#747683] hover:text-[#24283A] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStartSession} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#292D40] mb-1">
                  Interview Mode *
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as any)}
                  className="w-full text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl px-3 py-2 text-[#24283A] focus:ring-2 focus:ring-[#5052C9]"
                >
                  <option value="TECHNICAL">Technical &amp; Algorithms</option>
                  <option value="PROJECT_BASED">Project Architecture (Your Portfolio)</option>
                  <option value="BEHAVIOURAL">Behavioural &amp; Team Scenarios (STAR)</option>
                  <option value="HR">HR &amp; Cultural Fit</option>
                  <option value="COMPANY_SPECIFIC">Company / Drive Specific Practice</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292D40] mb-1">
                  Target Hiring Role *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Software Developer / Full Stack Engineer"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl px-3 py-2 text-[#24283A] focus:ring-2 focus:ring-[#5052C9]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#292D40] mb-1">
                    Difficulty Level
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl px-3 py-2 text-[#24283A]"
                  >
                    <option value="BEGINNER">Beginner (Foundational)</option>
                    <option value="INTERMEDIATE">Intermediate (Standard)</option>
                    <option value="ADVANCED">Advanced (Rigorous)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292D40] mb-1">
                    Question Count
                  </label>
                  <select
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(Number(e.target.value))}
                    className="w-full text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl px-3 py-2 text-[#24283A]"
                  >
                    <option value="3">3 Questions (Quick Practice)</option>
                    <option value="4">4 Questions (Standard)</option>
                    <option value="5">5 Questions (Comprehensive)</option>
                    <option value="6">6 Questions (In-depth)</option>
                  </select>
                </div>
              </div>

              {selectedType === "COMPANY_SPECIFIC" && (
                <div>
                  <label className="block text-xs font-semibold text-[#292D40] mb-1">
                    Target Campus Drive
                  </label>
                  <select
                    value={selectedDriveId}
                    onChange={(e) => setSelectedDriveId(e.target.value)}
                    className="w-full text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl px-3 py-2 text-[#24283A]"
                  >
                    <option value="">General Enterprise Standards</option>
                    {drives.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.companyName} — {d.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="p-3 rounded-xl bg-[#EDECE7]/60 border border-[#DDDCD5] text-[11px] text-[#747683] leading-relaxed">
                ℹ️ The AI interviewer will ask one question at a time. After submitting each answer,
                you will receive structured evaluation scores, conceptual critique, and an illustrative improved response.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DDDCD5]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSetupModal(false)}
                  className="text-xs border-[#DDDCD5]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isStarting}
                  className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs font-semibold"
                >
                  {isStarting ? (
                    <>
                      <BrandLoader size="inline" className="mr-1.5" />
                      Initializing Interview...
                    </>
                  ) : (
                    "Launch Interview"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
