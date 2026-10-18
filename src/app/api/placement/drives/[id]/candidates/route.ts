/**
 * Drive Candidates API Route
 * GET /api/placement/drives/[id]/candidates — List registered candidates
 * POST /api/placement/drives/[id]/candidates — Register student for recruitment drive
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { CandidateService } from "@/modules/placement/services/candidate-service";
import { StudentService } from "@/modules/students/services/student-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.DRIVES_MANAGE);

    const candidates = await CandidateService.listByDrive(ctx.tenantId, id);
    return NextResponse.json(candidates);
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
    const ctx = await requireAuthContext(Permissions.CANDIDATES_REGISTER);
    const body = await request.json();

    let studentId = body.studentId;

    // If caller is student, resolve studentId from their auth account
    if (ctx.tenantRole === "STUDENT") {
      const studentProfile = await StudentService.getByUserId(ctx.tenantId, ctx.userId);
      if (!studentProfile) {
        return NextResponse.json(
          { error: "Student profile record not found. Please contact placement cell." },
          { status: 404 }
        );
      }
      studentId = studentProfile.id;
    }

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required." }, { status: 400 });
    }

    const application = await CandidateService.registerCandidate({
      tenantId: ctx.tenantId,
      driveId: id,
      studentId,
      registeredBy: ctx.userId,
    });

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "CANDIDATE_REGISTERED",
      resourceType: "drive_application",
      resourceId: application.id,
      afterState: { driveId: id, studentId, status: application.status },
    });

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
