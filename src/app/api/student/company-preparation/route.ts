/**
 * Company Preparation API
 * GET /api/student/company-preparation
 * Returns company profiles, hiring workflows, roles, and progress
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { CompanyPreparationService } from "@/modules/students/services/company-preparation-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

    const url = new URL(request.url);
    const industry = url.searchParams.get("industry") || undefined;
    const search = url.searchParams.get("search") || undefined;

    const companies = await CompanyPreparationService.getCompanyProfiles(
      authContext.tenantId,
      student.id,
      { industry, search }
    );

    return NextResponse.json({
      success: true,
      data: companies,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load company preparation profiles" },
      { status: 500 }
    );
  }
}
