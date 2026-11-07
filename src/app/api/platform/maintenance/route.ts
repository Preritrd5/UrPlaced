import { NextResponse } from "next/server";
import { PlatformConfigService } from "@/modules/platform-admin/services/platform-config-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await PlatformConfigService.getMaintenanceStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (err: any) {
    return NextResponse.json({ success: false, enabled: false, message: "" }, { status: 500 });
  }
}
