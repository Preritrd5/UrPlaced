import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlatformNotificationBell, getPlatformCategoryDetails, formatRelativeTime } from "@/components/platform-admin/platform-notification-bell";
import { PlatformUserAccountMenu } from "@/components/platform-admin/platform-user-account-menu";
import { PlatformTopNavbar } from "@/components/platform-admin/platform-nav";
import { PlatformAdminProvider } from "@/components/platform-admin/platform-admin-context";
import * as NotificationHook from "@/modules/platform-admin/hooks/use-platform-notifications";

// Polyfill pointer methods for jsdom
beforeEach(() => {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/preritrd/dashboard",
}));

const mockAdminState = {
  id: "admin-uuid-123",
  email: "urplaced5@gmail.com",
  fullName: "Platform Super Admin",
  role: "SUPER_ADMIN" as const,
  status: "ACTIVE" as const,
  avatarUrl: null,
  mfaEnforced: true,
  mfaVerified: true,
  lastSignInAt: new Date().toISOString(),
};

const mockNotifications = [
  {
    id: "notif-1",
    recipient_user_id: "admin-uuid-123",
    source: "PLATFORM_EVENT",
    type: "SECURITY_EVENT",
    title: "Two-Factor Authentication Active (AAL2)",
    body: "Session elevated to cryptographic AAL2 assurance.",
    action_url: "/preritrd/profile#security",
    metadata: {},
    read_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "notif-2",
    recipient_user_id: "admin-uuid-123",
    source: "PLATFORM_EVENT",
    type: "COLLEGE_ONBOARDING",
    title: "Institutional Tenant Configured",
    body: "College workspace setup complete with cohorts verified.",
    action_url: "/preritrd/colleges",
    metadata: {},
    read_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
];

describe("Super Admin Header UI: Notification Bell, Profile Avatar & Dropdown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Category Formatter & Relative Time Helpers", () => {
    it("formats platform control plane categories into distinct labels and badges", () => {
      const sec = getPlatformCategoryDetails("SECURITY_EVENT");
      expect(sec.label).toBe("Security");
      expect(sec.badgeClass).toContain("text-[#2E8F86]");

      const sub = getPlatformCategoryDetails("SUBSCRIPTION_EXPIRY");
      expect(sub.label).toBe("Subscription");
      expect(sub.badgeClass).toContain("text-[#5052C9]");

      const inc = getPlatformCategoryDetails("SERVICE_INCIDENT");
      expect(inc.label).toBe("Health");

      const reg = getPlatformCategoryDetails("COLLEGE_REGISTRATION");
      expect(reg.label).toBe("Registration");
    });

    it("formats relative timestamps accurately", () => {
      const now = new Date().toISOString();
      expect(formatRelativeTime(now)).toBe("Just now");

      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      expect(formatRelativeTime(tenMinutesAgo)).toBe("10m ago");

      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      expect(formatRelativeTime(threeHoursAgo)).toBe("3h ago");
    });
  });

  describe("2. PlatformNotificationBell Component", () => {
    it("renders bell trigger with unread badge and opens notification panel on click", async () => {
      const mockMarkAsRead = vi.fn();
      const mockMarkAllAsRead = vi.fn();
      const mockRefetch = vi.fn();

      vi.spyOn(NotificationHook, "usePlatformNotifications").mockReturnValue({
        notifications: mockNotifications,
        unreadCount: 1,
        isLoading: false,
        error: null,
        markAsRead: mockMarkAsRead,
        markAllAsRead: mockMarkAllAsRead,
        refetch: mockRefetch,
      });

      render(<PlatformNotificationBell />);

      const bellBtn = screen.getByLabelText(/Platform Notifications/i);
      expect(bellBtn).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();

      // Click to open panel
      fireEvent.click(bellBtn);

      await waitFor(() => {
        expect(screen.getByText("Platform Alerts")).toBeInTheDocument();
        expect(screen.getByText("Two-Factor Authentication Active (AAL2)")).toBeInTheDocument();
        expect(screen.getByText("Institutional Tenant Configured")).toBeInTheDocument();
        expect(screen.getByText("Mark all read")).toBeInTheDocument();
      });

      // Click Mark all read
      const markAllBtn = screen.getByText("Mark all read");
      fireEvent.click(markAllBtn);
      expect(mockMarkAllAsRead).toHaveBeenCalled();

      // Click individual notification item
      const item = screen.getByText("Two-Factor Authentication Active (AAL2)");
      fireEvent.click(item);
      expect(mockMarkAsRead).toHaveBeenCalledWith("notif-1");
    });
  });

  describe("3. PlatformUserAccountMenu (Super Admin Profile Avatar & Rich Dropdown)", () => {
    it("renders avatar trigger, opens rich dropdown with Super Admin identity card", async () => {
      render(
        <PlatformAdminProvider initialAdmin={mockAdminState}>
          <PlatformUserAccountMenu />
        </PlatformAdminProvider>
      );

      const trigger = screen.getByTestId("platform-admin-avatar-button");
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveAttribute("aria-expanded", "false");

      // Open menu via keyboard navigation (Enter key)
      fireEvent.keyDown(trigger, { key: "Enter" });

      await waitFor(() => {
        // Identity Card assertions
        expect(screen.getByText("Platform Super Admin")).toBeInTheDocument();
        expect(screen.getByText("urplaced5@gmail.com")).toBeInTheDocument();
        expect(screen.getByText("SUPER ADMIN")).toBeInTheDocument();
        expect(screen.getByText("UrPlaced Platform")).toBeInTheDocument();

        // Strict Option A: Ensure NO Student, Placement Head, or College name appears
        expect(screen.queryByText("Student")).toBeNull();
        expect(screen.queryByText("Placement Head")).toBeNull();
        expect(screen.queryByText("Placement Officer")).toBeNull();

        // Menu Item assertions
        expect(screen.getByText("My Profile")).toBeInTheDocument();
        expect(screen.getByText("Account & Security")).toBeInTheDocument();
        expect(screen.getByText("Notification Preferences")).toBeInTheDocument();
        expect(screen.getByText("Sign Out")).toBeInTheDocument();
      });

      // Verify navigation items exist
      expect(screen.getByTestId("platform-menu-item-profile")).toBeInTheDocument();
      expect(screen.getByTestId("platform-menu-item-security")).toBeInTheDocument();
      expect(screen.getByTestId("platform-menu-item-notifications")).toBeInTheDocument();
      expect(screen.getByTestId("platform-menu-item-signout")).toBeInTheDocument();

      // Click profile navigation
      const profileItem = screen.getByTestId("platform-menu-item-profile");
      fireEvent.click(profileItem);
      expect(mockPush).toHaveBeenCalledWith("/preritrd/profile");
    });
  });

  describe("4. PlatformTopNavbar Header Layout Parity", () => {
    it("renders right side as [Theme Toggle] [Notification Bell] [Profile Avatar] with no duplicate Sign Out button", async () => {
      vi.spyOn(NotificationHook, "usePlatformNotifications").mockReturnValue({
        notifications: [],
        unreadCount: 0,
        isLoading: false,
        error: null,
        markAsRead: vi.fn(),
        markAllAsRead: vi.fn(),
        refetch: vi.fn(),
      });

      render(
        <PlatformAdminProvider initialAdmin={mockAdminState}>
          <PlatformTopNavbar />
        </PlatformAdminProvider>
      );

      // Notification bell is present
      expect(screen.getByLabelText(/Platform Notifications/i)).toBeInTheDocument();

      // Profile avatar trigger is present
      expect(screen.getByTestId("platform-admin-avatar-button")).toBeInTheDocument();

      // Standalone header Sign Out button is REMOVED
      const standaloneSignOut = screen.queryByRole("button", { name: /^sign out$/i });
      expect(standaloneSignOut).toBeNull();
    });
  });
});
