/**
 * Single Drive API Route
 * GET /api/placement/drives/[id] — Retrieve recruitment drive details
 * PATCH /api/placement/drives/[id] — Update recruitment drive details
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { DriveService } from "@/modules/recruitment-drives/services/drive-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.DRIVES_MANAGE);

    const drive = await DriveService.getById(ctx.tenantId, id);
    if (!drive) {
      return NextResponse.json({ error: "Recruitment drive not found." }, { status: 404 });
    }

    return NextResponse.json(drive);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.DRIVES_MANAGE);
    const body = await request.json();

    const existing = await DriveService.getById(ctx.tenantId, id);
    if (!existing) {
      return NextResponse.json({ error: "Recruitment drive not found." }, { status: 404 });
    }

    const updated = await DriveService.update(ctx.tenantId, id, body);

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "DRIVE_UPDATED",
      resourceType: "recruitment_drive",
      resourceId: id,
      afterState: { title: updated.title, roleTitle: updated.role_title },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
