/**
 * Drive Offers API Route
 * GET /api/placement/drives/[id]/offers — List placement offers for drive
 * POST /api/placement/drives/[id]/offers — Record a placement offer
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { OutcomeService } from "@/modules/placement/services/outcome-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.DRIVES_MANAGE);

    const offers = await OutcomeService.listByDrive(ctx.tenantId, id);
    return NextResponse.json(offers);
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
    const ctx = await requireAuthContext(Permissions.OUTCOMES_MANAGE);
    const body = await request.json();

    if (!body.studentId || !body.applicationId) {
      return NextResponse.json(
        { error: "Missing required fields: studentId, applicationId" },
        { status: 400 }
      );
    }

    const offer = await OutcomeService.recordOffer({
      tenantId: ctx.tenantId,
      studentId: body.studentId,
      driveId: id,
      applicationId: body.applicationId,
      offerType: body.offerType,
      compensationAmount: body.compensationAmount ? parseFloat(body.compensationAmount) : null,
      compensationDetails: body.compensationDetails,
      status: body.status || "OFFERED",
      joiningDate: body.joiningDate,
      internalNotes: body.internalNotes,
      recordedBy: ctx.userId,
    });

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "PLACEMENT_OFFER_RECORDED",
      resourceType: "placement_offer",
      resourceId: offer.id,
      afterState: { studentId: body.studentId, driveId: id, amount: offer.compensation_amount },
    });

    return NextResponse.json(offer, { status: 201 });
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
