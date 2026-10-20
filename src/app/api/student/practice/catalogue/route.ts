import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { PracticeCatalogueService } from "@/modules/assessments/services/practice-catalogue-service";

export async function GET(_request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.PRACTICE_READ);
    const data = await PracticeCatalogueService.getPracticeCatalogue(authContext.tenantId);
    return NextResponse.json(data);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
