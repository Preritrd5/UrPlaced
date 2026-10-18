import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { QuestionSetService } from "@/modules/question-bank/services/question-set-service";

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthContext();
    const { searchParams } = new URL(request.url);
    const purpose = (searchParams.get("purpose") as any) || undefined;

    const { data: sets, error } = await QuestionSetService.listSets(
      authContext.tenantId,
      authContext.tenantRole,
      purpose
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(sets || []);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTION_SETS_MANAGE);
    const body = await request.json();

    if (!body.name || !body.purpose) {
      return NextResponse.json(
        { error: "Name and purpose are required." },
        { status: 400 }
      );
    }

    const { data: set, error } = await QuestionSetService.createSet(
      authContext.tenantId,
      authContext.userId,
      {
        name: body.name,
        description: body.description,
        purpose: body.purpose,
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(set, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
