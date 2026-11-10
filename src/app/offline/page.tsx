"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { WifiOff, RefreshCw, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UrPlacedLogo } from "@/components/ui/urplaced-logo";

export default function OfflineFallbackPage() {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setIsRetrying(true);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col items-center justify-center p-4 sm:p-6 font-body">
      <div className="w-full max-w-md space-y-6 text-center animate-in fade-in duration-300">
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-2">
          <UrPlacedLogo size="lg" priority />
          <span className="text-xs font-mono uppercase tracking-widest text-text-secondary mt-1">
            Progressive Web App
          </span>
        </div>

        {/* Offline Card */}
        <Card className="border-border bg-card shadow-sm p-2 sm:p-4 rounded-2xl">
          <CardContent className="pt-6 pb-4 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
              <WifiOff className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-xl sm:text-2xl font-bold font-heading text-text-primary">
                You&apos;re Currently Offline
              </h1>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                UrPlaced is displaying this offline shell. Your account, placement drives, mock
                interviews, and personalized career data require an active internet connection to load safely.
              </p>
            </div>

            {/* Status indicator */}
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border ${
                isOnline
                  ? "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? "bg-teal-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              <span>{isOnline ? "Connection Restored" : "No Internet Access"}</span>
            </div>

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="w-full sm:w-auto bg-primary hover:bg-primary-hover text-white text-xs gap-1.5 px-5 h-9"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
                <span>{isRetrying ? "Checking..." : "Retry Connection"}</span>
              </Button>

              <Link href="/" className="w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto text-xs gap-1.5 px-4 h-9 border-border hover:bg-hover-surface text-text-primary"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Go to Home</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Security and Privacy Notice */}
        <p className="text-[11px] text-text-muted leading-normal max-w-sm mx-auto">
          Student privacy is preserved: sensitive profiles, interview submissions, and institutional
          data are never stored in unverified device caches.
        </p>
      </div>
    </div>
  );
}
