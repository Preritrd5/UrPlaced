"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  PlusCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Ban,
  Play,
  Users,
  ShieldAlert,
  Mail,
  RotateCcw,
  XCircle,
  Eye,
  User,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-primary">
              Tenant Governance
            </span>
            <Badge variant="outline" className="font-mono text-[10px] bg-secondary/10 text-secondary border-secondary/30">
              Institutional Registry
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-primary tracking-tight">
            College Account Management
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Administer institutional subscriptions, onboarding progress, and operational access states.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchColleges}
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

      {/* Notifications */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between ${feedback.type === "success"
              ? "bg-secondary/10 border-secondary/30 text-secondary"
              : "bg-status-danger-subtle border-status-danger/30 text-status-danger"
            }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-secondary shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-status-danger shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold px-2 cursor-pointer">
            &times;
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card className="bg-card border-border shadow-xs rounded-2xl">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3" suppressHydrationWarning>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-text-secondary" />
            <Input
              type="text"
              placeholder="Search by college name, slug, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-input border-border text-xs h-9 focus:ring-2 focus:ring-primary/25"
              suppressHydrationWarning
            />
          </div>

          <div className="flex gap-2" suppressHydrationWarning>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-input border border-border text-xs rounded-xl px-3 py-1.5 text-text-primary outline-none focus:ring-2 focus:ring-primary/25"
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
              className="bg-input border border-border text-xs rounded-xl px-3 py-1.5 text-text-primary outline-none focus:ring-2 focus:ring-primary/25"
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
      <Card className="bg-card border-border shadow-xs rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface/80 text-text-secondary font-mono text-[10px] uppercase border-b border-border">
                <tr>
                  <th className="px-5 py-3 font-semibold">College / Tenant</th>
                  <th className="px-5 py-3 font-semibold">Placement Head</th>
                  <th className="px-5 py-3 font-semibold">Account Status</th>
                  <th className="px-5 py-3 font-semibold">Subscription</th>
                  <th className="px-5 py-3 font-semibold">Onboarding</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-5 py-4">
                        <Skeleton className="h-5 w-full bg-surface" />
                      </td>
                    </tr>
                  ))
                ) : colleges.length > 0 ? (
                  colleges.map((col) => (
                    <tr key={col.id} className="hover:bg-surface/50 transition-colors">
                      {/* Name & Slug */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold font-heading text-text-primary text-sm">
                          {col.name}
                        </div>
                        <div className="text-[11px] text-text-secondary font-mono">
                          slug: {col.slug}
                        </div>
                        <div className="text-[10px] text-text-secondary font-mono mt-0.5">
                          Registered: {new Date(col.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Placement Head Identity */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-text-primary text-xs">
                          {col.contactName || "—"}
                        </div>
                        <div className="text-[11px] text-primary font-mono truncate max-w-[200px]">
                          {col.officialEmail || "No institutional email"}
                        </div>
                      </td>

                      {/* Account Status */}
                      <td className="px-5 py-3.5">
                        <Badge
                          variant="outline"
                          className={
                            col.status === "ACTIVE"
                              ? "bg-secondary/10 text-secondary border-secondary/30 font-mono text-[10px]"
                              : col.status === "SUSPENDED"
                                ? "bg-status-danger-subtle text-status-danger border-status-danger/30 font-mono text-[10px]"
                                : "bg-surface text-text-secondary border-border font-mono text-[10px]"
                          }
                        >
                          {col.status}
                        </Badge>
                      </td>

                      {/* Subscription Plan, Status & Seat Limit */}
                      <td className="px-5 py-3.5 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-text-primary">
                            {col.subscriptionPlan?.name || "Unassigned Plan"}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              col.subscriptionPlan?.status === "ACTIVE"
                                ? "bg-secondary/10 text-secondary border-secondary/30 font-mono text-[9px]"
                                : col.subscriptionPlan?.status === "PENDING_PAYMENT"
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-mono text-[9px]"
                                  : "bg-surface text-text-secondary border-border font-mono text-[9px]"
                            }
                          >
                            {col.subscriptionPlan?.status || "NO_SUB"}
                          </Badge>
                        </div>
                        <div className="text-[11px] text-text-secondary flex items-center gap-1 font-mono">
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
                              ? "bg-secondary/10 text-secondary border-secondary/30 text-[10px] font-mono"
                              : col.onboardingStatus === "INVITED"
                                ? "bg-primary/10 text-primary border-primary/30 text-[10px] font-mono"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-mono"
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
                          className="h-8 text-xs text-primary hover:bg-surface cursor-pointer"
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
                              className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/5 cursor-pointer"
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
                                className="h-8 text-xs border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/5 cursor-pointer"
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
                            className="h-8 text-xs border-status-danger/30 text-status-danger hover:bg-status-danger-subtle cursor-pointer"
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
                            className="h-8 text-xs border-secondary/30 text-secondary hover:bg-secondary/10 cursor-pointer"
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
                          className="h-8 text-xs border-status-danger/40 text-status-danger hover:bg-status-danger-subtle cursor-pointer"
                          title="Delete or decommission institution"
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Delete
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-text-secondary">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-hidden">
          <Card className="w-full max-w-lg min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-border shadow-2xl rounded-2xl">
            <CardHeader className="shrink-0 pb-3 border-b border-border bg-card">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold font-heading text-text-primary flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <span>College Onboarding &amp; Identity Profile</span>
                </CardTitle>
                <button
                  onClick={() => setDetailsTarget(null)}
                  className="text-xs text-text-secondary hover:text-text-primary font-bold p-1 cursor-pointer"
                >
                  &times;
                </button>
              </div>
              <CardDescription className="text-xs text-text-secondary">
                Institutional metadata and administrative onboarding tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 pr-3 sm:pr-5 space-y-4 text-xs">
              {/* Institution Identity */}
              <div className="p-3 rounded-xl bg-surface border border-border space-y-2">
                <div className="text-[10px] font-mono font-bold uppercase text-text-secondary">
                  Institution Information
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-text-secondary">Name:</span>{" "}
                    <span className="font-semibold text-text-primary">{detailsTarget.name}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary">Slug:</span>{" "}
                    <span className="font-mono text-primary">{detailsTarget.slug}</span>
                  </div>
                  <div>
                    <span className="text-text-secondary">Status:</span>{" "}
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {detailsTarget.status}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-text-secondary">Registered:</span>{" "}
                    <span className="text-text-primary font-mono">
                      {new Date(detailsTarget.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Placement Head Identity */}
              <div className="p-3 rounded-xl bg-surface border border-border space-y-2">
                <div className="text-[10px] font-mono font-bold uppercase text-text-secondary">
                  Placement Head &amp; Bound Contact
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-secondary" />
                    <span className="font-semibold text-text-primary">{detailsTarget.contactName || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    <span className="font-mono text-text-primary">{detailsTarget.officialEmail || "—"}</span>
                  </div>
                  {detailsTarget.contactPhone && (
                    <div className="flex items-center gap-2 text-text-secondary font-mono">
                      <span>Phone: {detailsTarget.contactPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Onboarding Lifecycle */}
              <div className="p-3 rounded-xl bg-surface border border-border space-y-2">
                <div className="text-[10px] font-mono font-bold uppercase text-text-secondary">
                  Onboarding Lifecycle State
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-text-secondary">Status:</span>{" "}
                    <Badge
                      variant="outline"
                      className={
                        detailsTarget.onboardingStatus === "COMPLETED"
                          ? "bg-secondary/10 text-secondary border-secondary/30 font-mono text-[10px]"
                          : "bg-primary/10 text-primary border-primary/30 font-mono text-[10px]"
                      }
                    >
                      {detailsTarget.onboardingStatus}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-text-secondary">Completed:</span>{" "}
                    <span className="text-text-primary font-mono">
                      {detailsTarget.onboardingCompletedAt
                        ? new Date(detailsTarget.onboardingCompletedAt).toLocaleString()
                        : "Pending Setup"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-text-secondary">Subscription Plan:</span>{" "}
                    <span className="font-semibold text-text-primary">
                      {detailsTarget.subscriptionPlan?.name || "Standard Plan"} ({detailsTarget.subscriptionPlan?.status || "PENDING_PAYMENT"})
                    </span>
                  </div>
                </div>
              </div>

            </CardContent>

            {/* Modal Actions */}
            <div className="shrink-0 p-3 sm:p-4 border-t border-border bg-surface/50 flex items-center justify-between gap-2">
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
                      className="text-xs h-8 gap-1 border-primary/30 text-primary"
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
                        className="text-xs h-8 gap-1 border-amber-500/30 text-amber-700 dark:text-amber-400"
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
          </Card>
        </div>
      )}

      {/* Confirmation Modal for Suspend/Activate */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-hidden">
          <Card className="w-full max-w-md min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-border shadow-2xl rounded-2xl">
            <CardHeader className="shrink-0 pb-3 border-b border-border bg-card">
              <CardTitle className="text-base font-bold font-heading text-text-primary flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                <span>Confirm Status Modification</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 pr-3 sm:pr-5 space-y-4">
              <p className="text-xs text-text-primary leading-relaxed">
                You are about to change the status of{" "}
                <span className="font-bold">{actionTarget.college.name}</span> to{" "}
                <span className="font-bold text-primary">{actionTarget.newStatus}</span>.
                {actionTarget.newStatus === "SUSPENDED"
                  ? " This will immediately block college staff and student workspace access."
                  : " This will restore operational access for this institution."}
              </p>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-900 dark:text-amber-100 leading-relaxed">
                <strong>Important:</strong> Activating an institutional account restores administrative access, but does not bypass subscription payment requirements. Operational capabilities remain locked until an approved subscription plan is paid and verified.
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Administrative Reason (Logged in Platform Audit)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Terms review, subscription renewal pending"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="bg-input border-border text-xs h-9"
                />
              </div>
            </CardContent>
            <div className="shrink-0 p-3.5 sm:p-4 border-t border-border/60 bg-surface/50 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActionTarget(null)}
                disabled={actionLoading}
                className="border-border text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleStatusChange}
                disabled={actionLoading}
                className={`text-white text-xs h-9 ${actionTarget.newStatus === "SUSPENDED"
                    ? "bg-status-danger hover:opacity-90"
                    : "bg-primary hover:bg-[var(--color-primary-hover)]"
                  }`}
              >
                {actionLoading ? "Updating..." : `Confirm ${actionTarget.newStatus}`}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Confirmation Modal for College Deletion */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-hidden">
          <Card className="w-full max-w-lg min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-status-danger/40 shadow-2xl rounded-2xl">
            <CardHeader className="shrink-0 pb-3 border-b border-border bg-status-danger-subtle/40">
              <CardTitle className="text-base font-bold font-heading text-status-danger flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-status-danger" />
                <span>Delete College Account</span>
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Administrative removal of institutional workspace and associated accounts.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 pr-3 sm:pr-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-surface border border-border space-y-1.5">
                <div className="text-[10px] font-mono font-bold uppercase text-text-secondary">Target Institution</div>
                <div className="text-sm font-bold font-heading text-text-primary">{deleteTarget.name}</div>
                <div className="text-[11px] font-mono text-primary">Slug: {deleteTarget.slug}</div>
              </div>

              {/* Deletion Mode */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-primary">
                  Choose Deletion Action:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div
                    onClick={() => setDeleteMode("permanent")}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${deleteMode === "permanent"
                        ? "border-status-danger bg-status-danger-subtle/50 shadow-xs"
                        : "border-border bg-surface hover:bg-surface/80"
                      }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-status-danger">
                      <input
                        type="radio"
                        name="deleteMode"
                        checked={deleteMode === "permanent"}
                        onChange={() => setDeleteMode("permanent")}
                        className="text-status-danger focus:ring-status-danger"
                      />
                      <span>Permanent Delete</span>
                    </div>
                    <p className="text-[11px] text-text-secondary mt-1">
                      Completely removes the college and student records from the database. Recommended for test accounts.
                    </p>
                  </div>

                  <div
                    onClick={() => setDeleteMode("archive")}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${deleteMode === "archive"
                        ? "border-primary bg-primary/10 shadow-xs"
                        : "border-border bg-surface hover:bg-surface/80"
                      }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-text-primary">
                      <input
                        type="radio"
                        name="deleteMode"
                        checked={deleteMode === "archive"}
                        onChange={() => setDeleteMode("archive")}
                        className="text-primary focus:ring-primary"
                      />
                      <span>Archive &amp; Lockout</span>
                    </div>
                    <p className="text-[11px] text-text-secondary mt-1">
                      Revokes logins and cancels subscriptions, but preserves historical invoices and audit logs.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Administrative Reason (Audit Recorded)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Administrative removal via Super Admin portal"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="bg-input border-border text-xs h-9"
                />
              </div>

              {/* Confirmation Controls */}
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="confirmDeleteCheck"
                    checked={confirmChecked}
                    onChange={(e) => setConfirmChecked(e.target.checked)}
                    className="mt-0.5 rounded text-status-danger focus:ring-status-danger cursor-pointer"
                  />
                  <label htmlFor="confirmDeleteCheck" className="text-xs text-text-primary font-medium cursor-pointer leading-tight">
                    I confirm that I want to {deleteMode === "permanent" ? "permanently delete" : "archive"}{" "}
                    <strong className="text-status-danger">{deleteTarget.name}</strong>.
                  </label>
                </div>
                <div className="text-[11px] text-text-secondary">
                  Or type <strong className="font-mono text-text-primary">DELETE</strong> below:
                </div>
                <Input
                  type="text"
                  placeholder="Type DELETE to confirm"
                  value={confirmTypedName}
                  onChange={(e) => setConfirmTypedName(e.target.value)}
                  className="bg-input border-border text-xs h-8"
                />
              </div>
            </CardContent>
            <div className="shrink-0 p-3.5 sm:p-4 border-t border-border bg-surface/50 flex justify-end gap-2">
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
                className="border-border text-xs h-9 cursor-pointer"
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
                className="bg-status-danger hover:opacity-90 text-white text-xs h-9 disabled:opacity-50 cursor-pointer font-semibold"
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
          </Card>
        </div>
      )}
    </div>
  );
}
