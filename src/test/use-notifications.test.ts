import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNotifications } from "@/modules/notifications/hooks/use-notifications";
import * as AuthContextModule from "@/lib/auth/auth-context-provider";
import * as SupabaseClientModule from "@/lib/supabase/client";

describe("useNotifications Hook Suite", () => {
  const testUserId = "user-123-uuid";

  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };

  const mockSupabase = {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(SupabaseClientModule, "createClient").mockReturnValue(mockSupabase as any);
  });

  it("returns empty notifications and 0 unread when unauthenticated", async () => {
    vi.spyOn(AuthContextModule, "useAuthContext").mockReturnValue({
      isAuthenticated: false,
      userId: null,
    } as any);

    const { result } = renderHook(() => useNotifications());

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it("fetches notifications and initializes realtime channel when authenticated", async () => {
    vi.spyOn(AuthContextModule, "useAuthContext").mockReturnValue({
      isAuthenticated: true,
      userId: testUserId,
    } as any);

    const mockNotifications = [
      {
        id: "notif-1",
        title: "Test Notification",
        body: "Test Body",
        read_at: null,
        created_at: new Date().toISOString(),
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        notifications: mockNotifications,
        unreadCount: 1,
        total: 1,
      }),
    } as any);

    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.notifications.length).toBe(1);
    expect(result.current.unreadCount).toBe(1);
    expect(mockSupabase.channel).toHaveBeenCalledWith(`notifications:${testUserId}`);
  });

  it("performs optimistic markAsRead and dispatches PATCH request", async () => {
    vi.spyOn(AuthContextModule, "useAuthContext").mockReturnValue({
      isAuthenticated: true,
      userId: testUserId,
    } as any);

    const mockNotifications = [
      {
        id: "notif-1",
        title: "Test Notification",
        body: "Test Body",
        read_at: null,
        created_at: new Date().toISOString(),
      },
    ];

    const fetchMock = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes("/api/notifications?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            notifications: mockNotifications,
            unreadCount: 1,
            total: 1,
          }),
        });
      }
      if (url.includes("/read") && opts?.method === "PATCH") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    global.fetch = fetchMock;

    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.unreadCount).toBe(1);

    await act(async () => {
      await result.current.markAsRead("notif-1");
    });

    // Unread count decremented immediately
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications[0].read_at).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/notif-1/read", {
      method: "PATCH",
    });
  });

  it("performs optimistic markAllAsRead and dispatches POST request", async () => {
    vi.spyOn(AuthContextModule, "useAuthContext").mockReturnValue({
      isAuthenticated: true,
      userId: testUserId,
    } as any);

    const mockNotifications = [
      { id: "notif-1", title: "N1", body: "B1", read_at: null, created_at: new Date().toISOString() },
      { id: "notif-2", title: "N2", body: "B2", read_at: null, created_at: new Date().toISOString() },
    ];

    const fetchMock = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url.includes("/api/notifications?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            notifications: mockNotifications,
            unreadCount: 2,
            total: 2,
          }),
        });
      }
      if (url.includes("/read-all") && opts?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true, count: 2 }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    global.fetch = fetchMock;

    const { result } = renderHook(() => useNotifications());

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.unreadCount).toBe(2);

    await act(async () => {
      await result.current.markAllAsRead();
    });

    // All notifications marked as read
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every((n) => n.read_at !== null)).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/notifications/read-all", {
      method: "POST",
    });
  });
});
