"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Compass,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Briefcase,
  Layers,
  BookOpen,
  Plus,
  ExternalLink,
  RefreshCw,
  HelpCircle,
  FileText,
  ShieldCheck,
  Check,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BrandLoader } from "@/components/common/brand-loader";
import { FormattedAIResponse } from "@/components/ai/formatted-ai-response";
import type {
  SkillGapAnalysisResult,
  SkillProgressItem,
  SkillEvidenceType,
} from "@/modules/students/services/skill-gap-analyzer-service";

const POPULAR_ROLES = [
  "Software Developer",
  "Full Stack Developer",
  "Java Backend Engineer",
  "Python / Django Developer",
  "Data Analyst",
  "Cloud & DevOps Engineer",
  "Cybersecurity Analyst",
  "Frontend React Developer",
];

export default function SkillGapPage() {
  const [targetRole, setTargetRole] = useState("Software Developer");
  const [customRole, setCustomRole] = useState("");
  const [selectedDriveId, setSelectedDriveId] = useState<string>("");
  const [customJobDesc, setCustomJobDesc] = useState("");
  const [drives, setDrives] = useState<Array<{ id: string; title: string; companyName: string }>>([]);

  const [analysis, setAnalysis] = useState<SkillGapAnalysisResult | null>(null);
  const [progressSummary, setProgressSummary] = useState<any>(null);
  const [progressItems, setProgressItems] = useState<SkillProgressItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<"analysis" | "roadmap" | "progress">("analysis");
  const [error, setError] = useState<string | null>(null);

  // Evidence modal state
  const [evidenceModalSkill, setEvidenceModalSkill] = useState<string | null>(null);
  const [evidenceType, setEvidenceType] = useState<"GITHUB" | "PROJECT" | "CERTIFICATE" | "ASSIGNMENT" | "OTHER">("GITHUB");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceDesc, setEvidenceDesc] = useState("");
  const [isSavingEvidence, setIsSavingEvidence] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch drives
      const drivesRes = await fetch("/api/student/drives");
      if (drivesRes.ok) {
        const dJson = await drivesRes.json();
        const driveList = (dJson.data || []).map((d: any) => ({
          id: d.id,
          title: d.title,
          companyName: d.companies?.name || "Company",
        }));
        setDrives(driveList);
      }

      // 2. Fetch latest analysis
      const res = await fetch("/api/student/skill-gap");
      if (!res.ok) throw new Error("Failed to load skill gap data.");
      const json = await res.json();
      if (json.data?.analysis) {
        setAnalysis(json.data.analysis);
        setTargetRole(json.data.analysis.targetRole);
      }
      if (json.data?.progressSummary) {
        setProgressSummary(json.data.progressSummary);
      }

      // 3. Fetch progress items
      const progRes = await fetch("/api/student/skill-gap/progress");
      if (progRes.ok) {
        const progJson = await progRes.json();
        setProgressItems(progJson.data?.items || []);
        if (progJson.data?.summary) {
          setProgressSummary(progJson.data.summary);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load skill gap data.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunAnalysis = async (forceRefresh = false) => {
    const roleToUse = customRole.trim() || targetRole;
    if (!roleToUse) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await fetch("/api/student/skill-gap/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole: roleToUse,
          targetDriveId: selectedDriveId || undefined,
          customJobDescription: customJobDesc.trim() || undefined,
          forceRefresh,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to complete skill gap analysis.");

      setAnalysis(json.data);

      // Refresh progress items
      const progRes = await fetch("/api/student/skill-gap/progress");
      if (progRes.ok) {
        const progJson = await progRes.json();
        setProgressItems(progJson.data?.items || []);
        setProgressSummary(progJson.data?.summary || null);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpdateStatus = async (skillName: string, status: "NOT_STARTED" | "IN_PROGRESS" | "PRACTICED" | "EVIDENCE_SUBMITTED") => {
    try {
      const res = await fetch("/api/student/skill-gap/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillName, status }),
      });
      if (res.ok) {
        // Refresh progress items
        const progRes = await fetch("/api/student/skill-gap/progress");
        if (progRes.ok) {
          const progJson = await progRes.json();
          setProgressItems(progJson.data?.items || []);
          setProgressSummary(progJson.data?.summary || null);
        }
      }
    } catch {
      // Non-critical
    }
  };

  const handleSaveEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evidenceModalSkill || !evidenceTitle.trim() || !evidenceUrl.trim()) return;

    setIsSavingEvidence(true);
    try {
      const res = await fetch("/api/student/skill-gap/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillName: evidenceModalSkill,
          evidenceLink: {
            type: evidenceType,
            title: evidenceTitle.trim(),
            url: evidenceUrl.trim(),
            description: evidenceDesc.trim() || undefined,
          },
        }),
      });

      if (res.ok) {
        setEvidenceModalSkill(null);
        setEvidenceTitle("");
        setEvidenceUrl("");
        setEvidenceDesc("");

        // Refresh
        const progRes = await fetch("/api/student/skill-gap/progress");
        if (progRes.ok) {
          const progJson = await progRes.json();
          setProgressItems(progJson.data?.items || []);
          setProgressSummary(progJson.data?.summary || null);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit evidence.");
    } finally {
      setIsSavingEvidence(false);
    }
  };

  const getEvidenceBadge = (type: SkillEvidenceType) => {
    switch (type) {
      case "VERIFIED":
        return <Badge className="bg-[#2E8F86] text-white text-[10px] font-semibold">Verified</Badge>;
      case "ASSESSMENT_SUPPORTED":
        return <Badge className="bg-[#5052C9] text-white text-[10px] font-semibold">Assessment Backed</Badge>;
      case "PROJECT_SUPPORTED":
        return <Badge variant="outline" className="border-[#2E8F86] text-[#2E8F86] text-[10px]">Project Backed</Badge>;
      case "RESUME_SUPPORTED":
        return <Badge variant="outline" className="border-[#5052C9] text-[#5052C9] text-[10px]">Resume Match</Badge>;
      default:
        return <Badge variant="outline" className="border-[#B8B6AC] text-[#747683] text-[10px]">Self-Reported</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <BrandLoader size="lg" />
        <p className="text-sm font-medium text-[#292D40]/70">Loading personalized skill gap engine...</p>
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
              <Compass className="w-5 h-5" />
            </span>
            <h1 className="text-xl md:text-2xl font-bold font-outfit text-[#24283A]">
              AI Skill Gap Analyzer
            </h1>
            <Badge className="bg-[#5052C9] text-white text-[11px]">Phase 02</Badge>
          </div>
          <p className="text-sm text-[#292D40]/75 max-w-2xl">
            Compare your verified skills, projects, and primary resume against real collegiate job benchmarks.
            Understand exact requirements, classify evidence, and execute a structured roadmap.
          </p>
        </div>

        {progressSummary && (
          <div className="bg-[#FBFAF7] border border-[#DDDCD5] p-3 rounded-xl flex items-center gap-4 text-xs">
            <div>
              <span className="text-[#747683] block uppercase tracking-wider text-[10px] font-semibold">Targeted Skills</span>
              <span className="text-lg font-bold text-[#24283A] font-mono">{progressSummary.totalTargeted}</span>
            </div>
            <div className="w-px h-8 bg-[#DDDCD5]" />
            <div>
              <span className="text-[#747683] block uppercase tracking-wider text-[10px] font-semibold">Roadmap Progress</span>
              <span className="text-lg font-bold text-[#2E8F86] font-mono">{progressSummary.completionRate}%</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Analysis Notice</p>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Target Role & Drive Configuration Box */}
      <div className="bg-[#F8F7F3] border border-[#DDDCD5] p-5 rounded-2xl shadow-sm space-y-4">
        <h2 className="text-sm font-bold font-outfit text-[#24283A] uppercase tracking-wider flex items-center gap-2">
          <Target className="w-4 h-4 text-[#5052C9]" />
          Select Target Career Role or Campus Drive
        </h2>

        {/* Preset Role Pills */}
        <div className="flex flex-wrap gap-2">
          {POPULAR_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => {
                setTargetRole(role);
                setCustomRole("");
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                targetRole === role && !customRole
                  ? "bg-[#5052C9] text-white border-[#5052C9] shadow-sm"
                  : "bg-[#FBFAF7] text-[#24283A] border-[#DDDCD5] hover:bg-[#EDECE7]"
              }`}
            >
              {role}
            </button>
          ))}
        </div>

        {/* Custom Role & Target Drive Select */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-[#292D40] mb-1">
              Custom Role Title (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Embedded Firmware Engineer"
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              className="w-full text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl px-3 py-2 text-[#24283A] focus:outline-none focus:ring-2 focus:ring-[#5052C9]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#292D40] mb-1">
              Campus Placement Drive (Optional)
            </label>
            <select
              value={selectedDriveId}
              onChange={(e) => setSelectedDriveId(e.target.value)}
              className="w-full text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl px-3 py-2 text-[#24283A] focus:outline-none focus:ring-2 focus:ring-[#5052C9]"
            >
              <option value="">General Industry Standard (No Specific Drive)</option>
              {drives.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.companyName} — {d.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#DDDCD5]/60">
          <p className="text-xs text-[#747683]">
            Targeting: <strong className="text-[#24283A]">{customRole.trim() || targetRole}</strong>
          </p>

          <div className="flex items-center gap-2">
            {analysis && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRunAnalysis(true)}
                disabled={isAnalyzing}
                className="text-xs border-[#DDDCD5] text-[#24283A]"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isAnalyzing ? "animate-spin" : ""}`} />
                Re-Analyze
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => handleRunAnalysis(false)}
              disabled={isAnalyzing}
              className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs font-semibold shadow-sm"
            >
              {isAnalyzing ? (
                <>
                  <BrandLoader size="inline" className="mr-1.5" />
                  Evaluating Skills...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-white" />
                  Analyze Skill Gap
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      {analysis && (
        <div className="flex items-center border-b border-[#DDDCD5] space-x-2">
          <button
            onClick={() => setActiveTab("analysis")}
            className={`pb-2.5 px-3.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "analysis"
                ? "border-[#5052C9] text-[#5052C9]"
                : "border-transparent text-[#747683] hover:text-[#24283A]"
            }`}
          >
            <Layers className="w-4 h-4" />
            Skill Gap Breakdown ({analysis.matchedSkills.length + analysis.missingRequiredSkills.length})
          </button>

          <button
            onClick={() => setActiveTab("roadmap")}
            className={`pb-2.5 px-3.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "roadmap"
                ? "border-[#5052C9] text-[#5052C9]"
                : "border-transparent text-[#747683] hover:text-[#24283A]"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Learning Roadmap ({analysis.learningRoadmap.length} Milestones)
          </button>

          <button
            onClick={() => setActiveTab("progress")}
            className={`pb-2.5 px-3.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "progress"
                ? "border-[#5052C9] text-[#5052C9]"
                : "border-transparent text-[#747683] hover:text-[#24283A]"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Progress &amp; Evidence Tracker ({progressItems.length})
          </button>
        </div>
      )}

      {/* TAB 1: SKILL GAP BREAKDOWN */}
      {analysis && activeTab === "analysis" && (
        <div className="space-y-6">
          {/* Readiness Score Card */}
          <div className="bg-[#FBFAF7] border border-[#DDDCD5] p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-center gap-6">
            <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white border border-[#DDDCD5] shadow-xs w-36 h-36 shrink-0">
              <span className="text-3xl font-extrabold font-outfit text-[#5052C9]">
                {analysis.overallReadinessScore}%
              </span>
              <span className="text-[11px] font-semibold text-[#747683] uppercase tracking-wider mt-1 text-center">
                Placement Readiness
              </span>
              <div className="w-full bg-[#EDECE7] h-1.5 rounded-full mt-2.5 overflow-hidden">
                <div
                  className="bg-[#5052C9] h-full rounded-full transition-all duration-500"
                  style={{ width: `${analysis.overallReadinessScore}%` }}
                />
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#2E8F86] text-white text-[10px]">Authoritative Evaluation</Badge>
                <span className="text-xs text-[#747683]">
                  Updated {new Date(analysis.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-base font-bold font-outfit text-[#24283A]">
                Target: {analysis.targetRole} {analysis.targetDriveTitle ? `(${analysis.targetDriveTitle})` : ""}
              </h3>
              <p className="text-xs text-[#292D40] leading-relaxed">
                {analysis.summary}
              </p>
              {analysis.marketContext && (
                <div className="p-2.5 rounded-lg bg-[#EDECE7]/60 border border-[#DDDCD5] text-xs text-[#292D40]/80">
                  <strong className="text-[#24283A]">Market Expectation:</strong> {analysis.marketContext}
                </div>
              )}
            </div>
          </div>

          {/* 4 Categorized Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Strongly Matched Skills */}
            <div className="bg-[#F8F7F3] border border-[#DDDCD5] p-4 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#DDDCD5]">
                <h4 className="text-xs font-bold font-outfit text-[#24283A] uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#2E8F86]" />
                  Verified &amp; Matched Skills ({analysis.matchedSkills.length})
                </h4>
                <span className="text-[10px] text-[#747683]">Profile Validated</span>
              </div>

              {analysis.matchedSkills.length === 0 ? (
                <p className="text-xs text-[#747683] italic">No strong matches identified yet. Update your career profile or project portfolio.</p>
              ) : (
                <div className="space-y-2.5">
                  {analysis.matchedSkills.map((s, idx) => (
                    <div key={idx} className="bg-[#FBFAF7] border border-[#DDDCD5] p-3 rounded-xl shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#24283A]">{s.name}</span>
                        {getEvidenceBadge(s.evidenceType)}
                      </div>
                      <p className="text-[11px] text-[#292D40]/75">{s.relevanceNote}</p>
                      {s.evidenceDetails && (
                        <p className="text-[10px] text-[#2E8F86] font-medium flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>{s.evidenceDetails}</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Missing Required Skills */}
            <div className="bg-[#F8F7F3] border border-[#DDDCD5] p-4 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#DDDCD5]">
                <h4 className="text-xs font-bold font-outfit text-red-800 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  Missing Required Skills ({analysis.missingRequiredSkills.length})
                </h4>
                <Badge variant="outline" className="border-red-300 text-red-700 text-[10px]">Mandatory</Badge>
              </div>

              {analysis.missingRequiredSkills.length === 0 ? (
                <p className="text-xs text-emerald-700 font-medium">All essential requirements are satisfied by your profile!</p>
              ) : (
                <div className="space-y-2.5">
                  {analysis.missingRequiredSkills.map((m, idx) => (
                    <div key={idx} className="bg-[#FBFAF7] border border-red-200/80 p-3 rounded-xl shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#24283A]">{m.name}</span>
                        <Badge className="bg-red-600 text-white text-[10px]">{m.importance}</Badge>
                      </div>
                      <p className="text-[11px] text-[#292D40]/80">
                        <strong>Why it matters:</strong> {m.whyItMatters}
                      </p>
                      <p className="text-[11px] text-[#5052C9] font-medium">
                        <strong>Next step:</strong> {m.recommendedAction}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Missing Preferred Skills */}
            <div className="bg-[#F8F7F3] border border-[#DDDCD5] p-4 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#DDDCD5]">
                <h4 className="text-xs font-bold font-outfit text-[#24283A] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#5052C9]" />
                  Missing Preferred Skills ({analysis.missingPreferredSkills.length})
                </h4>
                <span className="text-[10px] text-[#747683]">Competitive Advantage</span>
              </div>

              {analysis.missingPreferredSkills.length === 0 ? (
                <p className="text-xs text-[#747683]">No secondary skills missing.</p>
              ) : (
                <div className="space-y-2.5">
                  {analysis.missingPreferredSkills.map((p, idx) => (
                    <div key={idx} className="bg-[#FBFAF7] border border-[#DDDCD5] p-3 rounded-xl shadow-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#24283A]">{p.name}</span>
                        <Badge variant="outline" className="border-[#DDDCD5] text-[10px]">{p.importance}</Badge>
                      </div>
                      <p className="text-[11px] text-[#292D40]/75">{p.whyItMatters}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Skills with Insufficient Evidence */}
            <div className="bg-[#F8F7F3] border border-[#DDDCD5] p-4 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#DDDCD5]">
                <h4 className="text-xs font-bold font-outfit text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-amber-600" />
                  Insufficient Evidence ({analysis.skillsWithInsufficientEvidence.length})
                </h4>
                <Badge variant="outline" className="border-amber-300 text-amber-800 text-[10px]">Unverified</Badge>
              </div>

              {analysis.skillsWithInsufficientEvidence.length === 0 ? (
                <p className="text-xs text-emerald-700 font-medium">All listed skills have authentic repository or assessment evidence.</p>
              ) : (
                <div className="space-y-2.5">
                  {analysis.skillsWithInsufficientEvidence.map((ie, idx) => (
                    <div key={idx} className="bg-[#FBFAF7] border border-amber-200 p-3 rounded-xl shadow-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#24283A]">{ie.name}</span>
                        <Badge variant="outline" className="border-amber-400 text-amber-900 text-[10px]">
                          {ie.currentEvidence}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-amber-950/80">{ie.whyInsufficient}</p>
                      <p className="text-[11px] text-[#5052C9] font-medium">
                        <strong>Action:</strong> {ie.howToValidate}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LEARNING ROADMAP */}
      {analysis && activeTab === "roadmap" && (
        <div className="space-y-4">
          <div className="bg-[#F8F7F3] border border-[#DDDCD5] p-4 rounded-2xl shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold font-outfit text-[#24283A]">
                Structured Development Roadmap for {analysis.targetRole}
              </h3>
              <p className="text-xs text-[#747683]">
                Phased action plan derived from your verified skill delta and collegiate recruitment timelines.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {analysis.learningRoadmap.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#FBFAF7] border border-[#DDDCD5] p-5 rounded-2xl shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#DDDCD5]">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#5052C9] text-white text-[10px] uppercase font-bold">
                      {item.phase.replace("_", " ")}
                    </Badge>
                    <h4 className="text-sm font-bold font-outfit text-[#24283A]">
                      {item.skill}
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="border-[#DDDCD5] text-[#292D40]">
                      {item.priority} Priority
                    </Badge>
                    <span className="text-[#747683] font-mono text-[11px]">
                      {item.estimatedEffort}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#292D40]/80 leading-relaxed">
                  <strong>Why:</strong> {item.reason}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-[#EDECE7]/50 border border-[#DDDCD5] space-y-1.5">
                    <span className="font-bold text-[#24283A] block text-[11px] uppercase tracking-wider">
                      Learning Milestones
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-[#292D40]/80">
                      {item.learningMilestones.map((m, mIdx) => (
                        <li key={mIdx}>{m}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="p-3 rounded-xl bg-[#EDECE7]/50 border border-[#DDDCD5] space-y-1.5">
                    <span className="font-bold text-[#24283A] block text-[11px] uppercase tracking-wider">
                      Practical Exercises &amp; Projects
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-[#292D40]/80">
                      {item.practicalExercises.map((e, eIdx) => (
                        <li key={eIdx}>{e}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 text-xs text-[#2E8F86]">
                  <span>
                    <strong>Completion Criteria:</strong> {item.completionCriteria}
                  </span>
                  <button
                    onClick={() => {
                      setEvidenceModalSkill(item.skill);
                      setEvidenceTitle(`${item.skill} Proof of Work`);
                    }}
                    className="text-xs text-[#5052C9] font-bold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Attach Proof Link
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PROGRESS & EVIDENCE TRACKER */}
      {activeTab === "progress" && (
        <div className="space-y-4">
          <div className="bg-[#F8F7F3] border border-[#DDDCD5] p-5 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold font-outfit text-[#24283A]">
                Skill Development &amp; Evidence Tracker
              </h3>
              <p className="text-xs text-[#747683]">
                Manage learning statuses, commit proof of work, and bridge identified placement gaps.
              </p>
            </div>
          </div>

          {progressItems.length === 0 ? (
            <div className="p-12 text-center bg-[#F8F7F3] border border-[#DDDCD5] rounded-2xl space-y-2">
              <Compass className="w-8 h-8 text-[#747683] mx-auto" />
              <p className="text-sm font-bold text-[#24283A]">No skills tracked yet</p>
              <p className="text-xs text-[#747683]">
                Run an AI Skill Gap Analysis above to automatically populate your development roadmap.
              </p>
            </div>
          ) : (
            <div className="bg-[#FBFAF7] border border-[#DDDCD5] rounded-2xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#EDECE7] text-[#24283A] font-outfit font-semibold border-b border-[#DDDCD5]">
                    <tr>
                      <th className="p-3.5 pl-4">Skill</th>
                      <th className="p-3.5">Target Role</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5">Evidence Links</th>
                      <th className="p-3.5 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDDCD5]">
                    {progressItems.map((item) => (
                      <tr key={item.id} className="hover:bg-[#F8F7F3] transition-colors">
                        <td className="p-3.5 pl-4 font-bold text-[#24283A]">{item.skillName}</td>
                        <td className="p-3.5 text-[#747683]">{item.targetRole || "General"}</td>
                        <td className="p-3.5">
                          <select
                            value={item.status}
                            onChange={(e) => handleUpdateStatus(item.skillName, e.target.value as any)}
                            className="text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-lg px-2 py-1 text-[#24283A]"
                          >
                            <option value="NOT_STARTED">Not Started</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="PRACTICED">Practiced</option>
                            <option value="EVIDENCE_SUBMITTED">Evidence Submitted</option>
                            <option value="VERIFIED" disabled>Verified (Staff Only)</option>
                          </select>
                        </td>
                        <td className="p-3.5">
                          {item.evidenceLinks.length === 0 ? (
                            <span className="text-[#747683] italic">No links added</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {item.evidenceLinks.map((link, lIdx) => (
                                <a
                                  key={lIdx}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] bg-[#EDECE7] text-[#5052C9] hover:underline px-2 py-0.5 rounded-full border border-[#DDDCD5]"
                                >
                                  <span>{link.title}</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 pr-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEvidenceModalSkill(item.skillName);
                              setEvidenceTitle(`${item.skillName} Proof of Work`);
                            }}
                            className="text-xs text-[#5052C9] hover:bg-[#EDECE7]"
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add Evidence
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EVIDENCE SUBMISSION MODAL */}
      {evidenceModalSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FBFAF7] border border-[#DDDCD5] rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 font-inter">
            <div className="flex items-center justify-between pb-2 border-b border-[#DDDCD5]">
              <h3 className="text-sm font-bold font-outfit text-[#24283A]">
                Submit Evidence for {evidenceModalSkill}
              </h3>
              <button
                onClick={() => setEvidenceModalSkill(null)}
                className="text-[#747683] hover:text-[#24283A] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEvidence} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#292D40] mb-1">
                  Evidence Category
                </label>
                <select
                  value={evidenceType}
                  onChange={(e) => setEvidenceType(e.target.value as any)}
                  className="w-full text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl px-3 py-2 text-[#24283A]"
                >
                  <option value="GITHUB">GitHub Repository / Commit</option>
                  <option value="PROJECT">Live Project Deployment</option>
                  <option value="CERTIFICATE">Course / Credential URL</option>
                  <option value="ASSIGNMENT">Lab / Assignment Submission</option>
                  <option value="OTHER">Other Proof of Work</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292D40] mb-1">
                  Evidence Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Cache Implementation"
                  value={evidenceTitle}
                  onChange={(e) => setEvidenceTitle(e.target.value)}
                  className="w-full text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl px-3 py-2 text-[#24283A] focus:outline-none focus:ring-2 focus:ring-[#5052C9]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292D40] mb-1">
                  Public URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/username/project"
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                  className="w-full text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl px-3 py-2 text-[#24283A] focus:outline-none focus:ring-2 focus:ring-[#5052C9]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#292D40] mb-1">
                  Notes or Summary
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain how this artifact demonstrates proficiency..."
                  value={evidenceDesc}
                  onChange={(e) => setEvidenceDesc(e.target.value)}
                  className="w-full text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl px-3 py-2 text-[#24283A] focus:outline-none focus:ring-2 focus:ring-[#5052C9]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DDDCD5]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEvidenceModalSkill(null)}
                  className="text-xs border-[#DDDCD5]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSavingEvidence}
                  className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs font-semibold"
                >
                  {isSavingEvidence ? "Saving..." : "Submit Proof"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
