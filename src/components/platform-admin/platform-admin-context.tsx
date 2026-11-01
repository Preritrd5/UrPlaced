"use client";

import * as React from "react";
import type { AuthenticatedSuperAdmin } from "@/modules/platform-admin/services/platform-auth-service";

export interface PlatformAdminContextValue {
  admin: AuthenticatedSuperAdmin;
  updateAdminProfile: (partial: Partial<AuthenticatedSuperAdmin>) => void;
  refreshAdmin: () => Promise<void>;
}

const PlatformAdminContext = React.createContext<PlatformAdminContextValue | null>(null);

export function PlatformAdminProvider({
  initialAdmin,
  children,
}: {
  initialAdmin: AuthenticatedSuperAdmin;
  children: React.ReactNode;
}) {
  const [admin, setAdmin] = React.useState<AuthenticatedSuperAdmin>(initialAdmin);

  const updateAdminProfile = React.useCallback(
    (partial: Partial<AuthenticatedSuperAdmin>) => {
      setAdmin((prev) => ({
        ...prev,
        ...partial,
      }));
    },
    []
  );

  const refreshAdmin = React.useCallback(async () => {
    try {
      const res = await fetch("/api/preritrd/profile", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.admin) {
          setAdmin((prev) => ({
            ...prev,
            ...data.admin,
          }));
        }
      }
    } catch {
      // Non-fatal
    }
  }, []);

  return (
    <PlatformAdminContext.Provider
      value={{
        admin,
        updateAdminProfile,
        refreshAdmin,
      }}
    >
      {children}
    </PlatformAdminContext.Provider>
  );
}

const fallbackAdmin: AuthenticatedSuperAdmin = {
  id: "admin-fallback",
  email: "admin@urplaced.com",
  fullName: "Platform Super Admin",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
  mfaEnforced: true,
  mfaVerified: true,
};

const fallbackContext: PlatformAdminContextValue = {
  admin: fallbackAdmin,
  updateAdminProfile: () => {},
  refreshAdmin: async () => {},
};

export function usePlatformAdminContext() {
  const ctx = React.useContext(PlatformAdminContext);
  return ctx || fallbackContext;
}
