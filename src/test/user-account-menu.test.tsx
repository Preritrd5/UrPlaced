import * as React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  UserAccountMenu,
  formatUserRoleTitle,
  getUserInitials,
} from "@/components/layout/user-account-menu";
import * as AuthContextModule from "@/lib/auth/auth-context-provider";

// Polyfill pointer methods for jsdom
beforeEach(() => {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/dashboard",
}));

describe("Global Profile/Avatar Icon & Account Menu System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Role Identity Formatter & Initials Helper", () => {
    it("formats role titles according to UrPlaced two-portal institutional specification", () => {
      // Student identity
      expect(formatUserRoleTitle("STUDENT", "STUDENT")).toBe("Student");
      expect(formatUserRoleTitle("STUDENT", null)).toBe("Student");

      // College / Cell internal roles
      expect(formatUserRoleTitle("COLLEGE", "PLACEMENT_HEAD")).toBe(
        "College / Cell · Placement Head"
      );
      expect(formatUserRoleTitle("COLLEGE", "PLACEMENT_STAFF")).toBe(
        "College / Cell · Placement Staff"
      );
      expect(formatUserRoleTitle("COLLEGE", "TRAINER")).toBe(
        "College / Cell · Trainer"
      );
      expect(formatUserRoleTitle("COLLEGE", undefined)).toBe(
        "College / Cell · Placement Head"
      );
    });

    it("generates correct initials from diverse name and email configurations", () => {
      expect(getUserInitials("Ananya Sharma", null)).toBe("AS");
      expect(getUserInitials("Rohit Kumar Verma", null)).toBe("RV");
      expect(getUserInitials("Student", null)).toBe("ST");
      expect(getUserInitials(null, "placement.cell@rvce.edu.in")).toBe("PL");
      expect(getUserInitials(null, null)).toBe("UP");
      expect(getUserInitials("", "")).toBe("UP");
    });
  });

  describe("2. Avatar Visual Presentation (Photo vs Circular Initials)", () => {
    it("displays uploaded profile photo image when avatarUrl is present", () => {
      vi.spyOn(AuthContextModule, "useAuthContext").mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        userId: "user-123",
        email: "student@example.com",
        fullName: "Priya Sharma",
        avatarUrl: "https://example.com/photos/priya.png",
        role: "STUDENT",
        accountCategory: "STUDENT",
        isPlatformAdmin: false,
        isVerifiedMembership: true,
        tenant: null,
        availableTenants: [],
        permissions: [],
        can: vi.fn().mockReturnValue(true),
        refresh: vi.fn(),
        signOut: vi.fn(),
      });

      render(<UserAccountMenu />);

      const avatarButton = screen.getByTestId("header-avatar-button");
      expect(avatarButton).toBeInTheDocument();
      expect(avatarButton).toHaveAttribute("aria-label", "User account menu");

      const img = avatarButton.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("src", "https://example.com/photos/priya.png");
      expect(img).toHaveAttribute("alt", "Priya Sharma");
    });

    it("displays circular initials avatar when no avatarUrl exists", () => {
      vi.spyOn(AuthContextModule, "useAuthContext").mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        userId: "user-456",
        email: "officer@college.edu",
        fullName: "Karan Patel",
        avatarUrl: null,
        role: "PLACEMENT_HEAD",
        accountCategory: "COLLEGE",
        isPlatformAdmin: false,
        isVerifiedMembership: true,
        tenant: { id: "tenant-1", name: "Bengaluru Tech Institute" },
        availableTenants: [],
        permissions: [],
        can: vi.fn().mockReturnValue(true),
        refresh: vi.fn(),
        signOut: vi.fn(),
      });

      render(<UserAccountMenu />);

      const avatarButton = screen.getByTestId("header-avatar-button");
      expect(avatarButton).toBeInTheDocument();
      expect(avatarButton.querySelector("img")).toBeNull();
      expect(avatarButton).toHaveTextContent("KP");
    });

    it("renders nothing when user is unauthenticated", () => {
      vi.spyOn(AuthContextModule, "useAuthContext").mockReturnValue({
        isLoading: false,
        isAuthenticated: false,
        userId: null,
        email: null,
        fullName: null,
        avatarUrl: null,
        role: null,
        accountCategory: null,
        isPlatformAdmin: false,
        isVerifiedMembership: false,
        tenant: null,
        availableTenants: [],
        permissions: [],
        can: vi.fn().mockReturnValue(false),
        refresh: vi.fn(),
        signOut: vi.fn(),
      });

      const { container } = render(<UserAccountMenu />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("3. Accessible Dropdown Menu Interactions & Role Presentation", () => {
    it("opens menu and displays user identity with College Placement Head title", async () => {
      const mockSignOut = vi.fn().mockResolvedValue(undefined);

      vi.spyOn(AuthContextModule, "useAuthContext").mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        userId: "head-1",
        email: "head@rvce.edu",
        fullName: "Dr. Ramesh Rao",
        avatarUrl: null,
        role: "PLACEMENT_HEAD",
        accountCategory: "COLLEGE",
        isPlatformAdmin: false,
        isVerifiedMembership: true,
        tenant: { id: "tenant-rvce", name: "RV College of Engineering" },
        availableTenants: [],
        permissions: [],
        can: vi.fn().mockReturnValue(true),
        refresh: vi.fn(),
        signOut: mockSignOut,
      });

      render(<UserAccountMenu />);

      const trigger = screen.getByTestId("header-avatar-button");
      expect(trigger).toHaveAttribute("aria-expanded", "false");

      // Open menu via keyboard navigation (Enter key)
      fireEvent.keyDown(trigger, { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByText("Dr. Ramesh Rao")).toBeInTheDocument();
        expect(screen.getByText("head@rvce.edu")).toBeInTheDocument();
        expect(
          screen.getByText("College / Cell · Placement Head")
        ).toBeInTheDocument();
        expect(screen.getByText(/RV College of Engineering/)).toBeInTheDocument();
      });

      // Actions present in menu
      expect(screen.getByTestId("menu-item-profile")).toBeInTheDocument();
      expect(screen.getByTestId("menu-item-settings")).toBeInTheDocument();
      expect(screen.getByTestId("menu-item-signout")).toBeInTheDocument();
    });

    it("displays Student identity badge for student account", async () => {
      vi.spyOn(AuthContextModule, "useAuthContext").mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        userId: "student-1",
        email: "student@urplaced.internal",
        fullName: "Aditi Rao",
        avatarUrl: null,
        role: "STUDENT",
        accountCategory: "STUDENT",
        isPlatformAdmin: false,
        isVerifiedMembership: true,
        tenant: null,
        availableTenants: [],
        permissions: [],
        can: vi.fn().mockReturnValue(true),
        refresh: vi.fn(),
        signOut: vi.fn(),
      });

      render(<UserAccountMenu />);

      fireEvent.keyDown(screen.getByTestId("header-avatar-button"), { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByText("Aditi Rao")).toBeInTheDocument();
        expect(screen.getByText("Student")).toBeInTheDocument();
      });
    });

    it("navigates to /dashboard/profile when My Profile is selected", async () => {
      vi.spyOn(AuthContextModule, "useAuthContext").mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        userId: "user-1",
        email: "user@example.com",
        fullName: "Test User",
        avatarUrl: null,
        role: "STUDENT",
        accountCategory: "STUDENT",
        isPlatformAdmin: false,
        isVerifiedMembership: true,
        tenant: null,
        availableTenants: [],
        permissions: [],
        can: vi.fn().mockReturnValue(true),
        refresh: vi.fn(),
        signOut: vi.fn(),
      });

      render(<UserAccountMenu />);

      fireEvent.keyDown(screen.getByTestId("header-avatar-button"), { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByTestId("menu-item-profile")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("menu-item-profile"));

      expect(mockPush).toHaveBeenCalledWith("/dashboard/profile");
    });

    it("navigates to /dashboard/profile#account-security when Account Settings is selected", async () => {
      vi.spyOn(AuthContextModule, "useAuthContext").mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        userId: "user-2",
        email: "user2@example.com",
        fullName: "Test Officer",
        avatarUrl: null,
        role: "PLACEMENT_STAFF",
        accountCategory: "COLLEGE",
        isPlatformAdmin: false,
        isVerifiedMembership: true,
        tenant: null,
        availableTenants: [],
        permissions: [],
        can: vi.fn().mockReturnValue(true),
        refresh: vi.fn(),
        signOut: vi.fn(),
      });

      render(<UserAccountMenu />);

      fireEvent.keyDown(screen.getByTestId("header-avatar-button"), { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByTestId("menu-item-settings")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("menu-item-settings"));

      expect(mockPush).toHaveBeenCalledWith("/dashboard/profile#account-security");
    });

    it("triggers auth.signOut flow when Sign Out is clicked", async () => {
      const mockSignOut = vi.fn().mockResolvedValue(undefined);

      vi.spyOn(AuthContextModule, "useAuthContext").mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        userId: "user-3",
        email: "user3@example.com",
        fullName: "Test Trainer",
        avatarUrl: null,
        role: "TRAINER",
        accountCategory: "COLLEGE",
        isPlatformAdmin: false,
        isVerifiedMembership: true,
        tenant: null,
        availableTenants: [],
        permissions: [],
        can: vi.fn().mockReturnValue(true),
        refresh: vi.fn(),
        signOut: mockSignOut,
      });

      render(<UserAccountMenu />);

      fireEvent.keyDown(screen.getByTestId("header-avatar-button"), { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByTestId("menu-item-signout")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("menu-item-signout"));

      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  describe("4. Responsive Sizing & Keyboard Accessibility", () => {
    it("applies compact size styles when size='sm' is specified for mobile headers", () => {
      vi.spyOn(AuthContextModule, "useAuthContext").mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        userId: "user-sm",
        email: "mobile@example.com",
        fullName: "Mobile User",
        avatarUrl: null,
        role: "STUDENT",
        accountCategory: "STUDENT",
        isPlatformAdmin: false,
        isVerifiedMembership: true,
        tenant: null,
        availableTenants: [],
        permissions: [],
        can: vi.fn().mockReturnValue(true),
        refresh: vi.fn(),
        signOut: vi.fn(),
      });

      render(<UserAccountMenu size="sm" />);

      const button = screen.getByTestId("header-avatar-button");
      const avatarContainer = button.firstElementChild;
      expect(avatarContainer).toHaveClass("h-8");
      expect(avatarContainer).toHaveClass("w-8");
    });

    it("includes focus-visible styling and ARIA attributes for keyboard navigation", () => {
      vi.spyOn(AuthContextModule, "useAuthContext").mockReturnValue({
        isLoading: false,
        isAuthenticated: true,
        userId: "user-kb",
        email: "keyboard@example.com",
        fullName: "Keyboard Accessible",
        avatarUrl: null,
        role: "STUDENT",
        accountCategory: "STUDENT",
        isPlatformAdmin: false,
        isVerifiedMembership: true,
        tenant: null,
        availableTenants: [],
        permissions: [],
        can: vi.fn().mockReturnValue(true),
        refresh: vi.fn(),
        signOut: vi.fn(),
      });

      render(<UserAccountMenu />);

      const button = screen.getByTestId("header-avatar-button");
      expect(button).toHaveAttribute("aria-haspopup", "menu");
      expect(button).toHaveClass("focus-visible:ring-2");
      expect(button).toHaveClass("focus-visible:ring-primary");
    });
  });
});
