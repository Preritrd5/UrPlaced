"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  Building2,
  CreditCard,
  Receipt,
  AlertCircle,
  Activity,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Users2,
  Inbox,
  X,
  ExternalLink,
} from "lucide-react";
import { usePlatformNotifications } from "@/modules/platform-admin/hooks/use-platform-notifications";
import type { PlatformNotificationRecord } from "@/modules/platform-admin/services/platform-notification-service";
import { cn } from "@/lib/utils";

export interface PlatformNotificationBellProps {
  className?: string;
  size?: "sm" | "default";
}

export function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function getPlatformCategoryDetails(category: string): {
  icon: React.ReactNode;
  label: string;
  badgeClass: string;
} {
  const upper = (category || "").toUpperCase();
  switch (upper) {
    case "COLLEGE_REGISTRATION":
      return {
        icon: <Building2 className="w-4 h-4 text-[#2E8F86]" />,
        label: "Registration",
        badgeClass: "bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30",
      };
    case "COLLEGE_ONBOARDING":
      return {
        icon: <Building2 className="w-4 h-4 text-[#2E8F86]" />,
        label: "Onboarding",
        badgeClass: "bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30",
      };
    case "COLLEGE_ONBOARDING_FAILURE":
      return {
        icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
        label: "Delivery Failure",
        badgeClass: "bg-red-500/10 text-red-600 border-red-500/30",
      };
    case "SUBSCRIPTION_ACTIVATION":
      return {
        icon: <CreditCard className="w-4 h-4 text-[#2E8F86]" />,
        label: "Activation",
        badgeClass: "bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30",
      };
    case "SUBSCRIPTION_EXPIRY":
      return {
        icon: <CreditCard className="w-4 h-4 text-[#5052C9]" />,
        label: "Subscription",
        badgeClass: "bg-[#5052C9]/10 text-[#5052C9] border-[#5052C9]/30",
      };
    case "BILLING_INVOICE":
      return {
        icon: <Receipt className="w-4 h-4 text-[#5052C9]" />,
        label: "Billing",
        badgeClass: "bg-[#5052C9]/10 text-[#5052C9] border-[#5052C9]/30",
      };
    case "PAYMENT_FAILURE":
      return {
        icon: <AlertCircle className="w-4 h-4 text-red-600" />,
        label: "Payment",
        badgeClass: "bg-red-500/10 text-red-600 border-red-500/30",
      };
    case "INFRASTRUCTURE_INCIDENT":
      return {
        icon: <Activity className="w-4 h-4 text-amber-600" />,
        label: "Infrastructure",
        badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30",
      };
    case "SERVICE_INCIDENT":
      return {
        icon: <Activity className="w-4 h-4 text-amber-600" />,
        label: "Health",
        badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30",
      };
    case "DATABASE_INCIDENT":
      return {
        icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
        label: "DB/Auth Incident",
        badgeClass: "bg-red-500/10 text-red-600 border-red-500/30",
      };
    case "AI_PROVIDER_STATUS":
    case "AI_PROVIDER_OUTAGE":
      return {
        icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
        label: "AI Engine",
        badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/30",
      };
    case "MAINTENANCE":
      return {
        icon: <Clock className="w-4 h-4 text-[#5052C9]" />,
        label: "Maintenance",
        badgeClass: "bg-[#5052C9]/10 text-[#5052C9] border-[#5052C9]/30",
      };
    case "SECURITY_LOGIN":
      return {
        icon: <ShieldCheck className="w-4 h-4 text-[#2E8F86]" />,
        label: "Login Event",
        badgeClass: "bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30",
      };
    case "SECURITY_MFA":
    case "SECURITY_EVENT":
      return {
        icon: <ShieldCheck className="w-4 h-4 text-[#2E8F86]" />,
        label: "Security",
        badgeClass: "bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30",
      };
    case "ADMIN_INVITATION":
      return {
        icon: <Users2 className="w-4 h-4 text-[#5052C9]" />,
        label: "Admin",
        badgeClass: "bg-[#5052C9]/10 text-[#5052C9] border-[#5052C9]/30",
      };
    default:
      return {
        icon: <Bell className="w-4 h-4 text-[#5052C9]" />,
        label: "Platform",
        badgeClass: "bg-[#5052C9]/10 text-[#5052C9] border-[#5052C9]/30",
      };
  }
}

export function PlatformNotificationBell({
  className,
  size = "default",
}: PlatformNotificationBellProps) {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    refetch,
  } = usePlatformNotifications();

  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape key
  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleNotificationClick = async (notif: PlatformNotificationRecord) => {
    // 1. Mark as read if not already read
    if (!notif.read_at) {
      markAsRead(notif.id);
    }

    // 2. Safely navigate if action_url is internal and restricted to platform admin routes
    if (notif.action_url && notif.action_url.startsWith("/preritrd/")) {
      setIsOpen(false);
      router.push(notif.action_url);
    }
  };

  const badgeText = unreadCount > 99 ? "99+" : unreadCount > 0 ? String(unreadCount) : null;

  return (
    <div ref={containerRef} className={cn("relative inline-block text-left", className)}>
      {/* Bell Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        suppressHydrationWarning
        aria-label={
          unreadCount > 0
            ? `Platform Notifications (${unreadCount} unread)`
            : "Platform Notifications"
        }
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={cn(
          "relative rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#5052C9]/30",
          size === "sm" ? "w-8 h-8 p-1.5" : "w-9 h-9 p-2",
          isOpen
            ? "bg-[#5052C9]/10 text-[#5052C9]"
            : "text-[#292D40]/80 hover:text-[#24283A] hover:bg-[#EDECE7]/60 active:scale-95"
        )}
      >
        <Bell className={cn(size === "sm" ? "w-4 h-4" : "w-5 h-5")} />

        {/* Unread Badge */}
        {badgeText && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#5052C9] text-white text-[10px] font-bold font-mono leading-none flex items-center justify-center shadow-xs border-2 border-[#F8F7F3] select-none animate-in fade-in zoom-in-75 duration-150"
            )}
          >
            {badgeText}
          </span>
        )}
      </button>

      {/* Expanded Notification Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Platform Notification Center"
          className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full mt-2 sm:w-96 sm:max-w-[calc(100vw-1.5rem)] bg-[#F8F7F3] border border-[#B8B6AC] rounded-2xl shadow-xl overflow-hidden z-50 flex flex-col font-sans animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="p-3.5 px-4 bg-[#FBFAF7] border-b border-[#B8B6AC]/40 flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-bold text-sm text-[#24283A]">
                Platform Alerts
              </h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full bg-[#5052C9]/10 text-[#5052C9] border border-[#5052C9]/20">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  className="text-xs text-[#5052C9] hover:text-[#4345B0] font-medium flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-[#5052C9]/5"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-[#292D40]/60 hover:text-[#24283A] rounded-lg hover:bg-[#EDECE7] transition-colors"
                aria-label="Close notifications"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-[#B8B6AC]/20">
            {isLoading && notifications.length === 0 ? (
              /* Loading Skeleton */
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-[#EDECE7]" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 bg-[#EDECE7] rounded" />
                      <div className="h-2.5 w-1/2 bg-[#EDECE7] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              /* Error State */
              <div className="p-6 text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
                <p className="text-xs text-[#24283A] font-medium">
                  Failed to load platform alerts
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="text-xs text-[#5052C9] hover:underline font-semibold"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              /* Empty State */
              <div className="py-12 px-6 text-center space-y-2 select-none">
                <div className="w-10 h-10 rounded-full bg-[#EDECE7] text-[#292D40]/50 flex items-center justify-center mx-auto mb-3">
                  <Inbox className="w-5 h-5" />
                </div>
                <h4 className="font-heading font-bold text-sm text-[#24283A]">
                  All clear in control plane
                </h4>
                <p className="text-xs text-[#747683] max-w-[240px] mx-auto">
                  No pending platform incidents, billing events, or onboarding alerts.
                </p>
              </div>
            ) : (
              /* Notification Items List */
              notifications.map((notif) => {
                const isUnread = !notif.read_at;
                const categoryDetails = getPlatformCategoryDetails(notif.type);

                return (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={cn(
                      "p-3.5 px-4 flex items-start gap-3 transition-colors cursor-pointer group text-left",
                      isUnread
                        ? "bg-[#5052C9]/5 hover:bg-[#5052C9]/10"
                        : "hover:bg-[#EDECE7]/50"
                    )}
                  >
                    {/* Category Icon */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border mt-0.5",
                        isUnread
                          ? "bg-white border-[#5052C9]/20 shadow-xs"
                          : "bg-[#EDECE7] border-transparent"
                      )}
                    >
                      {categoryDetails.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border",
                            categoryDetails.badgeClass
                          )}
                        >
                          {categoryDetails.label}
                        </span>
                        <span className="text-[10px] text-[#747683] font-mono shrink-0">
                          {formatRelativeTime(notif.created_at)}
                        </span>
                      </div>

                      <h4
                        className={cn(
                          "text-xs leading-snug line-clamp-1 font-heading",
                          isUnread
                            ? "font-bold text-[#24283A]"
                            : "font-medium text-[#24283A]/90"
                        )}
                      >
                        {notif.title}
                      </h4>

                      <p className="text-[11px] text-[#747683] leading-relaxed line-clamp-2">
                        {notif.body}
                      </p>
                    </div>

                    {/* Unread Indicator Dot */}
                    {isUnread && (
                      <div className="w-2 h-2 rounded-full bg-[#5052C9] shrink-0 self-center mt-1" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 px-4 bg-[#FBFAF7] border-t border-[#B8B6AC]/40 flex items-center justify-between text-xs text-[#747683]">
            <span className="text-[11px]">Strict Option A Platform Scope</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push("/preritrd/profile#notifications");
              }}
              className="text-[11px] text-[#5052C9] hover:underline font-medium inline-flex items-center gap-1"
            >
              <span>Preferences</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
