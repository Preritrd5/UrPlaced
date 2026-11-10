import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { PWAInstallPrompt } from "@/components/pwa/pwa-install-prompt";

// Helper component to test usePwaInstall hook directly
function TestPwaInstallConsumer({ onRender }: { onRender: (state: ReturnType<typeof usePwaInstall>) => void }) {
  const pwa = usePwaInstall();
  React.useEffect(() => {
    onRender(pwa);
  });
  return (
    <div>
      <span data-testid="is-installable">{String(pwa.isInstallable)}</span>
      <span data-testid="is-installed">{String(pwa.isInstalled)}</span>
      <span data-testid="is-ios">{String(pwa.isIos)}</span>
      <span data-testid="is-mobile">{String(pwa.isMobile)}</span>
      <span data-testid="is-dismissed">{String(pwa.isDismissed)}</span>
      <button data-testid="btn-prompt" onClick={() => pwa.promptToInstall()}>
        Prompt
      </button>
      <button data-testid="btn-dismiss" onClick={() => pwa.dismissPrompt()}>
        Dismiss
      </button>
    </div>
  );
}

describe("PWA — Installation Experience and Lifecycle Tests", () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as any).__deferredPrompt;
    vi.restoreAllMocks();

    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    localStorage.clear();
    delete (window as any).__deferredPrompt;
  });

  it("should initialize with default uninstalled states when on desktop with no prompt", () => {
    let capturedState: any;
    render(<TestPwaInstallConsumer onRender={(state) => (capturedState = state)} />);

    expect(capturedState.isInstalled).toBe(false);
    expect(capturedState.isInstallable).toBe(false);
    expect(capturedState.isDismissed).toBe(false);
  });

  it("should detect mobile devices (Android) and ensure isInstallable=true even before native prompt fires", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    );

    let capturedState: any;
    render(<TestPwaInstallConsumer onRender={(state) => (capturedState = state)} />);

    expect(capturedState.isMobile).toBe(true);
    expect(capturedState.isAndroid).toBe(true);
    expect(capturedState.isInstallable).toBe(true);
  });

  it("should capture beforeinstallprompt event, set isInstallable=true, and allow promptToInstall()", async () => {
    let capturedState: any;
    render(<TestPwaInstallConsumer onRender={(state) => (capturedState = state)} />);

    const mockPrompt = vi.fn().mockResolvedValue(undefined);
    const mockUserChoice = Promise.resolve({ outcome: "accepted", platform: "web" });

    const beforeInstallEvent = new Event("beforeinstallprompt") as any;
    beforeInstallEvent["prompt"] = mockPrompt;
    beforeInstallEvent.userChoice = mockUserChoice;
    beforeInstallEvent.preventDefault = vi.fn();

    act(() => {
      window.dispatchEvent(beforeInstallEvent);
    });

    expect(screen.getByTestId("is-installable").textContent).toBe("true");

    await act(async () => {
      const outcome = await capturedState.promptToInstall();
      expect(outcome).toBe(true);
    });

    expect(mockPrompt).toHaveBeenCalledTimes(1);
  });

  it("should detect appinstalled event and set isInstalled=true", () => {
    render(<TestPwaInstallConsumer onRender={() => {}} />);

    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });

    expect(screen.getByTestId("is-installed").textContent).toBe("true");
    expect(screen.getByTestId("is-installable").textContent).toBe("false");
  });

  it("should persist dismiss state in localStorage with 24-hour cooldown", () => {
    let capturedState: any;
    render(<TestPwaInstallConsumer onRender={(state) => (capturedState = state)} />);

    act(() => {
      capturedState.dismissPrompt();
    });

    expect(screen.getByTestId("is-dismissed").textContent).toBe("true");
    const stored = localStorage.getItem("urplaced_pwa_install_dismissed_until");
    expect(stored).not.toBeNull();
    const expiry = Number(stored);
    expect(expiry).toBeGreaterThan(Date.now() + 23 * 60 * 60 * 1000);
  });

  it("should render PWAInstallPrompt button variant when installable", () => {
    // Dispatch beforeinstallprompt to make installable
    const beforeInstallEvent = new Event("beforeinstallprompt") as any;
    beforeInstallEvent["prompt"] = vi.fn().mockResolvedValue(undefined);
    beforeInstallEvent.userChoice = Promise.resolve({ outcome: "accepted" });
    beforeInstallEvent.preventDefault = vi.fn();

    const { rerender } = render(<PWAInstallPrompt variant="button" />);
    // Initially not installable on desktop
    expect(screen.queryByText("Install App")).toBeNull();

    act(() => {
      window.dispatchEvent(beforeInstallEvent);
    });
    rerender(<PWAInstallPrompt variant="button" />);

    expect(screen.getByText("Install App")).toBeDefined();
  });

  it("should render PWAInstallPrompt banner variant with dismissal button", () => {
    const beforeInstallEvent = new Event("beforeinstallprompt") as any;
    beforeInstallEvent["prompt"] = vi.fn().mockResolvedValue(undefined);
    beforeInstallEvent.userChoice = Promise.resolve({ outcome: "dismissed" });
    beforeInstallEvent.preventDefault = vi.fn();

    const { rerender } = render(<PWAInstallPrompt variant="banner" />);

    act(() => {
      window.dispatchEvent(beforeInstallEvent);
    });
    rerender(<PWAInstallPrompt variant="banner" />);

    expect(screen.getByText("Install UrPlaced App")).toBeDefined();
    expect(screen.getByText("Install Now")).toBeDefined();

    // Click dismiss button
    const closeBtn = screen.getByLabelText("Dismiss installation banner");
    fireEvent.click(closeBtn);

    // After dismissal, banner should no longer be visible
    rerender(<PWAInstallPrompt variant="banner" />);
    expect(screen.queryByText("Install UrPlaced App")).toBeNull();
  });

  it("should render mobile installation popup banner and open guide modal on click", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    );

    render(<PWAInstallPrompt variant="banner" />);
    expect(screen.getByText("Install UrPlaced App")).toBeDefined();
    expect(screen.getByText(/Add UrPlaced to your home screen/i)).toBeDefined();

    const installBtn = screen.getByRole("button", { name: /install now/i });
    fireEvent.click(installBtn);

    // Guide modal appears explaining 3 steps
    expect(screen.getByText("Install UrPlaced on Android / Mobile")).toBeDefined();
    expect(screen.getByText(/Tap the browser menu/i)).toBeDefined();
  });
});
