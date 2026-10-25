import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AIRateLimiter } from "@/modules/ai/ai-rate-limiter";
import { AIMistakeMasteryService } from "@/modules/ai/services/ai-mistake-mastery-service";
import { GeminiServiceError } from "@/modules/ai/gemini-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.AI_MISTAKE_MASTERY_USE);

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

    const analysis = await AIMistakeMasteryService.analyzeStudentMistakes({
      userId: authContext.userId,
      tenantId: authContext.tenantId,
    });

    return NextResponse.json(analysis, {
      headers: {
        "X-RateLimit-Remaining": String(rateCheck.remaining),
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }
    if (error instanceof GeminiServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || "Failed to analyze mistakes." }, { status: 500 });
  }
}
