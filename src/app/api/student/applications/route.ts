/**
 * Student Applications List API
 * GET /api/student/applications
 * 
 * Returns all campus recruitment drive applications for the authenticated student.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { CandidateService } from "@/modules/placement/services/candidate-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.CANDIDATES_REGISTER);

    const student = await StudentService.getByUserId(ctx.tenantId, ctx.userId);
    if (!student) {
      return NextResponse.json({ applications: [], total: 0 });
    }

    const applications = await CandidateService.listByStudent(ctx.tenantId, student.id);

    return NextResponse.json({
      applications,
      total: applications.length,
    });
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
