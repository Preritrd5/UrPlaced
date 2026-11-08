import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AIRateLimiter } from "@/modules/ai/ai-rate-limiter";
import { AIDriveFitService } from "@/modules/ai/services/ai-drivefit-service";
import { GeminiServiceError } from "@/modules/ai/gemini-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.AI_DRIVEFIT_EVALUATE);

    const rateCheck = AIRateLimiter.checkLimit(authContext.userId, authContext.tenantRole);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: rateCheck.reason },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateCheck.resetInSeconds),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    const body = await request.json();
    const { driveId } = body;

    if (!driveId || typeof driveId !== "string") {
      return NextResponse.json(
        { error: "Valid recruitment drive ID (driveId) is required." },
        { status: 400 }
      );
    }

    const evaluation = await AIDriveFitService.evaluateDriveFit({
      userId: authContext.userId,
      driveId,
      tenantId: authContext.tenantId,
    });

    return NextResponse.json(evaluation, {
      headers: {
        "X-RateLimit-Remaining": String(rateCheck.remaining),
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }
    if (error.message?.startsWith("FORBIDDEN") || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: error.message || "Access denied." }, { status: 403 });
    }
    if (error instanceof GeminiServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || "Failed to evaluate DriveFit." }, { status: 500 });
  }
}
