import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { TrainingSessionService } from "@/modules/training/services/training-session-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.TRAINING_SESSIONS_MANAGE);
    const { sessionId } = await params;
    const body = await request.json();

    if (body.action === "ENROLL" && Array.isArray(body.studentIds)) {
      const result = await TrainingSessionService.enrollStudents(
        authContext.tenantId,
        sessionId,
        body.studentIds
      );
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ enrolledCount: result.enrolledCount });
    }

    if (body.action === "MARK_ATTENDANCE" && Array.isArray(body.attendanceList)) {
      const result = await TrainingSessionService.markAttendance(
        authContext.tenantId,
        sessionId,
        body.attendanceList
      );
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ updatedCount: result.updatedCount });
    }

    return NextResponse.json({ error: "Invalid attendance action or missing arguments" }, { status: 400 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
