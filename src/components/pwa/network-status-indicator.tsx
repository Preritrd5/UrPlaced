"use client";

import React, { useState, useEffect } from "react";
import { Wifi, WifiOff, CheckCircle2, X } from "lucide-react";

export function NetworkStatusIndicator() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showReconnected, setShowReconnected] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initialize with real status
    setIsOnline(navigator.onLine);

    let reconnectTimer: NodeJS.Timeout;

    const handleOnline = () => {
      setIsOnline(true);
      setIsDismissed(false);
      setShowReconnected(true);
      reconnectTimer = setTimeout(() => {
        setShowReconnected(false);
      }, 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
      setIsDismissed(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  // When online and no reconnection message is active, render nothing
  if (isOnline && !showReconnected) {
    return null;
  }

  // Dismissed by user during offline session
  if (!isOnline && isDismissed) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 max-w-sm w-auto animate-in slide-in-from-bottom-3 duration-200"
    >
      {!isOnline ? (
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 shadow-md backdrop-blur-md text-xs font-medium">
          <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
          <div className="flex-1">
            <p className="font-semibold leading-tight">You are offline</p>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 leading-tight mt-0.5">
              Live updates, drive submissions, and mock evaluations are paused until reconnected.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1 rounded-md hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors"
            aria-label="Dismiss offline alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : showReconnected ? (
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-teal-500/15 border border-teal-500/30 text-teal-900 dark:text-teal-200 shadow-md backdrop-blur-md text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold">Back Online</span>
            <span className="text-[11px] text-teal-800/80 dark:text-teal-300/80 ml-1.5">
              Network connectivity has been restored.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowReconnected(false)}
            className="p-1 rounded-md hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 transition-colors"
            aria-label="Dismiss reconnected alert"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
