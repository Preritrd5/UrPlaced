import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase Client
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: { access_token: "mock-token" }, user: { id: "u-1" } },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }),
}));

import StudentSignUpPage from "@/app/auth/signup/page";
import StudentSignInPage from "@/app/auth/signin/page";
import CollegeSignUpPage from "@/app/auth/college/signup/page";
import CollegeSignInPage from "@/app/auth/college/signin/page";

const VIEWPORTS = [
  { name: "Large Desktop", width: 1440, height: 900 },
  { name: "Standard Laptop", width: 1366, height: 768 },
  { name: "Short Viewport / Small Laptop", width: 1024, height: 600 },
  { name: "Tablet Portrait", width: 768, height: 1024 },
  { name: "Modern Mobile", width: 390, height: 844 },
  { name: "Constrained Mobile", width: 360, height: 640 },
];

describe("UrPlaced Complete Authentication UI Redesign & Viewport Invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // 1. Student Sign Up Page Verification
  // ============================================================================
  describe("1. Student Sign Up Route (/auth/signup)", () => {
    it("renders all required fields, primary CTA, and promotional branding without card nesting", () => {
      const { container } = render(<StudentSignUpPage />);

      // Verify no outer boxed card container wrapper
      expect(container.querySelector(".rounded-3xl.shadow-2xl")).toBeNull();

      // Top navigation & brand
      expect(screen.getByRole("link", { name: /^Back to Home$/i })).toBeInTheDocument();
      expect(screen.getAllByText("UrPlaced").length).toBeGreaterThanOrEqual(1);

      // Heading & subtitle
      expect(screen.getByRole("heading", { name: "Create Student Account" })).toBeInTheDocument();
      expect(
        screen.getByText(/Enter your official SRN, name, email address, and create your portal password/i)
      ).toBeInTheDocument();

      // Form controls
      expect(screen.getByLabelText(/Student Registration Number \(SRN\)/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Create Login Password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Retype Login Password/i)).toBeInTheDocument();

      // Primary submit button & footer navigation
      expect(
        screen.getByRole("button", { name: /Create Student Account \(Sign Up\)/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/Already have a student account\?/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Sign In →/i })).toBeInTheDocument();

      // Desktop promotional right-panel text
      expect(screen.getByText("Your next")).toBeInTheDocument();
      expect(screen.getByText("chapter")).toBeInTheDocument();
      expect(screen.getByText("starts here.")).toBeInTheDocument();
      expect(
        screen.getByText(/Build skills, practice smarter, and get placement ready with UrPlaced/i)
      ).toBeInTheDocument();
    });

    it("verifies password show/hide controls toggle password visibility on both fields", () => {
      render(<StudentSignUpPage />);

      const pwdInput = screen.getByLabelText(/Create Login Password/i) as HTMLInputElement;
      const confirmPwdInput = screen.getByLabelText(/Retype Login Password/i) as HTMLInputElement;

      expect(pwdInput.type).toBe("password");
      expect(confirmPwdInput.type).toBe("password");

      const toggleButtons = screen.getAllByRole("button", { name: /show password/i });
      expect(toggleButtons.length).toBe(2);

      // Toggle first password field
      fireEvent.click(toggleButtons[0]);
      expect(pwdInput.type).toBe("text");
      expect(confirmPwdInput.type).toBe("password");

      // Toggle confirm password field
      fireEvent.click(toggleButtons[1]);
      expect(pwdInput.type).toBe("text");
      expect(confirmPwdInput.type).toBe("text");
    });
  });

  // ============================================================================
  // 2. Student Sign In Page Verification
  // ============================================================================
  describe("2. Student Sign In Route (/auth/signin)", () => {
    it("renders required sign-in fields, forgot password, primary CTA, and secondary account creation card", () => {
      const { container } = render(<StudentSignInPage />);

      // Verify no outer boxed card container wrapper
      expect(container.querySelector(".rounded-3xl.shadow-2xl")).toBeNull();

      // Top navigation & brand
      expect(screen.getByRole("link", { name: /^Back to Home$/i })).toBeInTheDocument();
      expect(screen.getAllByText("UrPlaced").length).toBeGreaterThanOrEqual(1);

      // Heading & subtitle
      expect(screen.getByRole("heading", { name: "Student Sign In" })).toBeInTheDocument();
      expect(screen.getByText(/Enter your registered email address & password/i)).toBeInTheDocument();

      // Inputs
      expect(screen.getByLabelText(/Registered Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Forgot password\?/i })).toBeInTheDocument();

      // Actions
      expect(
        screen.getByRole("button", { name: /Sign In to Student Portal/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/New student\?/i)).toBeInTheDocument();
      expect(screen.getByText(/Create Account \(Sign Up\) →/i)).toBeInTheDocument();

      // Desktop promotional right-panel text
      expect(screen.getByText("Welcome")).toBeInTheDocument();
      expect(screen.getByText("Back!")).toBeInTheDocument();
      expect(
        screen.getByText(/Access your preparation, assessments, and placement journey with UrPlaced/i)
      ).toBeInTheDocument();
    });
  });

  // ============================================================================
  // 3. College / Cell Sign In Page Verification
  // ============================================================================
  describe("3. College / Cell Sign In Route (/auth/college/signin)", () => {
    it("renders institutional sign-in controls, role recovery, and signup link", () => {
      render(<CollegeSignInPage />);

      expect(screen.getByRole("link", { name: /^Back to Home$/i })).toBeInTheDocument();
      expect(screen.getAllByText("UrPlaced").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole("heading", { name: "Placement Cell Sign In" })).toBeInTheDocument();
      expect(
        screen.getByText(/Enter your authorized institutional email address & password/i)
      ).toBeInTheDocument();

      expect(screen.getByLabelText(/Institutional Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Forgot password\?/i })).toBeInTheDocument();

      expect(
        screen.getByRole("button", { name: /Sign In to Placement Portal/i })
      ).toBeInTheDocument();
      // SA-03: Invitation requirement notice replaces public self-registration
      expect(screen.getByText(/Invitation-Only Institutional Access/i)).toBeInTheDocument();
      expect(
        screen.getByText(/College placement accounts are registered by Platform Super Admin/i)
      ).toBeInTheDocument();

      expect(screen.getByText("Placement")).toBeInTheDocument();
      expect(screen.getByText("Cell Portal")).toBeInTheDocument();
    });
  });

  // ============================================================================
  // 4. College / Cell Sign Up Page Verification
  // ============================================================================
  describe("4. College / Cell Sign Up Route (/auth/college/signup)", () => {
    it("renders invitation requirement gate when accessed without a valid token", () => {
      render(<CollegeSignUpPage />);

      expect(screen.getByRole("link", { name: /^Back to Home$/i })).toBeInTheDocument();
      expect(screen.getAllByText("UrPlaced").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole("heading", { name: "Institutional Invitation Required" })).toBeInTheDocument();
      expect(screen.getByText(/An authorized institutional invitation is required to access college account setup/i)).toBeInTheDocument();
      expect(screen.getByText(/Only colleges registered by the Platform Super Admin can provision College Placement Cell accounts/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Return to College Sign In/i })).toBeInTheDocument();

      expect(screen.getByText("Partner With")).toBeInTheDocument();
      expect(screen.getAllByText("UrPlaced").length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================================
  // 5. Cross-Viewport Sizing & Layout Invariants Matrix
  // ============================================================================
  describe("5. Viewport Invariant Checks across All Required Dimensions", () => {
    for (const vp of VIEWPORTS) {
      it(`mounts Student Sign Up with locked 100dvh composition at ${vp.name} (${vp.width}x${vp.height})`, () => {
        window.innerWidth = vp.width;
        window.innerHeight = vp.height;

        const { container } = render(<StudentSignUpPage />);
        const main = container.querySelector("main");

        expect(main).not.toBeNull();
        expect(main?.className).toContain("h-[100dvh]");
        expect(main?.className).toContain("overflow-hidden");

        // Required controls remain accessible and present
        expect(screen.getByLabelText(/Student Registration Number \(SRN\)/i)).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /Create Student Account \(Sign Up\)/i })
        ).toBeInTheDocument();
      });

      it(`mounts Student Sign In with locked 100dvh composition at ${vp.name} (${vp.width}x${vp.height})`, () => {
        window.innerWidth = vp.width;
        window.innerHeight = vp.height;

        const { container } = render(<StudentSignInPage />);
        const main = container.querySelector("main");

        expect(main).not.toBeNull();
        expect(main?.className).toContain("h-[100dvh]");
        expect(main?.className).toContain("overflow-hidden");

        expect(screen.getByLabelText(/Registered Email Address/i)).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /Sign In to Student Portal/i })
        ).toBeInTheDocument();
      });

      it(`mounts College Sign In with locked 100dvh composition at ${vp.name} (${vp.width}x${vp.height})`, () => {
        window.innerWidth = vp.width;
        window.innerHeight = vp.height;

        const { container } = render(<CollegeSignInPage />);
        const main = container.querySelector("main");

        expect(main).not.toBeNull();
        expect(main?.className).toContain("h-[100dvh]");
        expect(main?.className).toContain("overflow-hidden");

        expect(screen.getByLabelText(/Institutional Email Address/i)).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /Sign In to Placement Portal/i })
        ).toBeInTheDocument();
      });

      it(`mounts College Sign Up with locked 100dvh composition at ${vp.name} (${vp.width}x${vp.height})`, () => {
        window.innerWidth = vp.width;
        window.innerHeight = vp.height;

        const { container } = render(<CollegeSignUpPage />);
        const main = container.querySelector("main");

        expect(main).not.toBeNull();
        expect(main?.className).toContain("h-[100dvh]");
        expect(main?.className).toContain("overflow-hidden");

        expect(screen.getByRole("heading", { name: "Institutional Invitation Required" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /Return to College Sign In/i })).toBeInTheDocument();
      });
    }
  });
});
