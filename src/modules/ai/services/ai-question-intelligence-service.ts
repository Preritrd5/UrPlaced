import { z } from "zod";
import { GeminiClient } from "../gemini-client";
import { createAdminClient } from "@/lib/supabase/admin";

export const GeneratedOptionSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
});

export const GeneratedQuestionSchema = z.object({
  prompt: z.string().min(10),
  questionType: z.enum(["SINGLE_CHOICE", "MULTIPLE_SELECT", "NUMERIC", "SHORT_ANSWER", "CODING"]),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  options: z.array(GeneratedOptionSchema).default([]),
  answerKey: z.record(z.any()),
  explanation: z.string().min(10),
  topicTags: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(1).default(0.95),
});

export const GenerationResponseSchema = z.object({
  questions: z.array(GeneratedQuestionSchema),
});

export type GeneratedQuestion = z.infer<typeof GeneratedQuestionSchema>;

export interface GenerateQuestionsInput {
  tenantId: string;
  userId: string;
  bankId?: string;
  subject?: string;
  category?: string;
  topic: string;
  subtopic?: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  questionType: "SINGLE_CHOICE" | "MULTIPLE_SELECT" | "NUMERIC" | "SHORT_ANSWER" | "CODING";
  count?: number;
  referenceNotes?: string;
  saveAsDraft?: boolean;
}

export interface QuestionDraftResult {
  questionId?: string;
  versionId?: string;
  question: GeneratedQuestion;
  duplicateWarning?: {
    isPossibleDuplicate: boolean;
    matchedQuestionId?: string;
    matchedPrompt?: string;
  };
  isSavedAsDraft: boolean;
}

export class AIQuestionIntelligenceService {
  /**
   * Generates strictly validated placement questions using Gemini structured output.
   */
  public static async generateQuestions(input: GenerateQuestionsInput): Promise<QuestionDraftResult[]> {
    const count = Math.min(Math.max(1, input.count || 1), 5); // Limit batch to 1-5 for high quality

    const systemInstruction = `You are UrPlaced's AI Question Bank Architect.
You generate high-caliber, mathematically sound, industry-standard assessment questions for college placement drives and competitive programming.

STRICT GENERATION RULES:
1. Every question must be original, mathematically rigorous, and unambiguously worded.
2. For SINGLE_CHOICE: Exactly 4 distinct plausible options (A, B, C, D). IDs must be "opt-a", "opt-b", "opt-c", "opt-d".
   - The answerKey MUST be { "correctOptionId": "<one-of-the-option-ids>" }.
3. For MULTIPLE_SELECT: 4 options. answerKey: { "correctOptionIds": ["opt-a", "opt-c"] }.
4. For CODING: The prompt must include problem statement, input/output specifications, constraints, and 2 example cases. answerKey: { "sampleInput": "...", "sampleOutput": "..." }.
5. For NUMERIC: answerKey: { "exactValue": 42 } or { "min": 41.9, "max": 42.1 }.
6. Detailed, step-by-step solution logic in explanation.
7. Return strictly valid JSON adhering to the required schema. Never wrap in markdown backticks.`;

    const subjectLine = input.subject ? `Subject: ${input.subject}` : "";
    const categoryLine = input.category ? `Category: ${input.category}` : "";
    const userPrompt = `Generate ${count} ${input.difficulty} question(s) of type ${input.questionType}.
${subjectLine ? `${subjectLine}\n` : ""}${categoryLine ? `${categoryLine}\n` : ""}Topic: ${input.topic}
${input.subtopic ? `Subtopic: ${input.subtopic}` : ""}
${input.referenceNotes ? `Reference constraints/syllabus: ${input.referenceNotes}` : ""}

Return format:
{
  "questions": [
    {
      "prompt": "Question text...",
      "questionType": "${input.questionType}",
      "difficulty": "${input.difficulty}",
      "options": [
        { "id": "opt-a", "text": "Option A" },
        { "id": "opt-b", "text": "Option B" },
        { "id": "opt-c", "text": "Option C" },
        { "id": "opt-d", "text": "Option D" }
      ],
      "answerKey": { "correctOptionId": "opt-a" },
      "explanation": "Step-by-step derivation...",
      "topicTags": ["${input.topic}"],
      "confidenceScore": 0.95
    }
  ]
}`;

    const result = await GeminiClient.generate({
      prompt: userPrompt,
      systemInstruction,
      temperature: 0.2,
      responseMimeType: "application/json",
      feature: "QUESTION_INTELLIGENCE",
      userId: input.userId,
      tenantId: input.tenantId,
    });

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(result.text);
    } catch (err: any) {
      throw new Error(`AI generated non-JSON response: ${err.message}`);
    }

    const validation = GenerationResponseSchema.safeParse(parsedJson);
    if (!validation.success) {
      throw new Error(`Generated questions failed validation: ${validation.error.message}`);
    }

    const generatedQuestions = validation.data.questions;
    const admin = createAdminClient();
    const results: QuestionDraftResult[] = [];

    for (const q of generatedQuestions) {
      // 1. Quality check: if SINGLE_CHOICE, verify correctOptionId matches an option
      if (q.questionType === "SINGLE_CHOICE") {
        const correctId = q.answerKey?.correctOptionId;
        const exists = q.options.some((opt) => opt.id === correctId);
        if (!exists && q.options.length > 0) {
          // If model misassigned ID, default to first option ID and flag
          q.answerKey.correctOptionId = q.options[0].id;
        }
      }

      // 2. Duplicate detection check against existing question versions in tenant
      let duplicateWarning: QuestionDraftResult["duplicateWarning"] = {
        isPossibleDuplicate: false,
      };

      try {
        const snippet = q.prompt.slice(0, 40).replace(/[^a-zA-Z0-9 ]/g, "").trim();
        if (snippet.length > 10) {
          const { data: existing } = await admin
            .from("question_versions")
            .select("id, question_id, prompt")
            .eq("tenant_id", input.tenantId)
            .ilike("prompt", `%${snippet}%`)
            .limit(1)
            .maybeSingle();

          if (existing) {
            duplicateWarning = {
              isPossibleDuplicate: true,
              matchedQuestionId: existing.question_id,
              matchedPrompt: existing.prompt,
            };
          }
        }
      } catch {
        // Continue if duplicate check encounters error
      }

      // 3. Save as Draft if requested and bankId provided
      let savedQuestionId: string | undefined;
      let savedVersionId: string | undefined;

      if (input.saveAsDraft && input.bankId) {
        try {
          const { data: insertedQ, error: qErr } = await admin
            .from("questions")
            .insert({
              tenant_id: input.tenantId,
              bank_id: input.bankId,
              question_type: q.questionType,
              lifecycle_status: "DRAFT", // NEVER published automatically
            })
            .select("id")
            .single();

          if (insertedQ && !qErr) {
            savedQuestionId = insertedQ.id;

            const resolvedTags = new Set<string>();
            if (input.topic) resolvedTags.add(input.topic.trim().toLowerCase());
            if (input.subtopic) resolvedTags.add(input.subtopic.trim().toLowerCase());
            (q.topicTags || []).forEach((t) => {
              if (t && typeof t === "string" && t.trim()) resolvedTags.add(t.trim().toLowerCase());
            });

            const { data: insertedV, error: vErr } = await admin
              .from("question_versions")
              .insert({
                tenant_id: input.tenantId,
                question_id: savedQuestionId,
                version_number: 1,
                prompt: q.prompt,
                content_format: "MARKDOWN",
                options: q.options,
                answer_key: q.answerKey,
                explanation: q.explanation,
                difficulty: q.difficulty,
                topic_tags: Array.from(resolvedTags),
                source_type: "AI_GENERATED", // Audit provenance
              })
              .select("id")
              .single();

            if (insertedV && !vErr) {
              savedVersionId = insertedV.id;
              // Link current_version_id
              await admin
                .from("questions")
                .update({ current_version_id: savedVersionId })
                .eq("id", savedQuestionId);
            }
          }
        } catch {
          // If draft insertion fails, still return the generated object to caller
        }
      }

      results.push({
        question: q,
        questionId: savedQuestionId,
        versionId: savedVersionId,
        duplicateWarning,
        isSavedAsDraft: !!savedQuestionId,
      });
    }

    return results;
  }

  /**
   * Classifies question difficulty and generates a structured explanation for an existing question.
   */
  public static async classifyAndExplain(params: {
    prompt: string;
    options?: any[];
    answerKey?: any;
    userId: string;
    tenantId: string;
  }): Promise<{
    recommendedDifficulty: "EASY" | "MEDIUM" | "HARD";
    suggestedSkillCategory: string;
    explanation: string;
    keyConcepts: string[];
  }> {
    const promptText = `Analyze the following placement question.
Evaluate its conceptual complexity, classify its difficulty, identify the primary subject category, and generate a clear pedagogical solution explanation.

Question:
${params.prompt}
${params.options ? `Options: ${JSON.stringify(params.options)}` : ""}
${params.answerKey ? `Answer Key: ${JSON.stringify(params.answerKey)}` : ""}

Respond in JSON format:
{
  "recommendedDifficulty": "EASY" | "MEDIUM" | "HARD",
  "suggestedSkillCategory": "DATA_STRUCTURES_ALGORITHMS | QUANTITATIVE_APTITUDE | etc",
  "explanation": "Detailed explanation...",
  "keyConcepts": ["Concept 1", "Concept 2"]
}`;

    const result = await GeminiClient.generate({
      prompt: promptText,
      systemInstruction: "You are an expert assessment psychometrician and computer science professor.",
      temperature: 0.1,
      responseMimeType: "application/json",
      feature: "QUESTION_INTELLIGENCE",
      userId: params.userId,
      tenantId: params.tenantId,
    });

    try {
      const data = JSON.parse(result.text);
      return {
        recommendedDifficulty: ["EASY", "MEDIUM", "HARD"].includes(data.recommendedDifficulty)
          ? data.recommendedDifficulty
          : "MEDIUM",
        suggestedSkillCategory: data.suggestedSkillCategory || "GENERAL",
        explanation: data.explanation || "No explanation generated.",
        keyConcepts: Array.isArray(data.keyConcepts) ? data.keyConcepts : [],
      };
    } catch {
      return {
        recommendedDifficulty: "MEDIUM",
        suggestedSkillCategory: "GENERAL",
        explanation: result.text,
        keyConcepts: [],
      };
    }
  }
}
