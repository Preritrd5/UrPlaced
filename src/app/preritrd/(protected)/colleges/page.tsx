"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  Filter,
  PlusCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Ban,
  Play,
  Calendar,
  Users,
  ExternalLink,
  ShieldAlert,
  Mail,
  RotateCcw,
  XCircle,
  Eye,
  Info,
  Copy,
  Check,
  User,
  Clock,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/dialog-system";
import { BrandLoader } from "@/components/common/brand-loader";
import type { CollegeListItem } from "@/modules/platform-admin/services/platform-college-service";

export default function PlatformCollegesPage() {
  const [colleges, setColleges] = React.useState<CollegeListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filters
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [planFilter, setPlanFilter] = React.useState("ALL");

  // Status Action Modal State
  const [actionTarget, setActionTarget] = React.useState<{ college: CollegeListItem; newStatus: "ACTIVE" | "SUSPENDED" } | null>(null);
  const [actionReason, setActionReason] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState(false);

  // Onboarding Details Modal State
  const [detailsTarget, setDetailsTarget] = React.useState<CollegeListItem | null>(null);
  const [resendingId, setResendingId] = React.useState<string | null>(null);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = React.useState(false);

  // Decommission / Delete Modal State
  const [deleteTarget, setDeleteTarget] = React.useState<CollegeListItem | null>(null);
  const [deleteReason, setDeleteReason] = React.useState("Administrative deletion via Super Admin portal");
  const [deleteMode, setDeleteMode] = React.useState<"permanent" | "archive">("permanent");
  const [confirmTypedName, setConfirmTypedName] = React.useState("");
  const [confirmChecked, setConfirmChecked] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  const fetchColleges = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (planFilter !== "ALL") params.set("planId", planFilter);

      const res = await fetch(`/api/preritrd/colleges?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load colleges");
      } else {
        setColleges(data.colleges || []);
      }
    } catch {
      setError("Network error loading colleges.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, planFilter]);

  React.useEffect(() => {
    fetchColleges();
  }, [fetchColleges]);

  async function handleStatusChange() {
    if (!actionTarget) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/preritrd/colleges/${actionTarget.college.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: actionTarget.newStatus,
          reason: actionReason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to update status." });
        toast.error(data.error || "Failed to update status.");
      } else {
        setFeedback({
          type: "success",
          text: `College '${actionTarget.college.name}' status updated to ${actionTarget.newStatus}.`,
        });
        toast.success(`College '${actionTarget.college.name}' status updated to ${actionTarget.newStatus}.`);
        setActionTarget(null);
        setActionReason("");
        await fetchColleges();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error updating college status." });
      toast.error("Network error updating college status.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResendInvite(college: CollegeListItem) {
    setResendingId(college.id);
    try {
      const res = await fetch(`/api/preritrd/colleges/${college.id}/invitation/resend`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to resend onboarding invitation.");
      } else {
        toast.success(data.message || `Replacement invitation sent to ${college.officialEmail}.`);
        await fetchColleges();
      }
    } catch {
      toast.error("Network error resending onboarding invitation.");
    } finally {
      setResendingId(null);
    }
  }

  async function handleRevokeInvite(college: CollegeListItem) {
    setRevokingId(college.id);
    try {
      const res = await fetch(`/api/preritrd/colleges/${college.id}/invitation/revoke`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to revoke onboarding invitation.");
      } else {
        toast.success(data.message || `Invitation for '${college.name}' has been revoked.`);
        await fetchColleges();
      }
    } catch {
      toast.error("Network error revoking onboarding invitation.");
    } finally {
      setRevokingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setFeedback(null);
    try {
      const reasonText = deleteReason.trim() || "Administrative deletion via Super Admin portal";
      const res = await fetch(`/api/preritrd/colleges/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reasonText,
          hardDelete: deleteMode === "permanent",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({ type: "error", text: data.error || "Failed to delete college." });
        toast.error(data.error || "Failed to delete college.");
      } else {
        const successMsg = data.message || `College '${deleteTarget.name}' has been successfully deleted.`;
        setFeedback({
          type: "success",
          text: successMsg,
        });
        toast.success(successMsg);
        setDeleteTarget(null);
        setDeleteReason("Administrative deletion via Super Admin portal");
        setConfirmTypedName("");
        setConfirmChecked(false);
        await fetchColleges();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error deleting college." });
      toast.error("Network error deleting college.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#B8B6AC]/40">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#5052C9]">
            Tenant Governance
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[#24283A] tracking-tight">
            College Account Management
          </h1>
          <p className="text-xs text-[#292D40]/75 mt-0.5">
            Administer institutional subscriptions, onboarding progress, and operational access states.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchColleges}
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

      {/* Notifications */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold px-2">
            &times;
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-xl">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3" suppressHydrationWarning>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#747683]" />
            <Input
              type="text"
              placeholder="Search by college name, slug, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9 focus:ring-2 focus:ring-[#5052C9]/30"
              suppressHydrationWarning
            />
          </div>

          <div className="flex gap-2" suppressHydrationWarning>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#FBFAF7] border border-[#B8B6AC] text-xs rounded-lg px-3 py-1.5 text-[#24283A] outline-none focus:ring-2 focus:ring-[#5052C9]/30"
              suppressHydrationWarning
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="bg-[#FBFAF7] border border-[#B8B6AC] text-xs rounded-lg px-3 py-1.5 text-[#24283A] outline-none focus:ring-2 focus:ring-[#5052C9]/30"
              suppressHydrationWarning
            >
              <option value="ALL">All Plans</option>
              <option value="starter">Institutional Starter</option>
              <option value="growth">Campus Growth</option>
              <option value="enterprise">University Enterprise</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Colleges Table */}
      <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FBFAF7] text-[#747683] font-mono text-[10px] uppercase border-b border-[#B8B6AC]/30">
                <tr>
                  <th className="px-5 py-3 font-semibold">College / Tenant</th>
                  <th className="px-5 py-3 font-semibold">Placement Head</th>
                  <th className="px-5 py-3 font-semibold">Account Status</th>
                  <th className="px-5 py-3 font-semibold">Subscription</th>
                  <th className="px-5 py-3 font-semibold">Onboarding</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#B8B6AC]/20">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-5 py-4">
                        <Skeleton className="h-5 w-full bg-gray-200" />
                      </td>
                    </tr>
                  ))
                ) : colleges.length > 0 ? (
                  colleges.map((col) => (
                    <tr key={col.id} className="hover:bg-[#FBFAF7] transition-colors">
                      {/* Name & Slug */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold font-heading text-[#24283A] text-sm">
                          {col.name}
                        </div>
                        <div className="text-[11px] text-[#747683] font-mono">
                          slug: {col.slug}
                        </div>
                        <div className="text-[10px] text-[#747683] font-mono mt-0.5">
                          Registered: {new Date(col.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Placement Head Identity */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-[#24283A] text-xs">
                          {col.contactName || "—"}
                        </div>
                        <div className="text-[11px] text-[#5052C9] font-mono truncate max-w-[200px]">
                          {col.officialEmail || "No institutional email"}
                        </div>
                      </td>

                      {/* Account Status */}
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={
                            col.status === "ACTIVE"
                              ? "default"
                              : col.status === "SUSPENDED"
                              ? "danger"
                              : "secondary"
                          }
                          className={
                            col.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[10px]"
                              : col.status === "SUSPENDED"
                              ? "bg-red-100 text-red-800 border border-red-300 font-mono text-[10px]"
                              : "bg-gray-100 text-gray-800 font-mono text-[10px]"
                          }
                        >
                          {col.status}
                        </Badge>
                      </td>

                      {/* Subscription Plan, Status & Seat Limit */}
                      <td className="px-5 py-3.5 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-[#24283A]">
                            {col.subscriptionPlan?.name || "Unassigned Plan"}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              col.subscriptionPlan?.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[9px]"
                                : col.subscriptionPlan?.status === "PENDING_PAYMENT"
                                ? "bg-amber-50 text-amber-800 border-amber-300 font-mono text-[9px]"
                                : "bg-gray-50 text-gray-700 border-gray-300 font-mono text-[9px]"
                            }
                          >
                            {col.subscriptionPlan?.status || "NO_SUB"}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-[#747683] flex items-center gap-1 font-mono">
                          <Users className="h-3 w-3" />
                          <span>{col.studentSeatLimit.toLocaleString()} student seats</span>
                        </div>
                      </td>

                      {/* Onboarding Status */}
                      <td className="px-5 py-3.5">
                        <Badge
                          variant="outline"
                          className={
                            col.onboardingStatus === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-mono"
                              : col.onboardingStatus === "INVITED"
                              ? "bg-blue-50 text-blue-800 border-blue-300 text-[10px] font-mono"
                              : "bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-mono"
                          }
                        >
                          {col.onboardingStatus}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {/* Details Action */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDetailsTarget(col)}
                          className="h-7 text-xs text-[#5052C9] hover:bg-[#5052C9]/10 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Details
                        </Button>

                        {/* Onboarding Invitation Actions */}
                        {col.onboardingStatus !== "COMPLETED" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResendInvite(col)}
                              disabled={resendingId === col.id}
                              className="h-7 text-xs border-[#5052C9]/30 text-[#5052C9] hover:bg-[#5052C9]/5 cursor-pointer"
                              title="Generate replacement invitation and email Placement Head"
                            >
                              <RotateCcw className={`h-3 w-3 mr-1 ${resendingId === col.id ? "animate-spin" : ""}`} />
                              Resend
                            </Button>

                            {col.onboardingStatus !== "ACTION_REQUIRED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRevokeInvite(col)}
                                disabled={revokingId === col.id}
                                className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-50 cursor-pointer"
                                title="Revoke pending invitation link"
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Revoke
                              </Button>
                            )}
                          </>
                        )}

                        {/* Suspend / Activate Action */}
                        {col.status === "ACTIVE" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setActionTarget({
                                college: col,
                                newStatus: "SUSPENDED",
                              })
                            }
                            className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50 cursor-pointer"
                          >
                            <Ban className="h-3 w-3 mr-1" /> Suspend
                          </Button>
                        ) : col.status !== ("DECOMMISSIONED" as any) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setActionTarget({
                                college: col,
                                newStatus: "ACTIVE",
                              })
                            }
                            className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                          >
                            <Play className="h-3 w-3 mr-1" /> Activate
                          </Button>
                        ) : null}

                        {/* Delete Action */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDeleteTarget(col);
                            setDeleteReason("Administrative deletion via Super Admin portal");
                            setDeleteMode("permanent");
                            setConfirmTypedName("");
                            setConfirmChecked(false);
                          }}
                          className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400 cursor-pointer"
                          title="Delete or decommission institution"
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-[#747683]">
                      No college accounts found matching the filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Details Modal */}
      {detailsTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-lg bg-[#F8F7F3] border-[#B8B6AC] shadow-lg rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#5052C9]" />
                  <span>College Onboarding &amp; Identity Profile</span>
                </CardTitle>
                <button
                  onClick={() => setDetailsTarget(null)}
                  className="text-xs text-[#747683] hover:text-[#24283A] font-bold p-1"
                >
                  &times;
                </button>
              </div>
              <CardDescription className="text-xs text-[#292D40]/70">
                Institutional metadata and administrative onboarding tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs">
              {/* Institution Identity */}
              <div className="p-3 rounded-xl bg-white border border-[#DDDCD5] space-y-2">
                <div className="text-[10px] font-mono font-bold uppercase text-[#747683]">
                  Institution Information
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#747683]">Name:</span>{" "}
                    <span className="font-semibold text-[#24283A]">{detailsTarget.name}</span>
                  </div>
                  <div>
                    <span className="text-[#747683]">Slug:</span>{" "}
                    <span className="font-mono text-[#5052C9]">{detailsTarget.slug}</span>
                  </div>
                  <div>
                    <span className="text-[#747683]">Status:</span>{" "}
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {detailsTarget.status}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-[#747683]">Registered:</span>{" "}
                    <span className="text-[#24283A]">
                      {new Date(detailsTarget.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Placement Head Identity */}
              <div className="p-3 rounded-xl bg-white border border-[#DDDCD5] space-y-2">
                <div className="text-[10px] font-mono font-bold uppercase text-[#747683]">
                  Placement Head &amp; Bound Contact
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-[#2E8F86]" />
                    <span className="font-semibold text-[#24283A]">{detailsTarget.contactName || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-[#5052C9]" />
                    <span className="font-mono text-[#24283A]">{detailsTarget.officialEmail || "—"}</span>
                  </div>
                  {detailsTarget.contactPhone && (
                    <div className="flex items-center gap-2 text-[#747683]">
                      <span>Phone: {detailsTarget.contactPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Onboarding Lifecycle */}
              <div className="p-3 rounded-xl bg-white border border-[#DDDCD5] space-y-2">
                <div className="text-[10px] font-mono font-bold uppercase text-[#747683]">
                  Onboarding Lifecycle State
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#747683]">Status:</span>{" "}
                    <Badge
                      variant="outline"
                      className={
                        detailsTarget.onboardingStatus === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[10px]"
                          : "bg-blue-50 text-blue-800 border-blue-300 font-mono text-[10px]"
                      }
                    >
                      {detailsTarget.onboardingStatus}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-[#747683]">Completed:</span>{" "}
                    <span className="text-[#24283A]">
                      {detailsTarget.onboardingCompletedAt
                        ? new Date(detailsTarget.onboardingCompletedAt).toLocaleString()
                        : "Pending Setup"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[#747683]">Subscription Plan:</span>{" "}
                    <span className="font-semibold text-[#24283A]">
                      {detailsTarget.subscriptionPlan?.name || "Standard Plan"} ({detailsTarget.subscriptionPlan?.status || "PENDING_PAYMENT"})
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-[#B8B6AC]/30">
                <div className="flex gap-2">
                  {detailsTarget.onboardingStatus !== "COMPLETED" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const col = detailsTarget;
                          setDetailsTarget(null);
                          await handleResendInvite(col);
                        }}
                        className="text-xs h-8 gap-1 border-[#5052C9]/30 text-[#5052C9]"
                      >
                        <RotateCcw className="h-3 w-3" /> Resend Invite
                      </Button>
                      {detailsTarget.onboardingStatus !== "ACTION_REQUIRED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const col = detailsTarget;
                            setDetailsTarget(null);
                            await handleRevokeInvite(col);
                          }}
                          className="text-xs h-8 gap-1 border-amber-300 text-amber-800"
                        >
                          <XCircle className="h-3 w-3" /> Revoke Invite
                        </Button>
                      )}
                    </>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDetailsTarget(null)}
                  className="text-xs h-8"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmation Modal for Suspend/Activate */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-md bg-[#F8F7F3] border-[#B8B6AC] shadow-lg rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                <span>Confirm Status Modification</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <p className="text-xs text-[#24283A] leading-relaxed">
                You are about to change the status of{" "}
                <span className="font-bold">{actionTarget.college.name}</span> to{" "}
                <span className="font-bold text-[#5052C9]">{actionTarget.newStatus}</span>.
                {actionTarget.newStatus === "SUSPENDED"
                  ? " This will immediately block college staff and student workspace access."
                  : " This will restore operational access for this institution."}
              </p>

              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                <strong>Important:</strong> Activating an institutional account restores administrative access, but does not bypass subscription payment requirements. Operational capabilities remain locked until an approved subscription plan is paid and verified.
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#24283A]">
                  Administrative Reason (Logged in Platform Audit)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Terms review, subscription renewal pending"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#B8B6AC]/30">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActionTarget(null)}
                  disabled={actionLoading}
                  className="border-[#B8B6AC] text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleStatusChange}
                  disabled={actionLoading}
                  className={`text-white text-xs h-9 ${
                    actionTarget.newStatus === "SUSPENDED"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-[#5052C9] hover:bg-[#4345B0]"
                  }`}
                >
                  {actionLoading ? "Updating..." : `Confirm ${actionTarget.newStatus}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmation Modal for College Deletion */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-lg bg-[#F8F7F3] border-red-300 shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30 bg-red-50/60">
              <CardTitle className="text-base font-bold font-heading text-red-950 flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                <span>Delete College Account</span>
              </CardTitle>
              <CardDescription className="text-xs text-red-800">
                Administrative removal of institutional workspace and associated accounts.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-white border border-[#DDDCD5] space-y-1.5">
                <div className="text-[10px] font-mono font-bold uppercase text-[#747683]">Target Institution</div>
                <div className="text-sm font-bold font-heading text-[#24283A]">{deleteTarget.name}</div>
                <div className="text-[11px] font-mono text-[#5052C9]">Slug: {deleteTarget.slug}</div>
              </div>

              {/* Deletion Mode */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#24283A]">
                  Choose Deletion Action:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div
                    onClick={() => setDeleteMode("permanent")}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      deleteMode === "permanent"
                        ? "border-red-500 bg-red-50/50 shadow-xs"
                        : "border-[#DDDCD5] bg-white hover:bg-stone-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-red-900">
                      <input
                        type="radio"
                        name="deleteMode"
                        checked={deleteMode === "permanent"}
                        onChange={() => setDeleteMode("permanent")}
                        className="text-red-600 focus:ring-red-500"
                      />
                      <span>Permanent Delete</span>
                    </div>
                    <p className="text-[11px] text-[#747683] mt-1">
                      Completely removes the college and student records from the database. Recommended for test accounts.
                    </p>
                  </div>

                  <div
                    onClick={() => setDeleteMode("archive")}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      deleteMode === "archive"
                        ? "border-[#5052C9] bg-[#5052C9]/5 shadow-xs"
                        : "border-[#DDDCD5] bg-white hover:bg-stone-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-[#24283A]">
                      <input
                        type="radio"
                        name="deleteMode"
                        checked={deleteMode === "archive"}
                        onChange={() => setDeleteMode("archive")}
                        className="text-[#5052C9] focus:ring-[#5052C9]"
                      />
                      <span>Archive &amp; Lockout</span>
                    </div>
                    <p className="text-[11px] text-[#747683] mt-1">
                      Revokes logins and cancels subscriptions, but preserves historical invoices and audit logs.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#24283A]">
                  Administrative Reason (Audit Recorded)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Administrative removal via Super Admin portal"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                />
              </div>

              {/* Confirmation Controls */}
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="confirmDeleteCheck"
                    checked={confirmChecked}
                    onChange={(e) => setConfirmChecked(e.target.checked)}
                    className="mt-0.5 rounded text-red-600 focus:ring-red-500 cursor-pointer"
                  />
                  <label htmlFor="confirmDeleteCheck" className="text-xs text-[#24283A] font-medium cursor-pointer leading-tight">
                    I confirm that I want to {deleteMode === "permanent" ? "permanently delete" : "archive"}{" "}
                    <strong className="text-red-700">{deleteTarget.name}</strong>.
                  </label>
                </div>
                <div className="text-[11px] text-[#747683]">
                  Or type <strong className="font-mono text-[#24283A]">DELETE</strong> below:
                </div>
                <Input
                  type="text"
                  placeholder="Type DELETE to confirm"
                  value={confirmTypedName}
                  onChange={(e) => setConfirmTypedName(e.target.value)}
                  className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-8"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#B8B6AC]/30">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteReason("Administrative deletion via Super Admin portal");
                    setConfirmTypedName("");
                    setConfirmChecked(false);
                  }}
                  disabled={deleteLoading}
                  className="border-[#B8B6AC] text-xs h-9 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleDelete}
                  disabled={
                    deleteLoading ||
                    (!confirmChecked &&
                      confirmTypedName.trim().toUpperCase() !== "DELETE" &&
                      confirmTypedName.trim().toLowerCase() !== deleteTarget.name.toLowerCase())
                  }
                  className="bg-red-600 hover:bg-red-700 text-white text-xs h-9 disabled:opacity-50 cursor-pointer font-semibold"
                >
                  {deleteLoading ? (
                    <span className="flex items-center gap-1.5">
                      <BrandLoader size="button" /> Deleting...
                    </span>
                  ) : (
                    `Confirm & Delete`
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
