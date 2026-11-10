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
  isStandalone: boolean;
  isDismissed: boolean;
  promptToInstall: () => Promise<boolean>;
  dismissPrompt: () => void;
  resetDismissal: () => void;
}

const DISMISSAL_STORAGE_KEY = "urplaced_pwa_install_dismissed_until";
const DISMISSAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function usePwaInstall(): UsePwaInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);
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

    // 2. Detect iOS / iPadOS Safari (which does not support beforeinstallprompt)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIos(isIosDevice);

    // 3. Check dismissal cool-down
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

    // 4. Capture beforeinstallprompt (Chromium / Edge / Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 5. Capture appinstalled confirmation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      try {
        localStorage.removeItem(DISMISSAL_STORAGE_KEY);
      } catch {}
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener("change", handleMediaChange);
      }
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
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
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt["prompt"]();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
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

  const isInstallable = !isInstalled && !isStandalone && (Boolean(deferredPrompt) || isIos);

  return {
    isInstallable,
    isInstalled,
    isIos,
    isStandalone,
    isDismissed,
    promptToInstall,
    dismissPrompt,
    resetDismissal,
  };
}
