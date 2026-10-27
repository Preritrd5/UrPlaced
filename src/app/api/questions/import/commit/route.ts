import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { ImportService, ParsedCsvRow } from "@/modules/question-bank/services/import-service";

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTIONS_IMPORT);
    const body = await request.json();

    const bankId = body.bankId;
    const fileName = body.fileName || "batch_import.csv";
    const items = body.items as ParsedCsvRow[];

    if (!bankId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "bankId and non-empty items array are required." },
        { status: 400 }
      );
    }

    const res = await ImportService.commitImport(
      authContext.tenantId,
      authContext.userId,
      bankId,
      fileName,
      items
    );

    if (!res.success) {
      const isNotFound = res.error?.includes("not found");
      return NextResponse.json({ error: res.error }, { status: isNotFound ? 404 : 400 });
    }

    return NextResponse.json(res, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
