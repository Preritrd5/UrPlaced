import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import OfflineFallbackPage from "@/app/offline/page";
import { NetworkStatusIndicator } from "@/components/pwa/network-status-indicator";
import { PWAUpdateBanner } from "@/components/pwa/pwa-update-banner";
import * as serviceWorkerHook from "@/hooks/use-service-worker";

describe("PWA — Offline Shell and Network Status Testing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Offline Fallback Shell Page", () => {
    it("should render branded offline shell with privacy guarantee and retry button", () => {
      const originalLocation = window.location;
      const reloadMock = vi.fn();

      Object.defineProperty(window, "location", {
        configurable: true,
        value: {
          ...originalLocation,
          reload: reloadMock,
        },
      });

      render(<OfflineFallbackPage />);

      expect(screen.getByText("You're Currently Offline")).toBeDefined();
      expect(screen.getByText(/Progressive Web App/i)).toBeDefined();
      expect(screen.getByText(/sensitive profiles, interview submissions, and institutional data are never stored/i)).toBeDefined();

      const retryBtn = screen.getByRole("button", { name: /retry/i });
      expect(retryBtn).toBeDefined();

      fireEvent.click(retryBtn);
      expect(reloadMock).toHaveBeenCalledTimes(1);

      Object.defineProperty(window, "location", {
        configurable: true,
        value: originalLocation,
      });
    });
  });

  describe("Network Status Indicator Component", () => {
    it("should render nothing when device is online and stable", () => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
      const { container } = render(<NetworkStatusIndicator />);
      expect(container.firstChild).toBeNull();
    });

    it("should display non-intrusive alert when offline event is triggered", () => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
      render(<NetworkStatusIndicator />);

      act(() => {
        window.dispatchEvent(new Event("offline"));
      });

      expect(screen.getByText("You are offline")).toBeDefined();
      expect(screen.getByText(/Live updates, drive submissions, and mock evaluations are paused/i)).toBeDefined();
    });

    it("should display reconnected pill when returning online", () => {
      vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      render(<NetworkStatusIndicator />);

      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      expect(screen.getByText("Back Online")).toBeDefined();
      expect(screen.getByText(/Network connectivity has been restored/i)).toBeDefined();
    });
  });

  describe("PWA Update Banner Component", () => {
    it("should render nothing when no update is available", () => {
      vi.spyOn(serviceWorkerHook, "useServiceWorker").mockReturnValue({
        isRegistered: true,
        isUpdateAvailable: false,
        updateApp: vi.fn(),
        registration: null,
      });

      const { container } = render(<PWAUpdateBanner />);
      expect(container.firstChild).toBeNull();
    });

    it("should render update banner and trigger updateApp when clicked", () => {
      const mockUpdateApp = vi.fn();
      vi.spyOn(serviceWorkerHook, "useServiceWorker").mockReturnValue({
        isRegistered: true,
        isUpdateAvailable: true,
        updateApp: mockUpdateApp,
        registration: null,
      });

      render(<PWAUpdateBanner />);

      expect(screen.getByText("UrPlaced Update Available")).toBeDefined();
      expect(screen.getByText(/A newer version of UrPlaced is ready/i)).toBeDefined();

      const updateBtn = screen.getByRole("button", { name: /update now/i });
      fireEvent.click(updateBtn);
      expect(mockUpdateApp).toHaveBeenCalledTimes(1);
    });
  });
});
