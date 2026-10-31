/**
 * Student Application Submission API
 * POST /api/student/drives/[id]/apply
 * 
 * Verifies student eligibility, drive registration status, and deadlines,
 * and creates an atomic candidate application record.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { CandidateService } from "@/modules/placement/services/candidate-service";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { NotificationService } from "@/modules/notifications/services/notification-service";
import { DriveService } from "@/modules/recruitment-drives/services/drive-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: driveId } = await params;
    const ctx = await requireAuthContext(Permissions.CANDIDATES_REGISTER);

    // 1. Fetch student roster record
    const student = await StudentService.getByUserId(ctx.tenantId, ctx.userId);
    if (!student) {
      return NextResponse.json(
        { error: "No student academic roster record found for your account." },
        { status: 400 }
      );
    }

    // 2. Fetch drive info for audit and notifications
    const drive = await DriveService.getById(ctx.tenantId, driveId);
    if (!drive) {
      return NextResponse.json({ error: "Recruitment drive not found." }, { status: 404 });
    }

    // 3. Register candidate application (performs backend validation, deadline, and eligibility checks)
    const application = await CandidateService.registerCandidate({
      tenantId: ctx.tenantId,
      driveId,
      studentId: student.id,
      registeredBy: ctx.userId,
    });

    // 4. Record audit event
    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "APPLICATION_SUBMITTED",
      resourceType: "application",
      resourceId: application.id,
      afterState: {
        driveId,
        studentId: student.id,
        enrollmentNumber: student.enrollment_number,
        status: application.status,
      },
    }).catch(() => null);

    // 5. Send confirmation notification to student
    await NotificationService.createNotification({
      recipientUserId: ctx.userId,
      collegeId: ctx.tenantId,
      actorUserId: ctx.userId,
      type: "SYSTEM_ALERT",
      title: "Application Submitted Successfully",
      body: `You have successfully applied for the position of ${drive.role_title} at ${drive.company?.name}.`,
      actionUrl: "/dashboard/student/applications",
    }).catch(() => null);

    return NextResponse.json(application, { status: 201 });
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
