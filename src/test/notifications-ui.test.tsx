import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  NotificationBell,
  formatRelativeTime,
  getNotificationIcon,
} from "@/components/notifications/notification-bell";
import * as NotificationsHookModule from "@/modules/notifications/hooks/use-notifications";
import type { NotificationRecord } from "@/modules/notifications/types";

// Mock next/navigation router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("UrPlaced Notification Bell & Panel UI Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Time Formatter & Icon Resolver", () => {
    it("formats relative timestamps accurately", () => {
      const now = new Date();
      expect(formatRelativeTime(now.toISOString())).toBe("Just now");

      const fiveMinsAgo = new Date(now.getTime() - 5 * 60 * 1000);
      expect(formatRelativeTime(fiveMinsAgo.toISOString())).toBe("5m ago");

      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      expect(formatRelativeTime(twoHoursAgo.toISOString())).toBe("2h ago");

      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      expect(formatRelativeTime(yesterday.toISOString())).toBe("Yesterday");

      expect(formatRelativeTime("invalid-date")).toBe("");
    });

    it("resolves category icons appropriately", () => {
      expect(getNotificationIcon("ASSESSMENT_ASSIGNED")).toBeDefined();
      expect(getNotificationIcon("DRIVE_ANNOUNCED")).toBeDefined();
      expect(getNotificationIcon("TRAINING_MODULE")).toBeDefined();
      expect(getNotificationIcon("STAFF_INVITATION")).toBeDefined();
      expect(getNotificationIcon("SYSTEM_ALERT")).toBeDefined();
    });
  });

  describe("2. Notification Bell & Unread Badge Rendering", () => {
    it("renders bell without badge when unreadCount is 0", () => {
      vi.spyOn(NotificationsHookModule, "useNotifications").mockReturnValue({
        notifications: [],
        unreadCount: 0,
        isLoading: false,
        error: null,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
        refetch: vi.fn(),
      });

      render(<NotificationBell />);

      const bellBtn = screen.getByRole("button", { name: /^Notifications$/i });
      expect(bellBtn).toBeInTheDocument();
      expect(screen.queryByText("0")).toBeNull();
    });

    it("renders badge with exact count when unreadCount is between 1 and 99", () => {
      vi.spyOn(NotificationsHookModule, "useNotifications").mockReturnValue({
        notifications: [],
        unreadCount: 5,
        isLoading: false,
        error: null,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
        refetch: vi.fn(),
      });

      render(<NotificationBell />);

      const bellBtn = screen.getByRole("button", {
        name: /Notifications \(5 unread\)/i,
      });
      expect(bellBtn).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();
    });

    it("renders '99+' badge when unreadCount exceeds 99", () => {
      vi.spyOn(NotificationsHookModule, "useNotifications").mockReturnValue({
        notifications: [],
        unreadCount: 120,
        isLoading: false,
        error: null,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
        refetch: vi.fn(),
      });

      render(<NotificationBell />);

      expect(screen.getByText("99+")).toBeInTheDocument();
    });
  });

  describe("3. Notification Panel Interactions & States", () => {
    it("opens panel when bell is clicked and closes on second click", () => {
      vi.spyOn(NotificationsHookModule, "useNotifications").mockReturnValue({
        notifications: [],
        unreadCount: 0,
        isLoading: false,
        error: null,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
        refetch: vi.fn(),
      });

      render(<NotificationBell />);

      const bellBtn = screen.getByRole("button", { name: /^Notifications$/i });

      // Click to open
      fireEvent.click(bellBtn);
      expect(screen.getByRole("dialog", { name: /Notification center/i })).toBeInTheDocument();

      // Click to close
      fireEvent.click(bellBtn);
      expect(screen.queryByRole("dialog", { name: /Notification center/i })).toBeNull();
    });

    it("displays empty state when user has no notifications", () => {
      vi.spyOn(NotificationsHookModule, "useNotifications").mockReturnValue({
        notifications: [],
        unreadCount: 0,
        isLoading: false,
        error: null,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
        refetch: vi.fn(),
      });

      render(<NotificationBell />);

      const bellBtn = screen.getByRole("button", { name: /^Notifications$/i });
      fireEvent.click(bellBtn);

      expect(screen.getByText("You're all caught up")).toBeInTheDocument();
      expect(
        screen.getByText("You don't have any notifications right now.")
      ).toBeInTheDocument();
    });

    it("displays populated notification items with unread styling", () => {
      const mockNotifications: NotificationRecord[] = [
        {
          id: "notif-1",
          recipient_user_id: "u-1",
          college_id: null,
          actor_user_id: null,
          type: "ASSESSMENT_ASSIGNED",
          title: "Technical Mock Interview Assigned",
          body: "Please complete by Friday 5:00 PM.",
          action_url: "/dashboard/student/assessments/mock-1",
          metadata: {},
          deduplication_key: null,
          read_at: null, // Unread
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "notif-2",
          recipient_user_id: "u-1",
          college_id: null,
          actor_user_id: null,
          type: "SYSTEM",
          title: "Profile Verified",
          body: "Your institutional credentials have been verified.",
          action_url: null,
          metadata: {},
          deduplication_key: null,
          read_at: new Date().toISOString(), // Read
          created_at: new Date(Date.now() - 3600000).toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(NotificationsHookModule, "useNotifications").mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 1,
        isLoading: false,
        error: null,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
        refetch: vi.fn(),
      });

      render(<NotificationBell />);

      const bellBtn = screen.getByRole("button", { name: /Notifications/i });
      fireEvent.click(bellBtn);

      expect(screen.getByText("Technical Mock Interview Assigned")).toBeInTheDocument();
      expect(screen.getByText("Profile Verified")).toBeInTheDocument();
      expect(screen.getByText("1 new")).toBeInTheDocument();
      expect(screen.getByText("Mark all read")).toBeInTheDocument();
    });

    it("clicking notification marks it as read and navigates to validated internal URL", () => {
      const mockMarkAsRead = vi.fn();
      const mockNotifications: NotificationRecord[] = [
        {
          id: "notif-1",
          recipient_user_id: "u-1",
          college_id: null,
          actor_user_id: null,
          type: "ASSESSMENT_ASSIGNED",
          title: "Assessment Ready",
          body: "Start your test.",
          action_url: "/dashboard/student/assessments/test-1",
          metadata: {},
          deduplication_key: null,
          read_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(NotificationsHookModule, "useNotifications").mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 1,
        isLoading: false,
        error: null,
        markAsRead: mockMarkAsRead,
        markAllAsRead: vi.fn(),
        refetch: vi.fn(),
      });

      render(<NotificationBell />);

      fireEvent.click(screen.getByRole("button", { name: /Notifications/i }));

      const item = screen.getByText("Assessment Ready");
      fireEvent.click(item);

      expect(mockMarkAsRead).toHaveBeenCalledWith("notif-1");
      expect(mockPush).toHaveBeenCalledWith("/dashboard/student/assessments/test-1");
    });

    it("clicking 'Mark all read' triggers markAllAsRead handler", () => {
      const mockMarkAll = vi.fn();
      const mockNotifications: NotificationRecord[] = [
        {
          id: "notif-1",
          recipient_user_id: "u-1",
          college_id: null,
          actor_user_id: null,
          type: "SYSTEM",
          title: "System Update",
          body: "Platform maintenance scheduled.",
          action_url: null,
          metadata: {},
          deduplication_key: null,
          read_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      vi.spyOn(NotificationsHookModule, "useNotifications").mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 1,
        isLoading: false,
        error: null,
        markAsRead: vi.fn(),
        markAllAsRead: mockMarkAll,
        refetch: vi.fn(),
      });

      render(<NotificationBell />);

      fireEvent.click(screen.getByRole("button", { name: /Notifications/i }));

      const markAllBtn = screen.getByText("Mark all read");
      fireEvent.click(markAllBtn);

      expect(mockMarkAll).toHaveBeenCalled();
    });

    it("closes panel on Escape key", () => {
      vi.spyOn(NotificationsHookModule, "useNotifications").mockReturnValue({
        notifications: [],
        unreadCount: 0,
        isLoading: false,
        error: null,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
        refetch: vi.fn(),
      });

      render(<NotificationBell />);

      fireEvent.click(screen.getByRole("button", { name: /^Notifications$/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("closes panel on outside click", () => {
      vi.spyOn(NotificationsHookModule, "useNotifications").mockReturnValue({
        notifications: [],
        unreadCount: 0,
        isLoading: false,
        error: null,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
        refetch: vi.fn(),
      });

      render(
        <div>
          <span data-testid="outside-element">Outside</span>
          <NotificationBell />
        </div>
      );

      fireEvent.click(screen.getByRole("button", { name: /^Notifications$/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      fireEvent.mouseDown(screen.getByTestId("outside-element"));
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
