"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Loader2,
  HelpCircle,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* =======================================================================
   1. TOAST NOTIFICATION TYPES & STORE
   ======================================================================= */

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  action?: ToastAction;
  createdAt: number;
}

interface ToastOptions {
  title?: string;
  duration?: number;
  action?: ToastAction;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastStore {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const copy = [...this.toasts];
    this.listeners.forEach((listener) => listener(copy));
  }

  show(type: ToastType, message: string, options?: ToastOptions): string {
    if (!message) return "";

    // Deduplication: If an identical toast is already active, refresh its timer instead of duplicating
    const existing = this.toasts.find(
      (t) => t.type === type && t.message === message && t.title === options?.title
    );
    if (existing) {
      this.resetTimer(existing.id, options?.duration ?? (type === "error" ? 6000 : 4000));
      return existing.id;
    }

    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const duration = options?.duration ?? (type === "error" ? 6000 : 4000);

    const toast: ToastItem = {
      id,
      type,
      message,
      title: options?.title,
      duration,
      action: options?.action,
      createdAt: Date.now(),
    };

    // Keep max 5 visible toasts to avoid viewport clutter
    if (this.toasts.length >= 5) {
      const oldest = this.toasts[0];
      this.dismiss(oldest.id);
    }

    this.toasts.push(toast);
    this.notify();

    if (duration > 0) {
      const timer = setTimeout(() => {
        this.dismiss(id);
      }, duration);
      this.timers.set(id, timer);
    }

    return id;
  }

  private resetTimer(id: string, duration: number) {
    const existingTimer = this.timers.get(id);
    if (existingTimer) clearTimeout(existingTimer);

    if (duration > 0) {
      const timer = setTimeout(() => {
        this.dismiss(id);
      }, duration);
      this.timers.set(id, timer);
    }
  }

  dismiss(id: string) {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }

    const index = this.toasts.findIndex((t) => t.id === id);
    if (index !== -1) {
      this.toasts.splice(index, 1);
      this.notify();
    }
  }

  clear() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers.clear();
    this.toasts = [];
    this.notify();
  }

  getToasts(): ToastItem[] {
    return [...this.toasts];
  }
}

export const toastStore = new ToastStore();

/**
 * Universal Toast API
 */
export const toast = {
  success: (message: string, options?: ToastOptions | string) => {
    const opts = typeof options === "string" ? { title: options } : options;
    return toastStore.show("success", message, opts);
  },
  error: (message: string, options?: ToastOptions | string) => {
    const opts = typeof options === "string" ? { title: options } : options;
    return toastStore.show("error", message, opts);
  },
  warning: (message: string, options?: ToastOptions | string) => {
    const opts = typeof options === "string" ? { title: options } : options;
    return toastStore.show("warning", message, opts);
  },
  info: (message: string, options?: ToastOptions | string) => {
    const opts = typeof options === "string" ? { title: options } : options;
    return toastStore.show("info", message, opts);
  },
  dismiss: (id: string) => {
    toastStore.dismiss(id);
  },
  clear: () => {
    toastStore.clear();
  },
};

export function useToast() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    return toastStore.subscribe(setToasts);
  }, []);

  return {
    toasts,
    toast,
    dismiss: (id: string) => toastStore.dismiss(id),
  };
}

/* =======================================================================
   2. MODAL DIALOG TYPES & STORE (Confirm, Prompt, Alert)
   ======================================================================= */

export type DialogVariant = "default" | "destructive" | "warning" | "info" | "primary";

export interface ConfirmDialogOptions {
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: DialogVariant;
  /** Optional item name for highlight */
  itemName?: string;
  /** Async confirmation handler with automatic loading state */
  onConfirm?: () => Promise<void> | void;
}

export interface PromptDialogOptions {
  title: string;
  description?: React.ReactNode;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  inputType?: string;
  required?: boolean;
  validate?: (val: string) => string | null | undefined;
}

export interface AlertDialogOptions {
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  variant?: DialogVariant;
}

type DialogState =
  | {
      id: string;
      type: "confirm";
      options: ConfirmDialogOptions;
      resolve: (value: boolean) => void;
      isLoading?: boolean;
    }
  | {
      id: string;
      type: "prompt";
      options: PromptDialogOptions;
      resolve: (value: string | null) => void;
      error?: string | null;
    }
  | {
      id: string;
      type: "alert";
      options: AlertDialogOptions;
      resolve: () => void;
    }
  | null;

type DialogListener = (state: DialogState) => void;

class DialogStore {
  private currentDialog: DialogState = null;
  private queue: DialogState[] = [];
  private listeners: Set<DialogListener> = new Set();

  subscribe(listener: DialogListener) {
    this.listeners.add(listener);
    listener(this.currentDialog);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.currentDialog));
  }

  private processNext() {
    if (this.queue.length > 0) {
      this.currentDialog = this.queue.shift() || null;
      this.notify();
    } else {
      this.currentDialog = null;
      this.notify();
    }
  }

  confirm(options: ConfirmDialogOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const dialog: DialogState = {
        id: `dialog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: "confirm",
        options,
        resolve: (val: boolean) => {
          resolve(val);
          this.processNext();
        },
      };

      if (!this.currentDialog) {
        this.currentDialog = dialog;
        this.notify();
      } else {
        this.queue.push(dialog);
      }
    });
  }

  prompt(options: PromptDialogOptions): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const dialog: DialogState = {
        id: `dialog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: "prompt",
        options,
        resolve: (val: string | null) => {
          resolve(val);
          this.processNext();
        },
      };

      if (!this.currentDialog) {
        this.currentDialog = dialog;
        this.notify();
      } else {
        this.queue.push(dialog);
      }
    });
  }

  alert(options: AlertDialogOptions): Promise<void> {
    return new Promise<void>((resolve) => {
      const dialog: DialogState = {
        id: `dialog_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: "alert",
        options,
        resolve: () => {
          resolve();
          this.processNext();
        },
      };

      if (!this.currentDialog) {
        this.currentDialog = dialog;
        this.notify();
      } else {
        this.queue.push(dialog);
      }
    });
  }

  setLoading(isLoading: boolean) {
    if (this.currentDialog && this.currentDialog.type === "confirm") {
      this.currentDialog.isLoading = isLoading;
      this.notify();
    }
  }

  dismissCurrent(returnValue: any = null) {
    if (!this.currentDialog) return;
    if (this.currentDialog.type === "confirm" && this.currentDialog.isLoading) return; // Prevent closing while critical mutation is in progress

    const curr = this.currentDialog;
    if (curr.type === "confirm") {
      curr.resolve(returnValue === true);
    } else if (curr.type === "prompt") {
      curr.resolve(typeof returnValue === "string" ? returnValue : null);
    } else if (curr.type === "alert") {
      curr.resolve();
    }
  }
}

export const dialogStore = new DialogStore();

/**
 * Universal Dialog APIs
 */
export const confirmDialog = (options: ConfirmDialogOptions): Promise<boolean> => {
  return dialogStore.confirm(options);
};

export const promptDialog = (options: PromptDialogOptions): Promise<string | null> => {
  return dialogStore.prompt(options);
};

export const alertDialog = (options: AlertDialogOptions): Promise<void> => {
  return dialogStore.alert(options);
};

export function useDialog() {
  return {
    confirm: confirmDialog,
    prompt: promptDialog,
    alert: alertDialog,
  };
}

/* =======================================================================
   3. TOAST CONTAINER COMPONENT (Accessible, Polished, UrPlaced Tokens)
   ======================================================================= */

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 inset-x-3 sm:inset-x-auto sm:right-4 sm:max-w-sm z-[9999] flex flex-col gap-2.5 pointer-events-none"
    >
      {toasts.map((t) => {
        const isError = t.type === "error";
        const isSuccess = t.type === "success";
        const isWarning = t.type === "warning";

        const iconMap = {
          success: <CheckCircle2 className="h-5 w-5 text-secondary shrink-0" aria-hidden="true" />,
          error: <AlertCircle className="h-5 w-5 text-status-danger shrink-0" aria-hidden="true" />,
          warning: <AlertTriangle className="h-5 w-5 text-status-warning shrink-0" aria-hidden="true" />,
          info: <Info className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />,
        };

        const borderMap = {
          success: "border-secondary/50 bg-[#F8F7F3] dark:bg-[#222636] text-text-primary shadow-md",
          error: "border-status-danger/50 bg-[#FDF8F8] dark:bg-[#222636] text-text-primary shadow-md",
          warning: "border-status-warning/50 bg-[#FDFBF7] dark:bg-[#222636] text-text-primary shadow-md",
          info: "border-primary/50 bg-[#F8F7F3] dark:bg-[#222636] text-text-primary shadow-md",
        };

        return (
          <div
            key={t.id}
            data-urplaced-toast={t.type}
            role={isError ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-200 animate-in fade-in-0 slide-in-from-bottom-2 sm:slide-in-from-right-2",
              borderMap[t.type]
            )}
          >
            <div className="pt-0.5">{iconMap[t.type]}</div>

            <div className="flex-1 min-w-0 pr-1">
              {t.title && (
                <p className="text-xs font-bold font-heading text-text-primary leading-tight">
                  {t.title}
                </p>
              )}
              <p className={cn("text-xs leading-relaxed text-text-primary", t.title ? "mt-0.5" : "")}>
                {t.message}
              </p>

              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="mt-2 text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  {t.action.label}
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-text-secondary/60 hover:text-text-primary p-1 rounded-md transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* =======================================================================
   4. DIALOG SYSTEM HOST (Imperative Confirm, Prompt, Alert Modals)
   ======================================================================= */

export function DialogSystemHost() {
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [promptValue, setPromptValue] = React.useState("");
  const [promptError, setPromptError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__urplaced_dialog__ = { confirmDialog, promptDialog, alertDialog, toast };
    }
    return dialogStore.subscribe((state) => {
      setDialog(state);
      setIsSubmitting(false);
      if (state && state.type === "prompt") {
        setPromptValue(state.options.defaultValue || "");
        setPromptError(null);
      }
    });
  }, []);

  React.useEffect(() => {
    if (dialog?.type === "prompt") {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [dialog]);

  if (!dialog) return null;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (isSubmitting) return; // Prevent dismissal during async loading
      dialogStore.dismissCurrent(null);
    }
  };

  /* Render Confirmation Modal */
  if (dialog.type === "confirm") {
    const { options } = dialog;
    const isDestructive = options.variant === "destructive";

    const handleConfirm = async () => {
      if (options.onConfirm) {
        try {
          setIsSubmitting(true);
          dialogStore.setLoading(true);
          await options.onConfirm();
          dialog.resolve(true);
        } catch (err: any) {
          toast.error(err.message || "Operation failed");
          setIsSubmitting(false);
          dialogStore.setLoading(false);
        }
      } else {
        dialog.resolve(true);
      }
    };

    return (
      <DialogPrimitive.Root open={true} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-1.5rem)] sm:w-full max-w-md max-h-[90dvh] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-card p-4 sm:p-6 shadow-xl rounded-xl duration-200">
            <div className="flex flex-col space-y-3">
              <div
                className={cn(
                  "mx-auto sm:mx-0 flex h-10 w-10 items-center justify-center rounded-full",
                  isDestructive
                    ? "bg-red-100 text-status-danger"
                    : "bg-[var(--color-primary-subtle)] text-primary"
                )}
              >
                {isDestructive ? (
                  <Trash2 className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <HelpCircle className="h-5 w-5" aria-hidden="true" />
                )}
              </div>

              <div>
                <DialogPrimitive.Title className="text-base font-bold text-text-primary font-heading">
                  {options.title}
                </DialogPrimitive.Title>
                {options.itemName && (
                  <p className="mt-1 text-xs font-semibold text-text-secondary font-mono">
                    &ldquo;{options.itemName}&rdquo;
                  </p>
                )}
                <DialogPrimitive.Description className="mt-2 text-xs text-text-secondary leading-relaxed">
                  {options.description}
                </DialogPrimitive.Description>
              </div>
            </div>

            <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => dialog.resolve(false)}
                disabled={isSubmitting}
                className="text-xs h-9"
              >
                {options.cancelText || "Cancel"}
              </Button>
              <Button
                type="button"
                variant={isDestructive ? "destructive" : "primary"}
                size="sm"
                onClick={handleConfirm}
                disabled={isSubmitting}
                className={cn(
                  "text-xs h-9 font-semibold flex items-center gap-1.5",
                  isDestructive
                    ? "bg-status-danger hover:bg-status-danger/90 text-white"
                    : "bg-primary hover:bg-primary-hover text-white"
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  options.confirmText || (isDestructive ? "Confirm Delete" : "Confirm")
                )}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  /* Render Prompt Modal */
  if (dialog.type === "prompt") {
    const { options } = dialog;

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = promptValue.trim();

      if (options.required && !trimmed) {
        setPromptError("This field is required.");
        return;
      }

      if (options.validate) {
        const customErr = options.validate(trimmed);
        if (customErr) {
          setPromptError(customErr);
          return;
        }
      }

      dialog.resolve(trimmed);
    };

    return (
      <DialogPrimitive.Root open={true} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-1.5rem)] sm:w-full max-w-md max-h-[90dvh] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-card p-4 sm:p-6 shadow-xl rounded-xl duration-200">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <DialogPrimitive.Title className="text-base font-bold text-text-primary font-heading">
                  {options.title}
                </DialogPrimitive.Title>
                {options.description && (
                  <DialogPrimitive.Description className="mt-1.5 text-xs text-text-secondary leading-relaxed">
                    {options.description}
                  </DialogPrimitive.Description>
                )}
              </div>

              <div>
                {options.label && (
                  <Label htmlFor="prompt-input" className="text-xs font-medium text-text-primary block mb-1">
                    {options.label} {options.required && <span className="text-status-danger">*</span>}
                  </Label>
                )}
                <Input
                  id="prompt-input"
                  ref={inputRef}
                  type={options.inputType || "text"}
                  value={promptValue}
                  onChange={(e) => {
                    setPromptValue(e.target.value);
                    if (promptError) setPromptError(null);
                  }}
                  placeholder={options.placeholder}
                  className="w-full text-sm"
                  autoFocus
                />
                {promptError && (
                  <p className="mt-1 text-xs text-status-danger flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {promptError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => dialog.resolve(null)}
                  className="text-xs h-9"
                >
                  {options.cancelText || "Cancel"}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  className="text-xs h-9 font-semibold"
                >
                  {options.confirmText || "Submit"}
                </Button>
              </div>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  /* Render Notice / Alert Modal */
  if (dialog.type === "alert") {
    const { options } = dialog;
    const isWarning = options.variant === "warning";
    const isDestructive = options.variant === "destructive";

    return (
      <DialogPrimitive.Root open={true} onOpenChange={handleOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-1.5rem)] sm:w-full max-w-md max-h-[90dvh] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-card p-4 sm:p-6 shadow-xl rounded-xl duration-200">
            <div className="flex flex-col space-y-3">
              <div
                className={cn(
                  "mx-auto sm:mx-0 flex h-10 w-10 items-center justify-center rounded-full",
                  isDestructive
                    ? "bg-red-100 text-status-danger"
                    : isWarning
                    ? "bg-amber-100 text-status-warning"
                    : "bg-[var(--color-primary-subtle)] text-primary"
                )}
              >
                {isDestructive ? (
                  <AlertCircle className="h-5 w-5" />
                ) : isWarning ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <Info className="h-5 w-5" />
                )}
              </div>

              <div>
                <DialogPrimitive.Title className="text-base font-bold text-text-primary font-heading">
                  {options.title}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-2 text-xs text-text-secondary leading-relaxed">
                  {options.description}
                </DialogPrimitive.Description>
              </div>
            </div>

            <div className="mt-4 flex justify-end pt-2 border-t border-border">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => dialog.resolve()}
                className="text-xs h-9 font-semibold px-4"
                autoFocus
              >
                {options.confirmText || "Understood"}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    );
  }

  return null;
}
