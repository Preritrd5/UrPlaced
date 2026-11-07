/**
 * StudentNotificationToast
 * UrPlaced Enterprise Notification Pop-Up
 * 
 * Delivers immediate, top-of-screen visible pop-ups when new notifications arrive in real time.
 * Features auto-dismiss with hover pause, keyboard accessibility, category indicators,
 * and strict suppression inside distraction-free examination environments.
 */

"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import {
  FileText,
  Briefcase,
  GraduationCap,
  AlertTriangle,
  Bell,
  X,
  ChevronRight,
} from "lucide-react";
import { useNotifications } from "@/modules/notifications/hooks/use-notifications";
import type { NotificationRecord } from "@/modules/notifications/types";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "./notification-bell";

export function getToastCategoryIcon(type: string) {
  const upper = (type || "").toUpperCase();
  if (upper.includes("ASSESSMENT") || upper.includes("TEST")) {
    return <FileText className="w-5 h-5 text-primary shrink-0" />;
  }
  if (upper.includes("DRIVE") || upper.includes("JOB") || upper.includes("PLACEMENT")) {
    return <Briefcase className="w-5 h-5 text-secondary shrink-0" />;
  }
  if (upper.includes("TRAINING") || upper.includes("LEARN")) {
    return <GraduationCap className="w-5 h-5 text-primary shrink-0" />;
  }
  if (upper.includes("URGENT") || upper.includes("ALERT") || upper.includes("WARNING")) {
    return <AlertTriangle className="w-5 h-5 text-status-danger shrink-0" />;
  }
  return <Bell className="w-5 h-5 text-primary shrink-0" />;
}

export function getToastCategoryBadge(type: string) {
  const upper = (type || "").toUpperCase();
  if (upper.includes("ASSESSMENT") || upper.includes("TEST")) {
    return {
      label: "Assessment Exam",
      badgeClass: "bg-primary/10 text-primary border-primary/25",
    };
  }
  if (upper.includes("DRIVE") || upper.includes("JOB") || upper.includes("PLACEMENT")) {
    return {
      label: "Campus Drive",
      badgeClass: "bg-secondary/15 text-secondary border-secondary/30",
    };
  }
  if (upper.includes("TRAINING") || upper.includes("LEARN")) {
    return {
      label: "Training",
      badgeClass: "bg-primary/10 text-primary border-primary/25",
    };
  }
  if (upper.includes("URGENT") || upper.includes("ALERT") || upper.includes("WARNING")) {
    return {
      label: "Urgent Alert",
      badgeClass: "bg-status-danger/15 text-status-danger border-status-danger/30",
    };
  }
  return {
    label: "Announcement",
    badgeClass: "bg-primary/10 text-primary border-primary/25",
  };
}

export function StudentNotificationToast() {
  const router = useRouter();
  const pathname = usePathname();
  const { activeToasts = [], dismissToast, markAsRead } = useNotifications();

  const [isPaused, setIsPaused] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Active examination protection: Never display pop-ups while taking a test
  const isAssessmentTaking = React.useMemo(() => {
    return pathname ? /^\/dashboard\/student\/assessments\/[^/]+\/take/.test(pathname) : false;
  }, [pathname]);

  const currentToast = activeToasts.length > 0 ? activeToasts[0] : null;
  const queueCount = activeToasts.length;

  const effectiveActionUrl = React.useMemo(() => {
    if (
      currentToast?.action_url &&
      currentToast.action_url.startsWith("/") &&
      !currentToast.action_url.startsWith("//")
    ) {
      return currentToast.action_url;
    }
    const upper = (currentToast?.type || "").toUpperCase();
    if (upper.includes("ASSESSMENT") || upper.includes("TEST")) {
      return "/dashboard/student/assessments";
    }
    if (upper.includes("DRIVE") || upper.includes("JOB") || upper.includes("PLACEMENT")) {
      return "/dashboard/student/drives";
    }
    if (upper.includes("ANNOUNCEMENT")) {
      return "/dashboard/student/announcements";
    }
    return "/dashboard/student";
  }, [currentToast]);

  // Auto-dismiss 8-second timer with hover pause
  React.useEffect(() => {
    if (!currentToast || isPaused || isAssessmentTaking) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    timerRef.current = setTimeout(() => {
      if (dismissToast) {
        dismissToast(currentToast.id);
      }
    }, 8000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentToast, isPaused, isAssessmentTaking, dismissToast]);

  if (!currentToast || isAssessmentTaking) {
    return null;
  }

  const badgeInfo = getToastCategoryBadge(currentToast.type);

  const handleAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    markAsRead(currentToast.id);
    if (dismissToast) {
      dismissToast(currentToast.id);
    }

    if (effectiveActionUrl) {
      router.push(effectiveActionUrl);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dismissToast) {
      dismissToast(currentToast.id);
    }
  };

  const toastContent = (
    <div
      role="status"
      aria-live="polite"
      aria-label="New notification received"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[999999] w-[calc(100%-1.5rem)] max-w-md sm:max-w-lg transition-all duration-300 ease-out animate-notification-pop pointer-events-auto shadow-2xl"
    >
      <div className="bg-card border-2 border-primary/30 rounded-2xl shadow-2xl overflow-hidden p-4 flex flex-col gap-3 backdrop-blur-none relative ring-1 ring-black/5">
        {/* Top Header Row: Category Icon, Badge, Title, Time, Close */}
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 shrink-0 mt-0.5">
              {getToastCategoryIcon(currentToast.type)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border shrink-0",
                    badgeInfo.badgeClass
                  )}
                >
                  {badgeInfo.label}
                </span>

                <span className="font-heading font-bold text-sm sm:text-base text-text-primary tracking-tight truncate max-w-[200px] sm:max-w-[280px]">
                  {currentToast.title || badgeInfo.label}
                </span>

                {queueCount > 1 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-secondary/15 text-secondary border border-secondary/30">
                    +{queueCount - 1} more
                  </span>
                )}
              </div>

              <div className="text-[11px] font-mono text-text-muted mt-1">
                {formatRelativeTime(currentToast.created_at) || "Just now"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss notification"
            className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors shrink-0 ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Preview */}
        <p className="text-xs sm:text-sm text-text-secondary line-clamp-2 leading-relaxed pl-1 sm:pl-2">
          {currentToast.body}
        </p>

        {/* Action Row */}
        <div className="flex items-center justify-between pt-2 border-t border-border-subtle gap-2">
          <span className="text-[11px] text-text-muted font-mono truncate">
            UrPlaced Notification Center
          </span>

          <div className="flex items-center gap-2 shrink-0">
            {effectiveActionUrl && (
              <button
                type="button"
                onClick={handleAction}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary hover:bg-[var(--color-primary-hover)] text-white transition-all shadow-xs active:scale-95"
              >
                <span>View Details</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={handleDismiss}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (mounted && typeof document !== "undefined") {
    return createPortal(toastContent, document.body);
  }

  return toastContent;
}
