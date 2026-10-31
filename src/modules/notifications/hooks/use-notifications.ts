/**
 * useNotifications Hook
 * Manages notification state, Supabase Realtime subscription, and optimistic read actions.
 * Ensures zero cross-session leakage when user accounts or sessions change.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { createClient } from "@/lib/supabase/client";
import type { NotificationRecord } from "../types";

export interface UseNotificationsReturn {
  notifications: NotificationRecord[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => Promise<void>;
}

// Shared in-flight deduplication cache to prevent concurrent redundant fetches (e.g. from mobile and desktop bells)
let inFlightFetchPromise: Promise<{ notifications: NotificationRecord[]; unreadCount: number }> | null = null;
let lastFetchTimestamp = 0;
let cachedResult: { notifications: NotificationRecord[]; unreadCount: number; userId: string } | null = null;

export function useNotifications(): UseNotificationsReturn {
  const auth = useAuthContext();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const activeUserIdRef = useRef<string | null>(null);

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
      // Reuse recent cached result if fetched within 1.5 seconds for the same user
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

      // Deduplicate concurrent in-flight requests
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
    } catch (err: any) {
      setError(err.message || "Unable to fetch notifications");
    } finally {
      setIsLoading(false);
    }
  }, [auth.isAuthenticated, auth.userId]);

  // Main lifecycle: Session attachment and Realtime subscription
  useEffect(() => {
    // 1. Session boundary guard: Clear state when signed out or switching users
    if (!auth.isAuthenticated || !auth.userId) {
      activeUserIdRef.current = null;
      setNotifications([]);
      setUnreadCount(0);
      setIsLoading(false);
      setError(null);
      return;
    }

    activeUserIdRef.current = auth.userId;
    fetchNotifications(true);

    // 2. Setup Supabase Realtime channel
    let channel: any = null;
    try {
      const supabase = createClient();
      const channelName = `notifications:${auth.userId}`;

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

            // Reconcile unread count if read_at changed
            if (updated.read_at) {
              setUnreadCount((prev) => Math.max(0, prev - 1));
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
          }
        )
        .subscribe();
    } catch {
      // In environments where Realtime WebSocket fails or is disabled, initial REST fetch serves as fallback
    }

    // 3. Tab visibility / focus reconciliation
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications(false);
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);

    // 4. Cleanup on unmount or user switch
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
  }, [auth.isAuthenticated, auth.userId, fetchNotifications]);

  // Mark single notification as read (optimistic)
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!notificationId) return;

      // Optimistic update
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId && !item.read_at
            ? { ...item, read_at: new Date().toISOString() }
            : item
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      cachedResult = null;
      try {
        const res = await fetch(`/api/notifications/${notificationId}/read`, {
          method: "PATCH",
        });
        if (!res.ok) {
          // Re-sync on failure
          fetchNotifications(false);
        }
      } catch {
        fetchNotifications(false);
      }
    },
    [fetchNotifications]
  );

  // Mark all notifications as read (optimistic)
  const markAllAsRead = useCallback(async () => {
    cachedResult = null;
    // Optimistic update
    setNotifications((prev) =>
      prev.map((item) =>
        !item.read_at ? { ...item, read_at: new Date().toISOString() } : item
      )
    );
    setUnreadCount(0);

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

  return {
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
  };
}
