import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AIRateLimiter } from "@/modules/ai/ai-rate-limiter";
import { AIQuestionIntelligenceService } from "@/modules/ai/services/ai-question-intelligence-service";
import { GeminiServiceError } from "@/modules/ai/gemini-client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.AI_QUESTIONS_GENERATE);

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
    const { topic, subtopic, difficulty, questionType, count, referenceNotes, bankId, saveAsDraft } = body;

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return NextResponse.json(
        { error: "Subject or topic is required." },
        { status: 400 }
      );
    }

    const validDifficulties = ["EASY", "MEDIUM", "HARD"];
    const validTypes = ["SINGLE_CHOICE", "MULTIPLE_SELECT", "NUMERIC", "SHORT_ANSWER", "CODING"];

    if (!validDifficulties.includes(difficulty)) {
      return NextResponse.json(
        { error: `Invalid difficulty. Allowed values: ${validDifficulties.join(", ")}` },
        { status: 400 }
      );
    }

    if (!validTypes.includes(questionType)) {
      return NextResponse.json(
        { error: `Invalid question type. Allowed values: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const maxAllowed = process.env.MAX_AI_QUESTIONS_PER_REQUEST
      ? parseInt(process.env.MAX_AI_QUESTIONS_PER_REQUEST, 10)
      : 20;

    const parsedCount = typeof count === "number" ? count : parseInt(String(count), 10);
    if (isNaN(parsedCount) || !Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > maxAllowed) {
      return NextResponse.json(
        { error: `Number of questions must be an integer between 1 and ${maxAllowed}.` },
        { status: 400 }
      );
    }

    let bankSubject: string | undefined;
    let bankCategory: string | undefined;

    if (bankId) {
      const supabase = await createServerSupabaseClient();
      const { data: bankRecord, error: bankErr } = await supabase
        .from("question_banks")
        .select("id, tenant_id, name, category")
        .eq("id", bankId)
        .eq("tenant_id", authContext.tenantId)
        .maybeSingle();

      if (bankErr || !bankRecord) {
        return NextResponse.json(
          { error: "Target Question Bank not found or does not belong to your college." },
          { status: 404 }
        );
      }
      bankSubject = (bankRecord as any)?.subject || bankRecord.name;
      bankCategory = bankRecord.category;
    } else if (saveAsDraft) {
      return NextResponse.json(
        { error: "Target Question Bank is required to save generated questions." },
        { status: 400 }
      );
    }

    const results = await AIQuestionIntelligenceService.generateQuestions({
      tenantId: authContext.tenantId,
      userId: authContext.userId,
      bankId,
      subject: bankSubject,
      category: bankCategory,
      topic: topic.trim(),
      subtopic: typeof subtopic === "string" ? subtopic.trim() : undefined,
      difficulty,
      questionType,
      count: parsedCount,
      referenceNotes: typeof referenceNotes === "string" ? referenceNotes.slice(0, 1000) : undefined,
      saveAsDraft: Boolean(saveAsDraft),
    });

    return NextResponse.json(
      { questions: results, count: results.length },
      {
        headers: {
          "X-RateLimit-Remaining": String(rateCheck.remaining),
        },
      }
    );
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }
    if (error.message?.startsWith("FORBIDDEN") || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: error.message || "Access denied. Only authorized placement staff may generate questions." }, { status: 403 });
    }
    if (error instanceof GeminiServiceError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || "Failed to generate questions." }, { status: 500 });
  }
}
