import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.STUDENTS_DELETE);

    if (ctx.tenantRole !== "PLACEMENT_HEAD") {
      return NextResponse.json(
        { error: "Bulk deletion of student records is strictly restricted to Placement Heads." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const confirmationPhrase = body?.confirmationPhrase;

    if (!confirmationPhrase || confirmationPhrase.trim() !== "DELETE ALL STUDENTS") {
      return NextResponse.json(
        { error: "Confirmation phrase does not match. Please enter 'DELETE ALL STUDENTS' exactly." },
        { status: 400 }
      );
    }

    const result = await StudentService.executeBulkDelete(
      ctx.tenantId,
      confirmationPhrase,
      ctx.userId
    );

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
