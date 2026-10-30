"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, ShieldCheck, UserX, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { toast } from "@/components/ui/dialog-system";
import { authFetch } from "@/lib/auth/auth-fetch";

export interface MemberRowActionsProps {
  memberId: string;
  userId: string;
  memberName: string;
  memberEmail: string;
  memberRole: string;
  memberStatus: "ACTIVE" | "SUSPENDED" | "REVOKED";
  isCurrentSessionUser: boolean;
  institutionName: string;
}

export function MemberRowActions({
  memberId,
  userId,
  memberName,
  memberEmail,
  memberRole,
  memberStatus,
  isCurrentSessionUser,
  institutionName,
}: MemberRowActionsProps) {
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const isPlacementHead = memberRole === "PLACEMENT_HEAD";

  // Handle status toggle (ACTIVE <-> SUSPENDED)
  const handleToggleStatus = async () => {
    try {
      setIsTogglingStatus(true);
      const nextStatus = memberStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

      const res = await authFetch(`/api/placement/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          reason: `Status changed to ${nextStatus} by Placement Head`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update member status.");
      }

      toast.success(
        nextStatus === "ACTIVE"
          ? `${memberName} has been reactivated.`
          : `${memberName} has been suspended.`
      );
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update status.";
      toast.error(msg);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // Handle permanent removal from tenant
  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      const res = await authFetch(`/api/placement/members/${memberId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove staff member.");
      }

      toast.success(`${memberName}'s staff account and login credentials have been permanently removed.`);
      setIsDeleteDialogOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove staff member.";
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        {/* If current logged-in user is this Placement Head, mark as admin */}
        {isCurrentSessionUser ? (
          <span className="inline-flex items-center gap-1 text-xs text-text-muted font-mono bg-surface px-2.5 py-1 rounded border border-border">
            <ShieldCheck className="h-3 w-3 text-primary" /> (You) Admin
          </span>
        ) : (
          <>
            {/* Status Toggle Button (Suspend/Reactivate) */}
            <Button
              type="button"
              variant={memberStatus === "ACTIVE" ? "ghost" : "outline"}
              size="sm"
              disabled={isTogglingStatus || isDeleting}
              onClick={handleToggleStatus}
              className={`h-8 text-xs font-medium ${
                memberStatus === "ACTIVE"
                  ? "text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                  : "text-secondary hover:text-secondary-hover"
              }`}
            >
              {isTogglingStatus ? (
                "Updating..."
              ) : memberStatus === "ACTIVE" ? (
                <>
                  <UserX className="h-3.5 w-3.5 mr-1" /> Suspend
                </>
              ) : (
                <>
                  <UserCheck className="h-3.5 w-3.5 mr-1" /> Reactivate
                </>
              )}
            </Button>

            {/* Remove Member Button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isDeleting || isTogglingStatus}
              onClick={() => setIsDeleteDialogOpen(true)}
              className="h-8 text-xs font-medium text-status-danger hover:bg-red-50 hover:text-red-700 flex items-center gap-1"
              title="Permanently remove staff member account"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </Button>
          </>
        )}
      </div>

      {/* Professional UrPlaced Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        title="Permanently Remove Staff Member"
        itemName={memberName}
        description={
          <span className="space-y-1.5 block">
            <span>
              Are you sure you want to permanently remove <strong>{memberName}</strong> ({memberEmail || "No email"})?
            </span>
            <span className="block text-status-danger text-[12px] font-medium mt-1">
              Warning: This will permanently delete their login credentials, user profile, and access to {institutionName}. They will no longer be able to sign in.
            </span>
          </span>
        }
        confirmLabel="Permanently Remove Staff"
        isDeleting={isDeleting}
      />
    </>
  );
}
