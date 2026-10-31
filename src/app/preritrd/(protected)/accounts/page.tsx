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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#B8B6AC]/40">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#5052C9]">
            Access Governance
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[#24283A] tracking-tight">
            Platform Administrators
          </h1>
          <p className="text-xs text-[#292D40]/75 mt-0.5">
            Manage authorized platform super administrator credentials, invitations, and MFA enforcement.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAccounts}
            disabled={loading}
            className="border-[#B8B6AC] text-xs h-9 gap-1.5"
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
            className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-9 gap-1.5 shadow-sm"
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

      {/* Admins Table Card */}
      <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
          <CardTitle className="text-base font-bold font-heading text-[#24283A]">
            Active Platform Administrators ({admins.length})
          </CardTitle>
          <CardDescription className="text-xs text-[#292D40]/70">
            Accounts holding platform-wide infrastructure control authority
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#FBFAF7] text-[#747683] font-mono text-[10px] uppercase border-b border-[#B8B6AC]/30">
                <tr>
                  <th className="px-5 py-3 font-semibold">Administrator</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">MFA Assurance</th>
                  <th className="px-5 py-3 font-semibold">Last Sign In</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#B8B6AC]/20">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-5 py-4">
                        <Skeleton className="h-5 w-full bg-gray-200" />
                      </td>
                    </tr>
                  ))
                ) : admins.length > 0 ? (
                  admins.map((adm) => (
                    <tr key={adm.id} className="hover:bg-[#FBFAF7] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-bold font-heading text-[#24283A] text-sm">
                          {adm.fullName || "Super Admin"}
                        </div>
                        <div className="text-[11px] text-[#747683] font-mono">{adm.email}</div>
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
                      <td className="px-5 py-3.5 font-mono text-[#747683]">
                        {adm.lastSignInAt ? new Date(adm.lastSignInAt).toLocaleString() : "Recently active"}
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1.5">
                        {adm.status === "ACTIVE" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatusTarget({ admin: adm, newStatus: "SUSPENDED" })}
                            className="h-7 text-xs border-red-200 text-red-700 hover:bg-red-50"
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
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-[#747683]">
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
        <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
            <CardTitle className="text-base font-bold font-heading text-[#24283A]">
              Pending Administrator Invitations ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FBFAF7] text-[#747683] font-mono text-[10px] uppercase border-b border-[#B8B6AC]/30">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Invited Email</th>
                    <th className="px-5 py-3 font-semibold">Assigned Role</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Expires At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#B8B6AC]/20">
                  {invitations.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-5 py-3 font-mono text-[#24283A]">{inv.email}</td>
                      <td className="px-5 py-3 font-medium text-[#5052C9]">{inv.role}</td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 font-mono text-[#747683]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-md bg-[#F8F7F3] border-[#B8B6AC] shadow-lg rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <CardTitle className="text-base font-bold font-heading text-[#24283A]">
                Invite Super Administrator
              </CardTitle>
              <CardDescription className="text-xs text-[#292D40]/70">
                Issue a single-use onboarding credential link with mandatory MFA
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {!createdInviteLink ? (
                <form onSubmit={handleCreateInvite} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#24283A]">
                      Administrator Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-[#747683]" />
                      <Input
                        type="email"
                        required
                        placeholder="newadmin@urplaced.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="pl-8 bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-[#B8B6AC]/30">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowInviteModal(false)}
                      disabled={inviteLoading}
                      className="border-[#B8B6AC] text-xs h-9"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={inviteLoading}
                      className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-9"
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
                      className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-9"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-md bg-[#F8F7F3] border-[#B8B6AC] shadow-lg rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span>Confirm Privilege Modification</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <p className="text-xs text-[#24283A] leading-relaxed">
                Are you sure you want to change the status of administrator{" "}
                <span className="font-bold font-mono">{statusTarget.admin.email}</span> to{" "}
                <span className="font-bold text-[#5052C9]">{statusTarget.newStatus}</span>?
              </p>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#B8B6AC]/30">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStatusTarget(null)}
                  disabled={statusLoading}
                  className="border-[#B8B6AC] text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpdateStatus}
                  disabled={statusLoading}
                  className={`text-white text-xs h-9 ${
                    statusTarget.newStatus === "SUSPENDED" ? "bg-red-600 hover:bg-red-700" : "bg-[#5052C9] hover:bg-[#4345B0]"
                  }`}
                >
                  {statusLoading ? "Updating..." : `Confirm ${statusTarget.newStatus}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
