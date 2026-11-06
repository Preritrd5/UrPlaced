import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AssessmentScoringService } from "@/modules/assessments/services/assessment-scoring-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.ASSESSMENTS_GRADE);
    const { id } = await params;

    const result = await AssessmentScoringService.regradeAllTenantAttempts(
      authContext.tenantId,
      id,
      authContext.userId
    );

    if (!result.success) {
      return NextResponse.json({ error: "Failed to regrade assessment attempts." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      totalAttempts: result.totalAttempts,
      regradedCount: result.regradedCount,
      mistakesPurgedTotal: result.mistakesPurgedTotal,
      message: `Successfully regraded ${result.regradedCount} attempts and purged ${result.mistakesPurgedTotal} invalid mistake occurrences.`,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
