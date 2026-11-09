/**
 * Save Company for Later API
 * POST /api/student/company-preparation/save
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
    const { companyId, isSaved } = body;

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required." },
        { status: 400 }
      );
    }

    const success = await CompanyPreparationService.toggleSaveCompany(
      authContext.tenantId,
      student.id,
      companyId,
      typeof isSaved === "boolean" ? isSaved : true
    );

    return NextResponse.json({
      success,
      data: { isSaved: typeof isSaved === "boolean" ? isSaved : true },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to toggle saved company" },
      { status: 500 }
    );
  }
}
