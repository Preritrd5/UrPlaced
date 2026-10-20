import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import {
  TrainingSessionService,
  CreateTrainingSessionInput,
} from "@/modules/training/services/training-session-service";

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.TRAINING_SESSIONS_MANAGE);
    const searchParams = request.nextUrl.searchParams;
    const status = (searchParams.get("status") as any) || undefined;

    const result = await TrainingSessionService.listSessions(authContext.tenantId, status);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ sessions: result.sessions });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.TRAINING_SESSIONS_MANAGE);
    const body: CreateTrainingSessionInput = await request.json();

    const result = await TrainingSessionService.createSession(authContext.tenantId, body);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ session: result.session }, { status: 201 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
