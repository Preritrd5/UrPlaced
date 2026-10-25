"use strict";
"use client";

import React, { useState } from "react";
import {
  Sparkles,
  X,
  Loader2,
  AlertCircle,
  Brain,
  Clock,
  ArrowRight,
  Target,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AIMistakeAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIMistakeAnalysisModal({ isOpen, onClose }: AIMistakeAnalysisModalProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/mistakes/analyze", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate mistake analysis.");
      }
      setAnalysis(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#24283A]/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#F8F7F3] border border-[#DDDCD5] rounded-xl shadow-xl w-full max-w-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#DDDCD5] flex items-center justify-between bg-[#FBFAF7]">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-[#5052C9]/10 text-[#5052C9]">
              <Brain className="w-5 h-5 text-[#5052C9]" />
            </span>
            <div>
              <h2 className="text-xl font-bold font-outfit text-[#24283A]">
                AI Mistake-to-Mastery Analysis
              </h2>
              <p className="text-xs text-[#292D40]/70 font-inter">
                Evidence-based conceptual gap diagnosis from your actual recorded assessment errors.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#292D40]/50 hover:text-[#24283A] p-1.5 rounded-lg hover:bg-[#EDECE7] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {!analysis && !loading && (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#5052C9]/10 text-[#5052C9] mx-auto flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h3 className="text-base font-bold text-[#24283A] font-outfit">
                  Run Diagnostic Analysis on Recorded Mistakes
                </h3>
                <p className="text-xs text-[#292D40]/70 font-inter leading-relaxed">
                  Our Gemini intelligence engine analyzes your error patterns, diagnoses underlying root-cause knowledge gaps, and recommends prioritized spaced-repetition actions.
                </p>
              </div>
              <Button
                onClick={handleRunAnalysis}
                className="bg-[#5052C9] hover:bg-[#4345B0] text-white font-medium"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze My Mistakes
              </Button>
            </div>
          )}

          {loading && (
            <div className="text-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#5052C9] mx-auto" />
              <p className="text-sm font-medium text-[#24283A]">
                Evaluating mistake history and synthesizing conceptual gaps...
              </p>
              <p className="text-xs text-[#292D40]/60">
                Grounding against verified questions and error frequency
              </p>
            </div>
          )}

          {analysis && (
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="bg-[#FBFAF7] border border-[#DDDCD5] p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#5052C9] uppercase tracking-wider">
                    Diagnostic Summary
                  </span>
                  <Badge variant="outline" className="text-xs border-[#DDDCD5] text-[#292D40]">
                    {analysis.totalMistakesAnalyzed} Errors Evaluated
                  </Badge>
                </div>
                <p className="text-sm text-[#24283A] font-inter leading-relaxed">
                  {analysis.summary}
                </p>
              </div>

              {/* Identified Gaps */}
              {analysis.identifiedGaps && analysis.identifiedGaps.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#24283A] uppercase tracking-wider font-outfit">
                    Identified Knowledge Gaps
                  </h4>
                  <div className="space-y-2">
                    {analysis.identifiedGaps.map((gap: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 bg-[#FBFAF7] border border-[#DDDCD5] rounded-lg space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#24283A]">
                            {gap.skillOrTopic}
                          </span>
                          <Badge
                            className={`text-[10px] ${
                              gap.severity === "HIGH"
                                ? "bg-rose-100 text-rose-800 border-rose-300"
                                : gap.severity === "MEDIUM"
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-emerald-100 text-emerald-800 border-emerald-300"
                            }`}
                          >
                            {gap.severity} Priority
                          </Badge>
                        </div>
                        <p className="text-xs text-[#292D40]/80">
                          <span className="font-semibold text-[#24283A]">Observed: </span>
                          {gap.observedPattern}
                        </p>
                        <p className="text-xs text-[#292D40]/80">
                          <span className="font-semibold text-[#24283A]">Root Cause Gap: </span>
                          {gap.rootCauseGap}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Actions */}
              {analysis.recommendedActions && analysis.recommendedActions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-[#24283A] uppercase tracking-wider font-outfit">
                    Prioritized Revision Roadmap
                  </h4>
                  <div className="space-y-2">
                    {analysis.recommendedActions.map((action: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3 bg-white border border-[#DDDCD5] rounded-lg flex items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-[#24283A]">
                            {idx + 1}. {action.action}
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-[#292D40]/60">
                            <span>Focus: {action.targetTopic}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {action.estimatedMinutes} mins
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs border-[#5052C9]/30 text-[#5052C9] shrink-0">
                          Step {action.priority || idx + 1}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#DDDCD5] bg-[#FBFAF7] flex items-center justify-between">
          <span className="text-[11px] text-[#292D40]/60">
            Recommendations update dynamically as you complete practice sessions
          </span>
          <div className="flex items-center gap-2">
            {analysis && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunAnalysis}
                disabled={loading}
                className="text-xs border-[#DDDCD5]"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Re-Analyze
              </Button>
            )}
            <Button
              size="sm"
              onClick={onClose}
              className="text-xs bg-[#5052C9] hover:bg-[#4345B0] text-white"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
