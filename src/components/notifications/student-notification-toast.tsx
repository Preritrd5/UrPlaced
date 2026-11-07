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
import { useRouter, usePathname } from "next/navigation";
import {
  FileText,
  Briefcase,
  GraduationCap,
  AlertTriangle,
  Bell,
  X,
  ExternalLink,
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

export function StudentNotificationToast() {
  const router = useRouter();
  const pathname = usePathname();
  const { activeToasts = [], dismissToast, markAsRead } = useNotifications();

  const [isPaused, setIsPaused] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Active examination protection: Never display pop-ups while taking a test
  const isAssessmentTaking = React.useMemo(() => {
    return pathname ? /^\/dashboard\/student\/assessments\/[^/]+\/take/.test(pathname) : false;
  }, [pathname]);

  const currentToast = activeToasts.length > 0 ? activeToasts[0] : null;
  const queueCount = activeToasts.length;

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

  const handleAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    markAsRead(currentToast.id);
    if (dismissToast) {
      dismissToast(currentToast.id);
    }

    if (
      currentToast.action_url &&
      currentToast.action_url.startsWith("/") &&
      !currentToast.action_url.startsWith("//")
    ) {
      router.push(currentToast.action_url);
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dismissToast) {
      dismissToast(currentToast.id);
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="New notification received"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] w-[calc(100%-1.5rem)] max-w-md sm:max-w-lg transition-all duration-300 ease-out animate-in fade-in slide-in-from-top-4"
    >
      <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden p-3.5 sm:p-4 flex flex-col gap-3 backdrop-blur-none relative">
        {/* Top Header Row: Category Icon, Title, Time, Close */}
        <div className="flex items-start justify-between gap-3 min-w-0">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
              {getToastCategoryIcon(currentToast.type)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-heading font-bold text-sm sm:text-base text-text-primary tracking-tight truncate max-w-[240px] sm:max-w-[320px]">
                  {currentToast.title}
                </span>

                {queueCount > 1 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-secondary/15 text-secondary border border-secondary/30">
                    +{queueCount - 1} more
                  </span>
                )}
              </div>

              <div className="text-[11px] font-mono text-text-muted mt-0.5">
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
        <div className="flex items-center justify-between pt-1 border-t border-border-subtle gap-2">
          <span className="text-[11px] text-text-muted font-mono truncate">
            UrPlaced Notification Center
          </span>

          <div className="flex items-center gap-2 shrink-0">
            {currentToast.action_url && (
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
}
