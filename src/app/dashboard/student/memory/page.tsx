"use client";

import React, { useEffect, useState } from "react";
import {
  Archive,
  Building2,
  FileText,
  Send,
  CheckCircle,
  HelpCircle,
  UserCheck,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/skeleton";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { FeatureLockedCard } from "@/components/ui/feature-locked-card";

export default function StudentPlacementMemoryPage() {
  const { isPlatformAdmin, isLoading: isLoadingAuth, tenant } = useAuthContext();
  const [records, setRecords] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const isEntitled =
    isPlatformAdmin || (tenant?.entitlements ? tenant.entitlements["placement_memory_analytics"] !== false : true);

  // Form State
  const [companyId, setCompanyId] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [recruitmentCycle, setRecruitmentCycle] = useState("2026-2027");
  const [notes, setNotes] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoadingAuth && isEntitled) {
      loadMemoryData();
    }
  }, [isLoadingAuth, isEntitled]);

  async function loadMemoryData() {
    setLoading(true);
    try {
      const [recRes, repRes, compRes] = await Promise.all([
        fetch("/api/student/memory/records"),
        fetch("/api/student/memory/reports"),
        fetch("/api/placement/companies?pageSize=50").catch(() => null),
      ]);
      if (recRes.ok) {
        const json = await recRes.json();
        setRecords(json.records || []);
      }
      if (repRes.ok) {
        const json = await repRes.json();
        setReports(json.reports || []);
      }
      if (compRes && compRes.ok) {
        const json = await compRes.json();
        const list = json.companies || json.data || [];
        setCompanies(list);
        if (list.length > 0) {
          setCompanyId(list[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading student memory:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!roleTitle || !recruitmentCycle) {
      setFeedback("Please enter the role title and recruitment cycle.");
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      // For student debrief, we submit rounds described
      const selectedComp = companies.find((c) => c.id === companyId);
      const payload = {
        companyId: companyId || companies[0]?.id || undefined,
        companyName: selectedComp?.name || "Hiring Partner",
        roleTitle,
        recruitmentCycle,
        roundsDescribed: [
          {
            roundNumber: 1,
            roundName: "Online Assessment / Technical Round",
            description: notes || "Technical MCQs and coding challenges",
          },
        ],
        isAnonymous,
        notes,
      };

      const res = await fetch("/api/student/memory/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setFeedback("Debrief submitted successfully! It is now in the college review queue.");
        setShowSubmitModal(false);
        setNotes("");
        setRoleTitle("");
      } else {
        const err = await res.json();
        setFeedback(`Submission failed: ${err.error}`);
      }
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (!isLoadingAuth && !isEntitled) {
    return (
      <FeatureLockedCard
        featureName="Target Drive Insights & Placement Memory"
        featureKey="placement_memory_analytics"
        description="Cross-year hiring debriefs and past interview experiences are not included in your college's current subscription plan."
        recommendedPlan="Campus Growth"
      />
    );
  }

  return (
    <div className="space-y-8 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#DDDCD5] pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#24283A] font-['Outfit']">
            Placement Memory & Experience Debriefs
          </h1>
          <p className="text-[#292D40] text-sm mt-1">
            Verified institutional drive patterns, round structures, and moderated peer recruitment debriefs.
          </p>
        </div>
        <Button
          onClick={() => setShowSubmitModal(!showSubmitModal)}
          className="bg-[#5052C9] hover:bg-[#4345B0] text-white"
        >
          <Send className="w-4 h-4 mr-2" />
          Share Interview Debrief
        </Button>
      </div>

      {feedback && (
        <div className="p-3 bg-[#F8F7F3] border border-[#2E8F86] text-[#24283A] text-sm rounded">
          {feedback}
        </div>
      )}

      {/* Submission Form Modal/Panel */}
      {showSubmitModal && (
        <Card className="bg-[#FBFAF7] border-[#5052C9] ring-1 ring-[#5052C9]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#24283A] font-['Outfit']">
              Submit Recruitment Experience Debrief
            </CardTitle>
            <CardDescription className="text-xs text-[#292D40]">
              Help your juniors prepare with authentic interview insights. Submissions are moderated before publishing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitReport} className="space-y-4">
              {companies.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-[#24283A] block mb-1">
                    Company *
                  </label>
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full text-sm p-2 rounded bg-white border border-[#DDDCD5] focus:ring-2 focus:ring-[#5052C9]"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-[#24283A] block mb-1">
                    Role Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="e.g. Associate Software Engineer"
                    className="w-full text-sm p-2 rounded bg-white border border-[#DDDCD5] focus:ring-2 focus:ring-[#5052C9]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#24283A] block mb-1">
                    Recruitment Cycle *
                  </label>
                  <input
                    type="text"
                    required
                    value={recruitmentCycle}
                    onChange={(e) => setRecruitmentCycle(e.target.value)}
                    className="w-full text-sm p-2 rounded bg-white border border-[#DDDCD5] focus:ring-2 focus:ring-[#5052C9]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[#24283A] block mb-1">
                  Interview & Assessment Insights
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe the rounds encountered, coding topics, aptitude difficulty, interview questions..."
                  className="w-full text-sm p-2 rounded bg-white border border-[#DDDCD5] focus:ring-2 focus:ring-[#5052C9]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="anonymousCheck"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded text-[#5052C9] focus:ring-[#5052C9]"
                />
                <label htmlFor="anonymousCheck" className="text-xs text-[#292D40] select-none cursor-pointer">
                  Submit anonymously (protect my name and roll number from fellow students)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowSubmitModal(false)}
                  className="border-[#DDDCD5] text-[#24283A]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#5052C9] hover:bg-[#4345B0] text-white"
                >
                  {submitting ? "Submitting..." : "Submit for Moderation"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Historical Records Grid */}
      <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#24283A] font-['Outfit'] flex items-center gap-2">
            <Archive className="w-5 h-5 text-[#5052C9]" />
            Verified Company Recruitment Patterns
          </CardTitle>
          <CardDescription className="text-xs text-[#292D40]">
            Official and college-confirmed patterns from previous campus recruitment drives
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="status" aria-busy="true">
              <span className="sr-only">Loading recruitment patterns...</span>
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-6 text-[#292D40] text-sm">
              No historical recruitment patterns currently published.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {records.map((rec) => (
                <div key={rec.id} className="p-4 bg-[#FBFAF7] border border-[#DDDCD5] rounded-lg space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-[#24283A] text-base">{rec.role_title}</h4>
                      <p className="text-xs text-[#292D40] flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-[#5052C9]" />
                        {rec.companies?.name || "Company"} &bull; Year: {rec.recruitment_year}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-[#2E8F86] text-[#2E8F86]">
                      {rec.reliability_label}
                    </Badge>
                  </div>

                  {rec.process_summary && (
                    <p className="text-xs text-[#292D40] pt-1">
                      {rec.process_summary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Peer Debriefs */}
      <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-[#24283A] font-['Outfit'] flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#2E8F86]" />
            Moderated Candidate Debriefs
          </CardTitle>
          <CardDescription className="text-xs text-[#292D40]">
            Direct insights reported by students who appeared in recruitment drives
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4" role="status" aria-busy="true">
              <span className="sr-only">Loading debriefs...</span>
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-6 text-[#292D40] text-sm">
              No moderated candidate debriefs published yet.
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((rep) => (
                <div key={rep.id} className="p-4 bg-[#FBFAF7] border border-[#DDDCD5] rounded-lg space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-[#24283A]">{rep.role_title}</h4>
                      <p className="text-xs text-[#292D40]">
                        {rep.companies?.name || "Company"} &bull; Cycle: {rep.recruitment_cycle}
                      </p>
                    </div>
                    <Badge variant="secondary">
                      {rep.is_anonymous ? "Anonymous Student" : rep.students?.full_name || "Student"}
                    </Badge>
                  </div>

                  {rep.notes && (
                    <p className="text-xs text-[#292D40] bg-[#F8F7F3] p-3 rounded border border-[#DDDCD5]">
                      {rep.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
