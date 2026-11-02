"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Calendar,
  Users,
  CheckCircle,
  PlusCircle,
  BarChart2,
  Clock,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";

export default function TrainingManagementPage() {
  const router = useRouter();
  const { role, isPlatformAdmin, isVerifiedMembership, isLoading: isLoadingAuth } = useAuthContext();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [impactResult, setImpactResult] = useState<any | null>(null);
  const [computingImpact, setComputingImpact] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canManageTraining =
    isPlatformAdmin ||
    (role && ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"].includes(role));

  useEffect(() => {
    if (!isLoadingAuth) {
      if (role === "STUDENT") {
        router.replace("/dashboard/student");
      } else if (!canManageTraining) {
        router.replace("/auth/access-denied");
      }
    }
  }, [role, canManageTraining, isLoadingAuth, router]);

  useEffect(() => {
    if (!isLoadingAuth && canManageTraining) {
      loadSessions();
    }
  }, [isLoadingAuth, canManageTraining]);

  async function loadSessions() {
    setLoading(true);
    try {
      const res = await fetch("/api/placement/training/sessions");
      if (res.ok) {
        const json = await res.json();
        setSessions(json.sessions || []);
      }
    } catch (err) {
      console.error("Error loading sessions:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleComputeImpact(sessionId: string) {
    setComputingImpact(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/placement/training/before-after/${sessionId}`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok) {
        setImpactResult(json.comparison);
      } else {
        setMessage(`Impact computation: ${json.error}`);
        setImpactResult(null);
      }
    } catch (err: any) {
      setMessage(`Failed: ${err.message}`);
    } finally {
      setComputingImpact(false);
    }
  }

  if (isLoadingAuth || (loading && sessions.length === 0)) {
    return <DashboardSkeleton />;
  }

  if (!canManageTraining) {
    return null;
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#DDDCD5] pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#24283A] font-['Outfit']">
            Training & Skill Interventions
          </h1>
          <p className="text-[#292D40] text-sm mt-1">
            Workshops, attendance verification, and paired baseline vs follow-up assessment evaluation.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3 bg-[#F8F7F3] border border-[#DDDCD5] text-[#24283A] text-sm rounded">
          {message}
        </div>
      )}

      {/* Sessions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[#24283A] font-['Outfit'] flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-[#5052C9]" />
                Scheduled & Completed Training Sessions
              </CardTitle>
              <CardDescription className="text-xs text-[#292D40]">
                Select a session to evaluate its verified attendee learning outcomes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-[#292D40] py-4">Loading training sessions...</p>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-[#292D40] text-sm">
                  No training sessions currently scheduled.
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      onClick={() => {
                        setSelectedSession(sess);
                        setImpactResult(null);
                        setMessage(null);
                      }}
                      className={`p-4 rounded-lg border transition-all cursor-pointer ${
                        selectedSession?.id === sess.id
                          ? "border-[#5052C9] bg-[#FBFAF7] ring-1 ring-[#5052C9]"
                          : "border-[#DDDCD5] bg-[#FBFAF7] hover:border-[#5052C9]/50"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-[#24283A]">{sess.title}</h4>
                          <p className="text-xs text-[#292D40] mt-1">Topic: {sess.topic}</p>
                        </div>
                        <Badge
                          variant={sess.status === "COMPLETED" ? "outline" : "secondary"}
                          className={sess.status === "COMPLETED" ? "border-[#2E8F86] text-[#2E8F86]" : ""}
                        >
                          {sess.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-[#292D40] mt-3 pt-2 border-t border-[#DDDCD5]">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#5052C9]" />
                          {new Date(sess.session_date).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[#2E8F86]" />
                          {sess.duration_minutes} Mins
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Selected Session & Before/After Evaluation */}
        <div className="space-y-4">
          <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-[#24283A] font-['Outfit'] flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-[#2E8F86]" />
                Paired Impact Analysis
              </CardTitle>
              <CardDescription className="text-xs text-[#292D40]">
                Strict paired observation delta for attending candidates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedSession ? (
                <p className="text-sm text-[#292D40] py-6 text-center">
                  Select a training session on the left to evaluate its paired assessment impact.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-[#FBFAF7] rounded border border-[#DDDCD5]">
                    <h4 className="font-semibold text-sm text-[#24283A]">{selectedSession.title}</h4>
                    <p className="text-xs text-[#292D40] mt-1">Topic: {selectedSession.topic}</p>
                  </div>

                  <Button
                    onClick={() => handleComputeImpact(selectedSession.id)}
                    disabled={computingImpact}
                    className="w-full bg-[#5052C9] hover:bg-[#4345B0] text-white"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    {computingImpact ? "Calculating..." : "Compute Paired Delta"}
                  </Button>

                  {impactResult && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-[#FBFAF7] rounded border border-[#DDDCD5]">
                          <p className="text-xs text-[#292D40]">Baseline Score</p>
                          <p className="text-lg font-bold text-[#24283A] font-['JetBrains_Mono']">
                            {impactResult.baseline_avg_score}%
                          </p>
                        </div>
                        <div className="p-3 bg-[#FBFAF7] rounded border border-[#DDDCD5]">
                          <p className="text-xs text-[#292D40]">Follow-up Score</p>
                          <p className="text-lg font-bold text-[#5052C9] font-['JetBrains_Mono']">
                            {impactResult.followup_avg_score}%
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-[#FBFAF7] rounded border border-[#DDDCD5] flex justify-between items-center">
                        <div>
                          <p className="text-xs text-[#292D40]">Absolute Delta</p>
                          <p className="text-lg font-bold text-[#2E8F86] font-['JetBrains_Mono']">
                            {impactResult.absolute_delta > 0 ? `+${impactResult.absolute_delta}%` : `${impactResult.absolute_delta}%`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#292D40]">Paired Students</p>
                          <p className="text-lg font-bold text-[#24283A] font-['JetBrains_Mono']">
                            {impactResult.paired_students_count}
                          </p>
                        </div>
                      </div>

                      {/* Mandatory Causal Disclaimer */}
                      <div className="p-3 bg-[#F8F7F3] border border-[#DDDCD5] rounded text-xs text-[#292D40] space-y-1">
                        <div className="flex items-center gap-1 font-semibold text-[#24283A]">
                          <AlertCircle className="w-3.5 h-3.5 text-[#5052C9]" />
                          Methodological Disclaimer
                        </div>
                        <p>{impactResult.limitations_disclaimer}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
