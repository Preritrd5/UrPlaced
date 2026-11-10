"use client";

import { useState, useEffect, useCallback } from "react";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  ["prompt"]: () => Promise<void>;
}

export interface UsePwaInstallReturn {
  isInstallable: boolean;
  isInstalled: boolean;
  isIos: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  hasNativePrompt: boolean;
  isStandalone: boolean;
  isDismissed: boolean;
  promptToInstall: () => Promise<boolean>;
  dismissPrompt: () => void;
  resetDismissal: () => void;
}

const DISMISSAL_STORAGE_KEY = "urplaced_pwa_install_dismissed_until";
const DISMISSAL_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours cool-down if explicitly dismissed

export function usePwaInstall(): UsePwaInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Detect Standalone / Installed mode
    const checkStandalone = () => {
      const isStandaloneMode =
        (typeof window.matchMedia === "function" &&
          (window.matchMedia("(display-mode: standalone)").matches ||
            window.matchMedia("(display-mode: fullscreen)").matches)) ||
        (window.navigator as any)?.standalone === true ||
        (typeof document !== "undefined" && document.referrer.includes("android-app://"));

      setIsStandalone(Boolean(isStandaloneMode));
      if (isStandaloneMode) {
        setIsInstalled(true);
      }
    };

    checkStandalone();
    const mediaQuery =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(display-mode: standalone)")
        : null;
    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsStandalone(e.matches);
      if (e.matches) setIsInstalled(true);
    };

    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener("change", handleMediaChange);
    }

    // 2. Detect Mobile / iOS / Android platforms
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroidDevice = /android/.test(ua);
    const isMobileDevice =
      isIosDevice ||
      isAndroidDevice ||
      /mobile|tablet|webos|blackberry|iemobile|opera mini/i.test(ua) ||
      window.innerWidth <= 768;

    setIsIos(isIosDevice);
    setIsAndroid(isAndroidDevice);
    setIsMobile(isMobileDevice);

    // 3. Check early captured beforeinstallprompt event from <head>
    if ((window as any).__deferredPrompt) {
      setDeferredPrompt((window as any).__deferredPrompt);
    }

    // 4. Check dismissal cool-down
    try {
      const dismissedUntil = localStorage.getItem(DISMISSAL_STORAGE_KEY);
      if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
        setIsDismissed(true);
      } else if (dismissedUntil) {
        localStorage.removeItem(DISMISSAL_STORAGE_KEY);
        setIsDismissed(false);
      }
    } catch {
      // Storage unavailable (e.g. private browsing)
    }

    // 5. Capture beforeinstallprompt (Chromium / Edge / Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).__deferredPrompt = e;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleCustomPrompt = () => {
      if ((window as any).__deferredPrompt) {
        setDeferredPrompt((window as any).__deferredPrompt as BeforeInstallPromptEvent);
      }
    };

    // 6. Capture appinstalled confirmation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).__deferredPrompt = null;
      try {
        localStorage.removeItem(DISMISSAL_STORAGE_KEY);
      } catch {}
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("urplaced:beforeinstallprompt", handleCustomPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener("change", handleMediaChange);
      }
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("urplaced:beforeinstallprompt", handleCustomPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const dismissPrompt = useCallback(() => {
    setIsDismissed(true);
    try {
      localStorage.setItem(
        DISMISSAL_STORAGE_KEY,
        String(Date.now() + DISMISSAL_DURATION_MS)
      );
    } catch {}
  }, []);

  const promptToInstall = useCallback(async (): Promise<boolean> => {
    const promptEvent = deferredPrompt || (typeof window !== "undefined" ? (window as any).__deferredPrompt : null);
    if (!promptEvent) {
      return false;
    }

    try {
      await promptEvent["prompt"]();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
        if (typeof window !== "undefined") {
          (window as any).__deferredPrompt = null;
        }
        return true;
      } else {
        // User dismissed native prompt
        dismissPrompt();
        return false;
      }
    } catch (err) {
      console.warn("[PWA Install] Native prompt error:", err);
      return false;
    }
  }, [deferredPrompt, dismissPrompt]);

  const resetDismissal = useCallback(() => {
    setIsDismissed(false);
    try {
      localStorage.removeItem(DISMISSAL_STORAGE_KEY);
    } catch {}
  }, []);

  // On mobile (Android or iOS), or whenever deferredPrompt is available, the app is installable
  const isInstallable = !isInstalled && !isStandalone && (Boolean(deferredPrompt) || isIos || isMobile);
  const hasNativePrompt = Boolean(deferredPrompt);

  return {
    isInstallable,
    isInstalled,
    isIos,
    isAndroid,
    isMobile,
    hasNativePrompt,
    isStandalone,
    isDismissed,
    promptToInstall,
    dismissPrompt,
    resetDismissal,
  };
}
