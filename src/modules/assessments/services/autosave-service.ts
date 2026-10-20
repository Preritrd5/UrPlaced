/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Assessment Engine: Resilient Autosave Service
 * ==============================================================================
 * Handles granular question autosave with sequence-versioning concurrency control.
 * Prevents out-of-order network packets from overwriting newer candidate answers.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AutosaveInput {
  attemptId: string;
  questionId: string;
  versionId: string;
  responsePayload: Record<string, any>;
  saveSequence: number;
  isFlagged?: boolean;
  isAnswered?: boolean;
}

export interface AutosaveResult {
  success: boolean;
  acknowledged: boolean;
  overwritten: boolean;
  currentSequence: number;
  lastSavedAt: string;
  error?: string;
}

export class AutosaveService {
  /**
   * Persists a question response ensuring server timer validity and
   * monotonic sequence versioning.
   */
  public static async saveResponse(
    tenantId: string,
    studentId: string,
    input: AutosaveInput
  ): Promise<AutosaveResult> {
    const supabase = await createServerSupabaseClient();

    // 1. Validate attempt status & expiry
    const { data: attempt, error: attErr } = await supabase
      .from("assessment_attempts")
      .select("id, status, expires_at, student_id")
      .eq("tenant_id", tenantId)
      .eq("id", input.attemptId)
      .single();

    if (attErr || !attempt) {
      return {
        success: false,
        acknowledged: false,
        overwritten: false,
        currentSequence: 0,
        lastSavedAt: new Date().toISOString(),
        error: "Attempt record not found.",
      };
    }

    if (attempt.student_id !== studentId) {
      return {
        success: false,
        acknowledged: false,
        overwritten: false,
        currentSequence: 0,
        lastSavedAt: new Date().toISOString(),
        error: "Forbidden: Not authorized to modify this attempt.",
      };
    }

    if (attempt.status !== "IN_PROGRESS") {
      return {
        success: false,
        acknowledged: false,
        overwritten: false,
        currentSequence: 0,
        lastSavedAt: new Date().toISOString(),
        error: `Cannot save response: attempt status is ${attempt.status}.`,
      };
    }

    const now = new Date();
    if (attempt.expires_at && new Date(attempt.expires_at) < now) {
      return {
        success: false,
        acknowledged: false,
        overwritten: false,
        currentSequence: 0,
        lastSavedAt: now.toISOString(),
        error: "Time limit expired. Attempt is closed for further answers.",
      };
    }

    // 2. Fetch existing response to verify sequence order
    const { data: existingResp } = await supabase
      .from("attempt_responses")
      .select("id, save_sequence, last_saved_at")
      .eq("tenant_id", tenantId)
      .eq("attempt_id", input.attemptId)
      .eq("question_id", input.questionId)
      .maybeSingle();

    const incomingSeq = Number(input.saveSequence || 1);

    if (existingResp) {
      const existingSeq = Number(existingResp.save_sequence || 0);

      // Stale packet dropped (out-of-order network delay)
      if (incomingSeq < existingSeq) {
        return {
          success: true,
          acknowledged: true,
          overwritten: false,
          currentSequence: existingSeq,
          lastSavedAt: existingResp.last_saved_at,
        };
      }

      // Safe to update with newer sequence
      const savedAt = now.toISOString();
      const { error: upErr } = await supabase
        .from("attempt_responses")
        .update({
          version_id: input.versionId,
          response_payload: input.responsePayload,
          save_sequence: incomingSeq,
          is_flagged: Boolean(input.isFlagged),
          is_answered: Boolean(input.isAnswered),
          last_saved_at: savedAt,
        })
        .eq("id", existingResp.id);

      if (upErr) {
        return {
          success: false,
          acknowledged: false,
          overwritten: false,
          currentSequence: existingSeq,
          lastSavedAt: existingResp.last_saved_at,
          error: upErr.message,
        };
      }

      return {
        success: true,
        acknowledged: true,
        overwritten: true,
        currentSequence: incomingSeq,
        lastSavedAt: savedAt,
      };
    }

    // Insert initial record
    const savedAt = now.toISOString();
    const { error: insErr } = await supabase
      .from("attempt_responses")
      .insert({
        tenant_id: tenantId,
        attempt_id: input.attemptId,
        question_id: input.questionId,
        version_id: input.versionId,
        response_payload: input.responsePayload,
        save_sequence: incomingSeq,
        is_flagged: Boolean(input.isFlagged),
        is_answered: Boolean(input.isAnswered),
        last_saved_at: savedAt,
      });

    if (insErr) {
      return {
        success: false,
        acknowledged: false,
        overwritten: false,
        currentSequence: 0,
        lastSavedAt: savedAt,
        error: insErr.message,
      };
    }

    return {
      success: true,
      acknowledged: true,
      overwritten: true,
      currentSequence: incomingSeq,
      lastSavedAt: savedAt,
    };
  }
}
