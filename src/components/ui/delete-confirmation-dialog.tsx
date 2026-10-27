"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

export interface DeleteConfirmationDialogProps {
  isOpen: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: React.ReactNode;
  itemName?: string;
  isDeleting?: boolean;
  isLoading?: boolean;
  confirmLabel?: string;
  confirmText?: string;
}

export function DeleteConfirmationDialog({
  isOpen,
  onClose,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  isDeleting = false,
  isLoading = false,
  confirmLabel = "Delete",
  confirmText,
}: DeleteConfirmationDialogProps) {
  const activeLoading = isDeleting || isLoading;
  const activeConfirmLabel = confirmText || confirmLabel;

  const handleOpenChange = (open: boolean) => {
    if (activeLoading) return;
    if (onOpenChange) {
      onOpenChange(open);
    }
    if (!open && onClose) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md border border-border bg-card p-6 shadow-xl rounded-xl">
        <DialogHeader className="space-y-3">
          <div className="mx-auto sm:mx-0 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-status-danger">
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold text-text-primary font-display">
              {title}
            </DialogTitle>
            {itemName && (
              <p className="mt-1 text-xs font-semibold text-text-secondary font-mono">
                &ldquo;{itemName}&rdquo;
              </p>
            )}
            <DialogDescription className="mt-2 text-xs text-text-secondary leading-relaxed">
              {description}
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogFooter className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={activeLoading}
            className="text-xs h-9"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={activeLoading}
            className="text-xs h-9 bg-status-danger hover:bg-status-danger/90 text-white font-semibold flex items-center gap-1.5"
          >
            {activeLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                {activeConfirmLabel}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
