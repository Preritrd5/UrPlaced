/**
 * usePlatformNotifications Hook
 * Dedicated control-plane notification state and optimistic action management for Platform Super Admins.
 * 
 * STRICT OPTION A: Strictly communicates with /api/preritrd/notifications.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { PlatformNotificationRecord } from "../services/platform-notification-service";

export interface UsePlatformNotificationsReturn {
  notifications: PlatformNotificationRecord[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refetch: () => Promise<void>;
}

// In-flight request deduplication cache to prevent redundant concurrent fetches
let inFlightFetchPromise: Promise<{ notifications: PlatformNotificationRecord[]; unreadCount: number }> | null = null;
let lastFetchTimestamp = 0;
let cachedResult: { notifications: PlatformNotificationRecord[]; unreadCount: number } | null = null;

export function usePlatformNotifications(): UsePlatformNotificationsReturn {
  const [notifications, setNotifications] = useState<PlatformNotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const fetchNotifications = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    }
    setError(null);

    try {
      // Reuse cached result if fetched within 1.5 seconds
      if (cachedResult && Date.now() - lastFetchTimestamp < 1500) {
        if (isMountedRef.current) {
          setNotifications(cachedResult.notifications);
          setUnreadCount(cachedResult.unreadCount);
          setIsLoading(false);
        }
        return;
      }

      // Deduplicate concurrent in-flight requests
      if (!inFlightFetchPromise) {
        inFlightFetchPromise = (async () => {
          const res = await fetch("/api/preritrd/notifications?limit=30");
          if (!res.ok) {
            throw new Error(`Failed to load platform notifications: HTTP ${res.status}`);
          }
          const data = await res.json();
          if (!data.success) {
            throw new Error(data.error || "Failed to load platform notifications");
          }
          const result = {
            notifications: (data.notifications || []) as PlatformNotificationRecord[],
            unreadCount: typeof data.unreadCount === "number" ? data.unreadCount : 0,
          };
          cachedResult = result;
          lastFetchTimestamp = Date.now();
          return result;
        })().finally(() => {
          inFlightFetchPromise = null;
        });
      }

      const result = await inFlightFetchPromise;
      if (isMountedRef.current) {
        setNotifications(result.notifications);
        setUnreadCount(result.unreadCount);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || "Unable to fetch platform notifications");
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchNotifications(true);

    // Refresh notifications when tab regains focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        cachedResult = null;
        fetchNotifications(false);
      }
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchNotifications]);

  // Mark single notification as read (optimistic)
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!notificationId) return;

      cachedResult = null;
      // Optimistic update
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notificationId && !item.read_at
            ? { ...item, read_at: new Date().toISOString() }
            : item
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        const res = await fetch(`/api/preritrd/notifications/${notificationId}/read`, {
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
      const res = await fetch("/api/preritrd/notifications/read-all", {
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
