import { GoogleGenAI } from "@google/genai";
import { createAdminClient } from "@/lib/supabase/admin";

export interface GenerateOptions {
  prompt?: string;
  parts?: any[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: any;
  timeoutMs?: number;
  feature:
    | "STUDY_TUTOR"
    | "QUESTION_INTELLIGENCE"
    | "MISTAKE_MASTERY"
    | "DRIVEFIT"
    | "PLACEMENT_INTELLIGENCE"
    | "RESUME_SCAN"
    | "DRIVE_MATCH"
    | "SKILL_GAP_ANALYSIS"
    | "MOCK_INTERVIEW"
    | "CAREER_PASSPORT";
  userId?: string;
  tenantId?: string;
}

export interface GenerateResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  model: string;
}

export class GeminiServiceError extends Error {
  public code: string;
  public status: number;

  constructor(message: string, code = "AI_SERVICE_ERROR", status = 500) {
    super(message);
    this.name = "GeminiServiceError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Centralized, server-only Gemini AI client wrapper.
 * Strictly enforces API key protection, timeout boundaries, transient error retries,
 * emergency kill-switch, and usage audit logging.
 */
export class GeminiClient {
  private static defaultModel = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

  /**
   * Cleans and sanitizes the configured GEMINI_API_KEY from environment.
   * Strips accidental leading quotes, equals signs, or trailing whitespace.
   */
  public static getSanitizedKey(): string {
    const rawKey = process.env.GEMINI_API_KEY;
    if (!rawKey || typeof rawKey !== "string") {
      throw new GeminiServiceError(
        "GEMINI_API_KEY is not configured on the server. Please check your environment configuration.",
        "MISSING_API_KEY",
        503
      );
    }

    const cleanKey = rawKey.replace(/^[\s='"]+|[\s'"]+$/g, "").trim();
    if (cleanKey.length < 10) {
      throw new GeminiServiceError(
        "Configured GEMINI_API_KEY appears invalid or malformed.",
        "INVALID_API_KEY",
        503
      );
    }

    return cleanKey;
  }

  /**
   * Initializes the GoogleGenAI instance.
   */
  private static getSdkClient(): GoogleGenAI {
    const apiKey = this.getSanitizedKey();
    return new GoogleGenAI({ apiKey });
  }

  /**
   * Executes content generation with timeout, retry, model fallback, and audit logging.
   */
  public static async generate(options: GenerateOptions): Promise<GenerateResult> {
    // 1. Check emergency switch
    if (process.env.AI_ENABLED === "false") {
      throw new GeminiServiceError(
        "AI capabilities are temporarily disabled by the administrator.",
        "AI_SERVICE_DISABLED",
        503
      );
    }

    const startTime = Date.now();
    const client = this.getSdkClient();
    const model = process.env.GEMINI_MODEL || this.defaultModel;
    const timeoutMs = options.timeoutMs || 25000;
    const maxRetries = 2;

    let lastError: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const generationConfig: Record<string, any> = {
          temperature: options.temperature ?? 0.2,
        };

        if (options.maxOutputTokens) {
          generationConfig.maxOutputTokens = options.maxOutputTokens;
        }

        if (options.responseMimeType) {
          generationConfig.responseMimeType = options.responseMimeType;
        }

        if (options.responseSchema) {
          generationConfig.responseSchema = options.responseSchema;
        }

        if (options.systemInstruction) {
          generationConfig.systemInstruction = options.systemInstruction;
        }

        // Use Promise.race with timeout controller
        const timeoutPromise = new Promise<never>((_, reject) => {
          const id = setTimeout(() => {
            clearTimeout(id);
            reject(new GeminiServiceError(`AI request timed out after ${timeoutMs}ms.`, "TIMEOUT", 504));
          }, timeoutMs);
        });

        const apiCallPromise = client.models.generateContent({
          model,
          contents: options.parts && options.parts.length > 0 ? options.parts : (options.prompt || ""),
          config: generationConfig,
        });

        const response: any = await Promise.race([apiCallPromise, timeoutPromise]);
        const durationMs = Date.now() - startTime;

        const text = response.text || "";
        const usage = response.usageMetadata || {};
        const promptTokens = usage.promptTokenCount || 0;
        const completionTokens = usage.candidatesTokenCount || 0;
        const totalTokens = usage.totalTokenCount || promptTokens + completionTokens;

        // Async usage logging (non-blocking)
        void this.logUsage({
          tenantId: options.tenantId,
          userId: options.userId,
          feature: options.feature,
          model,
          promptTokens,
          completionTokens,
          totalTokens,
          durationMs,
          status: "SUCCESS",
        });

        return {
          text,
          promptTokens,
          completionTokens,
          totalTokens,
          durationMs,
          model,
        };
      } catch (err: any) {
        lastError = err;
        const isTransient =
          err?.status === 429 ||
          err?.status === 503 ||
          err?.message?.includes("RESOURCE_EXHAUSTED") ||
          err?.message?.includes("quota") ||
          err?.code === "ETIMEDOUT";

        if (isTransient && attempt < maxRetries) {
          // Exponential backoff: 1s, 2s
          const backoff = (attempt + 1) * 1000;
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }

        break;
      }
    }

    const durationMs = Date.now() - startTime;
    const errorMsg = lastError?.message || "Unknown AI provider error";
    const isRateLimit =
      lastError?.status === 429 ||
      errorMsg.includes("RESOURCE_EXHAUSTED") ||
      errorMsg.includes("quota");

    void this.logUsage({
      tenantId: options.tenantId,
      userId: options.userId,
      feature: options.feature,
      model,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      durationMs,
      status: isRateLimit ? "RATE_LIMITED" : "ERROR",
      errorMessage: errorMsg.slice(0, 500),
    });

    if (isRateLimit) {
      throw new GeminiServiceError(
        "AI provider rate limit or quota exceeded. Please wait a moment and try again.",
        "RATE_LIMITED",
        429
      );
    }

    if (lastError instanceof GeminiServiceError) {
      throw lastError;
    }

    throw new GeminiServiceError(
      `AI generation failed: ${errorMsg}`,
      "PROVIDER_ERROR",
      502
    );
  }

  /**
   * Safe usage logger to database. Fails silently so audit issues never block features.
   */
  private static async logUsage(entry: {
    tenantId?: string;
    userId?: string;
    feature: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    durationMs: number;
    status: "SUCCESS" | "ERROR" | "RATE_LIMITED";
    errorMessage?: string;
  }): Promise<void> {
    try {
      const admin = createAdminClient();
      await admin.from("ai_usage_logs").insert({
        tenant_id: entry.tenantId || null,
        user_id: entry.userId || null,
        feature: entry.feature,
        model: entry.model,
        prompt_tokens: entry.promptTokens,
        completion_tokens: entry.completionTokens,
        total_tokens: entry.totalTokens,
        duration_ms: entry.durationMs,
        status: entry.status,
        error_message: entry.errorMessage || null,
      });
    } catch {
      // Graceful fallback if database logging fails or table unseeded
    }
  }
}
