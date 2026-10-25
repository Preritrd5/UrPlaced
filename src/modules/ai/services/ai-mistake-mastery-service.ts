import { GeminiClient } from "../gemini-client";
import { createAdminClient } from "@/lib/supabase/admin";

export interface MistakeAnalysisGap {
  skillOrTopic: string;
  observedPattern: string;
  rootCauseGap: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

export interface MistakeMasteryAnalysis {
  id?: string;
  totalMistakesAnalyzed: number;
  summary: string;
  identifiedGaps: MistakeAnalysisGap[];
  recommendedActions: {
    action: string;
    targetTopic: string;
    priority: number;
    estimatedMinutes: number;
  }[];
  recommendedQuestionIds: string[];
  hasSufficientData: boolean;
}

export class AIMistakeMasteryService {
  /**
   * Generates evidence-based gap analysis and revision roadmaps from a student's actual recorded mistakes.
   */
  public static async analyzeStudentMistakes(params: {
    userId: string;
    tenantId?: string;
  }): Promise<MistakeMasteryAnalysis> {
    const admin = createAdminClient();

    // 1. Fetch real student mistakes
    const { data: targets } = await admin
      .from("mistake_review_targets")
      .select(`
        id,
        primary_reason,
        occurrence_count,
        interval_level,
        skill_id,
        canonical_skills (
          name,
          category
        ),
        questions (
          id,
          question_type
        ),
        question_versions (
          prompt,
          difficulty,
          topic_tags,
          explanation
        )
      `)
      .eq("user_id", params.userId)
      .order("occurrence_count", { ascending: false })
      .limit(10);

    if (!targets || targets.length === 0) {
      return {
        totalMistakesAnalyzed: 0,
        summary: "No recorded mistakes found in your Mistake Bank yet. Take practice assessments or attempt questions to enable personalized AI diagnostic gap analysis.",
        identifiedGaps: [],
        recommendedActions: [
          {
            action: "Attempt an initial diagnostic practice set",
            targetTopic: "Core Aptitude & DSA",
            priority: 1,
            estimatedMinutes: 30,
          },
        ],
        recommendedQuestionIds: [],
        hasSufficientData: false,
      };
    }

    // 2. Format evidence from real records
    const evidenceList = targets.map((t: any, index: number) => {
      const qv = Array.isArray(t.question_versions) ? t.question_versions[0] : t.question_versions;
      const skill = Array.isArray(t.canonical_skills) ? t.canonical_skills[0] : t.canonical_skills;
      return {
        index: index + 1,
        questionId: t.questions?.id,
        skill: skill?.name || "General",
        category: skill?.category || "APTITUDE",
        promptSnippet: qv?.prompt ? qv.prompt.slice(0, 140) : "N/A",
        recordedMistakeReason: t.primary_reason || "CONCEPTUAL_GAP",
        occurrences: t.occurrence_count || 1,
        difficulty: qv?.difficulty || "MEDIUM",
      };
    });

    // 3. Assemble prompt with strict grounding
    const promptText = `You are UrPlaced's AI Mistake-to-Mastery Diagnostic Engine.
Analyze the following ${evidenceList.length} actual student errors from real assessment attempts.

EVIDENCE OF RECORDED STUDENT MISTAKES:
${JSON.stringify(evidenceList, null, 2)}

DIAGNOSTIC TASK:
1. Synthesize the observed error patterns into underlying conceptual gaps.
2. Differentiate clearly between data-backed observations and inferred conceptual misunderstandings.
3. Formulate an actionable, prioritized spaced-repetition revision plan.
4. Return valid JSON adhering to this schema:
{
  "summary": "Concise summary of student's diagnostic profile...",
  "identifiedGaps": [
    {
      "skillOrTopic": "Topic name",
      "observedPattern": "What the data shows (e.g. repeated time-outs on dynamic programming)",
      "rootCauseGap": "Underlying conceptual weakness (e.g. state transition formulation)",
      "severity": "HIGH | MEDIUM | LOW"
    }
  ],
  "recommendedActions": [
    {
      "action": "Specific study/practice instruction",
      "targetTopic": "Topic",
      "priority": 1,
      "estimatedMinutes": 25
    }
  ]
}`;

    const systemInstruction = `You are an expert diagnostic tutor. Base your analysis strictly on the supplied student mistake evidence. Never fabricate student attempts or pretend the student has attempted topics not in the evidence.`;

    const result = await GeminiClient.generate({
      prompt: promptText,
      systemInstruction,
      temperature: 0.1,
      responseMimeType: "application/json",
      feature: "MISTAKE_MASTERY",
      userId: params.userId,
      tenantId: params.tenantId,
    });

    let parsedData: any = {};
    try {
      parsedData = JSON.parse(result.text);
    } catch {
      parsedData = {
        summary: result.text.slice(0, 300),
        identifiedGaps: [],
        recommendedActions: [],
      };
    }

    const questionIds = evidenceList
      .map((e) => e.questionId)
      .filter(Boolean) as string[];

    // 4. Persist analysis to ai_mistake_analyses
    let savedId: string | undefined;
    try {
      const { data: inserted } = await admin
        .from("ai_mistake_analyses")
        .insert({
          user_id: params.userId,
          tenant_id: params.tenantId || null,
          summary: parsedData.summary || "Student mistake gap analysis completed.",
          identified_gaps: parsedData.identifiedGaps || [],
          recommended_actions: parsedData.recommendedActions || [],
          recommended_question_ids: questionIds,
          total_mistakes_analyzed: evidenceList.length,
        })
        .select("id")
        .single();

      if (inserted) {
        savedId = inserted.id;
      }
    } catch {
      // Persistence error does not block returning analysis
    }

    return {
      id: savedId,
      totalMistakesAnalyzed: evidenceList.length,
      summary: parsedData.summary || "Analysis completed.",
      identifiedGaps: parsedData.identifiedGaps || [],
      recommendedActions: parsedData.recommendedActions || [],
      recommendedQuestionIds: questionIds,
      hasSufficientData: true,
    };
  }
}
