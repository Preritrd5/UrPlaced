"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  FileText,
  Briefcase,
  GraduationCap,
  UserPlus,
  AlertCircle,
  Inbox,
  X,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { useNotifications } from "@/modules/notifications/hooks/use-notifications";
import type { NotificationRecord } from "@/modules/notifications/types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface NotificationBellProps {
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

export function getNotificationIcon(type: string) {
  const upper = (type || "").toUpperCase();
  if (upper.includes("ASSESSMENT") || upper.includes("TEST")) {
    return <FileText className="w-4 h-4 text-[#5052C9]" />;
  }
  if (upper.includes("DRIVE") || upper.includes("JOB") || upper.includes("PLACEMENT")) {
    return <Briefcase className="w-4 h-4 text-[#2E8F86]" />;
  }
  if (upper.includes("TRAINING") || upper.includes("LEARN")) {
    return <GraduationCap className="w-4 h-4 text-[#5052C9]" />;
  }
  if (upper.includes("INVITE") || upper.includes("STAFF") || upper.includes("MEMBER")) {
    return <UserPlus className="w-4 h-4 text-[#2E8F86]" />;
  }
  return <Bell className="w-4 h-4 text-[#5052C9]" />;
}

export function NotificationBell({ className, size = "default" }: NotificationBellProps) {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    refetch,
  } = useNotifications();

  const [isOpen, setIsOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [panelCoords, setPanelCoords] = React.useState<{ top: number; right: number } | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPanelCoords({
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
    });
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener("resize", updatePosition);
      window.addEventListener("scroll", updatePosition, true);
      return () => {
        window.removeEventListener("resize", updatePosition);
        window.removeEventListener("scroll", updatePosition, true);
      };
    }
  }, [isOpen, updatePosition]);

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      const isInsideTrigger = triggerRef.current?.contains(target);
      const isInsidePanel = panelRef.current?.contains(target);
      if (!isInsideTrigger && !isInsidePanel) {
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

  const handleNotificationClick = async (notif: NotificationRecord) => {
    // 1. Mark as read if not already read
    if (!notif.read_at) {
      markAsRead(notif.id);
    }

    // 2. Safely navigate if action_url is internal
    if (notif.action_url && notif.action_url.startsWith("/") && !notif.action_url.startsWith("//")) {
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
        onClick={() => {
          if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPanelCoords({
              top: rect.bottom + 8,
              right: Math.max(12, window.innerWidth - rect.right),
            });
          }
          setIsOpen((prev) => !prev);
        }}
        suppressHydrationWarning
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
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
              "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#5052C9] text-white text-[10px] font-bold font-inter leading-none flex items-center justify-center shadow-sm border-2 border-white select-none animate-in fade-in zoom-in-75 duration-150"
            )}
          >
            {badgeText}
          </span>
        )}
      </button>

      {/* Expanded Notification Panel — Portaled to document.body to prevent any page button or header overlap */}
      {isOpen && (() => {
        const isClient = typeof window !== "undefined";
        const isDesktop = isClient && window.innerWidth >= 640;

        const panelElement = (
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notification center"
            style={{
              top: panelCoords ? `${panelCoords.top}px` : undefined,
              right: panelCoords && isDesktop ? `${panelCoords.right}px` : undefined,
            }}
            className={cn(
              "fixed top-16 z-[99999] bg-[#F8F7F3] border border-[#DDDCD5] rounded-2xl shadow-2xl overflow-hidden flex flex-col font-inter animate-in fade-in zoom-in-95 duration-150",
              "inset-x-3 sm:inset-x-auto sm:w-96 sm:max-w-[calc(100vw-1.5rem)]",
              "max-h-[min(520px,calc(100dvh-5rem))]"
            )}
          >
            {/* Header */}
            <div className="p-3.5 px-4 bg-[#FBFAF7] border-b border-[#DDDCD5] flex items-center justify-between select-none">
              <div className="flex items-center gap-2">
                <h3 className="font-outfit font-bold text-sm text-[#24283A]">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#5052C9]/10 text-[#5052C9]">
                    {unreadCount} new
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
                {notifications.length > 0 && clearAllNotifications && (
                  <button
                    type="button"
                    onClick={() => clearAllNotifications()}
                    className="text-xs text-red-500 hover:text-red-600 font-medium flex items-center gap-1 transition-colors px-1.5 py-0.5 rounded hover:bg-red-500/10"
                    title="Clear all notifications"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear all</span>
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
            <div className="max-h-[380px] overflow-y-auto divide-y divide-[#DDDCD5]/50">
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
                  <AlertCircle className="w-6 h-6 text-red-500 mx-auto" />
                  <p className="text-xs text-[#24283A] font-medium">
                    Failed to load notifications
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
                  <h4 className="font-outfit font-semibold text-sm text-[#24283A]">
                    You&apos;re all caught up
                  </h4>
                  <p className="text-xs text-[#292D40]/70 max-w-[220px] mx-auto leading-relaxed">
                    You don&apos;t have any notifications right now.
                  </p>
                </div>
              ) : (
                /* Populated Notification List */
                notifications.map((notif) => {
                  const isUnread = !notif.read_at;
                  const timeText = formatRelativeTime(notif.created_at);

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={cn(
                        "p-3.5 px-4 flex items-start gap-3 transition-colors cursor-pointer text-left relative group",
                        isUnread
                          ? "bg-white hover:bg-[#FBFAF7]"
                          : "bg-transparent hover:bg-white/60 opacity-80 hover:opacity-100"
                      )}
                    >
                      {/* Category Icon */}
                      <div
                        className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border mt-0.5",
                          isUnread
                            ? "bg-[#5052C9]/10 border-[#5052C9]/20"
                            : "bg-[#EDECE7] border-[#DDDCD5]"
                        )}
                      >
                        {getNotificationIcon(notif.type)}
                      </div>

                      {/* Text Body */}
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center justify-between gap-2">
                          <h4
                            className={cn(
                              "text-xs leading-snug truncate",
                              isUnread
                                ? "font-bold text-[#24283A]"
                                : "font-medium text-[#292D40]"
                            )}
                          >
                            {notif.title}
                          </h4>
                          {timeText && (
                            <span className="text-[10px] text-[#292D40]/50 whitespace-nowrap shrink-0">
                              {timeText}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#292D40]/80 line-clamp-2 mt-0.5 leading-relaxed">
                          {notif.body}
                        </p>

                        {notif.action_url && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#5052C9]">
                            <span>View details</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>

                      {/* Unread Dot Indicator & Delete Action */}
                      <div className="shrink-0 flex items-center gap-1.5 pt-1">
                        {deleteNotification && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notif.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-[#292D40]/50 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                            title="Delete notification"
                            aria-label="Delete notification"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isUnread && (
                          <span
                            className="block w-2 h-2 rounded-full bg-[#5052C9]"
                            title="Unread notification"
                          />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );

        if (mounted && typeof document !== "undefined") {
          return createPortal(panelElement, document.body);
        }
        return panelElement;
      })()}
    </div>
  );
}
