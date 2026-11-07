import * as React from "react";
import { PlatformConfigService } from "@/modules/platform-admin/services/platform-config-service";
import { createClient } from "@/lib/supabase/server";
import { FullScreenMaintenance } from "@/components/maintenance/full-screen-maintenance";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const maintenance = await PlatformConfigService.getMaintenanceStatus();

  if (maintenance.enabled) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const isPlatformAdmin = Boolean(
        user?.app_metadata?.is_platform_admin === true
      );

      // Super Admins retain access; all tenant users are strictly blocked on the server
      if (!isPlatformAdmin) {
        return (
          <FullScreenMaintenance
            announcement={maintenance.message}
            scheduledEnd={maintenance.scheduledEnd}
          />
        );
      }
    } catch {
      // Fail closed
      return (
        <FullScreenMaintenance
          announcement={maintenance.message}
          scheduledEnd={maintenance.scheduledEnd}
        />
      );
    }
  }

  return <>{children}</>;
}
