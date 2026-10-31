import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformConfigService } from "@/modules/platform-admin/services/platform-config-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);

    const settings = await PlatformConfigService.getAllSettings();

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load platform configuration";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "Configuration key and value are required." },
        { status: 400 }
      );
    }

    const updated = await PlatformConfigService.updateSetting({
      key,
      value,
      adminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      message: `Setting '${key}' updated successfully.`,
      setting: updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update configuration";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
