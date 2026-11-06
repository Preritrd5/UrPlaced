"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { DashboardSkeleton } from "@/components/ui/page-skeletons";

interface ClientAuthGateProps {
  redirectTo?: string;
  children?: React.ReactNode;
}

/**
 * ClientAuthGate
 * Used by Server Components when initial server-side rendering cannot resolve a tab's session
 * (e.g. on raw browser address-bar GET navigations or F5 reloads where Bearer tokens cannot be sent in HTTP headers).
 * Allows the browser tab to hydrate from tab-scoped storage, attach the tab's Bearer token,
 * and refresh the route seamlessly without falling back to shared cookies.
 */
export function ClientAuthGate({
  redirectTo = "/auth/signin",
  children,
}: ClientAuthGateProps) {
  const auth = useAuthContext();
  const router = useRouter();
  const [refreshed, setRefreshed] = React.useState(false);

  React.useEffect(() => {
    if (!auth.isLoading) {
      if (auth.isAuthenticated && !refreshed) {
        setRefreshed(true);
        router.refresh();
      } else if (!auth.isAuthenticated) {
        router.replace(redirectTo);
      }
    }
  }, [auth.isLoading, auth.isAuthenticated, refreshed, redirectTo, router]);

  if (auth.isLoading || (auth.isAuthenticated && !refreshed)) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  return <>{children}</>;
}
