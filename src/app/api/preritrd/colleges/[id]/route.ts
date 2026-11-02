import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformCollegeService } from "@/modules/platform-admin/services/platform-college-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);
    const { id } = await params;

    const college = await PlatformCollegeService.getCollegeById(id);
    if (!college) {
      return NextResponse.json({ error: "College not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, college });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load college details";
    const status = msg.includes("UNAUTHORIZED") ? 401 : msg.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const { status, reason } = body;

    if (!status || (status !== "ACTIVE" && status !== "SUSPENDED")) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'ACTIVE' or 'SUSPENDED'." },
        { status: 400 }
      );
    }

    const result = await PlatformCollegeService.updateCollegeStatus({
      tenantId: id,
      status,
      reason,
      adminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      status: result.status,
      tenantId: id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update college status";
    const httpStatus = msg.includes("UNAUTHORIZED") ? 401 : msg.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status: httpStatus });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const { reason, hardDelete } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return NextResponse.json(
        { error: "A mandatory justification reason (at least 5 characters) is required to decommission an institution." },
        { status: 400 }
      );
    }

    const result = await PlatformCollegeService.decommissionCollege({
      tenantId: id,
      adminId: admin.id,
      reason: reason.trim(),
      hardDelete: Boolean(hardDelete),
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      tenantId: result.tenantId,
      collegeName: result.collegeName,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to decommission college";
    const status = msg.includes("UNAUTHORIZED") ? 401 : msg.includes("FORBIDDEN") ? 403 : msg.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
