"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Bot,
  Layers,
  Award,
  HelpCircle,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/dialog-system";
import { FormattedAIResponse } from "@/components/ai/formatted-ai-response";
import { CompanyProfileData } from "@/modules/students/services/company-preparation-service";

export default function CompanyPreparationPage() {
  const [loading, setLoading] = React.useState(true);
  const [companies, setCompanies] = React.useState<CompanyProfileData[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedIndustry, setSelectedIndustry] = React.useState("ALL");
  const [selectedCompany, setSelectedCompany] = React.useState<CompanyProfileData | null>(null);

  // AI Practice Questions Modal/State
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiQuestions, setAiQuestions] = React.useState<any[] | null>(null);
  const [aiActiveTopic, setAiActiveTopic] = React.useState<string>("Technical Screening");

  // Load Companies
  const loadCompanies = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedIndustry !== "ALL") params.append("industry", selectedIndustry);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/student/company-preparation?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setCompanies(json.data || []);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, [selectedIndustry, searchQuery]);

  React.useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // Toggle Save Company
  const handleToggleSave = async (companyId: string, currentSaved: boolean) => {
    try {
      const res = await fetch("/api/student/company-preparation/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, isSaved: !currentSaved }),
      });
      if (res.ok) {
        setCompanies((prev) =>
          prev.map((c) => (c.id === companyId ? { ...c, isSaved: !currentSaved } : c))
        );
        if (selectedCompany && selectedCompany.id === companyId) {
          setSelectedCompany((prev) => (prev ? { ...prev, isSaved: !currentSaved } : null));
        }
      }
    } catch {
      // Continue
    }
  };

  // Toggle Module Completion
  const handleToggleModule = async (companyId: string, moduleId: string, isCompleted: boolean) => {
    try {
      const res = await fetch("/api/student/company-preparation/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, moduleId, isCompleted }),
      });
      if (res.ok) {
        const json = await res.json();
        const updatedProgress = json.data?.progressPercentage || 0;
        setCompanies((prev) =>
          prev.map((c) => (c.id === companyId ? { ...c, progressPercentage: updatedProgress } : c))
        );
        if (selectedCompany && selectedCompany.id === companyId) {
          setSelectedCompany((prev) =>
            prev ? { ...prev, progressPercentage: updatedProgress } : null
          );
        }
      }
    } catch {
      // Continue
    }
  };

  // Generate AI Practice Questions
  const handleGenerateAIQuestions = async (company: CompanyProfileData) => {
    try {
      setAiLoading(true);
      setAiQuestions(null);
      const role = company.roles[0]?.roleName || "Software Engineer";

      const res = await fetch("/api/student/company-preparation/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: company.name,
          roleName: role,
          topic: aiActiveTopic,
          difficulty: "INTERMEDIATE",
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setAiQuestions(json.data?.questions || []);
      }
    } catch {
      toast.error("Failed to generate questions. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold font-heading text-text-primary tracking-tight">
              Company-Specific Preparation
            </h1>
            <Badge variant="outline" className="border-secondary/40 text-secondary bg-[var(--color-secondary-subtle)] text-xs font-mono font-semibold">
              <Sparkles className="h-3 w-3 mr-1 text-secondary inline" /> Target Tracks
            </Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Tailor your interview preparation to specific campus recruiters, roles, hiring round workflows, and competencies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/student/mock-interview">
              <Bot className="h-4 w-4 mr-1.5" />
              Mock Interview Studio
            </Link>
          </Button>
          <Button asChild variant="primary" size="sm">
            <Link href="/dashboard/student/placement-practice">
              <BookOpen className="h-4 w-4 mr-1.5" />
              Practice Centre
            </Link>
          </Button>
        </div>
      </div>

      {/* Discovery Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-text-secondary" />
          <input
            type="text"
            placeholder="Search company (e.g. TCS, Infosys, Amazon, Accenture)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-border bg-card text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {["ALL", "Information Technology & Services", "Management Consulting", "Internet & Technology"].map((ind) => (
            <button
              key={ind}
              type="button"
              onClick={() => setSelectedIndustry(ind)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                selectedIndustry === ind
                  ? "border-primary bg-[var(--color-primary-subtle)] text-primary font-semibold"
                  : "border-border bg-card text-text-secondary hover:bg-surface"
              }`}
            >
              {ind === "ALL" ? "All Industries" : ind}
            </button>
          ))}
        </div>
      </div>

      {/* Company Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {companies.map((company) => (
          <Card
            key={company.id}
            className="border-border bg-card shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-surface border border-border flex items-center justify-center font-heading font-bold text-primary text-base">
                    {company.name.charAt(0)}
                  </div>
                  <div>
                    <CardTitle className="text-base font-heading">{company.name}</CardTitle>
                    <span className="text-[11px] text-text-secondary font-mono block">
                      {company.industry}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleSave(company.id, company.isSaved || false)}
                  className="text-text-secondary hover:text-amber-500 transition-colors p-1"
                >
                  {company.isSaved ? (
                    <BookmarkCheck className="h-5 w-5 text-amber-500 fill-amber-500" />
                  ) : (
                    <Bookmark className="h-5 w-5" />
                  )}
                </button>
              </div>

              <CardDescription className="text-xs line-clamp-2 mt-2">
                {company.description}
              </CardDescription>
              <div className="mt-2">
                <span className="text-[10px] text-amber-800 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 inline-block font-mono">
                  Indicative preparation guidance — not verified current hiring policy
                </span>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              {/* Target Roles */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono uppercase text-text-secondary">Target Roles:</span>
                <div className="flex flex-wrap gap-1.5">
                  {company.roles.map((r) => (
                    <Badge key={r.id} variant="outline" className="text-[11px] font-mono border-border bg-surface">
                      {r.roleName}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Prep Progress */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-text-secondary font-mono">
                  <span>Track Readiness</span>
                  <span>{company.progressPercentage || 0}% Complete</span>
                </div>
                <Progress value={company.progressPercentage || 0} className="h-1.5" />
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 justify-between text-xs"
                  onClick={() => setSelectedCompany(company)}
                >
                  <span>Explore Track</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                {company.websiteUrl && (
                  <Button asChild variant="ghost" size="sm" className="px-2 text-text-secondary">
                    <a href={company.websiteUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SELECTED COMPANY DETAIL MODAL / DRAWER */}
      {selectedCompany && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 sm:p-8 space-y-6">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold font-heading text-text-primary">
                    {selectedCompany.name}
                  </h2>
                  <Badge variant="outline" className="text-xs font-mono border-primary/40 text-primary">
                    {selectedCompany.industry}
                  </Badge>
                </div>
                <p className="text-xs text-text-secondary mt-1">{selectedCompany.description}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedCompany(null)}>
                ✕
              </Button>
            </div>

            {/* Hiring Workflow Journey */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold font-heading text-text-primary uppercase tracking-wider font-mono">
                Indicative Recruitment Workflow
              </h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {selectedCompany.hiringWorkflow.map((round) => (
                  <div key={round.roundNumber} className="p-3.5 rounded-xl bg-surface border border-border space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-primary text-white text-xs font-mono font-bold flex items-center justify-center">
                        {round.roundNumber}
                      </div>
                      <span className="text-xs font-bold text-text-primary">{round.title}</span>
                    </div>
                    <p className="text-[11px] text-text-secondary leading-relaxed">{round.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {round.focusAreas.map((f) => (
                        <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-card border border-border font-mono text-text-secondary">
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preparation Modules Checklist */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold font-heading text-text-primary uppercase tracking-wider font-mono">
                  Round-by-Round Preparation Track
                </h3>
                <span className="text-xs font-mono text-secondary">
                  {selectedCompany.progressPercentage || 0}% Progress
                </span>
              </div>

              <div className="space-y-2">
                {selectedCompany.prepTracks[0]?.modules?.map((mod) => (
                  <div
                    key={mod.id}
                    className="p-3.5 rounded-xl bg-surface border border-border flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                          {mod.category}
                        </Badge>
                        <span className="text-xs font-bold text-text-primary">{mod.title}</span>
                        <span className="text-[11px] text-text-secondary font-mono">({mod.estimatedMinutes} mins)</span>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">{mod.description}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {mod.keyTopics.map((k) => (
                          <span key={k} className="text-[10px] text-text-secondary font-mono">
                            • {k}
                          </span>
                        ))}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs whitespace-nowrap"
                      onClick={() => handleToggleModule(selectedCompany.id, mod.id, true)}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-secondary" />
                      Mark Done
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons: AI Practice & Mock Interview */}
            <div className="p-4 rounded-xl bg-surface border border-border space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold font-heading text-text-primary">
                    AI Practice &amp; Mock Interview Studio
                  </h4>
                  <p className="text-xs text-text-secondary">
                    Launch targeted interview simulations grounded in {selectedCompany.name}&apos;s profile.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateAIQuestions(selectedCompany)}
                    disabled={aiLoading}
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1 text-primary" />
                    {aiLoading ? "Generating..." : "Generate AI Practice"}
                  </Button>

                  <Button asChild variant="primary" size="sm">
                    <Link
                      href={`/dashboard/student/mock-interview?company=${encodeURIComponent(
                        selectedCompany.name
                      )}&role=${encodeURIComponent(
                        selectedCompany.roles[0]?.roleName || "Software Engineer"
                      )}&type=COMPANY_SPECIFIC`}
                    >
                      <Bot className="h-3.5 w-3.5 mr-1" />
                      Mock Interview Studio
                    </Link>
                  </Button>
                </div>
              </div>

              {/* AI Generated Questions Display */}
              {aiQuestions && aiQuestions.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-[11px] text-text-secondary">
                    <strong className="text-primary font-medium">Practice Notice:</strong> All interview questions are simulated AI-generated preparation prompts based on general industry benchmarks. They do not reproduce proprietary or confidential question banks.
                  </div>
                  <span className="text-xs font-mono text-primary font-semibold">
                    ✨ Generated Practice Questions:
                  </span>
                  {aiQuestions.map((q, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-card border border-border space-y-2 text-xs">
                      <p className="font-semibold text-text-primary">{q.questionText}</p>
                      {q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-text-secondary">
                          {q.options.map((opt: string, i: number) => (
                            <div key={i} className="p-1 rounded bg-surface border border-border">
                              {opt}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="p-2.5 rounded bg-surface border border-border text-[11px] text-text-secondary space-y-1">
                        <span className="font-semibold text-secondary">Explanation:</span>
                        <FormattedAIResponse content={q.explanation} className="text-[11px]" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-2 border-t border-border">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-text-secondary font-mono">
                  {selectedCompany.overviewNotes}
                </span>
                <span className="text-[10px] text-amber-800 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-mono w-fit">
                  {selectedCompany.provenance?.disclaimer || "Indicative preparation guidance — not a verified current company hiring policy."}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedCompany(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
