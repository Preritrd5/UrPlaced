import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AIRateLimiter } from "@/modules/ai/ai-rate-limiter";
import { AIPlacementIntelligenceService } from "@/modules/ai/services/ai-placement-intelligence-service";
import { GeminiServiceError } from "@/modules/ai/gemini-client";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.AI_PLACEMENT_INTEL_READ);

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

    const report = await AIPlacementIntelligenceService.generateCohortInsights({
      tenantId: authContext.tenantId,
      userId: authContext.userId,
    });

    return NextResponse.json(report, {
      headers: {
        "X-RateLimit-Remaining": String(rateCheck.remaining),
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied. Only institutional placement personnel may view placement intelligence." }, { status: 403 });
    }
    if (error instanceof GeminiServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || "Failed to generate placement insights." }, { status: 500 });
  }
}
