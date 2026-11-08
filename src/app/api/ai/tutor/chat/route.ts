import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AIRateLimiter } from "@/modules/ai/ai-rate-limiter";
import { AIStudyTutorService } from "@/modules/ai/services/ai-study-tutor-service";
import { GeminiServiceError } from "@/modules/ai/gemini-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.AI_STUDY_TUTOR_USE);

    // Rate limit check
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
    const { message, questionId, topic, mode, history, conversationId } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required and cannot be empty." },
        { status: 400 }
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        { error: "Message exceeds maximum allowed character length (5000)." },
        { status: 400 }
      );
    }

    const response = await AIStudyTutorService.chat({
      userId: authContext.userId,
      tenantId: authContext.tenantId,
      message: message.trim(),
      questionId,
      topic,
      mode: ["EXPLAIN", "HINT", "ANALOGY", "PRACTICE"].includes(mode) ? mode : "EXPLAIN",
      history: Array.isArray(history) ? history : [],
      conversationId,
    });

    return NextResponse.json(response, {
      headers: {
        "X-RateLimit-Remaining": String(rateCheck.remaining),
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }
    if (error.message?.startsWith("FORBIDDEN") || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: error.message || "Access denied. Insufficient permissions." }, { status: 403 });
    }
    if (error instanceof GeminiServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || "Failed to process tutor request." }, { status: 500 });
  }
}
