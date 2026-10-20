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

    const result = await TrainingSessionService.computeBeforeAfterComparison(
      authContext.tenantId,
      sessionId
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ comparison: result.comparison });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.TRAINING_SESSIONS_MANAGE);
    const { sessionId } = await params;

    const result = await TrainingSessionService.computeBeforeAfterComparison(
      authContext.tenantId,
      sessionId
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ comparison: result.comparison }, { status: 200 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
