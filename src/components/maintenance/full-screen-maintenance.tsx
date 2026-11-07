"use client";

import * as React from "react";
import Image from "next/image";
import { Wrench, RefreshCw, LogOut, Radio, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FullScreenMaintenanceProps {
  announcement?: string;
  scheduledEnd?: string | null;
  onRefresh?: () => void;
  onSignOut?: () => void;
}

export function FullScreenMaintenance({
  announcement,
  scheduledEnd,
  onRefresh,
  onSignOut,
}: FullScreenMaintenanceProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        onRefresh();
      } else {
        window.location.reload();
      }
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  };

  const handleSignOut = () => {
    if (onSignOut) {
      onSignOut();
    } else {
      window.location.href = "/auth/signin";
    }
  };

  const dynamicMessage =
    announcement && announcement.trim().length > 0
      ? announcement
      : "UrPlaced is performing scheduled platform maintenance and system upgrades. Services will resume shortly.";

  return (
    <div className="min-h-screen w-full bg-background text-text-primary flex flex-col justify-between items-center p-4 sm:p-6 lg:p-10 select-none relative overflow-y-auto">
      {/* Background Decorative Gradient Orbs */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 sm:w-[500px] h-96 sm:h-[500px] rounded-full pointer-events-none opacity-20 blur-3xl -z-10"
        style={{
          background: "radial-gradient(circle, #7779D8 0%, rgba(80, 82, 201, 0) 70%)",
        }}
      />

      {/* Top Header / Branding */}
      <header className="w-full max-w-4xl flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-lg shadow-xs">
            UP
          </div>
          <span className="font-heading font-bold text-xl text-text-primary tracking-tight">
            UrPlaced
          </span>
        </div>

        {/* Status Indicator Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-mono font-medium shadow-xs">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
          <span>MAINTENANCE MODE</span>
        </div>
      </header>

      {/* Center Maintenance Card */}
      <main className="w-full max-w-xl my-auto py-8">
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-10 shadow-card text-center space-y-6">
          {/* Prominent Maintenance Icon Badge */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-br from-primary/15 via-[#7779D8]/10 to-secondary/15 border border-primary/25 flex items-center justify-center text-primary mx-auto shadow-xs">
            <Wrench className="w-10 h-10 sm:w-12 sm:h-12 text-primary stroke-[1.75] animate-pulse" />
          </div>

          {/* Heading & Subtitle */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-heading text-text-primary tracking-tight">
              We&apos;re Under Maintenance
            </h1>
            <p className="text-sm sm:text-base text-text-secondary leading-relaxed max-w-md mx-auto">
              UrPlaced is temporarily unavailable while scheduled maintenance is in progress.
            </p>
          </div>

          {/* Dynamic Maintenance Announcement Callout */}
          <div className="bg-background border border-border rounded-xl p-4 sm:p-5 text-left space-y-2 shadow-xs">
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-secondary font-semibold">
              <Radio className="w-3.5 h-3.5 text-secondary shrink-0 animate-pulse" />
              <span>Platform Administration Broadcast</span>
            </div>
            <p className="text-sm sm:text-base font-medium text-text-primary leading-relaxed whitespace-pre-wrap">
              {dynamicMessage}
            </p>
            {scheduledEnd && (
              <div className="text-[11px] font-mono text-text-secondary pt-1 border-t border-border/50">
                Estimated Service Restoration:{" "}
                <span className="font-semibold text-text-primary">
                  {new Date(scheduledEnd).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Reassurance Message */}
          <p className="text-xs sm:text-sm text-text-secondary">
            Thank you for your patience. Please check back later.
          </p>

          {/* Interactive Action Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full sm:w-auto bg-primary hover:bg-[var(--color-primary-hover)] text-white font-medium px-6 h-10 shadow-xs flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Checking..." : "Refresh Status"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              className="w-full sm:w-auto border-border hover:bg-background text-text-secondary font-medium px-5 h-10 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="w-full max-w-4xl py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-text-secondary font-mono">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-secondary shrink-0" />
          <span>UrPlaced Platform Infrastructure</span>
        </div>
        <span>Control Plane Protected &bull; HTTP 503 Enforced</span>
      </footer>
    </div>
  );
}
