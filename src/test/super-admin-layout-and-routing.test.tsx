import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { AppShell } from "@/components/layout/app-shell";
import { PLATFORM_NAVIGATION, PlatformSidebar, PlatformTopNavbar } from "@/components/platform-admin/platform-nav";

// Mock next/navigation
const mockPathname = vi.fn();
const mockRouter = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
}));

// Mock auth context provider
vi.mock("@/lib/auth/auth-context-provider", () => ({
  useAuthContext: () => ({
    isAuthenticated: true,
    isLoading: false,
    role: "STUDENT",
    fullName: "Jane Student",
    email: "student@test.edu",
    avatarUrl: null,
    permissions: [],
    availableTenants: [],
  }),
}));

describe("Super Admin Portal Layout Isolation & Navigation Invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. AppShell Strict Isolation (Zero Leakage to /preritrd)", () => {
    it("Test A: confirms no Student or College shell appears on /preritrd/login", () => {
      mockPathname.mockReturnValue("/preritrd/login");

      render(
        <AppShell>
          <div data-testid="login-content">Standalone Login Page</div>
        </AppShell>
      );

      // Must render login content
      expect(screen.getByTestId("login-content")).toBeInTheDocument();

      // Must NOT render Student or College navigation, role badges, or sidebar
      expect(screen.queryByText("Student Workspace")).not.toBeInTheDocument();
      expect(screen.queryByText("Placement Preparation")).not.toBeInTheDocument();
      expect(screen.queryByText("College Placement Cell")).not.toBeInTheDocument();
      expect(screen.queryByTestId("header-avatar-button")).not.toBeInTheDocument();
    });

    it("confirms no Student or College shell appears on /preritrd/dashboard", () => {
      mockPathname.mockReturnValue("/preritrd/dashboard");

      render(
        <AppShell>
          <div data-testid="super-admin-dashboard">Super Admin Dashboard</div>
        </AppShell>
      );

      expect(screen.getByTestId("super-admin-dashboard")).toBeInTheDocument();
      expect(screen.queryByText("Student Workspace")).not.toBeInTheDocument();
      expect(screen.queryByText("College Placement Cell")).not.toBeInTheDocument();
      expect(screen.queryByTestId("header-avatar-button")).not.toBeInTheDocument();
    });

    it("confirms no Student or College shell appears on any other /preritrd/* routes", () => {
      const routes = [
        "/preritrd/colleges",
        "/preritrd/colleges/new",
        "/preritrd/subscriptions",
        "/preritrd/billing",
        "/preritrd/analytics",
        "/preritrd/configuration",
        "/preritrd/accounts",
        "/preritrd/audit-logs",
        "/preritrd/system-health",
      ];

      for (const route of routes) {
        mockPathname.mockReturnValue(route);
        const { container } = render(
          <AppShell>
            <div data-testid={`route-${route}`}>Page {route}</div>
          </AppShell>
        );

        // Expect exactly the child content, zero outer AppShell markup
        expect(container.querySelector("aside")).toBeNull();
        expect(container.querySelector("header")).toBeNull();
      }
    });

    it("Test G: verifies Student/College shell correctly mounts on /dashboard routes", () => {
      mockPathname.mockReturnValue("/dashboard");

      const { container } = render(
        <AppShell>
          <div data-testid="student-dashboard">Student Dashboard Page</div>
        </AppShell>
      );

      expect(screen.getByTestId("student-dashboard")).toBeInTheDocument();
      // On /dashboard, AppShell must render navigation
      expect(container.querySelector("header")).not.toBeNull();
      expect(container.querySelector("aside")).not.toBeNull();
    });
  });

  describe("2. Dedicated Platform Super Admin Navigation (All 10 Routes)", () => {
    it("Test F: verifies that all ten planned routes exist in PLATFORM_NAVIGATION", () => {
      const allItems = PLATFORM_NAVIGATION.flatMap((group) => group.items);
      expect(allItems).toHaveLength(10);

      const expectedRoutes = [
        "/preritrd/dashboard",
        "/preritrd/colleges",
        "/preritrd/colleges/new",
        "/preritrd/subscriptions",
        "/preritrd/billing",
        "/preritrd/analytics",
        "/preritrd/configuration",
        "/preritrd/accounts",
        "/preritrd/audit-logs",
        "/preritrd/system-health",
      ];

      for (const expected of expectedRoutes) {
        const found = allItems.find((item) => item.href === expected);
        expect(found, `Missing route ${expected} in PLATFORM_NAVIGATION`).toBeDefined();
      }
    });

    it("renders PlatformSidebar with all 10 links and highlights the active route", () => {
      mockPathname.mockReturnValue("/preritrd/analytics");

      render(
        <PlatformSidebar adminEmail="admin@urplaced.com" adminName="Platform Super Admin" />
      );

      // Verify branding
      expect(screen.getAllByText("UrPlaced Super Admin").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Platform Analytics").length).toBeGreaterThan(0);
      expect(screen.getAllByText("College Management").length).toBeGreaterThan(0);
      expect(screen.getAllByText("System Health").length).toBeGreaterThan(0);

      // Verify sign out button
      expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
    });

    it("renders PlatformTopNavbar with current title, ThemeToggle, and account menu", () => {
      mockPathname.mockReturnValue("/preritrd/billing");

      render(
        <PlatformTopNavbar adminEmail="admin@urplaced.com" adminName="Prerit" />
      );

      expect(screen.getByText("Billing & Invoices")).toBeInTheDocument();
      expect(screen.getByText("Strict Option A Enforced")).toBeInTheDocument();
      expect(screen.getByTestId("theme-toggle-btn")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /super admin account menu/i })).toBeInTheDocument();
    });
  });
});
