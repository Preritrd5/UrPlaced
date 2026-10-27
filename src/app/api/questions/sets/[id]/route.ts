import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { QuestionSetService } from "@/modules/question-bank/services/question-set-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authContext = await requireAuthContext();

    const result = await QuestionSetService.getSetById(
      authContext.tenantId,
      authContext.tenantRole,
      id
    );

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authContext = await requireAuthContext(Permissions.QUESTION_SETS_MANAGE);
    const body = await request.json();

    if (body.action === "LOCK_AND_PUBLISH") {
      const res = await QuestionSetService.lockAndPublishSet(
        authContext.tenantId,
        id
      );

      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }

      return NextResponse.json({ success: true, status: "PUBLISHED", is_locked: true });
    }

    if (body.action === "ADD_ITEMS" && Array.isArray(body.items)) {
      const res = await QuestionSetService.addItemsToSet(
        authContext.tenantId,
        id,
        body.items
      );

      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }

      return NextResponse.json(res);
    }

    if (body.action === "REMOVE_ITEM" && body.itemId) {
      const res = await QuestionSetService.removeItemFromSet(
        authContext.tenantId,
        id,
        body.itemId
      );

      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }

      return NextResponse.json(res);
    }

    return NextResponse.json({ error: "Invalid action or parameters." }, { status: 400 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authContext = await requireAuthContext(Permissions.QUESTION_SETS_MANAGE);

    const res = await QuestionSetService.deleteSet(authContext.tenantId, id);

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Question set deleted successfully." });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
