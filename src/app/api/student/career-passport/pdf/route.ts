/**
 * Career Passport PDF Export API
 * GET /api/student/career-passport/pdf — Streams verified professional PDF
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { CareerPassportService } from "@/modules/students/services/career-passport-service";

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

    const pdfBuffer = await CareerPassportService.generatePDF(
      authContext.tenantId,
      student.id
    );

    const safeName = (student.full_name || "Student").replace(/[^a-zA-Z0-9_-]/g, "_");

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}_Career_Passport.pdf"`,
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.startsWith("UNAUTHORIZED") || msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      msg.startsWith("FORBIDDEN") ||
      msg.includes("NO_ACTIVE_TENANT") ||
      msg === "FORBIDDEN" ||
      msg.includes("MEMBERSHIP_") ||
      msg.includes("SUBSCRIPTION_")
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to generate passport PDF." },
      { status: 500 }
    );
  }
}
