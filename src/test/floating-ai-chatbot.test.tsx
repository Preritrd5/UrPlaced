import * as React from "react";
import fs from "fs";
import path from "path";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FloatingAIChatbot } from "@/components/ai/floating-ai-chatbot";
import * as AuthContextModule from "@/lib/auth/auth-context-provider";

// Polyfill pointer methods for jsdom
beforeEach(() => {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

let mockCurrentPath = "/dashboard/student";

vi.mock("next/navigation", () => ({
  usePathname: () => mockCurrentPath,
}));

describe("UrPlaced Floating AI Chatbot Suite", () => {
  const mockAuthContextValue = {
    isAuthenticated: true,
    isLoading: false,
    userId: "test-student-uid-1",
    email: "student@college.edu",
    fullName: "Alex Student",
    role: "STUDENT" as const,
    accountCategory: "STUDENT" as const,
    isPlatformAdmin: false,
    isVerifiedMembership: true,
    tenant: null,
    availableTenants: [],
    permissions: ["ai.study_tutor.use"],
    refreshAuth: vi.fn(),
  };

  beforeEach(() => {
    vi.spyOn(AuthContextModule, "useAuthContext").mockReturnValue(mockAuthContextValue as any);
  });

  describe("1. Visual Asset Verification", () => {
    it("confirms the exact approved chatbot icon exists in public/assets directory", () => {
      const assetPath = path.join(process.cwd(), "public", "assets", "urplaced-ai-chatbot.png");
      expect(fs.existsSync(assetPath)).toBe(true);

      const stats = fs.statSync(assetPath);
      expect(stats.size).toBeGreaterThan(1000); // 93,878 bytes
    });
  });

  describe("2. Launcher Button Rendering & Accessibility", () => {
    it("renders floating launcher button with approved image and accessible label", () => {
      render(<FloatingAIChatbot />);

      const button = screen.getByRole("button", { name: /Open UrPlaced AI Assistant/i });
      expect(button).toBeDefined();

      const image = screen.getByAltText("UrPlaced AI Assistant");
      expect(image).toBeDefined();
      expect(image.getAttribute("src")).toContain("urplaced-ai-chatbot.png");
    });
  });

  describe("3. Panel Toggle, Minimize, and Close Actions", () => {
    it("opens expanded chat panel when launcher is clicked", () => {
      render(<FloatingAIChatbot />);

      const launcher = screen.getByRole("button", { name: /Open UrPlaced AI Assistant/i });
      fireEvent.click(launcher);

      expect(screen.getAllByText("UrPlaced AI").length).toBeGreaterThan(0);
      expect(screen.getByText(/Your placement & learning assistant/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/Ask UrPlaced AI anything/i)).toBeDefined();
    });

    it("minimizes and maximizes chat panel when minimize button is clicked", () => {
      render(<FloatingAIChatbot />);

      const launcher = screen.getByRole("button", { name: /Open UrPlaced AI Assistant/i });
      fireEvent.click(launcher);

      const minimizeBtn = screen.getByLabelText("Minimize Chat");
      fireEvent.click(minimizeBtn);

      // Composer should be hidden when minimized
      expect(screen.queryByPlaceholderText(/Ask UrPlaced AI anything/i)).toBeNull();

      // Click to maximize
      const maximizeBtn = screen.getByLabelText("Maximize Chat");
      fireEvent.click(maximizeBtn);

      expect(screen.getByPlaceholderText(/Ask UrPlaced AI anything/i)).toBeDefined();
    });

    it("closes chat panel when close button is clicked", () => {
      render(<FloatingAIChatbot />);

      const launcher = screen.getByRole("button", { name: /Open UrPlaced AI Assistant/i });
      fireEvent.click(launcher);

      const closeBtn = screen.getByLabelText("Close Chatbot");
      fireEvent.click(closeBtn);

      expect(screen.queryByText("UrPlaced AI")).toBeNull();
    });
  });

  describe("4. Draggable Positioning & Viewport Clamping", () => {
    it("distinguishes drag from click when movement exceeds threshold (>6px)", () => {
      render(<FloatingAIChatbot />);

      const launcher = screen.getByRole("button", { name: /Open UrPlaced AI Assistant/i });

      // Start drag at (100, 100) and move to (200, 250)
      fireEvent.pointerDown(launcher, { clientX: 100, clientY: 100, button: 0, bubbles: true });
      fireEvent.pointerMove(window, { clientX: 200, clientY: 250, bubbles: true });
      fireEvent.pointerUp(window, { clientX: 200, clientY: 250, bubbles: true });

      // Panel should NOT have opened because it was a drag operation
      expect(screen.queryByText("UrPlaced AI")).toBeNull();

      // Position should be saved in localStorage
      const savedPos = localStorage.getItem("urplaced_chatbot_position");
      expect(savedPos).not.toBeNull();
    });

    it("resets position when 'Reset Launcher Position' menu option is clicked", () => {
      localStorage.setItem("urplaced_chatbot_position", JSON.stringify({ x: 50, y: 50 }));

      render(<FloatingAIChatbot />);

      const launcher = screen.getByRole("button", { name: /Open UrPlaced AI Assistant/i });
      fireEvent.click(launcher);

      // Open menu
      const menuBtn = screen.getByLabelText("Chatbot Options");
      fireEvent.click(menuBtn);

      const resetBtn = screen.getByText("Reset Launcher Position");
      fireEvent.click(resetBtn);

      // localStorage position should be cleared
      expect(localStorage.getItem("urplaced_chatbot_position")).toBeNull();
    });
  });

  describe("5. Backend AI Integration & Message Flow", () => {
    it("submits user message to /api/ai/tutor/chat and displays Gemini response", async () => {
      const mockApiResponse = {
        conversationId: "conv-123",
        response: "Binary Search operates by halving the search space each step, achieving O(log N) time complexity.",
        mode: "EXPLAIN",
        suggestedFollowUps: ["How to handle duplicates in binary search?"],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      } as any);

      render(<FloatingAIChatbot />);

      const launcher = screen.getByRole("button", { name: /Open UrPlaced AI Assistant/i });
      fireEvent.click(launcher);

      const input = screen.getByPlaceholderText(/Ask UrPlaced AI anything/i);
      fireEvent.change(input, { target: { value: "Explain binary search complexity" } });

      const sendBtn = screen.getByLabelText("Send message");
      fireEvent.click(sendBtn);

      await waitFor(() => {
        expect(screen.getByText(/Binary Search operates by halving/i)).toBeDefined();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "/api/ai/tutor/chat",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Explain binary search complexity"),
        })
      );
    });

    it("displays error message with retry option when request fails", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "AI service temporarily unavailable." }),
      } as any);

      render(<FloatingAIChatbot />);

      const launcher = screen.getByRole("button", { name: /Open UrPlaced AI Assistant/i });
      fireEvent.click(launcher);

      const input = screen.getByPlaceholderText(/Ask UrPlaced AI anything/i);
      fireEvent.change(input, { target: { value: "Trigger error test" } });

      const sendBtn = screen.getByLabelText("Send message");
      fireEvent.click(sendBtn);

      await waitFor(() => {
        expect(screen.getAllByText(/AI service temporarily unavailable/i).length).toBeGreaterThan(0);
        expect(screen.getByText("Retry")).toBeDefined();
      });
    });
  });
});
