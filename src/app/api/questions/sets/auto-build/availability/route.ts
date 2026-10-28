import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { QuestionSetService, AutoBuildCriteria } from "@/modules/question-bank/services/question-set-service";

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTION_SETS_MANAGE);
    const body: AutoBuildCriteria = await request.json().catch(() => ({}));

    if (!body.subjects || !Array.isArray(body.subjects) || body.subjects.length === 0) {
      return NextResponse.json(
        { error: "At least one subject with a question count is required." },
        { status: 400 }
      );
    }

    const availability = await QuestionSetService.checkAutoBuildAvailability(
      authContext.tenantId,
      body
    );

    if (availability.error && !availability.isSatisfiable && availability.subjects.length === 0) {
      return NextResponse.json(availability, { status: 400 });
    }

    return NextResponse.json(availability);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Access denied. Requires Question Sets permission." }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
