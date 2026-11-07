"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  Award,
  BookOpen,
  CheckCircle,
  Clock,
  ArrowRight,
  Flame,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandLoader } from "@/components/common/brand-loader";
import { AnalyticsSkeleton } from "@/components/ui/page-skeletons";

export default function StudentAnalyticsPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverview();
  }, []);

  async function loadOverview() {
    setLoading(true);
    try {
      const res = await fetch("/api/student/analytics/overview");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load student analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  const summary = data?.summary;
  const attempts = data?.recentAttempts || [];

  if (loading) {
    return <AnalyticsSkeleton />;
  }

  return (
    <div className="space-y-8 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#DDDCD5] pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#24283A] font-['Outfit']">
            My Learning & Placement Analytics
          </h1>
          <p className="text-[#292D40] text-sm mt-1">
            Personal assessment performance, mistake remediation tracking, and practice consistency.
          </p>
        </div>
        <Link href="/dashboard/student/mistakes">
          <Button className="bg-[#5052C9] hover:bg-[#4345B0] text-white">
            <CheckCircle className="w-4 h-4 mr-2" />
            Go to Mistake Bank
          </Button>
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[#292D40]">
              Average Assessment Score
            </CardTitle>
            <Award className="w-4 h-4 text-[#5052C9]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#24283A] font-['JetBrains_Mono']">
              {loading
                ? "..."
                : summary?.averageScorePercentage !== null && summary?.averageScorePercentage !== undefined
                ? `${summary.averageScorePercentage}%`
                : "No Attempts"}
            </div>
            <p className="text-xs text-[#292D40] mt-1">Across all scored submissions</p>
          </CardContent>
        </Card>

        <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[#292D40]">
              Completed Assessments
            </CardTitle>
            <BookOpen className="w-4 h-4 text-[#2E8F86]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#24283A] font-['Outfit']">
              {loading ? "..." : summary?.completedAttemptsCount ?? 0}
            </div>
            <p className="text-xs text-[#292D40] mt-1">Total {summary?.totalAttempts ?? 0} attempts</p>
          </CardContent>
        </Card>

        <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[#292D40]">
              Practice Sessions
            </CardTitle>
            <Clock className="w-4 h-4 text-[#5052C9]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#24283A] font-['Outfit']">
              {loading ? "..." : summary?.totalPracticeSessions ?? 0}
            </div>
            <p className="text-xs text-[#292D40] mt-1">Targeted question practice</p>
          </CardContent>
        </Card>

        <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[#292D40]">
              Mistake Resolution
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-[#2E8F86]" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#2E8F86] font-['JetBrains_Mono']">
              {loading
                ? "..."
                : summary?.masteryResolutionRate !== null && summary?.masteryResolutionRate !== undefined
                ? `${summary.masteryResolutionRate}%`
                : "0%"}
            </div>
            <p className="text-xs text-[#292D40] mt-1">
              {summary?.masteredMistakesCount ?? 0} / {summary?.totalMistakesCaptured ?? 0} mastered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Attempts */}
      <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#24283A] font-['Outfit']">
            Recent Assessment Activity
          </CardTitle>
          <CardDescription className="text-xs text-[#292D40]">
            Your latest timed and diagnostic assessment records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex items-center justify-center">
              <BrandLoader size="card" aria-label="Loading attempts..." />
            </div>
          ) : attempts.length === 0 ? (
            <div className="text-center py-8 text-[#292D40] text-sm">
              No recent assessment attempts recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-[#DDDCD5] text-xs font-semibold uppercase text-[#292D40]">
                    <th className="py-3 px-4">Assessment Title</th>
                    <th className="py-3 px-4">Date Started</th>
                    <th className="py-3 px-4 text-center">Score</th>
                    <th className="py-3 px-4 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDDCD5]">
                  {attempts.map((att: any) => (
                    <tr key={att.id} className="hover:bg-[#FBFAF7] transition-colors">
                      <td className="py-3 px-4 font-medium text-[#24283A]">
                        {att.assessments?.title || "Assessment"}
                      </td>
                      <td className="py-3 px-4 text-[#292D40]">
                        {new Date(att.started_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-[#24283A] font-['JetBrains_Mono']">
                        {att.score_percentage !== null ? `${att.score_percentage}%` : "--"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Badge
                          variant={["SUBMITTED", "SCORED", "RESULT_RELEASED", "GRADED"].includes(att.status) ? "outline" : "secondary"}
                          className={["SUBMITTED", "SCORED", "RESULT_RELEASED", "GRADED"].includes(att.status) ? "border-[#2E8F86] text-[#2E8F86]" : ""}
                        >
                          {att.status}
                        </Badge>
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
