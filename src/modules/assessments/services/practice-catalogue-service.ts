/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Assessment Engine: Practice Discovery & Behavioral Preparation Service
 * ==============================================================================
 * Connects approved question content to untimed student practice sessions,
 * canonical skill drill-downs, and HR / Group Discussion preparation guidance.
 */

import {
  CanonicalSkillRow,
  BehavioralCategory,
  StudentBehavioralResponseRow,
  QuestionType,
} from "@/types/database";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface LogPracticeSessionInput {
  skill_id?: string | null;
  topic?: string | null;
  questions_practiced: number;
  correct_count: number;
  time_spent_seconds: number;
}

export interface SaveBehavioralDraftInput {
  prompt: string;
  category: BehavioralCategory;
  response_text: string;
  self_reflection?: string | null;
  key_learnings?: string | null;
}

export const BehavioralGuidelines = {
  starMethod: {
    title: "The STAR Framework for HR Interviews",
    description:
      "Structure your situational and behavioral responses with clarity, focus, and measurable outcomes.",
    steps: [
      {
        step: "Situation",
        directive:
          "Set the context. Describe the event or situation that you were in, the company or academic project, and key constraints.",
      },
      {
        step: "Task",
        directive:
          "Explain the goal or challenge. What was your specific responsibility or objective in that scenario?",
      },
      {
        step: "Action",
        directive:
          "Detail the specific actions you personally took. Highlight skills, tools, leadership, and problem-solving techniques.",
      },
      {
        step: "Result",
        directive:
          "Quantify the outcome. What happened? What did you accomplish or learn? Use percentages, turnaround time, or tangible impact.",
      },
    ],
  },
  groupDiscussionGuidelines: {
    title: "Campus Group Discussion (GD) Preparation Strategy",
    description:
      "Master high-impact communication, constructive consensus-building, and professional composure during GD rounds.",
    tips: [
      {
        area: "Initiation & Opening",
        advice:
          "Only initiate if you understand the topic clearly. Provide a structured definition and set a collaborative direction for the group rather than monopolizing.",
      },
      {
        area: "Constructive Counter-arguments",
        advice:
          "Acknowledge the peer's point first ('I appreciate your perspective on X; however, consider factor Y...'). Never interrupt aggressively or display dismissive gestures.",
      },
      {
        area: "Active Moderation",
        advice:
          "If the group enters a chaotic argument, calmly bring focus back to the core agenda: 'Let us structure this around economic vs social implications.' Invite silent members politely.",
      },
      {
        area: "Body Language & Etiquette",
        advice:
          "Maintain open posture, make eye contact with fellow candidates (not just the evaluators), and nod respectfully when others present strong arguments.",
      },
      {
        area: "Concluding Summary",
        advice:
          "Summarize both sides neutrally if requested. Never introduce new arguments in the final summary; represent the consensus accurately.",
      },
    ],
  },
};

export class PracticeCatalogueService {
  /**
   * Retrieves practice question banks and canonical skills with practice counts.
   */
  public static async getPracticeCatalogue(tenantId: string) {
    const supabase = await createServerSupabaseClient();

    // 1. Fetch canonical skills
    const { data: skills } = await supabase
      .from("canonical_skills")
      .select("id, name, category, description")
      .order("name", { ascending: true });

    // 2. Fetch practice question sets
    const { data: practiceSets } = await supabase
      .from("question_sets")
      .select(`
        id,
        name,
        description,
        purpose,
        status,
        items:question_set_items(count)
      `)
      .eq("tenant_id", tenantId)
      .in("purpose", ["PRACTICE", "COMPANY_PREP", "DIAGNOSTIC"])
      .eq("status", "PUBLISHED");

    return {
      skills: skills || [],
      practiceSets: (practiceSets || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        purpose: s.purpose,
        questionCount: Array.isArray(s.items)
          ? s.items[0]?.count || 0
          : s.items?.count || 0,
      })),
      behavioralGuidelines: BehavioralGuidelines,
    };
  }

  /**
   * Logs an untimed informal practice session for a student.
   */
  public static async logPracticeSession(
    tenantId: string,
    studentId: string,
    input: LogPracticeSessionInput
  ) {
    const supabase = await createServerSupabaseClient();

    return supabase.from("preparation_practice_sessions").insert({
      tenant_id: tenantId,
      student_id: studentId,
      skill_id: input.skill_id || null,
      topic: input.topic || null,
      questions_practiced: Math.max(0, input.questions_practiced),
      correct_count: Math.max(0, input.correct_count),
      time_spent_seconds: Math.max(0, input.time_spent_seconds),
    });
  }

  /**
   * Saves or updates a student's behavioral interview reflection draft.
   */
  public static async saveBehavioralResponse(
    tenantId: string,
    studentId: string,
    input: SaveBehavioralDraftInput
  ): Promise<{ success: boolean; data?: StudentBehavioralResponseRow; error?: string }> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("student_behavioral_responses")
      .insert({
        tenant_id: tenantId,
        student_id: studentId,
        prompt: input.prompt.trim(),
        category: input.category,
        response_text: input.response_text.trim(),
        self_reflection: input.self_reflection || null,
        key_learnings: input.key_learnings || null,
      })
      .select("*")
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  }

  /**
   * Lists a student's saved behavioral preparation drafts.
   */
  public static async listBehavioralResponses(
    tenantId: string,
    studentId: string,
    category?: BehavioralCategory
  ) {
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from("student_behavioral_responses")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false });

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    return { responses: data || [], error: error?.message };
  }
}
