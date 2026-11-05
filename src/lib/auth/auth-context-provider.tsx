"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { getTabStorageKey, tabSessionStorage } from "@/lib/auth/auth-tab";
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
  tenant: {
    id: string;
    name: string;
    subscriptionStatus?: string | null;
    isGracePeriod?: boolean;
    gracePeriodEndsAt?: string | null;
    canAccessOperational?: boolean;
    accessDecision?: string | null;
    planId?: string | null;
    planName?: string | null;
    entitlements?: Record<string, boolean> | null;
    limits?: Record<string, number | null> | null;
  } | null;
  availableTenants: { id: string; name: string; role: string }[];
  permissions: string[];
  can: (action: PermissionIdentifier) => boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  updateAvatar?: (avatarUrl: string | null) => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

const INITIAL_STATE = {
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
};

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
    tenant: {
      id: string;
      name: string;
      subscriptionStatus?: string | null;
      isGracePeriod?: boolean;
      gracePeriodEndsAt?: string | null;
      canAccessOperational?: boolean;
      accessDecision?: string | null;
      planId?: string | null;
      planName?: string | null;
      entitlements?: Record<string, boolean> | null;
      limits?: Record<string, number | null> | null;
    } | null;
    availableTenants: { id: string; name: string; role: string }[];
    permissions: string[];
  }>(INITIAL_STATE);

  const fetchSeqRef = React.useRef(0);
  const activeAbortRef = React.useRef<AbortController | null>(null);

  const fetchContext = React.useCallback(async () => {
    const seq = ++fetchSeqRef.current;
    if (activeAbortRef.current) {
      activeAbortRef.current.abort();
    }
    const controller = new AbortController();
    activeAbortRef.current = controller;

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        if (seq === fetchSeqRef.current) {
          setData(INITIAL_STATE);
          setIsLoading(false);
        }
        return;
      }

      const res = await fetch("/api/auth/context", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
        signal: controller.signal,
      });

      if (seq !== fetchSeqRef.current) {
        // Discard stale response because a newer fetch or signout was triggered
        return;
      }

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
          setData(INITIAL_STATE);
        }
      } else {
        setData(INITIAL_STATE);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        return; // Ignore intentional abort
      }
      if (seq === fetchSeqRef.current) {
        setData(INITIAL_STATE);
      }
    } finally {
      if (seq === fetchSeqRef.current) {
        setIsLoading(false);
      }
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
        fetchSeqRef.current++;
        if (activeAbortRef.current) {
          activeAbortRef.current.abort();
        }
        setData(INITIAL_STATE);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (activeAbortRef.current) {
        activeAbortRef.current.abort();
      }
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
    fetchSeqRef.current++;
    if (activeAbortRef.current) {
      activeAbortRef.current.abort();
    }
    try {
      const supabase = createClient();
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Local signOut fallback
    }
    try {
      const storageKey = getTabStorageKey();
      tabSessionStorage.removeItem(storageKey);
    } catch {
      // Storage fallback
    }
    setData(INITIAL_STATE);
    setIsLoading(false);
    window.location.href = "/auth/signin";
  }, []);

  const updateAvatar = React.useCallback((avatarUrl: string | null) => {
    setData((prev) => ({ ...prev, avatarUrl }));
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
      updateAvatar,
    }),
    [isLoading, data, can, fetchContext, signOut, updateAvatar]
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
