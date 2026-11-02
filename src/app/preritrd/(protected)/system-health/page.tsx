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
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BrandLoader } from "@/components/common/brand-loader";
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
        return <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />;
      case "DEGRADED":
        return <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />;
      case "DOWN":
        return <XCircle className="h-5 w-5 text-red-600 shrink-0" />;
      default:
        return <Activity className="h-5 w-5 text-[#747683] shrink-0" />;
    }
  }

  function getCategoryIcon(cat: string) {
    switch (cat) {
      case "CORE":
        return <Cpu className="h-4 w-4 text-[#5052C9]" />;
      case "DATABASE":
        return <Database className="h-4 w-4 text-[#2E8F86]" />;
      case "AUTH":
        return <Key className="h-4 w-4 text-amber-600" />;
      case "STORAGE":
        return <HardDrive className="h-4 w-4 text-[#5052C9]" />;
      case "AI":
        return <Sparkles className="h-4 w-4 text-purple-600" />;
      default:
        return <Server className="h-4 w-4 text-[#747683]" />;
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#B8B6AC]/40">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#5052C9]">
            Operational Diagnostics
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[#24283A] tracking-tight">
            System Operations &amp; Subsystem Health
          </h1>
          <p className="text-xs text-[#292D40]/75 mt-0.5">
            Real-time latency, availability diagnostics, and operational status for platform infrastructure.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealth}
            disabled={loading}
            className="border-[#B8B6AC] text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Run Diagnostic Probe
          </Button>
        </div>
      </div>

      {/* Overall Health Status Banner */}
      <Card
        className={`border shadow-xs rounded-2xl overflow-hidden ${
          report?.overallStatus === "HEALTHY"
            ? "bg-emerald-50 border-emerald-300"
            : report?.overallStatus === "DEGRADED"
            ? "bg-amber-50 border-amber-300"
            : "bg-red-50 border-red-300"
        }`}
      >
        <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white/80 shadow-xs flex items-center justify-center shrink-0">
              {loading ? (
                <BrandLoader size="inline" />
              ) : (
                getStatusIcon(report?.overallStatus || "HEALTHY")
              )}
            </div>
            <div>
              <div className="text-lg font-bold font-heading text-[#24283A] flex items-center gap-2">
                <span>Platform Overall Status: {report?.overallStatus || "ANALYZING"}</span>
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] bg-white/90 border-[#B8B6AC]"
                >
                  {report?.environment || "development"}
                </Badge>
              </div>
              <div className="text-xs text-[#292D40]/80 mt-0.5">
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
            className="bg-white/90 text-emerald-800 border-emerald-300 font-mono text-xs px-3 py-1 shrink-0"
          >
            <ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Option A Privacy Enforced
          </Badge>
        </CardContent>
      </Card>

      {/* Subsystem Health Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="bg-[#F8F7F3] border-[#B8B6AC] p-5">
                <Skeleton className="h-6 w-40 bg-gray-200" />
                <Skeleton className="h-4 w-60 bg-gray-200 mt-2" />
              </Card>
            ))
          : report?.services.map((svc) => (
              <Card
                key={svc.name}
                className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-white border border-[#B8B6AC]/40 flex items-center justify-center">
                      {getCategoryIcon(svc.category)}
                    </div>
                    <div>
                      <div className="font-bold text-xs font-heading text-[#24283A]">
                        {svc.name}
                      </div>
                      <div className="text-[10px] text-[#747683] font-mono">
                        Latency: {svc.latencyMs}ms
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={
                      svc.status === "HEALTHY"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-mono"
                        : svc.status === "DEGRADED"
                        ? "bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-mono"
                        : "bg-red-50 text-red-800 border-red-300 text-[10px] font-mono"
                    }
                  >
                    {svc.status}
                  </Badge>
                </div>

                <div className="p-2.5 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/30 text-xs font-mono text-[#24283A] leading-relaxed">
                  {svc.message}
                </div>
              </Card>
            ))}
      </div>

      {/* Security Architecture Statement */}
      <Card className="bg-[#FBFAF7] border-[#B8B6AC]/40 shadow-xs rounded-2xl">
        <CardContent className="p-4 flex items-center gap-3 text-xs text-[#747683]">
          <ShieldCheck className="h-5 w-5 text-[#5052C9] shrink-0" />
          <p>
            Health diagnostics query subsystem control-plane heartbeats only. Private tokens, passwords, database passwords, and user records are completely masked and suppressed from diagnostic reports.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
