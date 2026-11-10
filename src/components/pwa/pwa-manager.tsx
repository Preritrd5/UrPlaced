"use client";

import React from "react";
import { NetworkStatusIndicator } from "./network-status-indicator";
import { PWAInstallPrompt } from "./pwa-install-prompt";
import { PWAUpdateBanner } from "./pwa-update-banner";
import { useServiceWorker } from "@/hooks/use-service-worker";

export function PWAManager() {
  // Mount service worker lifecycle hook
  useServiceWorker();

  return (
    <>
      <NetworkStatusIndicator />
      <PWAInstallPrompt variant="banner" />
      <PWAUpdateBanner />
    </>
  );
}
