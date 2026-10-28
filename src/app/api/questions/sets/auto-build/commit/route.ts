import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { QuestionSetService } from "@/modules/question-bank/services/question-set-service";

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTION_SETS_MANAGE);
    const body = await request.json().catch(() => ({}));

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "At least one previewed question item is required to commit." },
        { status: 400 }
      );
    }

    if (body.targetType === "NEW_SET" && !body.setName?.trim()) {
      return NextResponse.json(
        { error: "Question Set name is required for new sets." },
        { status: 400 }
      );
    }

    if (body.targetType === "EXISTING_SET" && !body.setId) {
      return NextResponse.json(
        { error: "Target Question Set ID is required." },
        { status: 400 }
      );
    }

    const result = await QuestionSetService.commitAutoBuildSet(
      authContext.tenantId,
      authContext.userId,
      {
        targetType: body.targetType,
        setId: body.setId,
        setName: body.setName,
        setDescription: body.setDescription,
        purpose: body.purpose,
        items: body.items,
      }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Access denied. Requires Question Sets permission." }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
