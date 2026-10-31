/**
 * Candidate Stage Advancement & Evaluation API
 * POST /api/placement/drives/[id]/candidates/[appId]/advance
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { CandidateService } from "@/modules/placement/services/candidate-service";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { NotificationService } from "@/modules/notifications/services/notification-service";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string; appId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: driveId, appId } = await params;
    const ctx = await requireAuthContext(Permissions.STAGES_MANAGE);

    const body = await request.json().catch(() => null);
    if (!body || !body.stageId || !body.status) {
      return NextResponse.json(
        { error: "stageId and status are required fields." },
        { status: 400 }
      );
    }

    const { stageId, status, score, studentFeedback, internalNotes } = body;

    const result = await CandidateService.recordStageResult({
      tenantId: ctx.tenantId,
      applicationId: appId,
      stageId,
      status,
      score: score !== undefined && score !== null ? parseFloat(score) : null,
      studentFeedback,
      internalNotes,
      evaluatedBy: ctx.userId,
    });

    // Fetch student auth user id to send notification
    const supabase = createAdminClient();
    const { data: app } = await supabase
      .from("drive_applications")
      .select("student_id, student:students(user_id, full_name), drive:recruitment_drives(role_title, company:companies(name))")
      .eq("id", appId)
      .single();

    const studentUserId = (app?.student as any)?.user_id;
    if (studentUserId) {
      const driveTitle = (app?.drive as any)?.role_title || "Recruitment Drive";
      const companyName = (app?.drive as any)?.company?.name || "Hiring Partner";

      if (status === "PASSED") {
        await NotificationService.createNotification({
          recipientUserId: studentUserId,
          collegeId: ctx.tenantId,
          actorUserId: ctx.userId,
          type: "STAGE_QUALIFIED",
          title: "Congratulations! Round Cleared",
          body: `You have cleared the recruitment round for ${driveTitle} at ${companyName}.`,
          actionUrl: "/dashboard/student/applications",
        }).catch(() => null);
      }
    }

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "CANDIDATE_STAGE_EVALUATED",
      resourceType: "candidate_stage_result",
      resourceId: result.id,
      afterState: { driveId, applicationId: appId, stageId, status, score },
    }).catch(() => null);

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
