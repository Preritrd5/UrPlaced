/**
 * Drive Status Transition API Route
 * POST /api/placement/drives/[id]/status — Safely transition drive lifecycle state
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { DriveService } from "@/modules/recruitment-drives/services/drive-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.DRIVES_PUBLISH);
    const body = await request.json();

    if (!body.status) {
      return NextResponse.json({ error: "Target status is required." }, { status: 400 });
    }

    const updated = await DriveService.transitionStatus(
      ctx.tenantId,
      id,
      body.status,
      body.reason
    );

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: `DRIVE_STATUS_${body.status}`,
      resourceType: "recruitment_drive",
      resourceId: id,
      afterState: { status: updated.status, reason: body.reason },
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
