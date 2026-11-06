"use client";

import * as React from "react";
import {
  Users2,
  ShieldCheck,
  PlusCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Mail,
  Calendar,
  Check,
  Copy,
  UserX,
  UserCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLoader } from "@/components/common/brand-loader";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/dialog-system";
import type {
  PlatformAdminUserItem,
  PlatformAdminInvitationItem,
} from "@/modules/platform-admin/services/platform-admin-management-service";

export default function PlatformAccountsPage() {
  const [admins, setAdmins] = React.useState<PlatformAdminUserItem[]>([]);
  const [invitations, setInvitations] = React.useState<PlatformAdminInvitationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Invite Modal
  const [showInviteModal, setShowInviteModal] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteLoading, setInviteLoading] = React.useState(false);
  const [createdInviteLink, setCreatedInviteLink] = React.useState<string | null>(null);
  const [copiedLink, setCopiedLink] = React.useState(false);

  // Status Change Action State
  const [statusTarget, setStatusTarget] = React.useState<{ admin: PlatformAdminUserItem; newStatus: "ACTIVE" | "SUSPENDED" | "REVOKED" } | null>(null);
  const [statusLoading, setStatusLoading] = React.useState(false);

  // Permanent Deletion State
  const [deleteTarget, setDeleteTarget] = React.useState<PlatformAdminUserItem | null>(null);
  const [deleteReason, setDeleteReason] = React.useState("Administrative permanent deletion via platform Super Admin console");
  const [deleteConfirmEmail, setDeleteConfirmEmail] = React.useState("");
  const [deleteLoading, setDeleteLoading] = React.useState(false);

  const fetchAccounts = React.useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/preritrd/accounts");
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to load admin accounts." });
      } else {
        setAdmins(data.admins || []);
        setInvitations(data.invitations || []);
      }
    } catch {
      setFeedback({ type: "error", text: "Network error loading admin accounts." });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Handle Invite Creation
  async function handleCreateInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/preritrd/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to create administrator invitation." });
      } else {
        setCreatedInviteLink(`${window.location.origin}${data.inviteLink}`);
        await fetchAccounts();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error creating invitation." });
    } finally {
      setInviteLoading(false);
    }
  }

  // Handle Status Update
  async function handleUpdateStatus() {
    if (!statusTarget) return;
    setStatusLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/preritrd/accounts/${statusTarget.admin.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusTarget.newStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to update administrator status." });
      } else {
        setFeedback({
          type: "success",
          text: `Administrator '${statusTarget.admin.email}' status updated to ${statusTarget.newStatus}.`,
        });
        setStatusTarget(null);
        await fetchAccounts();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error updating status." });
    } finally {
      setStatusLoading(false);
    }
  }

  function handleCopyInvite() {
    if (createdInviteLink) {
      navigator.clipboard.writeText(createdInviteLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  // Handle Permanent Administrator Deletion
  async function handleDeleteAdmin() {
    if (!deleteTarget) return;
    if (deleteConfirmEmail.trim().toLowerCase() !== deleteTarget.email.toLowerCase()) {
      toast.error("Email confirmation does not match the target administrator email.");
      return;
    }
    if (!deleteReason || deleteReason.trim().length < 5) {
      toast.error("A valid deletion reason of at least 5 characters is required.");
      return;
    }

    setDeleteLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/preritrd/accounts/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailConfirmation: deleteConfirmEmail.trim(),
          reason: deleteReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to permanently delete administrator." });
        toast.error(data.error || "Failed to delete administrator.");
      } else {
        setFeedback({
          type: "success",
          text: `Administrator '${deleteTarget.email}' permanently deleted from Supabase Auth and platform registry.`,
        });
        toast.success(`Administrator '${deleteTarget.email}' permanently deleted.`);
        setDeleteTarget(null);
        setDeleteConfirmEmail("");
        setDeleteReason("Administrative permanent deletion via platform Super Admin console");
        await fetchAccounts();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error deleting administrator." });
      toast.error("Network error deleting administrator.");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary">
            Access Governance
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-primary tracking-tight">
            Platform Administrators
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Manage authorized platform super administrator credentials, invitations, and MFA enforcement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAccounts}
            disabled={loading}
            className="border-border text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setShowInviteModal(true);
              setCreatedInviteLink(null);
              setInviteEmail("");
            }}
            className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-9 gap-1.5 shadow-sm"
          >
            <PlusCircle className="h-4 w-4" /> Invite Super Admin
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-status-danger/30 text-status-danger"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-status-danger shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold px-2">
            &times;
          </button>
        </div>
      )}

      {/* Admins Table Card */}
      <Card className="bg-card border-border shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base font-bold font-heading text-text-primary">
            Active Platform Administrators ({admins.length})
          </CardTitle>
          <CardDescription className="text-xs text-text-secondary">
            Accounts holding platform-wide infrastructure control authority
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface text-text-secondary font-mono text-[10px] uppercase border-b border-border/60">
                <tr>
                  <th className="px-5 py-3 font-semibold">Administrator</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">MFA Assurance</th>
                  <th className="px-5 py-3 font-semibold">Last Sign In</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-5 py-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ))
                ) : admins.length > 0 ? (
                  admins.map((adm) => (
                    <tr key={adm.id} className="hover:bg-surface transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold font-heading text-text-primary text-sm">
                          {adm.fullName || "Super Admin"}
                        </div>
                        <div className="text-[11px] text-text-secondary font-mono">{adm.email}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={adm.status === "ACTIVE" ? "default" : "danger"}
                          className={
                            adm.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[10px]"
                              : "bg-red-100 text-red-800 font-mono text-[10px]"
                          }
                        >
                          {adm.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[10px]"
                        >
                          <ShieldCheck className="h-3 w-3 mr-1 text-emerald-600" /> AAL2 Mandatory
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-text-secondary">
                        {adm.lastSignInAt ? new Date(adm.lastSignInAt).toLocaleString() : "Recently active"}
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1.5">
                        {adm.status === "ACTIVE" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatusTarget({ admin: adm, newStatus: "SUSPENDED" })}
                            className="h-7 text-xs border-status-danger/30 text-status-danger hover:bg-red-50"
                          >
                            <UserX className="h-3 w-3 mr-1" /> Suspend
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatusTarget({ admin: adm, newStatus: "ACTIVE" })}
                            className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          >
                            <UserCheck className="h-3 w-3 mr-1" /> Activate
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDeleteTarget(adm);
                            setDeleteConfirmEmail("");
                            setDeleteReason("Administrative permanent deletion via platform Super Admin console");
                          }}
                          className="h-7 text-xs border-status-danger/40 text-status-danger hover:bg-red-50 hover:text-red-800"
                          title="Permanently Delete Admin"
                        >
                          <Trash2 className="h-3 w-3 mr-1 text-status-danger" /> Delete
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-text-secondary">
                      No administrator accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Invitations Table Card */}
      {invitations.length > 0 && (
        <Card className="bg-card border-border shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base font-bold font-heading text-text-primary">
              Pending Administrator Invitations ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface text-text-secondary font-mono text-[10px] uppercase border-b border-border/60">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Invited Email</th>
                    <th className="px-5 py-3 font-semibold">Assigned Role</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Expires At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-5 py-3 font-mono text-text-primary">{inv.email}</td>
                      <td className="px-5 py-3 font-medium text-primary">{inv.role}</td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 font-mono text-text-secondary">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Super Admin Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-hidden">
          <Card className="w-full max-w-md min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-border shadow-2xl rounded-2xl">
            <CardHeader className="shrink-0 pb-3 border-b border-border/60 bg-card">
              <CardTitle className="text-base font-bold font-heading text-text-primary">
                Invite Super Administrator
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Issue a single-use onboarding credential link with mandatory MFA
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 pr-3 sm:pr-5 space-y-4">
              {!createdInviteLink ? (
                <form onSubmit={handleCreateInvite} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-primary">
                      Administrator Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-text-secondary" />
                      <Input
                        type="email"
                        required
                        placeholder="newadmin@urplaced.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="pl-8 bg-surface border-border text-xs h-9"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowInviteModal(false)}
                      disabled={inviteLoading}
                      className="border-border text-xs h-9"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={inviteLoading}
                      className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-9"
                    >
                      {inviteLoading ? "Generating..." : "Generate Invitation"}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Invitation Link Generated</span>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-relaxed">
                      Deliver this secure link directly to the invited administrator. It will expire in 7 days and requires two-factor configuration upon sign in.
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <code className="text-[11px] font-mono bg-white p-2 rounded-lg flex-1 border border-emerald-200 break-all select-all">
                        {createdInviteLink}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopyInvite}
                        className="border-emerald-300 text-emerald-800 text-xs h-8 shrink-0"
                      >
                        {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => {
                        setShowInviteModal(false);
                        setCreatedInviteLink(null);
                      }}
                      className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-9"
                    >
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmation Modal for Admin Status Change */}
      {statusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-hidden">
          <Card className="w-full max-w-md min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-border shadow-2xl rounded-2xl">
            <CardHeader className="shrink-0 pb-3 border-b border-border/60 bg-card">
              <CardTitle className="text-base font-bold font-heading text-text-primary flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span>Confirm Privilege Modification</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 pr-3 sm:pr-5 space-y-4">
              <p className="text-xs text-text-primary leading-relaxed">
                Are you sure you want to change the status of administrator{" "}
                <span className="font-bold font-mono">{statusTarget.admin.email}</span> to{" "}
                <span className="font-bold text-primary">{statusTarget.newStatus}</span>?
              </p>

              </CardContent>
            <div className="shrink-0 p-3.5 sm:p-4 border-t border-border/60 bg-surface/50 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatusTarget(null)}
                  disabled={statusLoading}
                  className="border-border text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpdateStatus}
                  disabled={statusLoading}
                  className={`text-white text-xs h-9 ${
                    statusTarget.newStatus === "SUSPENDED" ? "bg-status-danger hover:opacity-90" : "bg-primary hover:bg-[var(--color-primary-hover)]"
                  }`}
                >
                  {statusLoading ? "Updating..." : `Confirm ${statusTarget.newStatus}`}
                </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Permanent Administrator Deletion Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-hidden">
          <Card className="w-full max-w-lg min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-status-danger/40 shadow-2xl rounded-2xl">
            <CardHeader className="shrink-0 pb-3 border-b border-status-danger/30 bg-status-danger-subtle/40">
              <CardTitle className="text-base font-bold font-heading text-status-danger flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-status-danger shrink-0" />
                <span>Permanently Delete Administrator</span>
              </CardTitle>
              <CardDescription className="text-xs text-status-danger mt-1">
                P0 Permanent Removal: Supabase Auth credentials, active sessions, and profile records will be permanently deleted.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 pr-3 sm:pr-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Permanent Irreversible Action</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Target account: <strong className="font-mono">{deleteTarget.email}</strong>. Once deleted, this administrator will immediately lose all login access and credentials cannot be recovered.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary block">
                  Mandatory Audit Reason (min 5 characters) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  placeholder="Reason for deletion..."
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  className="bg-surface border-border text-xs h-9"
                  disabled={deleteLoading}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary block">
                  Type <span className="font-mono font-bold text-status-danger">{deleteTarget.email}</span> to confirm:
                </label>
                <Input
                  type="text"
                  placeholder={deleteTarget.email}
                  value={deleteConfirmEmail}
                  onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                  className="bg-surface border-border text-xs h-9 font-mono"
                  disabled={deleteLoading}
                />
              </div>

              </CardContent>
            <div className="shrink-0 p-3.5 sm:p-4 border-t border-border/60 bg-surface/50 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setDeleteTarget(null);
                    setDeleteConfirmEmail("");
                  }}
                  disabled={deleteLoading}
                  className="border-border text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleDeleteAdmin}
                  disabled={
                    deleteLoading ||
                    deleteConfirmEmail.trim().toLowerCase() !== deleteTarget.email.toLowerCase() ||
                    deleteReason.trim().length < 5
                  }
                  className="bg-status-danger hover:opacity-90 text-white text-xs h-9 font-semibold gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleteLoading ? <span className="flex items-center gap-1.5"><BrandLoader size="button" /> Deleting...</span> : "Permanently Delete Administrator"}
                </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
