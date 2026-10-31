"use client";

import * as React from "react";
import {
  FileText,
  ShieldCheck,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Calendar,
  Lock,
  Layers,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#B8B6AC]/40">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#5052C9]">
            Governance &amp; Accountability
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[#24283A] tracking-tight">
            Platform Audit Trail
          </h1>
          <p className="text-xs text-[#292D40]/75 mt-0.5">
            Immutable, read-only historical log of all control-plane administrative operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="border-[#B8B6AC] text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Strict Isolation Notice */}
      <Card className="bg-[#FBFAF7] border-[#5052C9]/30 shadow-xs rounded-2xl">
        <CardContent className="p-4 flex items-start gap-3 text-xs text-[#24283A]">
          <ShieldCheck className="h-5 w-5 text-[#5052C9] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">Strict Audit Log Isolation:</span> This view queries only control-plane events where <code className="bg-[#EDECE7] px-1 py-0.5 rounded font-mono text-[11px]">tenant_id IS NULL</code>. Institutional events (student assessment submissions, mistake reviews, interviewer scoring) belong strictly to individual college domains and are forbidden from appearing in platform logs.
          </div>
        </CardContent>
      </Card>

      {/* Filters Bar */}
      <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-xl">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#747683] font-mono">
            Showing <span className="font-bold text-[#24283A]">{logs.length}</span> of{" "}
            <span className="font-bold text-[#24283A]">{total}</span> recorded events
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-[#747683]" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-[#FBFAF7] border border-[#B8B6AC] text-xs rounded-lg px-3 py-1.5 text-[#24283A] outline-none"
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
      <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FBFAF7] text-[#747683] font-mono text-[10px] uppercase border-b border-[#B8B6AC]/30">
                <tr>
                  <th className="px-5 py-3 font-semibold">Action / Event</th>
                  <th className="px-5 py-3 font-semibold">Administrator</th>
                  <th className="px-5 py-3 font-semibold">Target Resource</th>
                  <th className="px-5 py-3 font-semibold">Timestamp</th>
                  <th className="px-5 py-3 font-semibold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#B8B6AC]/20 font-sans">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-5 py-4">
                        <Skeleton className="h-5 w-full bg-gray-200" />
                      </td>
                    </tr>
                  ))
                ) : logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#FBFAF7] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-bold text-[#5052C9] text-xs">
                          {log.action}
                        </div>
                        <div className="text-[10px] text-[#747683] font-mono">
                          ID: {log.id.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[#24283A] font-medium">
                        {log.actorEmail}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className="text-[10px] font-mono border-[#B8B6AC]">
                          {log.resourceType || "CONTROL_PLANE"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[#747683]">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setInspectTarget(log)}
                          className="h-7 text-xs border-[#B8B6AC] gap-1"
                        >
                          <Eye className="h-3 w-3" /> Inspect
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-[#747683]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-lg bg-[#F8F7F3] border-[#B8B6AC] shadow-lg rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold font-heading text-[#24283A]">
                  Platform Event Metadata
                </CardTitle>
                <Badge variant="outline" className="font-mono text-[10px] text-[#5052C9] border-[#5052C9]/30">
                  {inspectTarget.action}
                </Badge>
              </div>
              <CardDescription className="text-xs text-[#292D40]/70 font-mono">
                Event ID: {inspectTarget.id}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[#747683] block">Actor:</span>
                  <span className="font-semibold text-[#24283A]">{inspectTarget.actorEmail}</span>
                </div>
                <div>
                  <span className="text-[#747683] block">Timestamp:</span>
                  <span className="font-mono text-[#24283A]">{new Date(inspectTarget.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-[#24283A] block">
                  Event Payload / Metadata (JSON)
                </span>
                <pre className="p-3 bg-[#FBFAF7] border border-[#B8B6AC] rounded-xl text-[11px] font-mono text-[#24283A] overflow-x-auto max-h-60 leading-relaxed">
                  {JSON.stringify(inspectTarget.metadata, null, 2)}
                </pre>
              </div>

              <div className="flex justify-end pt-2 border-t border-[#B8B6AC]/30">
                <Button
                  size="sm"
                  onClick={() => setInspectTarget(null)}
                  className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-8"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
