"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart3,
  Download,
  Users,
  Award,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  Activity,
  Percent,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AnalyticsData {
  placement: {
    totalEligibleStudents: number;
    uniquePlacedStudents: number;
    placementRatePercentage: number | null;
    totalApplications: number;
    totalOffersExtended: number;
    acceptedOffersCount: number;
    averageOffersPerPlacedStudent: number | null;
    dataSource: { calculatedAt: string; hasSufficientData: boolean };
  };
  preparation: {
    totalAssigned: number;
    totalCompleted: number;
    completionRatePercentage: number | null;
    averageCohortScore: number | null;
    totalPracticeSessions: number;
    dataSource: { calculatedAt: string; hasSufficientData: boolean };
  };
  mastery: {
    totalMistakesCaptured: number;
    activeMistakesCount: number;
    masteredMistakesCount: number;
    masteryResolutionRatePercentage: number | null;
  };
  topicHeatmap: Array<{
    topic: string;
    skillName?: string;
    totalAttempts: number;
    correctAttempts: number;
    accuracyPercentage: number;
    weaknessSeverity: "CRITICAL_WEAKNESS" | "MODERATE_WEAKNESS" | "COMPETENT" | "STRONG";
  }>;
}

export default function AnalyticsDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchCohortAnalytics();
  }, []);

  async function fetchCohortAnalytics() {
    setLoading(true);
    try {
      const res = await fetch("/api/placement/analytics/cohort");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportCsv(reportType: string) {
    setExporting(true);
    try {
      const res = await fetch("/api/placement/analytics/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportType.toLowerCase()}_export.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#DDDCD5] pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#24283A] font-['Outfit']">
            Placement & Institutional Analytics
          </h1>
          <p className="text-[#292D40] text-sm mt-1">
            Evidence-based cohort metrics, assessment tracking, and verifiable topic weakness heatmaps.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleExportCsv("PLACEMENT_OUTCOMES")}
            disabled={exporting}
            variant="outline"
            className="border-[#DDDCD5] text-[#24283A] hover:bg-[#F8F7F3]"
          >
            <Download className="w-4 h-4 mr-2 text-[#5052C9]" />
            Export Outcomes CSV
          </Button>
          <Button
            onClick={() => handleExportCsv("COHORT_SKILL_GAPS")}
            disabled={exporting}
            className="bg-[#5052C9] hover:bg-[#4345B0] text-white"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Heatmap CSV
          </Button>
        </div>
      </div>

      {/* Institutional Evidence Notice */}
      <div className="rounded-lg p-4 bg-[#F8F7F3] border border-[#DDDCD5] flex items-start gap-3">
        <Activity className="w-5 h-5 text-[#2E8F86] mt-0.5 flex-shrink-0" />
        <div className="text-xs text-[#292D40] space-y-1">
          <p className="font-semibold text-[#24283A]">Institutional Measurement Invariant</p>
          <p>
            All metrics shown are mathematically calculated from verified candidate registrations, official offers,
            and actual student assessment attempts. No hypothetical or decorative predictive probabilities are displayed.
          </p>
        </div>
      </div>

      {/* High-Level Placement Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[#292D40]">
              Unique Placed Students
            </CardTitle>
            <Users className="w-4 h-4 text-[#5052C9]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#24283A] font-['Outfit']">
              {loading ? "..." : data?.placement.uniquePlacedStudents ?? 0}
            </div>
            <p className="text-xs text-[#292D40] mt-1">
              Out of {data?.placement.totalEligibleStudents ?? 0} eligible candidates
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[#292D40]">
              Verified Placement Rate
            </CardTitle>
            <Percent className="w-4 h-4 text-[#2E8F86]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#24283A] font-['Outfit']">
              {loading
                ? "..."
                : data?.placement.placementRatePercentage !== null && data?.placement.placementRatePercentage !== undefined
                ? `${data.placement.placementRatePercentage}%`
                : "Insufficient Data"}
            </div>
            <p className="text-xs text-[#292D40] mt-1">Placed / Participating Cohort</p>
          </CardContent>
        </Card>

        <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[#292D40]">
              Offers Extended
            </CardTitle>
            <Award className="w-4 h-4 text-[#5052C9]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#24283A] font-['Outfit']">
              {loading ? "..." : data?.placement.totalOffersExtended ?? 0}
            </div>
            <p className="text-xs text-[#292D40] mt-1">
              {data?.placement.acceptedOffersCount ?? 0} confirmed acceptances
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[#292D40]">
              Avg Offers / Placed Student
            </CardTitle>
            <BarChart3 className="w-4 h-4 text-[#2E8F86]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#24283A] font-['Outfit']">
              {loading
                ? "..."
                : data?.placement.averageOffersPerPlacedStudent !== null &&
                  data?.placement.averageOffersPerPlacedStudent !== undefined
                ? data.placement.averageOffersPerPlacedStudent
                : "N/A"}
            </div>
            <p className="text-xs text-[#292D40] mt-1">Distribution across placed candidates</p>
          </CardContent>
        </Card>
      </div>

      {/* Assessment Preparation & Mastery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assessment Participation */}
        <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#24283A] font-['Outfit'] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#5052C9]" />
              Assessment & Practice Participation
            </CardTitle>
            <CardDescription className="text-xs text-[#292D40]">
              Completion rates and performance in assigned recruitment assessments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-[#FBFAF7] rounded border border-[#DDDCD5]">
                <p className="text-xs text-[#292D40]">Assigned Assessments</p>
                <p className="text-xl font-bold text-[#24283A] mt-1 font-['Outfit']">
                  {loading ? "..." : data?.preparation.totalAssigned ?? 0}
                </p>
              </div>
              <div className="p-3 bg-[#FBFAF7] rounded border border-[#DDDCD5]">
                <p className="text-xs text-[#292D40]">Completed Submissions</p>
                <p className="text-xl font-bold text-[#24283A] mt-1 font-['Outfit']">
                  {loading ? "..." : data?.preparation.totalCompleted ?? 0}
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#FBFAF7] rounded border border-[#DDDCD5] flex justify-between items-center">
              <div>
                <p className="text-xs text-[#292D40]">Completion Rate</p>
                <p className="text-lg font-bold text-[#24283A] font-['Outfit']">
                  {data?.preparation.completionRatePercentage !== null &&
                  data?.preparation.completionRatePercentage !== undefined
                    ? `${data.preparation.completionRatePercentage}%`
                    : "Insufficient Data"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#292D40]">Average Cohort Score</p>
                <p className="text-lg font-bold text-[#5052C9] font-['Outfit']">
                  {data?.preparation.averageCohortScore !== null && data?.preparation.averageCohortScore !== undefined
                    ? `${data.preparation.averageCohortScore}%`
                    : "No Submissions"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Mistake-to-Mastery Progression */}
        <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#24283A] font-['Outfit'] flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-[#2E8F86]" />
              Mistake-to-Mastery Resolution
            </CardTitle>
            <CardDescription className="text-xs text-[#292D40]">
              Remediation progress across student mistake targets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-[#FBFAF7] rounded border border-[#DDDCD5]">
                <p className="text-xs text-[#292D40]">Captured Targets</p>
                <p className="text-lg font-bold text-[#24283A] mt-1 font-['Outfit']">
                  {loading ? "..." : data?.mastery.totalMistakesCaptured ?? 0}
                </p>
              </div>
              <div className="p-3 bg-[#FBFAF7] rounded border border-[#DDDCD5]">
                <p className="text-xs text-[#292D40]">Active / Review</p>
                <p className="text-lg font-bold text-[#5052C9] mt-1 font-['Outfit']">
                  {loading ? "..." : data?.mastery.activeMistakesCount ?? 0}
                </p>
              </div>
              <div className="p-3 bg-[#FBFAF7] rounded border border-[#DDDCD5]">
                <p className="text-xs text-[#292D40]">Mastered</p>
                <p className="text-lg font-bold text-[#2E8F86] mt-1 font-['Outfit']">
                  {loading ? "..." : data?.mastery.masteredMistakesCount ?? 0}
                </p>
              </div>
            </div>

            <div className="p-3 bg-[#FBFAF7] rounded border border-[#DDDCD5] flex justify-between items-center">
              <div>
                <p className="text-xs text-[#292D40]">Resolution Rate</p>
                <p className="text-lg font-bold text-[#2E8F86] font-['Outfit']">
                  {data?.mastery.masteryResolutionRatePercentage !== null &&
                  data?.mastery.masteryResolutionRatePercentage !== undefined
                    ? `${data.mastery.masteryResolutionRatePercentage}%`
                    : "No Targets Recorded"}
                </p>
              </div>
              <Badge variant="outline" className="border-[#2E8F86] text-[#2E8F86]">
                Target Remediation
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Topic Weakness Heatmap Table */}
      <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#24283A] font-['Outfit'] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#5052C9]" />
            Cohort Topic Weakness Heatmap
          </CardTitle>
          <CardDescription className="text-xs text-[#292D40]">
            Topics with highest observed failure rates in assessments and targeted practice
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-[#292D40] py-4">Aggregating topic statistics...</p>
          ) : !data?.topicHeatmap || data.topicHeatmap.length === 0 ? (
            <div className="text-center py-8 text-[#292D40] text-sm">
              No attempt data currently available to construct a topic heatmap.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#DDDCD5] text-xs font-semibold uppercase text-[#292D40]">
                    <th className="py-3 px-4">Topic</th>
                    <th className="py-3 px-4">Skill Family</th>
                    <th className="py-3 px-4 text-center">Attempts</th>
                    <th className="py-3 px-4 text-center">Correct</th>
                    <th className="py-3 px-4 text-center">Accuracy</th>
                    <th className="py-3 px-4 text-right">Weakness Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDDCD5]">
                  {data.topicHeatmap.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#FBFAF7] transition-colors">
                      <td className="py-3 px-4 font-medium text-[#24283A]">{item.topic}</td>
                      <td className="py-3 px-4 text-[#292D40]">{item.skillName || "General"}</td>
                      <td className="py-3 px-4 text-center text-[#24283A]">{item.totalAttempts}</td>
                      <td className="py-3 px-4 text-center text-[#24283A]">{item.correctAttempts}</td>
                      <td className="py-3 px-4 text-center font-bold text-[#24283A] font-['JetBrains_Mono']">
                        {item.accuracyPercentage}%
                      </td>
                      <td className="py-3 px-4 text-right">
                        {item.weaknessSeverity === "CRITICAL_WEAKNESS" ? (
                          <Badge variant="danger">Critical (&lt;50%)</Badge>
                        ) : item.weaknessSeverity === "MODERATE_WEAKNESS" ? (
                          <Badge variant="secondary" className="bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30">
                            Moderate (50-70%)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-[#2E8F86] text-[#2E8F86]">
                            Competent (&ge;70%)
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
