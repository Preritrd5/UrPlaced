/**
 * Company Preparation Module Progress API
 * POST /api/student/company-preparation/progress
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { CompanyPreparationService } from "@/modules/students/services/company-preparation-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    let token: string | undefined;
    const authHeader = request?.headers?.get?.("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    const authContext = await requireAuthContext(Permissions.ASSESSMENTS_ATTEMPT, undefined, token);
    const student = await StudentService.getByUserId(authContext.tenantId, authContext.userId);

    if (!student || student.is_archived || student.academic_status !== "ACTIVE") {
      return NextResponse.json(
        { error: "No active verified student profile linked to this account." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { companyId, moduleId, isCompleted } = body;

    if (!companyId || !moduleId) {
      return NextResponse.json(
        { error: "companyId and moduleId are required." },
        { status: 400 }
      );
    }

    const result = await CompanyPreparationService.markModuleProgress(
      authContext.tenantId,
      student.id,
      companyId,
      moduleId,
      typeof isCompleted === "boolean" ? isCompleted : true
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update module progress" },
      { status: 500 }
    );
  }
}
