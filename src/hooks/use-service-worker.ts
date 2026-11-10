"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface UseServiceWorkerReturn {
  isRegistered: boolean;
  isUpdateAvailable: boolean;
  updateApp: () => void;
  registration: ServiceWorkerRegistration | null;
}

export function useServiceWorker(): UseServiceWorkerReturn {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // Register service worker
    const registerWorker = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        setRegistration(reg);
        setIsRegistered(true);

        // Check if an updated worker is already waiting
        if (reg.waiting) {
          waitingWorkerRef.current = reg.waiting;
          setIsUpdateAvailable(true);
        }

        // Listen for future updates
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              // A new update is ready and waiting for user activation
              waitingWorkerRef.current = newWorker;
              setIsUpdateAvailable(true);
            }
          });
        });
      } catch (err) {
        console.warn("[UrPlaced PWA] Service worker registration notice:", err);
      }
    };

    registerWorker();

    // Reload page smoothly when the new worker takes control after skipWaiting
    let refreshing = false;
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const updateApp = useCallback(() => {
    if (waitingWorkerRef.current) {
      waitingWorkerRef.current.postMessage({ type: "SKIP_WAITING" });
    } else if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  }, [registration]);

  return {
    isRegistered,
    isUpdateAvailable,
    updateApp,
    registration,
  };
}
