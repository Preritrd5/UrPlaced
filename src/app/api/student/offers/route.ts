/**
 * Student Placement Offers API
 * GET /api/student/offers
 * 
 * Returns all formal placement offers extended to the authenticated student.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { OutcomeService } from "@/modules/placement/services/outcome-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.OUTCOMES_READ_OWN);

    const student = await StudentService.getByUserId(ctx.tenantId, ctx.userId);
    if (!student) {
      return NextResponse.json({ offers: [], total: 0 });
    }

    const offers = await OutcomeService.listByStudent(ctx.tenantId, student.id);

    return NextResponse.json({
      offers,
      total: offers.length,
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
