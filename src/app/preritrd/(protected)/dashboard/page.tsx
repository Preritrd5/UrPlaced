"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Users2,
  CreditCard,
  Receipt,
  Activity,
  PlusCircle,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Sliders,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlatformOverviewMetrics } from "@/modules/platform-admin/services/platform-analytics-service";

export default function PlatformDashboardPage() {
  const [metrics, setMetrics] = React.useState<PlatformOverviewMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchMetrics = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/preritrd/dashboard/metrics", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load dashboard metrics");
      } else {
        setMetrics(data.metrics);
      }
    } catch {
      setError("Network error fetching platform metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#B8B6AC]/40">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#5052C9]">
            UrPlaced SaaS Infrastructure
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[#24283A] tracking-tight">
            Platform Overview
          </h1>
          <p className="text-xs text-[#292D40]/75 mt-0.5">
            Real-time control plane metrics, institutional onboarding status, and subscription activity.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            disabled={loading}
            className="border-[#B8B6AC] text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button asChild size="sm" className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-9 gap-1.5 shadow-sm">
            <Link href="/preritrd/colleges/new">
              <PlusCircle className="h-4 w-4" /> Register College
            </Link>
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={fetchMetrics} className="h-7 text-xs border-red-300">
            Retry
          </Button>
        </div>
      )}

      {/* 1. Core Platform KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Registered Colleges */}
        <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-[#747683] uppercase">
                Registered Colleges
              </span>
              <div className="h-8 w-8 rounded-lg bg-[#5052C9]/10 text-[#5052C9] flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {loading ? (
                <Skeleton className="h-8 w-20 bg-gray-200" />
              ) : (
                <div className="text-3xl font-extrabold font-heading text-[#24283A]">
                  {metrics?.totalColleges ?? 0}
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-[#2E8F86] font-medium">
              <span className="inline-block h-2 w-2 rounded-full bg-[#2E8F86]" />
              <span>{metrics?.activeColleges ?? 0} active</span>
              {metrics?.suspendedColleges ? (
                <span className="text-red-600">({metrics.suspendedColleges} suspended)</span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Active Subscriptions */}
        <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-[#747683] uppercase">
                Active Subscriptions
              </span>
              <div className="h-8 w-8 rounded-lg bg-[#2E8F86]/10 text-[#2E8F86] flex items-center justify-center">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {loading ? (
                <Skeleton className="h-8 w-20 bg-gray-200" />
              ) : (
                <div className="text-3xl font-extrabold font-heading text-[#24283A]">
                  {metrics?.activeSubscriptions ?? 0}
                </div>
              )}
            </div>
            <div className="mt-2 text-xs text-[#747683] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span>{metrics?.expiringSubscriptions ?? 0} expiring in &lt; 30d</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Platform Revenue */}
        <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-[#747683] uppercase">
                Revenue Collected
              </span>
              <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {loading ? (
                <Skeleton className="h-8 w-28 bg-gray-200" />
              ) : (
                <div className="text-3xl font-extrabold font-heading text-[#24283A]">
                  ₹{(metrics?.totalRevenueInr ?? 0).toLocaleString("en-IN")}
                </div>
              )}
            </div>
            <div className="mt-2 text-xs text-[#747683] flex items-center gap-1">
              <span>₹{(metrics?.pendingRevenueInr ?? 0).toLocaleString("en-IN")} pending invoices</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Platform Onboarding */}
        <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-[#747683] uppercase">
                Onboarding Pipeline
              </span>
              <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {loading ? (
                <Skeleton className="h-8 w-16 bg-gray-200" />
              ) : (
                <div className="text-3xl font-extrabold font-heading text-[#24283A]">
                  {metrics?.onboardingColleges ?? 0}
                </div>
              )}
            </div>
            <div className="mt-2 text-xs text-[#747683]">
              {metrics?.onboardingStatusFunnel?.completed ?? 0} verified &bull;{" "}
              {metrics?.onboardingStatusFunnel?.invited ?? 0} pending setup
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Middle Section: Quick Action Shortcuts & Plan Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Shortcuts */}
        <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-xl lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold font-heading text-[#24283A]">
              Quick Administrative Actions
            </CardTitle>
            <CardDescription className="text-xs text-[#292D40]/70">
              Immediate control plane workflows
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-2.5">
            <Link
              href="/preritrd/colleges/new"
              className="flex items-center justify-between p-3 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/40 hover:border-[#5052C9] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#5052C9]/10 text-[#5052C9] flex items-center justify-center">
                  <PlusCircle className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#24283A] group-hover:text-[#5052C9]">
                    Register New College
                  </div>
                  <div className="text-[10px] text-[#747683]">Provision institution workspace</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#747683] group-hover:text-[#5052C9] transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="/preritrd/colleges"
              className="flex items-center justify-between p-3 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/40 hover:border-[#5052C9] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#2E8F86]/10 text-[#2E8F86] flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#24283A] group-hover:text-[#5052C9]">
                    Manage College Accounts
                  </div>
                  <div className="text-[10px] text-[#747683]">Activate or suspend tenants</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#747683] group-hover:text-[#5052C9] transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="/preritrd/subscriptions"
              className="flex items-center justify-between p-3 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/40 hover:border-[#5052C9] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#5052C9]/10 text-[#5052C9] flex items-center justify-center">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#24283A] group-hover:text-[#5052C9]">
                    Subscription Administration
                  </div>
                  <div className="text-[10px] text-[#747683]">Plans, limits and seat renewals</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#747683] group-hover:text-[#5052C9] transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="/preritrd/configuration"
              className="flex items-center justify-between p-3 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/40 hover:border-[#5052C9] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-[#747683]/10 text-[#747683] flex items-center justify-center">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#24283A] group-hover:text-[#5052C9]">
                    Platform Configuration
                  </div>
                  <div className="text-[10px] text-[#747683]">Maintenance mode &amp; feature switches</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#747683] group-hover:text-[#5052C9] transition-transform group-hover:translate-x-1" />
            </Link>
          </CardContent>
        </Card>

        {/* Plan Distribution & Security Invariant */}
        <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-xl lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold font-heading text-[#24283A]">
                Subscription Plan Distribution
              </CardTitle>
              <CardDescription className="text-xs text-[#292D40]/70">
                Institutional adoption breakdown by subscribed tier
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-[#2E8F86]/40 text-[#2E8F86] bg-[#2E8F86]/10 text-xs font-mono">
              Live Subscriptions
            </Badge>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full bg-gray-200" />
                <Skeleton className="h-10 w-full bg-gray-200" />
              </div>
            ) : metrics?.subscriptionPlanDistribution && metrics.subscriptionPlanDistribution.length > 0 ? (
              <div className="space-y-3">
                {metrics.subscriptionPlanDistribution.map((plan) => {
                  const total = metrics.activeSubscriptions || 1;
                  const pct = Math.round((plan.count / total) * 100);
                  return (
                    <div key={plan.planId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium text-[#24283A]">
                        <span>{plan.planName}</span>
                        <span className="font-mono text-[#747683] font-bold">
                          {plan.count} colleges ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#EDECE7] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#7779D8] to-[#5052C9] rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-[#747683] py-6 text-center">
                No active subscriptions currently recorded.
              </div>
            )}

            {/* Strict Option A Isolation Callout */}
            <div className="mt-4 p-3.5 rounded-xl bg-[#EDECE7] border border-[#B8B6AC]/40 flex items-start gap-3 text-xs text-[#24283A]">
              <ShieldCheck className="h-4 w-4 text-[#5052C9] shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold">Strict Option A Governance:</span> Platform Super Admin operates on the SaaS control plane only. Under no circumstances can administrator sessions access private student profiles, resumes, evaluations, or college-owned question banks.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Recent Platform Audit Events Table */}
      <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-[#B8B6AC]/30">
          <div>
            <CardTitle className="text-base font-bold font-heading text-[#24283A]">
              Recent Platform Audit Events
            </CardTitle>
            <CardDescription className="text-xs text-[#292D40]/70">
              Control-plane administrative events (tenant_id = NULL)
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="text-xs h-8 border-[#B8B6AC]">
            <Link href="/preritrd/audit-logs">View All Logs</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FBFAF7] text-[#747683] font-mono text-[10px] uppercase border-b border-[#B8B6AC]/30">
                <tr>
                  <th className="px-5 py-3 font-semibold">Action</th>
                  <th className="px-5 py-3 font-semibold">Administrator</th>
                  <th className="px-5 py-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#B8B6AC]/20">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={3} className="px-5 py-3">
                        <Skeleton className="h-5 w-full bg-gray-200" />
                      </td>
                    </tr>
                  ))
                ) : metrics?.recentPlatformEvents && metrics.recentPlatformEvents.length > 0 ? (
                  metrics.recentPlatformEvents.map((evt) => (
                    <tr key={evt.id} className="hover:bg-[#FBFAF7] transition-colors">
                      <td className="px-5 py-3 font-mono font-bold text-[#5052C9]">
                        {evt.action}
                      </td>
                      <td className="px-5 py-3 text-[#24283A]">{evt.actorEmail}</td>
                      <td className="px-5 py-3 text-[#747683] font-mono">
                        {new Date(evt.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-[#747683]">
                      No recent platform audit events found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
