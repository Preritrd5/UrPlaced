import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AttemptLifecycleService } from "@/modules/assessments/services/attempt-lifecycle-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuthContext();
    const { id } = await params;

    const isStaff = [
      "SUPER_ADMIN",
      "PLACEMENT_HEAD",
      "PLACEMENT_STAFF",
      "TRAINER",
    ].includes(authContext.tenantRole);

    const result = await AttemptLifecycleService.getAttemptResult(
      authContext.tenantId,
      authContext.userId,
      id,
      isStaff
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
