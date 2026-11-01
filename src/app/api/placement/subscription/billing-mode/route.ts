import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { RecurringMandateService } from "@/modules/billing/services/recurring-mandate-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext();

    if (ctx.tenantRole !== "PLACEMENT_HEAD" && !ctx.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only the institutional Placement Head can update billing renewal mode." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { mode, consentGiven, termsVersion } = body;

    if (mode !== "MANUAL" && mode !== "AUTOMATIC") {
      return NextResponse.json({ error: "Invalid billing mode. Must be 'MANUAL' or 'AUTOMATIC'." }, { status: 400 });
    }

    const result = await RecurringMandateService.setBillingMode({
      tenantId: ctx.tenantId,
      mode,
      userId: ctx.userId,
      consentGiven: consentGiven === true,
      termsVersion,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const msg = error.message || "Failed to update billing renewal mode";
    const status = msg.includes("UNAUTHORIZED") ? 401 : msg.includes("consent") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
