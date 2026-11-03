"use client";

import * as React from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Cpu,
  Database,
  Key,
  HardDrive,
  Sparkles,
  Server,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLoader } from "@/components/common/brand-loader";
import { cn } from "@/lib/utils";
import type { SystemHealthReport } from "@/modules/platform-admin/services/platform-health-service";

export default function PlatformSystemHealthPage() {
  const [report, setReport] = React.useState<SystemHealthReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchHealth = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/preritrd/system-health", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Diagnostic health probe failed.");
      } else {
        setReport(data.report);
      }
    } catch {
      setError("Network error connecting to platform diagnostic probe.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  function getStatusIcon(status: string) {
    switch (status) {
      case "HEALTHY":
        return <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
      case "DEGRADED":
        return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />;
      case "DOWN":
        return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />;
      default:
        return <Activity className="h-5 w-5 text-text-secondary shrink-0" />;
    }
  }

  function getCategoryIcon(cat: string) {
    switch (cat) {
      case "CORE":
        return <Cpu className="h-4 w-4 text-primary" />;
      case "DATABASE":
        return <Database className="h-4 w-4 text-secondary" />;
      case "AUTH":
        return <Key className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case "STORAGE":
        return <HardDrive className="h-4 w-4 text-primary" />;
      case "AI":
        return <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />;
      default:
        return <Server className="h-4 w-4 text-text-secondary" />;
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary font-mono mb-1.5">
            Operational Diagnostics
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-primary tracking-tight">
            System Operations &amp; Subsystem Health
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Real-time latency, availability diagnostics, and operational status for platform infrastructure.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealth}
            disabled={loading}
            className="border-border text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Run Diagnostic Probe
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/10 text-red-900 dark:text-red-200 p-4 rounded-2xl text-xs">
          {error}
        </Card>
      )}

      {/* Overall Health Status Banner */}
      <Card
        className={cn(
          "border shadow-xs rounded-2xl overflow-hidden",
          report?.overallStatus === "HEALTHY"
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-100"
            : report?.overallStatus === "DEGRADED"
            ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-100"
            : "bg-red-500/10 border-red-500/30 text-red-950 dark:text-red-100"
        )}
      >
        <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-card border border-border shadow-xs flex items-center justify-center shrink-0">
              {loading ? (
                <BrandLoader size="inline" />
              ) : (
                getStatusIcon(report?.overallStatus || "HEALTHY")
              )}
            </div>
            <div>
              <div className="text-lg font-bold font-heading text-text-primary flex items-center gap-2">
                <span>Platform Overall Status: {report?.overallStatus || "ANALYZING"}</span>
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] bg-surface border-border text-text-primary"
                >
                  {report?.environment || "development"}
                </Badge>
              </div>
              <div className="text-xs text-text-secondary mt-0.5">
                Last probe executed:{" "}
                <span className="font-mono">
                  {report?.timestamp ? new Date(report.timestamp).toLocaleTimeString() : "—"}
                </span>{" "}
                &bull; System Uptime:{" "}
                <span className="font-mono font-bold">
                  {report?.uptimeSeconds ? `${Math.round(report.uptimeSeconds / 60)} minutes` : "—"}
                </span>
              </div>
            </div>
          </div>

          <Badge
            variant="outline"
            className="bg-surface text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-mono text-xs px-3 py-1 shrink-0"
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400" /> Option A Privacy Enforced
          </Badge>
        </CardContent>
      </Card>

      {/* Subsystem Health Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="bg-card border-border p-5 rounded-2xl shadow-xs space-y-3">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-60" />
              </Card>
            ))
          : report?.services.map((svc) => (
              <Card
                key={svc.name}
                className="bg-card border-border shadow-xs rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-surface border border-border flex items-center justify-center">
                      {getCategoryIcon(svc.category)}
                    </div>
                    <div>
                      <div className="font-bold text-xs font-heading text-text-primary">
                        {svc.name}
                      </div>
                      <div className="text-[10px] text-text-secondary font-mono">
                        Latency: {svc.latencyMs}ms
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={
                      svc.status === "HEALTHY"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-mono"
                        : svc.status === "DEGRADED"
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] font-mono"
                        : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30 text-[10px] font-mono"
                    }
                  >
                    {svc.status}
                  </Badge>
                </div>

                <div className="p-2.5 rounded-xl bg-surface border border-border text-xs font-mono text-text-primary leading-relaxed">
                  {svc.message}
                </div>
              </Card>
            ))}
      </div>

      {/* Security Architecture Statement */}
      <Card className="bg-surface/50 border-border shadow-xs rounded-2xl">
        <CardContent className="p-4 flex items-center gap-3 text-xs text-text-secondary">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
          <p>
            Health diagnostics query subsystem control-plane heartbeats only. Private tokens, passwords, database passwords, and user records are completely masked and suppressed from diagnostic reports.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
