import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { TrainingSessionService } from "@/modules/training/services/training-session-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.TRAINING_SESSIONS_MANAGE);
    const { sessionId } = await params;

    const result = await TrainingSessionService.getSessionById(authContext.tenantId, sessionId);

    if (!result.success || !result.session) {
      return NextResponse.json({ error: result.error || "Training session not found" }, { status: 404 });
    }

    return NextResponse.json({ session: result.session });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
