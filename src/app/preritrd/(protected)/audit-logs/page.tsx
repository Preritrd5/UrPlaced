"use client";

import * as React from "react";
import {
  FileText,
  ShieldCheck,
  RefreshCw,
  Filter,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlatformAuditLogItem } from "@/modules/platform-admin/services/platform-audit-service";

export default function PlatformAuditLogsPage() {
  const [logs, setLogs] = React.useState<PlatformAuditLogItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [actionFilter, setActionFilter] = React.useState("ALL");

  // Metadata Inspector Modal
  const [inspectTarget, setInspectTarget] = React.useState<PlatformAuditLogItem | null>(null);

  const fetchLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter !== "ALL") params.set("action", actionFilter);
      params.set("limit", "100");

      const res = await fetch(`/api/preritrd/audit-logs?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setTotal(data.total || 0);
      }
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  React.useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-primary">
              Governance &amp; Accountability
            </span>
            <Badge variant="outline" className="font-mono text-[10px] bg-secondary/10 text-secondary border-secondary/30">
              Immutable Trail
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-primary tracking-tight">
            Platform Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Immutable, read-only historical log of all control-plane administrative operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="border-border text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Strict Isolation Notice */}
      <Card className="bg-surface/80 border-primary/30 shadow-xs rounded-2xl">
        <CardContent className="p-4 flex items-start gap-3 text-xs text-text-primary">
          <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">Strict Audit Log Isolation:</span> This view queries only control-plane events where <code className="bg-surface px-1 py-0.5 rounded font-mono text-[11px] border border-border">tenant_id IS NULL</code>. Institutional events (student assessment submissions, mistake reviews, interviewer scoring) belong strictly to individual college domains and are forbidden from appearing in platform logs.
          </div>
        </CardContent>
      </Card>

      {/* Filters Bar */}
      <Card className="bg-card border-border shadow-xs rounded-2xl">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-text-secondary font-mono">
            Showing <span className="font-bold text-text-primary">{logs.length}</span> of{" "}
            <span className="font-bold text-text-primary">{total}</span> recorded events
          </div>

          <div className="flex items-center gap-2" suppressHydrationWarning>
            <Filter className="h-3.5 w-3.5 text-text-secondary" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-input border border-border text-xs rounded-xl px-3 py-1.5 text-text-primary outline-none focus:ring-2 focus:ring-primary/25"
              suppressHydrationWarning
            >
              <option value="ALL">All Event Actions</option>
              <option value="PLATFORM_ADMIN_LOGIN_SUCCESS">Admin Login</option>
              <option value="PLATFORM_MFA_CHALLENGE_VERIFIED">MFA Verified</option>
              <option value="PLATFORM_COLLEGE_REGISTER">College Registered</option>
              <option value="PLATFORM_COLLEGE_SUSPEND">College Suspended</option>
              <option value="PLATFORM_COLLEGE_ACTIVATE">College Activated</option>
              <option value="PLATFORM_PLAN_UPSERT">Plan Upserted</option>
              <option value="PLATFORM_SUBSCRIPTION_UPDATE">Subscription Updated</option>
              <option value="PLATFORM_INVOICE_CREATE">Invoice Created</option>
              <option value="PLATFORM_INVOICE_PAID">Invoice Paid</option>
              <option value="PLATFORM_CONFIG_UPDATE">Configuration Updated</option>
              <option value="PLATFORM_ADMIN_INVITE">Admin Invited</option>
              <option value="PLATFORM_ADMIN_STATUS_UPDATE">Admin Status Changed</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card className="bg-card border-border shadow-xs rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface/80 text-text-secondary font-mono text-[10px] uppercase border-b border-border">
                <tr>
                  <th className="px-5 py-3 font-semibold">Action / Event</th>
                  <th className="px-5 py-3 font-semibold">Administrator</th>
                  <th className="px-5 py-3 font-semibold">Target Resource</th>
                  <th className="px-5 py-3 font-semibold">Timestamp</th>
                  <th className="px-5 py-3 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-sans">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-5 py-4">
                        <Skeleton className="h-5 w-full bg-surface" />
                      </td>
                    </tr>
                  ))
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-bold text-primary text-xs">
                          {log.action}
                        </div>
                        <div className="text-[10px] text-text-secondary font-mono">
                          ID: {log.id.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-text-primary font-medium font-mono">
                        {log.actorEmail}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className="text-[10px] font-mono border-border bg-surface">
                          {log.resourceType || "CONTROL_PLANE"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-text-secondary">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInspectTarget(log)}
                          className="h-8 text-xs border-border gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" /> Inspect
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-text-secondary">
                      No platform audit logs recorded matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Metadata Inspector Modal */}
      {inspectTarget && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(36,40,58,0.50)] backdrop-blur-sm p-3 sm:p-4 flex min-h-full items-center justify-center">
          <Card className="w-full max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-border shadow-xl rounded-2xl my-auto">
            <CardHeader className="shrink-0 pb-3 border-b border-border/60 bg-card">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold font-heading text-text-primary">
                  Platform Event Metadata
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] text-primary border-primary/30 bg-primary/10">
                  {inspectTarget.action}
                </Badge>
              </div>
              <CardDescription className="text-xs text-text-secondary font-mono">
                Event ID: {inspectTarget.id}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-text-secondary block font-mono text-[11px]">Actor:</span>
                  <span className="font-semibold text-text-primary font-mono">{inspectTarget.actorEmail}</span>
                </div>
                <div>
                  <span className="text-text-secondary block font-mono text-[11px]">Timestamp:</span>
                  <span className="font-mono text-text-primary">{new Date(inspectTarget.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-text-primary block">
                  Event Payload / Metadata (JSON)
                </span>
                <pre className="p-3 bg-surface border border-border rounded-xl text-[11px] font-mono text-text-primary overflow-x-auto max-h-60 leading-relaxed">
                  {JSON.stringify(inspectTarget.metadata, null, 2)}
                </pre>
              </div>

              </CardContent>
            <div className="shrink-0 p-3.5 sm:p-4 border-t border-border/60 bg-surface/50 flex justify-end gap-2">
              <Button
                  size="sm"
                  onClick={() => setInspectTarget(null)}
                  className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-9 px-4 rounded-xl"
                >
                  Close
                </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
