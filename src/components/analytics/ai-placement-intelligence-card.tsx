"use strict";
"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Target,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function AIPlacementIntelligenceCard() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/placement/insights");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load placement intelligence.");
      }
      setReport(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const getInsightBadge = (category: string) => {
    switch (category) {
      case "COHORT_STRENGTH":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Cohort Strength</Badge>;
      case "SKILL_DEFICIENCY":
        return <Badge className="bg-rose-100 text-rose-800 border-rose-300">Skill Deficiency</Badge>;
      case "DRIVE_ALIGNMENT":
        return <Badge className="bg-[#5052C9]/15 text-[#5052C9] border-[#5052C9]/30">Drive Alignment</Badge>;
      case "TRAINING_NEED":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300">Training Need</Badge>;
      default:
        return <Badge variant="outline">{category}</Badge>;
    }
  };

  return (
    <Card className="bg-[#F8F7F3] border-[#DDDCD5] shadow-sm overflow-hidden">
      <CardHeader className="p-6 pb-4 border-b border-[#DDDCD5] bg-[#FBFAF7] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#5052C9]/10 text-[#5052C9]">
              <Sparkles className="w-5 h-5 text-[#5052C9]" />
            </span>
            <CardTitle className="text-lg font-bold font-['Outfit'] text-[#24283A]">
              AI Placement Intelligence Advisor
            </CardTitle>
            <Badge variant="outline" className="text-xs bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30">
              PII-Redacted
            </Badge>
          </div>
          <CardDescription className="text-xs text-[#292D40]/70 font-['Inter']">
            Automated institutional strategic insights, cohort readiness synthesis, and training interventions powered by Gemini.
          </CardDescription>
        </div>

        <div>
          <Button
            size="sm"
            onClick={fetchInsights}
            disabled={loading}
            className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
            ) : report ? (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            )}
            {report ? "Refresh Insights" : "Generate Strategic Insights"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {!report && !loading && (
          <div className="text-center py-6 space-y-2">
            <p className="text-xs text-[#292D40]/70 max-w-lg mx-auto">
              Click &quot;Generate Strategic Insights&quot; to synthesize your college cohort&apos;s assessment performance, mistake distribution, and recruitment drive preparation into high-impact training recommendations.
            </p>
          </div>
        )}

        {loading && (
          <div className="text-center py-8 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#5052C9] mx-auto" />
            <p className="text-sm font-medium text-[#24283A]">
              Aggregating anonymized cohort performance and generating strategic recommendations...
            </p>
            <p className="text-xs text-[#292D40]/60">
              Strict privacy guarantee: Zero student personal identifiers are transmitted
            </p>
          </div>
        )}

        {report && (
          <div className="space-y-6">
            {/* Top Readiness Index Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white border border-[#DDDCD5] text-center space-y-1">
                <span className="text-[11px] font-semibold text-[#292D40]/60 uppercase tracking-wider">
                  Placement Readiness Index
                </span>
                <div className="text-3xl font-bold font-mono text-[#5052C9]">
                  {report.cohortSummary?.readinessIndex || 70}/100
                </div>
                <p className="text-[11px] text-[#292D40]/70">Calculated from cohort skill coverage</p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#DDDCD5] text-center space-y-1">
                <span className="text-[11px] font-semibold text-[#292D40]/60 uppercase tracking-wider">
                  Registered Students
                </span>
                <div className="text-3xl font-bold font-mono text-[#24283A]">
                  {report.cohortSummary?.totalStudents || 0}
                </div>
                <p className="text-[11px] text-[#292D40]/70">Eligible cohort size</p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#DDDCD5] text-center space-y-1">
                <span className="text-[11px] font-semibold text-[#292D40]/60 uppercase tracking-wider">
                  Active Recruitment Drives
                </span>
                <div className="text-3xl font-bold font-mono text-[#2E8F86]">
                  {report.cohortSummary?.totalDrivesActive || 0}
                </div>
                <p className="text-[11px] text-[#292D40]/70">Active campus pipelines</p>
              </div>
            </div>

            {/* Strategic Key Insights */}
            {report.keyInsights && report.keyInsights.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#24283A] uppercase tracking-wider font-['Outfit']">
                  Strategic Placement Insights & Observations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {report.keyInsights.map((insight: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 bg-white border border-[#DDDCD5] rounded-xl space-y-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        {getInsightBadge(insight.category)}
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            insight.priority === "HIGH"
                              ? "text-rose-700 border-rose-300"
                              : "text-[#292D40] border-[#DDDCD5]"
                          }`}
                        >
                          {insight.priority} Priority
                        </Badge>
                      </div>

                      <h4 className="text-sm font-bold text-[#24283A] font-['Outfit']">
                        {insight.title}
                      </h4>
                      <p className="text-xs text-[#292D40]/80 leading-relaxed font-['Inter']">
                        {insight.description}
                      </p>

                      {insight.evidenceMetrics && (
                        <div className="pt-1 text-[11px] text-[#5052C9] font-medium flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          <span>Evidence: {insight.evidenceMetrics}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Interventions */}
            {report.recommendedInterventions && report.recommendedInterventions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#24283A] uppercase tracking-wider font-['Outfit']">
                  Recommended Training Interventions & Workshops
                </h3>
                <div className="space-y-2">
                  {report.recommendedInterventions.map((interv: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-white border border-[#DDDCD5] rounded-xl flex items-center justify-between gap-4 shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#24283A]">
                            {interv.title}
                          </span>
                          <Badge variant="outline" className="text-[10px] border-[#DDDCD5] text-[#292D40]">
                            {interv.format?.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#292D40]/70">
                          Target: <strong className="text-[#24283A]">{interv.targetDomain}</strong> • Impact: {interv.impactPotential}
                        </p>
                      </div>

                      <Badge className="bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30 text-xs shrink-0">
                        Actionable
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
