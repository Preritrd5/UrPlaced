"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  CreditCard,
  PlusCircle,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Clock,
  ShieldCheck,
  RefreshCw,
  Sliders,
  Activity,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-primary">
              UrPlaced Control Plane
            </span>
            <Badge variant="outline" className="font-mono text-[10px] bg-secondary/10 text-secondary border-secondary/30">
              Platform Overview
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-primary tracking-tight">
            Platform Overview
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Real-time control plane metrics, institutional onboarding status, and subscription activity.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMetrics}
            disabled={loading}
            className="border-border text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button asChild size="sm" className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-9 gap-1.5 shadow-xs">
            <Link href="/preritrd/colleges/new">
              <PlusCircle className="h-4 w-4" /> Register College
            </Link>
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-status-danger-subtle border border-status-danger/30 text-status-danger text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-status-danger" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={fetchMetrics} className="h-7 text-xs border-status-danger/40">
            Retry
          </Button>
        </div>
      )}

      {/* 1. Core Platform KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Card 1: Registered Colleges */}
        <Card className="bg-card border-border shadow-xs rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-text-secondary uppercase">
                Registered Colleges
              </span>
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Building2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-3xl font-extrabold font-heading text-text-primary">
                  {metrics?.totalColleges ?? 0}
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-secondary font-medium font-mono">
              <span className="inline-block h-2 w-2 rounded-full bg-secondary" />
              <span>{metrics?.activeColleges ?? 0} active</span>
              {metrics?.suspendedColleges ? (
                <span className="text-status-danger">({metrics.suspendedColleges} suspended)</span>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Active Subscriptions */}
        <Card className="bg-card border-border shadow-xs rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-text-secondary uppercase">
                Active Subscriptions
              </span>
              <div className="h-9 w-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
                <CreditCard className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-3xl font-extrabold font-heading text-text-primary">
                  {metrics?.activeSubscriptions ?? 0}
                </div>
              )}
            </div>
            <div className="mt-2 text-xs text-text-secondary flex items-center gap-1.5 font-mono">
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span>{metrics?.expiringSubscriptions ?? 0} expiring in &lt; 30d</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Platform Revenue */}
        <Card className="bg-card border-border shadow-xs rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-text-secondary uppercase">
                Revenue Collected
              </span>
              <div className="h-9 w-9 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {loading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <div className="text-3xl font-extrabold font-heading text-text-primary">
                  ₹{(metrics?.totalRevenueInr ?? 0).toLocaleString("en-IN")}
                </div>
              )}
            </div>
            <div className="mt-2 text-xs text-text-secondary flex items-center gap-1 font-mono">
              <span>₹{(metrics?.pendingRevenueInr ?? 0).toLocaleString("en-IN")} pending</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Platform Onboarding */}
        <Card className="bg-card border-border shadow-xs rounded-2xl">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-text-secondary uppercase">
                Onboarding Pipeline
              </span>
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-extrabold font-heading text-text-primary">
                  {metrics?.onboardingColleges ?? 0}
                </div>
              )}
            </div>
            <div className="mt-2 text-xs text-text-secondary font-mono">
              {metrics?.onboardingStatusFunnel?.completed ?? 0} verified &bull;{" "}
              {metrics?.onboardingStatusFunnel?.invited ?? 0} pending setup
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Middle Section: Quick Action Shortcuts & Plan Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Shortcuts */}
        <Card className="bg-card border-border shadow-xs rounded-2xl lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold font-heading text-text-primary">
              Quick Administrative Actions
            </CardTitle>
            <CardDescription className="text-xs text-text-secondary">
              Immediate control plane workflows
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-2.5">
            <Link
              href="/preritrd/colleges/new"
              className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border hover:border-primary transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <PlusCircle className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                    Register New College
                  </div>
                  <div className="text-[10px] text-text-secondary">Provision institutional workspace</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-text-secondary group-hover:text-primary transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="/preritrd/colleges"
              className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border hover:border-primary transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                    Manage College Accounts
                  </div>
                  <div className="text-[10px] text-text-secondary">Activate or suspend tenants</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-text-secondary group-hover:text-primary transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="/preritrd/subscriptions"
              className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border hover:border-primary transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                    Subscription Administration
                  </div>
                  <div className="text-[10px] text-text-secondary">Plans, limits and seat renewals</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-text-secondary group-hover:text-primary transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="/preritrd/configuration"
              className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border hover:border-primary transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-surface border border-border text-text-secondary flex items-center justify-center">
                  <Sliders className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-text-primary group-hover:text-primary transition-colors">
                    Platform Configuration
                  </div>
                  <div className="text-[10px] text-text-secondary">Maintenance mode &amp; feature switches</div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-text-secondary group-hover:text-primary transition-transform group-hover:translate-x-1" />
            </Link>
          </CardContent>
        </Card>

        {/* Plan Distribution & Security Invariant */}
        <Card className="bg-card border-border shadow-xs rounded-2xl lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold font-heading text-text-primary">
                Subscription Plan Distribution
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Institutional adoption breakdown by subscribed tier
              </CardDescription>
            </div>
            <Badge variant="outline" className="border-secondary/40 text-secondary bg-secondary/10 text-xs font-mono">
              Live Subscriptions
            </Badge>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : metrics?.subscriptionPlanDistribution && metrics.subscriptionPlanDistribution.length > 0 ? (
              <div className="space-y-3">
                {metrics.subscriptionPlanDistribution.map((plan) => {
                  const total = metrics.activeSubscriptions || 1;
                  const pct = Math.round((plan.count / total) * 100);
                  return (
                    <div key={plan.planId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium text-text-primary">
                        <span>{plan.planName}</span>
                        <span className="font-mono text-text-secondary font-bold">
                          {plan.count} colleges ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-surface overflow-hidden border border-border/40">
                        <div
                          className="h-full bg-primary-gradient rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-text-secondary py-6 text-center">
                No active subscriptions currently recorded.
              </div>
            )}

          </CardContent>
        </Card>
      </div>

      {/* 3. Recent Platform Audit Events Table */}
      <Card className="bg-card border-border shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-border">
          <div>
            <CardTitle className="text-base font-bold font-heading text-text-primary">
              Recent Platform Audit Events
            </CardTitle>
            <CardDescription className="text-xs text-text-secondary">
              Control-plane administrative events (tenant_id = NULL)
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="text-xs h-8 border-border">
            <Link href="/preritrd/audit-logs">View All Logs</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface/80 text-text-secondary font-mono text-[10px] uppercase border-b border-border">
                <tr>
                  <th className="px-5 py-3 font-semibold">Action</th>
                  <th className="px-5 py-3 font-semibold">Administrator</th>
                  <th className="px-5 py-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={3} className="px-5 py-3">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : metrics?.recentPlatformEvents && metrics.recentPlatformEvents.length > 0 ? (
                  metrics.recentPlatformEvents.map((evt) => (
                    <tr key={evt.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-5 py-3 font-mono font-bold text-primary">
                        {evt.action}
                      </td>
                      <td className="px-5 py-3 text-text-primary font-mono">{evt.actorEmail}</td>
                      <td className="px-5 py-3 text-text-secondary font-mono">
                        {new Date(evt.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-text-secondary">
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
