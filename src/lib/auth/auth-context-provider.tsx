"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole, PermissionIdentifier } from "@/modules/identity-access/services/policy-engine";
import type { AccountCategory } from "@/lib/navigation/navigation-config";

export interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  role: UserRole | null;
  accountCategory: AccountCategory | null;
  isPlatformAdmin: boolean;
  isVerifiedMembership: boolean;
  tenant: { id: string; name: string } | null;
  availableTenants: { id: string; name: string; role: string }[];
  permissions: string[];
  can: (action: PermissionIdentifier) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthContextProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [data, setData] = React.useState<{
    authenticated: boolean;
    userId: string | null;
    email: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    role: UserRole | null;
    accountCategory: AccountCategory | null;
    isPlatformAdmin: boolean;
    isVerifiedMembership: boolean;
    tenant: { id: string; name: string } | null;
    availableTenants: { id: string; name: string; role: string }[];
    permissions: string[];
  }>({
    authenticated: false,
    userId: null,
    email: null,
    fullName: null,
    avatarUrl: null,
    role: null,
    accountCategory: null,
    isPlatformAdmin: false,
    isVerifiedMembership: false,
    tenant: null,
    availableTenants: [],
    permissions: [],
  });

  const fetchContext = React.useCallback(async () => {
    try {
      const res = await fetch("/api/auth/context", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        if (json.authenticated) {
          setData({
            authenticated: true,
            userId: json.userId,
            email: json.email,
            fullName: json.fullName,
            avatarUrl: json.avatarUrl,
            role: json.role,
            accountCategory: json.accountCategory,
            isPlatformAdmin: json.isPlatformAdmin,
            isVerifiedMembership: !!json.isVerifiedMembership,
            tenant: json.tenant,
            availableTenants: json.availableTenants || [],
            permissions: json.permissions || [],
          });
        } else {
          setData({
            authenticated: false,
            userId: null,
            email: null,
            fullName: null,
            avatarUrl: null,
            role: null,
            accountCategory: null,
            isPlatformAdmin: false,
            isVerifiedMembership: false,
            tenant: null,
            availableTenants: [],
            permissions: [],
          });
        }
      }
    } catch {
      // Fallback safely on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchContext();

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
        fetchContext();
      } else if (event === "SIGNED_OUT") {
        setData({
          authenticated: false,
          userId: null,
          email: null,
          fullName: null,
          avatarUrl: null,
          role: null,
          accountCategory: null,
          isPlatformAdmin: false,
          isVerifiedMembership: false,
          tenant: null,
          availableTenants: [],
          permissions: [],
        });
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchContext]);

  const can = React.useCallback(
    (action: PermissionIdentifier) => {
      if (data.isPlatformAdmin) return true;
      return data.permissions.includes(action);
    },
    [data.isPlatformAdmin, data.permissions]
  );

  const signOut = React.useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setData({
      authenticated: false,
      userId: null,
      email: null,
      fullName: null,
      avatarUrl: null,
      role: null,
      accountCategory: null,
      isPlatformAdmin: false,
      isVerifiedMembership: false,
      tenant: null,
      availableTenants: [],
      permissions: [],
    });
    window.location.href = "/auth/signin";
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: data.authenticated,
      userId: data.userId,
      email: data.email,
      fullName: data.fullName,
      avatarUrl: data.avatarUrl,
      role: data.role,
      accountCategory: data.accountCategory,
      isPlatformAdmin: data.isPlatformAdmin,
      isVerifiedMembership: data.isVerifiedMembership,
      tenant: data.tenant,
      availableTenants: data.availableTenants,
      permissions: data.permissions,
      can,
      refresh: fetchContext,
      signOut,
    }),
    [isLoading, data, can, fetchContext, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within an AuthContextProvider");
  }
  return ctx;
}
