/**
 * Drive Stages API Route
 * GET /api/placement/drives/[id]/stages — List stages for a recruitment drive
 * POST /api/placement/drives/[id]/stages — Add a stage to a drive
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { StageService } from "@/modules/recruitment-drives/services/stage-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.DRIVES_MANAGE);

    const stages = await StageService.listByDrive(ctx.tenantId, id);
    return NextResponse.json(stages);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.STAGES_MANAGE);
    const body = await request.json();

    if (!body.name || !body.stageType || body.stageOrder === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: name, stageType, stageOrder" },
        { status: 400 }
      );
    }

    const stage = await StageService.create({
      tenantId: ctx.tenantId,
      driveId: id,
      name: body.name,
      stageType: body.stageType,
      stageOrder: parseInt(body.stageOrder, 10),
      description: body.description,
      scheduledAt: body.scheduledAt,
      isStudentVisible: body.isStudentVisible,
    });

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "DRIVE_STAGE_CREATED",
      resourceType: "drive_stage",
      resourceId: stage.id,
      afterState: { name: stage.name, order: stage.stage_order, type: stage.stage_type },
    });

    return NextResponse.json(stage, { status: 201 });
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
