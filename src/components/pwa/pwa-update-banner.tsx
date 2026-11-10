"use client";

import React, { useState } from "react";
import { Sparkles, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServiceWorker } from "@/hooks/use-service-worker";

export function PWAUpdateBanner() {
  const { isUpdateAvailable, updateApp } = useServiceWorker();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  if (!isUpdateAvailable || isDismissed) {
    return null;
  }

  const handleUpdate = () => {
    setIsUpdating(true);
    updateApp();
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-4 right-4 z-50 max-w-sm w-full p-3.5 rounded-2xl bg-card border border-primary/30 shadow-xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <h4 className="text-xs font-bold font-heading text-text-primary">
              UrPlaced Update Available
            </h4>
            <p className="text-[11px] text-text-secondary leading-snug">
              A newer version of UrPlaced is ready. Update now to receive the latest improvements.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-hover-surface transition-colors shrink-0"
          aria-label="Dismiss update alert"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setIsDismissed(true)}
          className="h-7 text-xs text-text-secondary hover:text-text-primary px-2.5"
        >
          Later
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleUpdate}
          disabled={isUpdating}
          className="h-7 text-xs bg-primary hover:bg-primary-hover text-white gap-1 px-3 shadow-xs"
        >
          <RefreshCw className={`w-3 h-3 ${isUpdating ? "animate-spin" : ""}`} />
          <span>{isUpdating ? "Updating..." : "Update Now"}</span>
        </Button>
      </div>
    </div>
  );
}
