"use client";

import * as React from "react";
import {
  BarChart3,
  TrendingUp,
  Building2,
  CreditCard,
  ShieldCheck,
  RefreshCw,
  PieChart,
  Calendar,
  Layers,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlatformAnalyticsTrends } from "@/modules/platform-admin/services/platform-analytics-service";

export default function PlatformAnalyticsPage() {
  const [trends, setTrends] = React.useState<PlatformAnalyticsTrends | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchAnalytics = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/preritrd/analytics", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load platform analytics");
      } else {
        setTrends(data.trends);
      }
    } catch {
      setError("Network error fetching analytics data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#B8B6AC]/40">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#5052C9]">
            Aggregate Telemetry
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[#24283A] tracking-tight">
            Platform Analytics &amp; Adoption
          </h1>
          <p className="text-xs text-[#292D40]/75 mt-0.5">
            Privacy-safe platform growth, subscription tier distribution, and institutional revenue trends.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            disabled={loading}
            className="border-[#B8B6AC] text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Strict Privacy Isolation Callout */}
      <Card className="bg-[#FBFAF7] border-[#5052C9]/30 shadow-xs rounded-2xl overflow-hidden">
        <CardContent className="p-5 flex items-start gap-4">
          <div className="h-10 w-10 rounded-xl bg-[#5052C9]/10 text-[#5052C9] flex items-center justify-center shrink-0">
            <Lock className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-bold font-heading text-[#24283A] flex items-center gap-2">
              <span>Strict Option A &bull; Guaranteed Zero-Knowledge Student Privacy</span>
              <Badge variant="outline" className="text-[10px] font-mono border-emerald-300 text-emerald-800 bg-emerald-50">
                Active Verification
              </Badge>
            </div>
            <p className="text-xs text-[#292D40]/80 leading-relaxed">
              In accordance with UrPlaced institutional privacy mandates, all analytics displayed below are aggregated scalars at the platform control-plane boundary. Platform Super Admin does not possess access to individual student grades, mistake banks, resumes, interview scores, or recruiter notes. Drill-down into individual institutional records is architecturally blocked.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Visualizations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Monthly Institutional Growth */}
        <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
          <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
            <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#5052C9]" />
              <span>Campus Adoption Growth (Recent Months)</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#292D40]/70">
              Aggregated monthly registrations of college platform workspaces
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <Skeleton className="h-48 w-full bg-gray-200" />
            ) : trends?.collegeGrowth && trends.collegeGrowth.length > 0 ? (
              <div className="space-y-4">
                <div className="h-44 flex items-end gap-3 pt-4 border-b border-[#B8B6AC]/30 pb-2">
                  {trends.collegeGrowth.map((g) => {
                    const maxVal = Math.max(...trends.collegeGrowth.map((x) => x.count), 5);
                    const heightPct = Math.max(Math.round((g.count / maxVal) * 100), 10);
                    return (
                      <div key={g.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                        <span className="text-[10px] font-mono font-bold text-[#5052C9]">{g.count}</span>
                        <div
                          className="w-full bg-gradient-to-t from-[#5052C9] to-[#7779D8] rounded-t-md transition-all duration-500"
                          style={{ height: `${heightPct}%` }}
                        />
                        <span className="text-[10px] font-mono text-[#747683] truncate w-full text-center">
                          {g.month.split(" ")[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="text-[11px] text-[#747683] text-center font-mono">
                  Monthly new college workspaces provisioned
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-[#747683]">
                No historical growth records available.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Plan Adoption Distribution */}
        <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
          <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
            <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
              <PieChart className="h-4 w-4 text-[#2E8F86]" />
              <span>Subscription Tier Distribution</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#292D40]/70">
              Breakdown of institutional accounts by subscription tier
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {loading ? (
              <Skeleton className="h-48 w-full bg-gray-200" />
            ) : trends?.planDistribution && trends.planDistribution.length > 0 ? (
              <div className="space-y-4">
                {trends.planDistribution.map((p) => (
                  <div key={p.plan} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#24283A]">
                      <span>{p.plan}</span>
                      <span className="font-mono text-[#747683]">
                        {p.count} accounts &bull; {p.percentage}%
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-[#EDECE7] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#2E8F86] to-[#5052C9] rounded-full"
                        style={{ width: `${p.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}

                <div className="pt-2 text-[11px] text-[#747683] text-center font-mono">
                  Calculated against all active college subscriptions
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-[#747683]">
                No subscription distribution data currently available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Over Time */}
      <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
        <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
          <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-700" />
            <span>Platform Revenue &amp; Billing History (INR)</span>
          </CardTitle>
          <CardDescription className="text-xs text-[#292D40]/70">
            Real billing receipts derived from persisted invoices (Paid vs Pending)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <Skeleton className="h-48 w-full bg-gray-200" />
          ) : trends?.revenueTrends && trends.revenueTrends.length > 0 ? (
            <div className="space-y-4">
              <div className="h-48 flex items-end gap-4 pt-4 border-b border-[#B8B6AC]/30 pb-2">
                {trends.revenueTrends.map((r) => {
                  const maxRev = Math.max(
                    ...trends.revenueTrends.map((x) => x.collectedInr + x.pendingInr),
                    100000
                  );
                  const collectedPct = Math.round((r.collectedInr / maxRev) * 100);
                  const pendingPct = Math.round((r.pendingInr / maxRev) * 100);

                  return (
                    <div key={r.period} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <div className="w-full flex flex-col items-center gap-0.5 justify-end h-full">
                        {r.pendingInr > 0 && (
                          <div
                            className="w-full bg-amber-400 rounded-t-sm"
                            style={{ height: `${Math.max(pendingPct, 4)}%` }}
                            title={`Pending: ₹${r.pendingInr.toLocaleString()}`}
                          />
                        )}
                        <div
                          className="w-full bg-emerald-600 rounded-b-sm"
                          style={{ height: `${Math.max(collectedPct, 4)}%` }}
                          title={`Collected: ₹${r.collectedInr.toLocaleString()}`}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-[#747683] truncate w-full text-center">
                        {r.period.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-center items-center gap-6 text-xs text-[#24283A] font-medium pt-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-xs bg-emerald-600" />
                  <span>Collected Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-xs bg-amber-400" />
                  <span>Pending / Outstanding Invoices</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-[#747683]">
              No revenue records found.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
