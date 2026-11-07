/**
 * Notification Context & Provider
 * UrPlaced Enterprise Notification Layer
 * 
 * Centralized notification store and single Supabase Realtime channel owner.
 * Dispatches live incoming toasts, synchronizes unread badges, and ensures zero cross-session leakage.
 */

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { usePathname } from "next/navigation";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { createClient } from "@/lib/supabase/client";
import type { NotificationRecord } from "../types";

export interface NotificationContextValue {
  notifications: NotificationRecord[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => Promise<void>;
  activeToasts: NotificationRecord[];
  dismissToast: (notificationId: string) => void;
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

let inFlightFetchPromise: Promise<{ notifications: NotificationRecord[]; unreadCount: number }> | null = null;
let lastFetchTimestamp = 0;
let cachedResult: { notifications: NotificationRecord[]; unreadCount: number; userId: string } | null = null;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthContext();
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeToasts, setActiveToasts] = useState<NotificationRecord[]>([]);

  const activeUserIdRef = useRef<string | null>(null);
  const initialLoadCompletedRef = useRef<boolean>(false);
  const seenToastIdsRef = useRef<Set<string>>(new Set());

  // Check if currently inside distraction-free examination taking workspace
  const isAssessmentTaking = useMemo(() => {
    return pathname ? /^\/dashboard\/student\/assessments\/[^/]+\/take/.test(pathname) : false;
  }, [pathname]);

  // Fetch notifications from server API
  const fetchNotifications = useCallback(async (isInitial = false) => {
    if (!auth.isAuthenticated || !auth.userId) {
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    if (isInitial) {
      setIsLoading(true);
    }
    setError(null);

    try {
      if (
        cachedResult &&
        cachedResult.userId === auth.userId &&
        Date.now() - lastFetchTimestamp < 1500
      ) {
        setNotifications(cachedResult.notifications);
        setUnreadCount(cachedResult.unreadCount);
        setIsLoading(false);
        return;
      }

      if (!inFlightFetchPromise) {
        inFlightFetchPromise = (async () => {
          const res = await fetch("/api/notifications?limit=30");
          if (!res.ok) {
            throw new Error(`Failed to load notifications: HTTP ${res.status}`);
          }
          const data = await res.json();
          if (!data.success) {
            throw new Error(data.error || "Failed to load notifications");
          }
          const result = {
            notifications: (data.notifications || []) as NotificationRecord[],
            unreadCount: typeof data.unreadCount === "number" ? data.unreadCount : 0,
          };
          lastFetchTimestamp = Date.now();
          cachedResult = { ...result, userId: auth.userId! };
          return result;
        })().finally(() => {
          inFlightFetchPromise = null;
        });
      }

      const data = await inFlightFetchPromise;
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);

      // Populate seenToastIds with initial historical records so historical notifications never trigger pop-ups on refresh
      data.notifications.forEach((n) => seenToastIdsRef.current.add(n.id));
      initialLoadCompletedRef.current = true;
    } catch (err: any) {
      setError(err.message || "Unable to fetch notifications");
    } finally {
      setIsLoading(false);
    }
  }, [auth.isAuthenticated, auth.userId]);

  // Main lifecycle: Realtime channel subscription & tab focus reconciliation
  useEffect(() => {
    if (!auth.isAuthenticated || !auth.userId) {
      activeUserIdRef.current = null;
      setNotifications([]);
      setUnreadCount(0);
      setActiveToasts([]);
      setIsLoading(false);
      setError(null);
      seenToastIdsRef.current.clear();
      initialLoadCompletedRef.current = false;
      return;
    }

    activeUserIdRef.current = auth.userId;
    fetchNotifications(true);

    let channel: any = null;
    try {
      const supabase = createClient();
      const channelName = `notifications_ctx:${auth.userId}`;

      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `recipient_user_id=eq.${auth.userId}`,
          },
          (payload) => {
            const newRecord = payload.new as NotificationRecord;
            if (!newRecord || !newRecord.id) return;

            setNotifications((prev) => {
              if (prev.some((item) => item.id === newRecord.id)) {
                return prev;
              }
              return [newRecord, ...prev];
            });

            if (!newRecord.read_at) {
              setUnreadCount((prev) => prev + 1);
            }

            // Only trigger visible pop-up toast if:
            // 1. Initial page load has completed (not a replay of initial state)
            // 2. Notification hasn't been toasted yet
            // 3. Student is not in active examination mode
            if (
              initialLoadCompletedRef.current &&
              !seenToastIdsRef.current.has(newRecord.id) &&
              !isAssessmentTaking
            ) {
              seenToastIdsRef.current.add(newRecord.id);
              setActiveToasts((prev) => {
                // Keep maximum 3 stacked toasts in queue to prevent viewport congestion
                const filtered = prev.filter((t) => t.id !== newRecord.id);
                return [newRecord, ...filtered].slice(0, 3);
              });
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "notifications",
            filter: `recipient_user_id=eq.${auth.userId}`,
          },
          (payload) => {
            const updated = payload.new as NotificationRecord;
            if (!updated || !updated.id) return;

            setNotifications((prev) =>
              prev.map((item) => (item.id === updated.id ? updated : item))
            );

            if (updated.read_at) {
              setUnreadCount((prev) => Math.max(0, prev - 1));
              setActiveToasts((prev) => prev.filter((t) => t.id !== updated.id));
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "notifications",
            filter: `recipient_user_id=eq.${auth.userId}`,
          },
          (payload) => {
            const oldId = payload.old?.id;
            if (!oldId) return;

            setNotifications((prev) => {
              const target = prev.find((item) => item.id === oldId);
              if (target && !target.read_at) {
                setUnreadCount((c) => Math.max(0, c - 1));
              }
              return prev.filter((item) => item.id !== oldId);
            });
            setActiveToasts((prev) => prev.filter((t) => t.id !== oldId));
          }
        )
        .subscribe();
    } catch {
      // In environments where WebSocket is disabled, REST fetch serves as resilient fallback
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications(false);
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      if (channel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(channel);
        } catch {
          // Fallback
        }
      }
    };
  }, [auth.isAuthenticated, auth.userId, fetchNotifications, isAssessmentTaking]);

  // Mark single notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!notificationId) return;

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId && !item.read_at
            ? { ...item, read_at: new Date().toISOString() }
            : item
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setActiveToasts((prev) => prev.filter((t) => t.id !== notificationId));

      cachedResult = null;
      try {
        const res = await fetch(`/api/notifications/${notificationId}/read`, {
          method: "PATCH",
        });
        if (!res.ok) {
          fetchNotifications(false);
        }
      } catch {
        fetchNotifications(false);
      }
    },
    [fetchNotifications]
  );

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    cachedResult = null;
    setNotifications((prev) =>
      prev.map((item) =>
        !item.read_at ? { ...item, read_at: new Date().toISOString() } : item
      )
    );
    setUnreadCount(0);
    setActiveToasts([]);

    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      if (!res.ok) {
        fetchNotifications(false);
      }
    } catch {
      fetchNotifications(false);
    }
  }, [fetchNotifications]);

  const dismissToast = useCallback((notificationId: string) => {
    setActiveToasts((prev) => prev.filter((t) => t.id !== notificationId));
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      error,
      markAsRead,
      markAllAsRead,
      refetch: () => {
        cachedResult = null;
        return fetchNotifications(false);
      },
      activeToasts,
      dismissToast,
    }),
    [
      notifications,
      unreadCount,
      isLoading,
      error,
      markAsRead,
      markAllAsRead,
      fetchNotifications,
      activeToasts,
      dismissToast,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext(): NotificationContextValue | null {
  return useContext(NotificationContext);
}
