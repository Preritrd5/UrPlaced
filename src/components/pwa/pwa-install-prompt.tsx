"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Download, Share, PlusSquare, X, Check, Laptop, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { UrPlacedLogo } from "@/components/ui/urplaced-logo";
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
    isDismissed,
    promptToInstall,
    dismissPrompt,
  } = usePwaInstall();

  const [showIosModal, setShowIosModal] = useState(false);
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

    try {
      setIsInstalling(true);
      await promptToInstall();
    } finally {
      setIsInstalling(false);
    }
  };

  // 1. Explicit Button Variant (used in header, sidebar, or settings)
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

        {/* iOS Step-by-Step Instructions Modal */}
        <IosInstallModal isOpen={showIosModal} onClose={() => setShowIosModal(false)} />
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
                Launch instantly from your desktop or home screen.
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
      </>
    );
  }

  // 3. Floating Banner Variant (Bottom Right)
  return (
    <>
      <div
        role="region"
        aria-label="Install UrPlaced Application"
        className={`fixed bottom-4 right-4 z-40 max-w-sm w-full p-4 rounded-2xl bg-card border border-border shadow-lg backdrop-blur-md animate-in slide-in-from-bottom-4 duration-300 ${className}`}
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
                Fast desktop shortcuts, standalone window, and instant access to campus placement drives.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissPrompt}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-hover-surface transition-colors shrink-0"
            aria-label="Dismiss installation banner"
            title="Dismiss for 7 days"
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

      <IosInstallModal isOpen={showIosModal} onClose={() => setShowIosModal(false)} />
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
                Located in the browser navigation bar at the bottom of your screen.
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
                Tap the icon featuring a square with a plus sign.
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
                UrPlaced will appear on your home screen with its official brand icon.
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
