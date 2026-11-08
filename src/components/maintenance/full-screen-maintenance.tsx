"use client";

import * as React from "react";
import {
  Wrench,
  RefreshCw,
  LogOut,
  Radio,
  ShieldCheck,
  Sparkles,
  Server,
  Activity,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UrPlacedLogo } from "@/components/ui/urplaced-logo";

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
  const [refreshSuccess, setRefreshSuccess] = React.useState(false);

  // Guarantee that body cannot show a scrollbar while maintenance screen is active
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshSuccess(false);
    try {
      if (onRefresh) {
        onRefresh();
      } else {
        window.location.reload();
      }
      setRefreshSuccess(true);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
        setRefreshSuccess(false);
      }, 1000);
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
    <div className="fixed inset-0 min-h-screen min-h-[100dvh] w-screen w-[100dvw] bg-background text-text-primary flex flex-col justify-between items-center px-4 sm:px-6 lg:px-8 py-3.5 sm:py-5 select-none overflow-y-auto z-[99999]">
      {/* Decorative Subtle Architectural Background Mesh & Glows */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        {/* Subtle dot matrix pattern */}
        <div
          className="absolute inset-0 opacity-[0.45]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(36, 40, 58, 0.14) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Top-Right Ambient Indigo Glow */}
        <div
          className="absolute -top-32 -right-32 w-80 sm:w-96 h-80 sm:h-96 rounded-full opacity-25 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, #7779D8 0%, rgba(80, 82, 201, 0) 70%)",
          }}
        />

        {/* Bottom-Left Ambient Teal Glow */}
        <div
          className="absolute -bottom-32 -left-32 w-80 sm:w-96 h-80 sm:h-96 rounded-full opacity-20 blur-3xl"
          style={{
            background:
              "radial-gradient(circle, #2E8F86 0%, rgba(46, 143, 134, 0) 70%)",
          }}
        />
      </div>

      {/* Top Header Bar */}
      <header className="w-full max-w-4xl flex items-center justify-between shrink-0 py-1">
        {/* Official Brand Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3 group">
          <UrPlacedLogo
            size="md"
            className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 drop-shadow-xs"
            priority
          />
          <div className="flex items-center gap-2">
            <span className="font-heading font-extrabold text-xl sm:text-2xl text-text-primary tracking-tight leading-none">
              UrPlaced
            </span>
            <span className="hidden sm:inline-flex text-[11px] font-mono px-2 py-0.5 rounded-md bg-card border border-border text-text-secondary uppercase tracking-wider">
              Platform Cloud
            </span>
          </div>
        </div>

        {/* Live Maintenance Status Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/35 text-amber-900 dark:text-amber-200 text-xs font-mono font-medium shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <span className="tracking-wide text-[11px] sm:text-xs font-semibold">
            MAINTENANCE LOCKDOWN
          </span>
        </div>
      </header>

      {/* Center Hero Card */}
      <main className="w-full max-w-xl my-auto py-2 flex flex-col items-center justify-center min-h-0 shrink">
        <div className="w-full bg-card border border-border/80 rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-card relative overflow-hidden text-center space-y-4 sm:space-y-4.5">
          {/* Subtle Top Accent Hairline */}
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, #7779D8 30%, #5052C9 50%, #2E8F86 70%, transparent 100%)",
            }}
          />

          {/* Futuristic Animated Maintenance Emblem */}
          <div className="relative mx-auto w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
            {/* Ambient Background Aura */}
            <div className="absolute inset-0 rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-primary/20 via-[#7779D8]/15 to-secondary/20 blur-md" />

            {/* Emblem Surface Box */}
            <div className="relative w-full h-full rounded-2xl sm:rounded-3xl bg-background border border-primary/30 flex items-center justify-center shadow-xs">
              <Wrench className="w-8 h-8 sm:w-10 sm:h-10 text-primary stroke-[1.8] animate-pulse" />
              {/* Corner Pulsing Pulse Dot */}
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-secondary" />
              </span>
            </div>
          </div>

          {/* Headings */}
          <div className="space-y-1 sm:space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-primary tracking-tight leading-tight">
              We&apos;re Under Maintenance
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary leading-relaxed max-w-md mx-auto">
              UrPlaced is temporarily unavailable while platform infrastructure optimization and security updates are being deployed.
            </p>
          </div>

          {/* Platform Broadcast Dispatch Card */}
          <div className="bg-background border border-border/70 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 text-left space-y-2 shadow-xs relative overflow-hidden">
            {/* Header Strip inside Broadcast */}
            <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-secondary font-bold">
                <Radio className="w-3.5 h-3.5 text-secondary shrink-0 animate-pulse" />
                <span>Super Admin Broadcast Dispatch</span>
              </div>
              <span className="text-[10px] font-mono text-text-secondary/70">
                ACTIVE NOTICE
              </span>
            </div>

            {/* Dynamic Message Content */}
            <p className="text-sm sm:text-[15px] font-semibold text-text-primary leading-snug whitespace-pre-wrap">
              {dynamicMessage}
            </p>

            {/* Optional Estimated Restoration */}
            {scheduledEnd && (
              <div className="text-[11px] font-mono text-text-secondary pt-1 border-t border-border/40 flex items-center justify-between">
                <span>Estimated Restoration:</span>
                <span className="font-semibold text-text-primary">
                  {new Date(scheduledEnd).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Data Protection & Security Indicators Strip */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 py-0.5 text-[10px] sm:text-[11px] font-mono text-text-secondary">
            <div className="flex items-center justify-center gap-1 bg-background/60 border border-border/50 rounded-lg py-1 px-1.5 truncate">
              <Lock className="w-3 h-3 text-secondary shrink-0" />
              <span className="truncate">Records Safe</span>
            </div>
            <div className="flex items-center justify-center gap-1 bg-background/60 border border-border/50 rounded-lg py-1 px-1.5 truncate">
              <ShieldCheck className="w-3 h-3 text-secondary shrink-0" />
              <span className="truncate">Data Isolated</span>
            </div>
            <div className="flex items-center justify-center gap-1 bg-background/60 border border-border/50 rounded-lg py-1 px-1.5 truncate">
              <Activity className="w-3 h-3 text-secondary shrink-0" />
              <span className="truncate">503 Enforced</span>
            </div>
          </div>

          {/* Reassurance Message */}
          <p className="text-[11px] sm:text-xs text-text-secondary">
            Thank you for your patience. All student and college data remains securely isolated.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
            <Button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full sm:w-auto bg-primary hover:bg-[#4345B0] text-white font-medium px-6 h-9 sm:h-10 text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  isRefreshing ? "animate-spin" : ""
                }`}
              />
              <span>
                {isRefreshing
                  ? "Checking Status..."
                  : refreshSuccess
                  ? "Status Verified"
                  : "Refresh Status"}
              </span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleSignOut}
              className="w-full sm:w-auto border-border/80 hover:bg-background text-text-secondary hover:text-text-primary font-medium px-5 h-9 sm:h-10 text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </main>

      {/* Bottom Footer Bar */}
      <footer className="w-full max-w-4xl py-1 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px] text-text-secondary font-mono shrink-0">
        <div className="flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5 text-secondary shrink-0" />
          <span>UrPlaced Enterprise Infrastructure</span>
        </div>
        <span>Zero Data Exposure &bull; Single-College Isolation Preserved</span>
      </footer>
    </div>
  );
}
