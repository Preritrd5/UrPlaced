/**
 * Student Application Withdrawal API
 * POST /api/student/applications/[id]/withdraw
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { CandidateService } from "@/modules/placement/services/candidate-service";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: applicationId } = await params;
    const ctx = await requireAuthContext(Permissions.CANDIDATES_REGISTER);

    const student = await StudentService.getByUserId(ctx.tenantId, ctx.userId);
    if (!student) {
      return NextResponse.json({ error: "Student profile not found." }, { status: 404 });
    }

    const supabase = createAdminClient();
    const { data: app, error: appErr } = await supabase
      .from("drive_applications")
      .select("id, status, drive_id, student_id")
      .eq("tenant_id", ctx.tenantId)
      .eq("id", applicationId)
      .single();

    if (appErr || !app) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    // Verify student ownership
    if (app.student_id !== student.id) {
      return NextResponse.json({ error: "Unauthorized access to application." }, { status: 403 });
    }

    if (app.status === "WITHDRAWN") {
      return NextResponse.json({ error: "Application is already withdrawn." }, { status: 400 });
    }

    if (app.status === "OFFER_ACCEPTED") {
      return NextResponse.json({ error: "Cannot withdraw an accepted placement offer." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = body?.reason || "Student self-withdrawn";

    const updated = await CandidateService.withdraw(ctx.tenantId, applicationId, reason);

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "APPLICATION_WITHDRAWN",
      resourceType: "application",
      resourceId: applicationId,
      afterState: { reason, status: updated.status },
    }).catch(() => null);

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
