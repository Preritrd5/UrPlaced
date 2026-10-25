import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AIQuestionIntelligenceService } from "@/modules/ai/services/ai-question-intelligence-service";
import { GeminiServiceError } from "@/modules/ai/gemini-client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.AI_QUESTIONS_GENERATE);
    const body = await request.json();
    const { prompt, options, answerKey } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Question prompt text is required." },
        { status: 400 }
      );
    }

    const classification = await AIQuestionIntelligenceService.classifyAndExplain({
      prompt: prompt.trim(),
      options: Array.isArray(options) ? options : undefined,
      answerKey: typeof answerKey === "object" ? answerKey : undefined,
      userId: authContext.userId,
      tenantId: authContext.tenantId,
    });

    return NextResponse.json(classification);
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
    return NextResponse.json({ error: error.message || "Failed to classify question." }, { status: 500 });
  }
}
