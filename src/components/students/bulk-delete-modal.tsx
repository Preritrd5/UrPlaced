"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  Users,
  ShieldAlert,
  Info,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  BulkDeletePreviewResult,
  BulkDeleteExecutionResult,
} from "@/modules/students/services/student-service";

interface BulkDeleteModalProps {
  collegeName?: string;
}

export function BulkDeleteModal({ collegeName = "your college" }: BulkDeleteModalProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [preview, setPreview] = React.useState<BulkDeletePreviewResult | null>(null);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  const [confirmationPhrase, setConfirmationPhrase] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<BulkDeleteExecutionResult | null>(null);

  const REQUIRED_PHRASE = "DELETE ALL STUDENTS";

  const fetchPreview = async () => {
    setLoadingPreview(true);
    setPreviewError(null);
    setConfirmationPhrase("");
    setDeleteError(null);
    setResult(null);

    try {
      const res = await fetch("/api/placement/students/bulk-delete/preview");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load deletion impact preview.");
      }
      const data: BulkDeletePreviewResult = await res.json();
      setPreview(data);
    } catch (err: any) {
      setPreviewError(err.message || "Failed to inspect student directory impact.");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      fetchPreview();
    } else {
      setConfirmationPhrase("");
      setDeleteError(null);
      setResult(null);
    }
  };

  const handleExecuteBulkDelete = async () => {
    if (confirmationPhrase.trim() !== REQUIRED_PHRASE) {
      setDeleteError(`Please type '${REQUIRED_PHRASE}' exactly to confirm.`);
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/placement/students/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationPhrase: confirmationPhrase.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to execute bulk deletion.");
      }

      const resData: BulkDeleteExecutionResult = await res.json();
      setResult(resData);
    } catch (err: any) {
      setDeleteError(err.message || "Failed to complete bulk deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDone = () => {
    setOpen(false);
    router.refresh();
  };

  const isConfirmed = confirmationPhrase.trim() === REQUIRED_PHRASE;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="shadow-sm">
          <Trash2 className="h-4 w-4 mr-1.5" /> Delete All Students
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-status-danger font-heading text-lg">
            <Trash2 className="h-5 w-5 text-status-danger" />
            Delete All Students — College Scope
          </DialogTitle>
          <DialogDescription className="text-xs text-text-secondary">
            Institution-scoped bulk deletion with automatic safeguard protection for registered students.
          </DialogDescription>
        </DialogHeader>

        {loadingPreview ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-status-danger" />
            <p className="text-xs text-text-secondary">
              Calculating impact preview and auditing student dependencies for {collegeName}...
            </p>
          </div>
        ) : previewError ? (
          <div className="py-4 space-y-3">
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 p-3 text-xs text-red-700 dark:text-red-300">
              {previewError}
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : result ? (
          /* Execution Result State */
          <div className="py-4 space-y-4">
            <div className="rounded-xl border border-secondary/30 bg-secondary/10 p-5 text-center space-y-2">
              <CheckCircle2 className="h-10 w-10 text-secondary mx-auto" />
              <h3 className="font-heading font-bold text-base text-text-primary">
                Bulk Deletion Executed Successfully
              </h3>
              <p className="text-xs text-text-secondary">
                {result.message || "Eligible student records have been deleted."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-border bg-card p-3 text-center">
                <span className="text-text-secondary block mb-1">Eligible Records Deleted</span>
                <span className="font-mono text-xl font-bold text-status-danger">
                  {result.deletedCount}
                </span>
              </div>
              <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-3 text-center">
                <span className="text-text-secondary block mb-1">Protected Records Retained</span>
                <span className="font-mono text-xl font-bold text-secondary">
                  {result.protectedCount}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-text-secondary text-center leading-relaxed">
              All registered student accounts, assessment history, campus drive applications, and placement
              offers were safeguarded and remain intact in the database.
            </p>

            <DialogFooter className="pt-2">
              <Button variant="primary" size="sm" onClick={handleDone} className="w-full sm:w-auto">
                Done & Refresh Directory
              </Button>
            </DialogFooter>
          </div>
        ) : preview ? (
          /* Impact Preview & Confirmation State */
          <div className="space-y-4 py-1 text-xs">
            {/* Impact Metric Cards */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-lg border border-border bg-surface p-3 text-center">
                <div className="text-[11px] text-text-secondary font-medium">Total Roster</div>
                <div className="text-lg font-bold font-mono text-text-primary mt-1">
                  {preview.totalStudents}
                </div>
              </div>
              <div className="rounded-lg border border-status-danger/30 bg-status-danger/5 p-3 text-center">
                <div className="text-[11px] text-status-danger font-medium">Eligible to Delete</div>
                <div className="text-lg font-bold font-mono text-status-danger mt-1">
                  {preview.eligibleCount}
                </div>
              </div>
              <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-3 text-center">
                <div className="text-[11px] text-secondary font-medium">Protected & Retained</div>
                <div className="text-lg font-bold font-mono text-secondary mt-1">
                  {preview.protectedCount}
                </div>
              </div>
            </div>

            {/* Safeguard Explanation Box */}
            <div className="rounded-xl border border-secondary/30 bg-secondary/5 p-3.5 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-secondary text-xs">
                <ShieldCheck className="h-4 w-4 text-secondary flex-shrink-0" />
                Automatic Multi-Layer Data Safeguards
              </div>
              <p className="text-text-secondary text-[11px] leading-relaxed">
                To guarantee zero accidental data loss, the system inspects every student record before deletion.
                Only unlinked standalone roster entries are purged.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                <div className="bg-card/70 rounded p-2 border border-border">
                  <div className="font-semibold text-text-primary">
                    {preview.breakdown?.withUserAccounts ?? 0} Accounts
                  </div>
                  <div className="text-text-muted text-[10px]">Registered student login accounts</div>
                </div>
                <div className="bg-card/70 rounded p-2 border border-border">
                  <div className="font-semibold text-text-primary">
                    {preview.breakdown?.withApplicationsOrOffers ?? 0} Drives
                  </div>
                  <div className="text-text-muted text-[10px]">Drive applications & job offers</div>
                </div>
                <div className="bg-card/70 rounded p-2 border border-border">
                  <div className="font-semibold text-text-primary">
                    {preview.breakdown?.withAssessmentsOrTraining ?? 0} Tests
                  </div>
                  <div className="text-text-muted text-[10px]">Assessments & mistake reviews</div>
                </div>
              </div>
            </div>

            {/* Warning Callout */}
            <div className="rounded-lg border border-status-danger/30 bg-status-danger/5 p-3 flex items-start gap-2 text-text-secondary text-[11px]">
              <AlertTriangle className="h-4 w-4 text-status-danger flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-status-danger">Permanent Action: </span>
                This will delete the <span className="font-bold">{preview.eligibleCount}</span> eligible
                standalone roster records belonging strictly to <span className="font-semibold">{collegeName}</span>.
                This operation cannot be undone.
              </div>
            </div>

            {/* Confirmation Phrase Input */}
            <div className="space-y-2 pt-1">
              <label className="block text-text-primary font-medium text-xs">
                To proceed, type the confirmation phrase exactly:{" "}
                <span className="font-mono font-bold text-status-danger select-all">
                  {REQUIRED_PHRASE}
                </span>
              </label>
              <Input
                value={confirmationPhrase}
                onChange={(e) => setConfirmationPhrase(e.target.value)}
                placeholder={`Type '${REQUIRED_PHRASE}'`}
                className="font-mono text-xs"
                disabled={isDeleting}
              />
            </div>

            {deleteError && (
              <div className="rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-2 text-xs text-red-600 dark:text-red-400">
                {deleteError}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleExecuteBulkDelete}
                disabled={!isConfirmed || isDeleting || preview.eligibleCount === 0}
                isLoading={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-1.5" /> Execute Bulk Deletion
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
