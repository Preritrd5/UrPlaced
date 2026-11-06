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
  AlertTriangle,
  Clock,
  ShieldCheck,
  Inbox,
  X,
  ExternalLink,
  Activity,
} from "lucide-react";
import { usePlatformNotifications } from "@/modules/platform-admin/hooks/use-platform-notifications";
import type { PlatformNotificationRecord } from "@/modules/platform-admin/services/platform-notification-service";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

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
        icon: <Building2 className="w-4 h-4 text-secondary" />,
        label: "Registration",
        badgeClass: "bg-secondary/10 text-secondary border-secondary/30",
      };
    case "COLLEGE_ONBOARDING":
      return {
        icon: <Building2 className="w-4 h-4 text-secondary" />,
        label: "Onboarding",
        badgeClass: "bg-secondary/10 text-secondary border-secondary/30",
      };
    case "COLLEGE_ONBOARDING_FAILURE":
      return {
        icon: <AlertTriangle className="w-4 h-4 text-status-danger" />,
        label: "Delivery Failure",
        badgeClass: "bg-status-danger-subtle text-status-danger border-status-danger/30",
      };
    case "SECURITY_EVENT":
    case "SECURITY_LOGIN":
    case "SECURITY_MFA":
      return {
        icon: <ShieldCheck className="w-4 h-4 text-secondary text-[#2E8F86]" />,
        label: "Security",
        badgeClass: "bg-secondary/10 text-secondary text-[#2E8F86] border-secondary/30",
      };
    case "SERVICE_INCIDENT":
    case "INFRASTRUCTURE_INCIDENT":
    case "DATABASE_INCIDENT":
      return {
        icon: <Activity className="w-4 h-4 text-status-warning" />,
        label: "Health",
        badgeClass: "bg-status-warning-subtle text-status-warning border-status-warning/30",
      };
    case "SUBSCRIPTION_ACTIVATION":
      return {
        icon: <CreditCard className="w-4 h-4 text-secondary" />,
        label: "Activation",
        badgeClass: "bg-secondary/10 text-secondary border-secondary/30",
      };
    case "SUBSCRIPTION_EXPIRY":
      return {
        icon: <CreditCard className="w-4 h-4 text-primary text-[#5052C9]" />,
        label: "Subscription",
        badgeClass: "bg-primary/10 text-primary text-[#5052C9] border-primary/30",
      };
    case "BILLING_INVOICE":
      return {
        icon: <Receipt className="w-4 h-4 text-primary" />,
        label: "Billing",
        badgeClass: "bg-primary/10 text-primary border-primary/30",
      };
    case "PAYMENT_FAILURE":
      return {
        icon: <AlertCircle className="w-4 h-4 text-status-danger" />,
        label: "Payment",
        badgeClass: "bg-status-danger-subtle text-status-danger border-status-danger/30",
      };
    default:
      return {
        icon: <ShieldCheck className="w-4 h-4 text-primary" />,
        label: "Security",
        badgeClass: "bg-primary/10 text-primary border-primary/30",
      };
  }
}

export function PlatformNotificationBell({
  className,
  size = "default",
}: PlatformNotificationBellProps) {
  const router = useRouter();
  const { notifications, unreadCount, isLoading, error, markAsRead, markAllAsRead, refetch } =
    usePlatformNotifications();

  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  // Close when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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
    if (!notif.read_at) {
      markAsRead(notif.id);
    }
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
          "relative rounded-full flex items-center justify-center transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30",
          size === "sm" ? "w-8 h-8 p-1.5" : "w-9 h-9 p-2",
          isOpen
            ? "bg-primary/10 text-primary"
            : "text-text-secondary hover:text-text-primary hover:bg-surface active:scale-95"
        )}
      >
        <Bell className={cn(size === "sm" ? "w-4 h-4" : "w-5 h-5")} />

        {/* Unread Badge */}
        {badgeText && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-white text-[10px] font-bold font-mono leading-none flex items-center justify-center shadow-xs border-2 border-card select-none animate-in fade-in zoom-in-75 duration-150"
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
          className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-full mt-2 sm:w-96 sm:max-w-[calc(100vw-1.5rem)] bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-50 flex flex-col font-sans animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="p-3.5 px-4 bg-surface/80 border-b border-border flex items-center justify-between select-none">
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-bold text-sm text-text-primary">
                Platform Alerts
              </h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  className="text-xs text-primary hover:text-primary-hover font-medium flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-primary/10"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface transition-colors"
                aria-label="Close notifications"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border/40">
            {isLoading && notifications.length === 0 ? (
              /* Loading Skeleton */
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 items-center">
                    <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error ? (
              /* Error State */
              <div className="p-6 text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-status-danger mx-auto" />
                <p className="text-xs text-text-primary font-medium">
                  Failed to load platform alerts
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="text-xs text-primary hover:underline font-semibold"
                >
                  Try again
                </button>
              </div>
            ) : notifications.length === 0 ? (
              /* Empty State */
              <div className="py-12 px-6 text-center space-y-2 select-none">
                <div className="w-10 h-10 rounded-full bg-surface text-text-secondary flex items-center justify-center mx-auto mb-3">
                  <Inbox className="w-5 h-5" />
                </div>
                <h4 className="font-heading font-bold text-sm text-text-primary">
                  All clear in control plane
                </h4>
                <p className="text-xs text-text-secondary max-w-[240px] mx-auto">
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
                        ? "bg-primary/5 hover:bg-primary/10"
                        : "hover:bg-surface/50"
                    )}
                  >
                    {/* Category Icon */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border mt-0.5",
                        isUnread
                          ? "bg-card border-primary/20 shadow-xs"
                          : "bg-surface border-transparent"
                      )}
                    >
                      {categoryDetails.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border",
                            categoryDetails.badgeClass
                          )}
                        >
                          {categoryDetails.label}
                        </span>
                        <span className="text-[10px] text-text-secondary font-mono shrink-0">
                          {formatRelativeTime(notif.created_at)}
                        </span>
                      </div>

                      <h4
                        className={cn(
                          "text-xs leading-snug line-clamp-1 font-heading",
                          isUnread
                            ? "font-bold text-text-primary"
                            : "font-medium text-text-primary/90"
                        )}
                      >
                        {notif.title}
                      </h4>

                      <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-2">
                        {notif.body}
                      </p>
                    </div>

                    {/* Unread Indicator Dot */}
                    {isUnread && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 self-center mt-1" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 px-4 bg-surface/80 border-t border-border flex items-center justify-between text-xs text-text-secondary">
            <span className="text-[11px] font-mono">Strict Option A Scope</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push("/preritrd/profile#notifications");
              }}
              className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1 font-mono"
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
