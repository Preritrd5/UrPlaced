import { Metadata } from "next";
import { PlatformConfigService } from "@/modules/platform-admin/services/platform-config-service";
import { FullScreenMaintenance } from "@/components/maintenance/full-screen-maintenance";

export const metadata: Metadata = {
  title: "Under Maintenance — UrPlaced",
  description: "UrPlaced platform is temporarily undergoing scheduled maintenance.",
};

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const maintenance = await PlatformConfigService.getMaintenanceStatus();

  return (
    <FullScreenMaintenance
      announcement={maintenance.message}
      scheduledEnd={maintenance.scheduledEnd}
    />
  );
}
