"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  ExternalLink,
  UserX,
  UserCheck,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StudentDeletionEligibility } from "@/modules/students/services/student-service";

interface StudentRowActionsProps {
  student: {
    id: string;
    enrollment_number: string;
    full_name: string;
    email: string;
    is_archived: boolean;
    academic_status?: string;
  };
  canDelete?: boolean;
  onRefresh?: () => void;
}

export function StudentRowActions({
  student,
  canDelete = false,
  onRefresh,
}: StudentRowActionsProps) {
  const router = useRouter();

  // Modals state
  const [showDeactivateDialog, setShowDeactivateDialog] = React.useState(false);
  const [showReactivateDialog, setShowReactivateDialog] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  // Deactivate state
  const [isDeactivating, setIsDeactivating] = React.useState(false);
  const [deactivateError, setDeactivateError] = React.useState<string | null>(null);

  // Reactivate state
  const [isReactivating, setIsReactivating] = React.useState(false);
  const [reactivateError, setReactivateError] = React.useState<string | null>(null);

  // Delete state
  const [checkingEligibility, setCheckingEligibility] = React.useState(false);
  const [eligibility, setEligibility] = React.useState<StudentDeletionEligibility | null>(null);
  const [eligibilityError, setEligibilityError] = React.useState<string | null>(null);
  const [srnInput, setSrnInput] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = React.useState(false);

  // Trigger eligibility check when opening delete dialog
  const handleOpenDeleteDialog = async () => {
    setShowDeleteDialog(true);
    setSrnInput("");
    setDeleteError(null);
    setDeleteSuccess(false);
    setCheckingEligibility(true);
    setEligibilityError(null);

    try {
      const res = await fetch(`/api/placement/students/${student.id}/eligibility`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to check deletion eligibility.");
      }
      const data: StudentDeletionEligibility = await res.json();
      setEligibility(data);
    } catch (err: any) {
      setEligibilityError(err.message || "Failed to check student dependencies.");
    } finally {
      setCheckingEligibility(false);
    }
  };

  // Execute deactivation
  const handleDeactivate = async () => {
    setIsDeactivating(true);
    setDeactivateError(null);
    try {
      const res = await fetch(`/api/placement/students/${student.id}/deactivate`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to deactivate student.");
      }
      setShowDeactivateDialog(false);
      if (onRefresh) onRefresh();
      router.refresh();
    } catch (err: any) {
      setDeactivateError(err.message || "Failed to deactivate student.");
    } finally {
      setIsDeactivating(false);
    }
  };

  // Execute reactivation
  const handleReactivate = async () => {
    setIsReactivating(true);
    setReactivateError(null);
    try {
      const res = await fetch(`/api/placement/students/${student.id}/reactivate`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to reactivate student.");
      }
      setShowReactivateDialog(false);
      if (onRefresh) onRefresh();
      router.refresh();
    } catch (err: any) {
      setReactivateError(err.message || "Failed to reactivate student.");
    } finally {
      setIsReactivating(false);
    }
  };

  // Execute permanent delete
  const handleDelete = async () => {
    if (srnInput.trim().toUpperCase() !== student.enrollment_number.trim().toUpperCase()) {
      setDeleteError("Entered enrollment number (SRN) does not match.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/placement/students/${student.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedSrn: srnInput.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete student record.");
      }

      setDeleteSuccess(true);
      setTimeout(() => {
        setShowDeleteDialog(false);
        if (onRefresh) onRefresh();
        router.refresh();
      }, 1200);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete student.");
    } finally {
      setIsDeleting(false);
    }
  };

  const isSrnMatch =
    srnInput.trim().toUpperCase() === student.enrollment_number.trim().toUpperCase();

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-text-secondary hover:text-text-primary"
            aria-label="Open student actions menu"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {/* Action 1: View Details */}
          <DropdownMenuItem asChild>
            <Link
              href={`/dashboard/students/${student.id}`}
              className="flex items-center gap-2 cursor-pointer font-medium"
            >
              <ExternalLink className="h-4 w-4 text-primary" />
              <span>View Details</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Action 2: Deactivate or Reactivate */}
          {student.is_archived ? (
            <DropdownMenuItem
              onClick={() => setShowReactivateDialog(true)}
              className="flex items-center gap-2 cursor-pointer text-secondary"
            >
              <UserCheck className="h-4 w-4 text-secondary" />
              <span>Reactivate Student</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => setShowDeactivateDialog(true)}
              className="flex items-center gap-2 cursor-pointer text-text-primary"
            >
              <UserX className="h-4 w-4 text-text-secondary" />
              <span>Remove from Directory</span>
            </DropdownMenuItem>
          )}

          {/* Action 3: Permanently Delete (Placement Head only) */}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleOpenDeleteDialog}
                className="flex items-center gap-2 cursor-pointer text-status-danger focus:text-status-danger"
              >
                <Trash2 className="h-4 w-4 text-status-danger" />
                <span>Permanently Delete</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Deactivate Dialog */}
      <Dialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-text-primary">
              <UserX className="h-5 w-5 text-text-secondary" />
              Remove from Active Directory
            </DialogTitle>
            <DialogDescription className="text-xs text-text-secondary">
              Deactivate student from the active campus directory without losing data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-text-primary font-medium">
              Are you sure you want to remove <span className="font-bold">{student.full_name}</span> (
              <span className="font-mono">{student.enrollment_number}</span>) from the active directory?
            </p>
            <div className="rounded-lg bg-surface p-3 border border-border space-y-1.5 text-text-secondary">
              <div className="font-semibold text-text-primary">Safe Archival Guarantee:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>Academic records, CGPA, and department history remain intact.</li>
                <li>Placement drive applications, shortlist status, and offers are preserved.</li>
                <li>Assessment scores and Mistake-to-Mastery review banks are retained.</li>
                <li>The student can be reactivated by the Placement Cell at any time.</li>
              </ul>
            </div>

            {deactivateError && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-2 text-xs text-red-600 dark:text-red-400">
                {deactivateError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeactivateDialog(false)}
              disabled={isDeactivating}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDeactivate}
              disabled={isDeactivating}
              isLoading={isDeactivating}
            >
              Remove from Active Directory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reactivate Dialog */}
      <Dialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-text-primary">
              <UserCheck className="h-5 w-5 text-secondary" />
              Reactivate Student
            </DialogTitle>
            <DialogDescription className="text-xs text-text-secondary">
              Restore student to the active campus placement directory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-text-primary">
              Reactivating <span className="font-bold">{student.full_name}</span> (
              <span className="font-mono">{student.enrollment_number}</span>) will set their academic status back to{" "}
              <span className="font-semibold text-secondary">ACTIVE</span> and make them visible across all
              active directory rosters and placement drives.
            </p>

            {reactivateError && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-2 text-xs text-red-600 dark:text-red-400">
                {reactivateError}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReactivateDialog(false)}
              disabled={isReactivating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleReactivate}
              disabled={isReactivating}
              isLoading={isReactivating}
            >
              Reactivate Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-status-danger font-heading">
              <Trash2 className="h-5 w-5 text-status-danger" />
              Permanently Delete Student Record
            </DialogTitle>
            <DialogDescription className="text-xs text-text-secondary">
              Inspect dependencies and safely purge standalone roster entries.
            </DialogDescription>
          </DialogHeader>

          {checkingEligibility ? (
            <div className="py-8 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-xs text-text-secondary">
                Verifying institutional dependencies, authentication accounts, and placement records...
              </p>
            </div>
          ) : eligibilityError ? (
            <div className="py-4 space-y-3">
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 p-3 text-xs text-red-700 dark:text-red-300">
                {eligibilityError}
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          ) : eligibility && !eligibility.eligible ? (
            /* BLOCKED CASE: Student has dependencies */
            <div className="space-y-4 py-2 text-xs">
              <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/20 p-4 space-y-2.5">
                <div className="flex items-center gap-2 font-semibold text-red-800 dark:text-red-300 text-sm">
                  <ShieldAlert className="h-5 w-5 text-status-danger flex-shrink-0" />
                  Permanent Deletion Blocked
                </div>
                <p className="text-text-secondary leading-relaxed">
                  This student record cannot be permanently deleted because it is tied to institutional data:
                </p>
                <ul className="list-disc list-inside space-y-1 text-red-700 dark:text-red-300 font-medium">
                  {eligibility.blockingReasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg bg-surface border border-border p-3 text-text-secondary space-y-1">
                <span className="font-semibold text-text-primary">Recommended Action:</span>
                <p>
                  To protect assessment records, audit trails, and placement offers, records with dependencies
                  must remain in the database. You can safely remove the student from the active directory instead.
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(false)}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowDeleteDialog(false);
                    setShowDeactivateDialog(true);
                  }}
                >
                  <UserX className="h-4 w-4 mr-1.5" /> Remove from Active Directory Instead
                </Button>
              </DialogFooter>
            </div>
          ) : eligibility && eligibility.eligible ? (
            /* ELIGIBLE CASE: Safe to permanently delete with exact SRN confirmation */
            <div className="space-y-4 py-2 text-xs">
              {deleteSuccess ? (
                <div className="py-6 text-center space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-secondary mx-auto" />
                  <h3 className="font-bold text-sm text-text-primary">Student Record Permanently Deleted</h3>
                  <p className="text-text-secondary">
                    The student has been purged from the institutional database.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-red-300 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20 p-3.5 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-status-danger">
                      <AlertTriangle className="h-4 w-4 text-status-danger flex-shrink-0" />
                      Warning: Irreversible Action
                    </div>
                    <p className="text-text-secondary leading-relaxed">
                      This student has no registered user accounts, active drive applications, or assessment records.
                      Permanently deleting this record will remove it completely from the database.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-text-primary font-medium">
                      To confirm permanent deletion, please type the exact student SRN:{" "}
                      <span className="font-mono font-bold text-status-danger bg-status-danger/10 px-1.5 py-0.5 rounded">
                        {student.enrollment_number}
                      </span>
                    </label>
                    <Input
                      value={srnInput}
                      onChange={(e) => setSrnInput(e.target.value)}
                      placeholder={`Type ${student.enrollment_number} to confirm`}
                      className="font-mono text-xs"
                      autoFocus
                    />
                  </div>

                  {deleteError && (
                    <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-2.5 text-xs text-red-600 dark:text-red-400">
                      {deleteError}
                    </div>
                  )}

                  <DialogFooter className="gap-2 sm:gap-0 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteDialog(false)}
                      disabled={isDeleting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={!isSrnMatch || isDeleting}
                      isLoading={isDeleting}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" /> Permanently Delete Student
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
