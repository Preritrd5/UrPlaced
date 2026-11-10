"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Download, Share, PlusSquare, X, Check, Laptop, Smartphone, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { usePwaInstall } from "@/hooks/use-pwa-install";

export interface PWAInstallPromptProps {
  variant?: "banner" | "button" | "inline";
  className?: string;
}

export function PWAInstallPrompt({ variant = "banner", className = "" }: PWAInstallPromptProps) {
  const {
    isInstallable,
    isInstalled,
    isIos,
    isAndroid,
    isMobile,
    hasNativePrompt,
    isDismissed,
    promptToInstall,
    dismissPrompt,
  } = usePwaInstall();

  const [showIosModal, setShowIosModal] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [showDesktopModal, setShowDesktopModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already installed or explicitly dismissed, do not display banner
  if (isInstalled || (variant === "banner" && isDismissed) || !isInstallable) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosModal(true);
      return;
    }

    if (hasNativePrompt) {
      try {
        setIsInstalling(true);
        const accepted = await promptToInstall();
        if (!accepted && isMobile) {
          setShowMobileModal(true);
        }
      } catch {
        if (isMobile) {
          setShowMobileModal(true);
        }
      } finally {
        setIsInstalling(false);
      }
      return;
    }

    // When on mobile without native beforeinstallprompt (e.g. Android Firefox, Samsung Internet, Mi Browser)
    if (isMobile || isAndroid) {
      setShowMobileModal(true);
      return;
    }

    // Desktop browser without prompt
    setShowDesktopModal(true);
  };

  // 1. Explicit Button Variant (used in desktop header, mobile top bar, sidebar)
  if (variant === "button") {
    return (
      <>
        <Button
          type="button"
          onClick={handleInstallClick}
          variant="outline"
          size="sm"
          className={`h-8 text-xs gap-1.5 border-border hover:border-primary/50 text-text-primary ${className}`}
          title="Install UrPlaced App"
          aria-label="Install UrPlaced App"
        >
          <Download className="w-3.5 h-3.5 text-primary" />
          <span>Install App</span>
        </Button>

        {/* Platform Guidance Modals */}
        <IosInstallModal isOpen={showIosModal} onClose={() => setShowIosModal(false)} />
        <MobileInstallModal isOpen={showMobileModal} onClose={() => setShowMobileModal(false)} />
        <DesktopInstallModal isOpen={showDesktopModal} onClose={() => setShowDesktopModal(false)} />
      </>
    );
  }

  // 2. Inline Card Variant
  if (variant === "inline") {
    return (
      <>
        <div
          className={`p-4 rounded-xl border border-border bg-card shadow-xs flex items-center justify-between gap-4 ${className}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Download className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold font-heading text-text-primary truncate">
                Install UrPlaced
              </h4>
              <p className="text-xs text-text-secondary truncate">
                Launch instantly from your home screen or desktop.
              </p>
            </div>
          </div>
          <Button
            type="button"
            onClick={handleInstallClick}
            disabled={isInstalling}
            size="sm"
            className="bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </Button>
        </div>

        <IosInstallModal isOpen={showIosModal} onClose={() => setShowIosModal(false)} />
        <MobileInstallModal isOpen={showMobileModal} onClose={() => setShowMobileModal(false)} />
        <DesktopInstallModal isOpen={showDesktopModal} onClose={() => setShowDesktopModal(false)} />
      </>
    );
  }

  // 3. Floating Popup Banner Variant (Prominently displayed across Mobile & Desktop)
  return (
    <>
      <div
        role="region"
        aria-label="Install UrPlaced Application"
        className={`fixed bottom-3 inset-x-3 sm:inset-x-auto sm:right-4 sm:bottom-4 z-[9999] sm:max-w-sm p-4 rounded-2xl bg-card border border-border shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300 pwa-safe-bottom ${className}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
              <Image
                src="/icons/icon-192x192.png"
                alt="UrPlaced"
                width={28}
                height={28}
                className="w-7 h-7 object-contain"
              />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-bold font-heading text-text-primary">
                  Install UrPlaced App
                </h4>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30 rounded-md">
                  PWA
                </span>
              </div>
              <p className="text-xs text-text-secondary leading-snug">
                {isMobile
                  ? "Add UrPlaced to your home screen for quick placement practice, offline shell, and mock interviews."
                  : "Fast desktop shortcuts, standalone window, and instant access to campus placement drives."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissPrompt}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-hover-surface transition-colors shrink-0"
            aria-label="Dismiss installation banner"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3.5 pt-3 border-t border-border/50 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={dismissPrompt}
            className="h-8 text-xs text-text-secondary hover:text-text-primary px-3"
          >
            Not Now
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleInstallClick}
            disabled={isInstalling}
            className="h-8 text-xs bg-primary hover:bg-primary-hover text-white gap-1.5 px-3.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isIos ? "Instructions" : isInstalling ? "Installing..." : "Install Now"}</span>
          </Button>
        </div>
      </div>

      {/* Platform Instructions Modals */}
      <IosInstallModal isOpen={showIosModal} onClose={() => setShowIosModal(false)} />
      <MobileInstallModal isOpen={showMobileModal} onClose={() => setShowMobileModal(false)} />
      <DesktopInstallModal isOpen={showDesktopModal} onClose={() => setShowDesktopModal(false)} />
    </>
  );
}

/**
 * Branded iOS Safari Step-by-Step Installation Modal
 */
function IosInstallModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border text-text-primary p-6 rounded-2xl shadow-xl">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-primary" />
            </div>
            <DialogTitle className="text-base font-bold font-heading text-text-primary">
              Install UrPlaced on iOS
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-text-secondary leading-relaxed">
            Safari on iPhone and iPad lets you add UrPlaced to your home screen as a standalone application:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 my-2">
          {/* Step 1 */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/50 border border-border/60 text-xs">
            <div className="w-6 h-6 rounded-full bg-primary/15 text-primary font-mono font-bold flex items-center justify-center shrink-0 text-xs">
              1
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-text-primary flex items-center gap-1.5">
                <span>Tap the Share button in Safari</span>
                <Share className="w-3.5 h-3.5 text-primary inline" />
              </p>
              <p className="text-text-secondary text-[11px]">
                Located in the browser toolbar at the bottom of your screen.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/50 border border-border/60 text-xs">
            <div className="w-6 h-6 rounded-full bg-primary/15 text-primary font-mono font-bold flex items-center justify-center shrink-0 text-xs">
              2
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-text-primary flex items-center gap-1.5">
                <span>Scroll down and select &ldquo;Add to Home Screen&rdquo;</span>
                <PlusSquare className="w-3.5 h-3.5 text-teal-600 inline" />
              </p>
              <p className="text-text-secondary text-[11px]">
                Tap the option with the square plus icon.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/50 border border-border/60 text-xs">
            <div className="w-6 h-6 rounded-full bg-primary/15 text-primary font-mono font-bold flex items-center justify-center shrink-0 text-xs">
              3
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-text-primary flex items-center gap-1.5">
                <span>Tap &ldquo;Add&rdquo; in the top-right corner</span>
                <Check className="w-3.5 h-3.5 text-primary inline" />
              </p>
              <p className="text-text-secondary text-[11px]">
                UrPlaced will appear on your home screen with its official icon.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={onClose}
            className="bg-primary hover:bg-primary-hover text-white text-xs px-5 h-8"
          >
            Got It
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Branded Android / General Mobile Installation Guide Modal
 */
function MobileInstallModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border text-text-primary p-6 rounded-2xl shadow-xl">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-primary" />
            </div>
            <DialogTitle className="text-base font-bold font-heading text-text-primary">
              Install UrPlaced on Android / Mobile
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-text-secondary leading-relaxed">
            Follow these quick steps to install UrPlaced as a native app on your home screen:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 my-2">
          {/* Step 1 */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/50 border border-border/60 text-xs">
            <div className="w-6 h-6 rounded-full bg-primary/15 text-primary font-mono font-bold flex items-center justify-center shrink-0 text-xs">
              1
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-text-primary flex items-center gap-1.5">
                <span>Tap the browser menu</span>
                <MoreVertical className="w-3.5 h-3.5 text-primary inline" />
              </p>
              <p className="text-text-secondary text-[11px]">
                Tap the three dots (⋮) in the top-right corner of Chrome, Edge, or Samsung Internet.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/50 border border-border/60 text-xs">
            <div className="w-6 h-6 rounded-full bg-primary/15 text-primary font-mono font-bold flex items-center justify-center shrink-0 text-xs">
              2
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-text-primary flex items-center gap-1.5">
                <span>Select &ldquo;Install app&rdquo; or &ldquo;Add to Home screen&rdquo;</span>
                <Download className="w-3.5 h-3.5 text-teal-600 inline" />
              </p>
              <p className="text-text-secondary text-[11px]">
                Choose the install option from the browser menu dropdown.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/50 border border-border/60 text-xs">
            <div className="w-6 h-6 rounded-full bg-primary/15 text-primary font-mono font-bold flex items-center justify-center shrink-0 text-xs">
              3
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-text-primary flex items-center gap-1.5">
                <span>Tap &ldquo;Install&rdquo; to confirm</span>
                <Check className="w-3.5 h-3.5 text-primary inline" />
              </p>
              <p className="text-text-secondary text-[11px]">
                UrPlaced will install directly to your device app drawer and home screen.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={onClose}
            className="bg-primary hover:bg-primary-hover text-white text-xs px-5 h-8"
          >
            Got It
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Desktop Installation Guide Modal
 */
function DesktopInstallModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-card border-border text-text-primary p-6 rounded-2xl shadow-xl">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Laptop className="w-4 h-4 text-primary" />
            </div>
            <DialogTitle className="text-base font-bold font-heading text-text-primary">
              Install UrPlaced on Desktop
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-text-secondary leading-relaxed">
            Install UrPlaced for a dedicated window and fast desktop launching:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 my-2">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/50 border border-border/60 text-xs">
            <div className="w-6 h-6 rounded-full bg-primary/15 text-primary font-mono font-bold flex items-center justify-center shrink-0 text-xs">
              1
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-text-primary">
                Look at your browser&apos;s address bar
              </p>
              <p className="text-text-secondary text-[11px]">
                Click the Install icon (computer screen with a down arrow or &ldquo;+&rdquo;) on the right side of the URL bar.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-surface/50 border border-border/60 text-xs">
            <div className="w-6 h-6 rounded-full bg-primary/15 text-primary font-mono font-bold flex items-center justify-center shrink-0 text-xs">
              2
            </div>
            <div className="space-y-0.5">
              <p className="font-semibold text-text-primary">
                Click &ldquo;Install&rdquo; in the confirmation prompt
              </p>
              <p className="text-text-secondary text-[11px]">
                UrPlaced will open in its own clean, standalone application window.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={onClose}
            className="bg-primary hover:bg-primary-hover text-white text-xs px-5 h-8"
          >
            Got It
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
