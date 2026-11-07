/**
 * StudentNotificationToast
 * UrPlaced Enterprise Notification Pop-Up
 * 
 * Delivers an elevated, modern, visually stunning top-of-screen visible pop-up
 * when new notifications arrive in real time.
 * 
 * Features:
 * - Live broadcast pulse beacon & category iconography
 * - Distinct, prominent headline & refined body typography
 * - Smooth CSS-accelerated auto-dismiss countdown progress bar with hover-pause
 * - One-click "View Details" with gradient styling & animated micro-interactions
 * - Accessible keyboard navigation & strict suppression during active examinations
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
    return <FileText className="w-5 h-5 text-[#5052C9] shrink-0" />;
  }
  if (upper.includes("DRIVE") || upper.includes("JOB") || upper.includes("PLACEMENT")) {
    return <Briefcase className="w-5 h-5 text-[#2E8F86] shrink-0" />;
  }
  if (upper.includes("TRAINING") || upper.includes("LEARN")) {
    return <GraduationCap className="w-5 h-5 text-[#5052C9] shrink-0" />;
  }
  if (upper.includes("URGENT") || upper.includes("ALERT") || upper.includes("WARNING")) {
    return <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />;
  }
  return <Bell className="w-5 h-5 text-[#5052C9] shrink-0" />;
}

export function getToastCategoryBadge(type: string) {
  const upper = (type || "").toUpperCase();
  if (upper.includes("ASSESSMENT") || upper.includes("TEST")) {
    return {
      label: "Assessment Exam",
      badgeClass: "bg-[#5052C9]/10 text-[#5052C9] border-[#5052C9]/25",
    };
  }
  if (upper.includes("DRIVE") || upper.includes("JOB") || upper.includes("PLACEMENT")) {
    return {
      label: "Campus Drive",
      badgeClass: "bg-[#2E8F86]/15 text-[#2E8F86] border-[#2E8F86]/30",
    };
  }
  if (upper.includes("TRAINING") || upper.includes("LEARN")) {
    return {
      label: "Training",
      badgeClass: "bg-[#5052C9]/10 text-[#5052C9] border-[#5052C9]/25",
    };
  }
  if (upper.includes("URGENT") || upper.includes("ALERT") || upper.includes("WARNING")) {
    return {
      label: "Urgent Alert",
      badgeClass: "bg-red-50 text-red-600 border-red-200",
    };
  }
  return {
    label: "Announcement",
    badgeClass: "bg-[#5052C9]/10 text-[#5052C9] border-[#5052C9]/25",
  };
}

export function StudentNotificationToast() {
  const router = useRouter();
  const pathname = usePathname();
  const { activeToasts = [], dismissToast, markAsRead } = useNotifications();

  const [isPaused, setIsPaused] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

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
      return;
    }

    const timer = setTimeout(() => {
      if (dismissToast) {
        dismissToast(currentToast.id);
      }
    }, 8000);

    return () => {
      clearTimeout(timer);
    };
  }, [currentToast?.id, isPaused, isAssessmentTaking, dismissToast]);

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
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[999999] w-[calc(100%-1.5rem)] max-w-lg sm:max-w-xl transition-all duration-300 ease-out animate-notification-pop pointer-events-auto select-none"
    >
      <div className="bg-[#F8F7F3] border border-[#DDDCD5] hover:border-[#5052C9]/40 rounded-2xl shadow-[0_20px_50px_rgba(36,40,58,0.16),0_6px_16px_rgba(36,40,58,0.08)] overflow-hidden transition-all duration-300 relative group">
        {/* Sleek Gradient Accent Strip on Top */}
        <div className="h-1 w-full bg-gradient-to-r from-[#7779D8] via-[#5052C9] to-[#2E8F86]" />

        <div className="p-4 sm:p-5 flex flex-col gap-3.5">
          {/* Top Header Row: Category Badge + Beacon + Timestamp + Close button */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border shrink-0 flex items-center gap-1.5 shadow-2xs",
                  badgeInfo.badgeClass
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-90 animate-pulse" />
                {badgeInfo.label}
              </span>

              {/* Glowing Live Broadcast Beacon */}
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#2E8F86]/10 border border-[#2E8F86]/20 text-[10px] font-mono font-semibold text-[#2E8F86]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2E8F86] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2E8F86]" />
                </span>
                <span>LIVE</span>
              </span>

              <span className="text-[11px] font-mono text-[#747683]">
                {formatRelativeTime(currentToast.created_at) || "Just now"}
              </span>

              {queueCount > 1 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#5052C9]/10 text-[#5052C9] border border-[#5052C9]/25 shadow-2xs">
                  +{queueCount - 1} pending
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss notification"
              className="p-1.5 rounded-lg text-[#747683] hover:text-[#24283A] hover:bg-[#EDECE7] transition-all shrink-0 active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content Body with Left Icon */}
          <div className="flex items-start gap-3.5">
            {/* Enhanced Dual-Tone Category Icon Container */}
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-white to-[#FBFAF7] border border-[#DDDCD5] shadow-xs flex items-center justify-center shrink-0 mt-0.5 group-hover:border-[#5052C9]/30 transition-colors">
              {getToastCategoryIcon(currentToast.type)}
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              {/* Distinct, Authoritative Title */}
              <h3 className="font-outfit font-bold text-[15px] sm:text-base text-[#24283A] leading-snug tracking-tight">
                {currentToast.title || badgeInfo.label}
              </h3>

              {/* Refined Message Body */}
              <p className="font-inter text-xs sm:text-[13px] text-[#292D40] leading-relaxed line-clamp-2">
                {currentToast.body}
              </p>
            </div>
          </div>

          {/* Bottom Interactive Action Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-[#DDDCD5] gap-3">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#747683] truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5052C9]" />
              <span className="truncate">UrPlaced Notification Center</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3 py-1.5 rounded-lg text-xs font-inter font-medium text-[#747683] hover:text-[#24283A] hover:bg-[#EDECE7] transition-all active:scale-95"
              >
                Dismiss
              </button>

              {effectiveActionUrl && (
                <button
                  type="button"
                  onClick={handleAction}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-inter font-semibold bg-gradient-to-r from-[#7779D8] to-[#5052C9] hover:from-[#6a6cd0] hover:to-[#4345B0] text-white transition-all shadow-sm hover:shadow active:scale-95 group/btn"
                >
                  <span>View Details</span>
                  <ChevronRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Auto-Dismiss Smooth Animated Progress Bar */}
        <div className="h-1 w-full bg-[#EDECE7] overflow-hidden">
          <div
            key={currentToast.id}
            className="h-full bg-gradient-to-r from-[#7779D8] to-[#5052C9]"
            style={{
              animation: "toast-progress 8s linear forwards",
              animationPlayState: isPaused ? "paused" : "running",
            }}
          />
        </div>
      </div>
    </div>
  );

  if (mounted && typeof document !== "undefined") {
    return createPortal(toastContent, document.body);
  }

  return toastContent;
}
