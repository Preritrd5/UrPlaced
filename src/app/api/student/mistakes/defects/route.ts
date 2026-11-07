import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { ContentDefectService } from "@/modules/mistake-mastery/services/content-defect-service";

export async function POST(request: NextRequest) {
  try {
    let token: string | undefined;
    const authHeader = request?.headers?.get?.("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }
    const authContext = await requireAuthContext(Permissions.QUESTION_DEFECTS_REPORT, undefined, token);
    const body = await request.json();
    const { questionId, versionId, defectType, description } = body;

    if (!questionId || !versionId || !defectType || !description) {
      return NextResponse.json(
        { error: "questionId, versionId, defectType, and description are required." },
        { status: 400 }
      );
    }

    const res = await ContentDefectService.reportDefect(
      authContext.tenantId,
      authContext.userId,
      {
        questionId,
        versionId,
        defectType,
        description,
      }
    );

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, report: res.report });
  } catch (err: any) {
    if (err.message?.startsWith("UNAUTHORIZED")) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message?.startsWith("FORBIDDEN") || err?.statusCode === 403) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
