"use strict";
"use client";

import React, { useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Target,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { BrandLoader } from "@/components/common/brand-loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AIDriveFitEvaluationCardProps {
  driveId: string;
  companyName: string;
  driveTitle: string;
}

export function AIDriveFitEvaluationCard({
  driveId,
  companyName,
  driveTitle,
}: AIDriveFitEvaluationCardProps) {
  const [loading, setLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunEvaluation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/drivefit/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to evaluate DriveFit readiness.");
      }
      setEvaluation(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const getEligibilityBadge = (status: string) => {
    switch (status) {
      case "ELIGIBLE":
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Verified Eligible
          </Badge>
        );
      case "INELIGIBLE":
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            Criteria Not Met
          </Badge>
        );
      case "CONDITIONAL":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
            Conditional Match
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-700 border-gray-300 flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
            Eligibility Unknown (Incomplete Profile)
          </Badge>
        );
    }
  };

  return (
    <Card className="border-[#DDDCD5] bg-[#F8F7F3] shadow-sm overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-[#DDDCD5] bg-[#FBFAF7] flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-[#5052C9]/10 text-[#5052C9]">
            <Sparkles className="w-4 h-4 text-[#5052C9]" />
          </span>
          <CardTitle className="text-base font-bold font-outfit text-[#24283A]">
            AI DriveFit Match & Preparation Roadmap
          </CardTitle>
        </div>

        {!evaluation && (
          <Button
            size="sm"
            onClick={handleRunEvaluation}
            disabled={loading}
            className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs"
          >
            {loading ? (
              <BrandLoader size="button" className="mr-1.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            )}
            Evaluate DriveFit
          </Button>
        )}
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        {!evaluation && !loading && (
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-[#292D40]/70 font-inter max-w-lg mx-auto">
              Evaluate your academic qualifications and skill proficiency against {companyName}&apos;s verified recruitment criteria to receive a personalized, stage-by-stage preparation roadmap.
            </p>
          </div>
        )}

        {loading && (
          <div className="text-center py-6 space-y-2">
            <BrandLoader size="card" className="mx-auto" />
            <p className="text-xs font-medium text-[#24283A]">
              Matching your academic records and skill history against {companyName}&apos;s recruitment criteria...
            </p>
          </div>
        )}

        {evaluation && (
          <div className="space-y-5">
            {/* Fit Score & Status row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-white border border-[#DDDCD5] text-center space-y-1">
                <span className="text-[11px] font-semibold text-[#292D40]/60 uppercase tracking-wider">
                  Overall DriveFit Score
                </span>
                <div className="text-2xl font-bold font-mono text-[#5052C9]">
                  {evaluation.overallFitScore}%
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white border border-[#DDDCD5] text-center space-y-1">
                <span className="text-[11px] font-semibold text-[#292D40]/60 uppercase tracking-wider">
                  Eligibility Status
                </span>
                <div className="pt-1 flex justify-center">
                  {getEligibilityBadge(evaluation.eligibilityStatus)}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white border border-[#DDDCD5] text-center space-y-1">
                <span className="text-[11px] font-semibold text-[#292D40]/60 uppercase tracking-wider">
                  Target Company
                </span>
                <div className="text-sm font-bold text-[#24283A] pt-1">
                  {evaluation.companyName}
                </div>
              </div>
            </div>

            {/* Eligibility Note / Missing Fields */}
            {evaluation.eligibilityDetails?.notes && (
              <div className="p-3 bg-[#FBFAF7] border border-[#DDDCD5] rounded-lg text-xs space-y-1">
                <span className="font-semibold text-[#24283A]">Eligibility Assessment:</span>
                <p className="text-[#292D40]/80 leading-relaxed">
                  {evaluation.eligibilityDetails.notes}
                </p>
                {evaluation.eligibilityDetails.missingProfileFields?.length > 0 && (
                  <p className="text-amber-800 text-[11px] font-medium pt-1">
                    Missing in profile: {evaluation.eligibilityDetails.missingProfileFields.join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Skill Match Breakdown */}
            {evaluation.skillMatchAnalysis && evaluation.skillMatchAnalysis.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#24283A] uppercase tracking-wider font-outfit">
                  Key Skill Match Analysis
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {evaluation.skillMatchAnalysis.map((skill: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-white border border-[#DDDCD5] rounded-lg text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#24283A]">{skill.skillName}</span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-[#DDDCD5]">
                          {skill.importance}
                        </Badge>
                      </div>
                      <p className="text-[#292D40]/70 text-[11px]">{skill.gapSummary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preparation Roadmap */}
            {evaluation.preparationRoadmap && evaluation.preparationRoadmap.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-[#24283A] uppercase tracking-wider font-outfit">
                  Recommended Preparation Roadmap
                </span>
                <div className="space-y-2">
                  {evaluation.preparationRoadmap.map((stage: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3 bg-white border border-[#DDDCD5] rounded-lg space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#24283A]">{stage.stage}</span>
                        <span className="text-[11px] text-[#292D40]/60 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {stage.recommendedHours} hrs
                        </span>
                      </div>
                      {stage.actionItems && stage.actionItems.length > 0 && (
                        <ul className="list-disc list-inside text-[11px] text-[#292D40]/80 space-y-0.5">
                          {stage.actionItems.map((act: string, aIdx: number) => (
                            <li key={aIdx}>{act}</li>
                          ))}
                        </ul>
                      )}
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
