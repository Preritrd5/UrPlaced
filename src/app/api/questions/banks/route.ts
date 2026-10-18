import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { QuestionService } from "@/modules/question-bank/services/question-service";

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTIONS_CREATE);
    const { data: banks, error } = await QuestionService.listBanks(authContext.tenantId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(banks || []);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTIONS_CREATE);
    const body = await request.json();

    if (!body.name || !body.category) {
      return NextResponse.json(
        { error: "Name and Category are required." },
        { status: 400 }
      );
    }

    const { data: bank, error } = await QuestionService.createBank(
      authContext.tenantId,
      authContext.userId,
      {
        name: body.name,
        description: body.description,
        category: body.category,
        sharing_policy: body.sharing_policy,
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(bank, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
