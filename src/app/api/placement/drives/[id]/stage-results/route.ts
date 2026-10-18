/**
 * Candidate Stage Result API Route
 * POST /api/placement/drives/[id]/stage-results — Record candidate evaluation for a drive stage
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { CandidateService } from "@/modules/placement/services/candidate-service";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.STAGES_MANAGE);
    const body = await request.json();

    if (!body.applicationId || !body.stageId || !body.status) {
      return NextResponse.json(
        { error: "Missing required fields: applicationId, stageId, status" },
        { status: 400 }
      );
    }

    const result = await CandidateService.recordStageResult({
      tenantId: ctx.tenantId,
      applicationId: body.applicationId,
      stageId: body.stageId,
      status: body.status,
      score: body.score !== undefined && body.score !== null ? parseFloat(body.score) : null,
      studentFeedback: body.studentFeedback,
      internalNotes: body.internalNotes,
      evaluatedBy: ctx.userId,
    });

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "STAGE_RESULT_RECORDED",
      resourceType: "stage_result",
      resourceId: result.id,
      afterState: { status: result.status, score: result.score },
    });

    return NextResponse.json(result);
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
