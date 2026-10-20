"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  GitCompare,
  CheckCircle2,
  XCircle,
  FileText,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Building2,
  Calendar,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/lib/auth/auth-context-provider";

export default function PlacementMemoryPage() {
  const router = useRouter();
  const { role, isPlatformAdmin, isLoading: isLoadingAuth } = useAuthContext();
  const [activeTab, setActiveTab] = useState<"RECORDS" | "COMPARE" | "MODERATION">("RECORDS");
  const [records, setRecords] = useState<any[]>([]);
  const [pendingReports, setPendingReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const canViewMemory = isPlatformAdmin || (role && ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"].includes(role));

  useEffect(() => {
    if (!isLoadingAuth) {
      if (role === "STUDENT") {
        router.replace("/dashboard/student/memory");
      } else if (!canViewMemory) {
        router.replace("/auth/access-denied");
      }
    }
  }, [role, canViewMemory, isLoadingAuth, router]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      if (activeTab === "RECORDS") {
        const res = await fetch("/api/placement/memory/records");
        if (res.ok) {
          const json = await res.json();
          setRecords(json.records || []);
        }
      } else if (activeTab === "MODERATION") {
        const res = await fetch("/api/placement/memory/moderation");
        if (res.ok) {
          const json = await res.json();
          setPendingReports(json.reports || []);
        }
      }
    } catch (err) {
      console.error("Error loading placement memory:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleModerate(reportId: string, decision: "APPROVED" | "REJECTED") {
    try {
      const res = await fetch(`/api/placement/memory/moderation/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, promoteToMemory: true }),
      });
      if (res.ok) {
        setActionMessage(`Report successfully ${decision.toLowerCase()} and logged.`);
        loadData();
      } else {
        const err = await res.json();
        setActionMessage(`Error: ${err.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Moderation failed: ${err.message}`);
    }
  }

  function renderReliabilityBadge(label: string) {
    switch (label) {
      case "OFFICIAL_CONFIRMED":
        return <Badge variant="outline" className="border-[#2E8F86] text-[#2E8F86]">Official Confirmed</Badge>;
      case "VERIFIED_HISTORICAL":
        return <Badge className="bg-[#5052C9] text-white">Verified Historical</Badge>;
      case "CANDIDATE_REPORTED":
        return <Badge variant="secondary" className="bg-[#2E8F86]/10 text-[#2E8F86]">Candidate Reported</Badge>;
      case "DISPUTED":
        return <Badge variant="danger">Disputed</Badge>;
      default:
        return <Badge variant="secondary">{label}</Badge>;
    }
  }

  if (isLoadingAuth || !canViewMemory) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#DDDCD5] pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#24283A] font-['Outfit']">
            Placement Memory & Recruitment Intelligence
          </h1>
          <p className="text-[#292D40] text-sm mt-1">
            Institutional recruitment archives, pattern comparability, and moderated candidate debriefs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === "RECORDS" ? "primary" : "outline"}
            onClick={() => setActiveTab("RECORDS")}
            className={activeTab === "RECORDS" ? "bg-[#5052C9] hover:bg-[#4345B0] text-white" : "border-[#DDDCD5] text-[#24283A]"}
          >
            <Archive className="w-4 h-4 mr-2" />
            Historical Archive
          </Button>
          <Button
            variant={activeTab === "MODERATION" ? "primary" : "outline"}
            onClick={() => setActiveTab("MODERATION")}
            className={activeTab === "MODERATION" ? "bg-[#5052C9] hover:bg-[#4345B0] text-white" : "border-[#DDDCD5] text-[#24283A]"}
          >
            <ShieldCheck className="w-4 h-4 mr-2" />
            Moderation Queue ({pendingReports.length})
          </Button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-[#F8F7F3] border border-[#2E8F86] text-[#24283A] text-sm rounded">
          {actionMessage}
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "RECORDS" && (
        <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#24283A] font-['Outfit']">
              Institutional Recruitment Records
            </CardTitle>
            <CardDescription className="text-xs text-[#292D40]">
              Historical drives with explicit source provenance, verified round structures, and question set links
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-[#292D40] py-4">Loading historical records...</p>
            ) : records.length === 0 ? (
              <div className="text-center py-8 text-[#292D40] text-sm">
                No historical recruitment records currently archived.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#DDDCD5] text-xs font-semibold uppercase text-[#292D40]">
                      <th className="py-3 px-4">Company</th>
                      <th className="py-3 px-4">Role Title</th>
                      <th className="py-3 px-4">Recruitment Year</th>
                      <th className="py-3 px-4">Cycle</th>
                      <th className="py-3 px-4">Reliability</th>
                      <th className="py-3 px-4">Scope</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDDCD5]">
                    {records.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#FBFAF7] transition-colors">
                        <td className="py-3 px-4 font-medium text-[#24283A] flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-[#5052C9]" />
                          {rec.companies?.name || "Company"}
                        </td>
                        <td className="py-3 px-4 text-[#24283A] font-semibold">{rec.role_title}</td>
                        <td className="py-3 px-4 text-[#292D40]">{rec.recruitment_year}</td>
                        <td className="py-3 px-4 text-[#292D40]">{rec.recruitment_cycle}</td>
                        <td className="py-3 px-4">{renderReliabilityBadge(rec.reliability_label)}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="border-[#DDDCD5] text-[#292D40]">
                            {rec.sharing_scope}
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
      )}

      {activeTab === "MODERATION" && (
        <Card className="bg-[#F8F7F3] border-[#DDDCD5]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[#24283A] font-['Outfit']">
              Candidate Debrief Moderation Queue
            </CardTitle>
            <CardDescription className="text-xs text-[#292D40]">
              Review student-submitted recruitment experiences before publishing them to the institutional memory
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-[#292D40] py-4">Checking moderation queue...</p>
            ) : pendingReports.length === 0 ? (
              <div className="text-center py-8 text-[#292D40] text-sm">
                No candidate reports currently pending review.
              </div>
            ) : (
              <div className="space-y-4">
                {pendingReports.map((rep) => (
                  <div key={rep.id} className="p-4 bg-[#FBFAF7] border border-[#DDDCD5] rounded-lg space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-[#24283A] text-base">{rep.role_title}</span>
                        <span className="text-sm text-[#292D40] ml-2">({rep.companies?.name})</span>
                      </div>
                      <Badge variant="secondary">Cycle: {rep.recruitment_cycle}</Badge>
                    </div>

                    <div className="text-xs text-[#292D40]">
                      <span className="font-semibold text-[#24283A]">Author: </span>
                      {rep.is_anonymous ? "Anonymous Student" : rep.students?.full_name || "Student"}
                    </div>

                    {rep.notes && (
                      <p className="text-xs text-[#292D40] bg-[#F8F7F3] p-2 rounded border border-[#DDDCD5]">
                        <span className="font-semibold">Candidate Notes: </span>
                        {rep.notes}
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-[#DDDCD5]">
                      <Button
                        size="sm"
                        onClick={() => handleModerate(rep.id, "APPROVED")}
                        className="bg-[#2E8F86] hover:bg-[#267870] text-white"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Approve & Promote
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleModerate(rep.id, "REJECTED")}
                        className="border-[#DDDCD5] text-[#24283A] hover:bg-[#F8F7F3]"
                      >
                        <XCircle className="w-4 h-4 mr-1 text-red-500" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
