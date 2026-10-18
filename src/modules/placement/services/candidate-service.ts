/**
 * Candidate Service
 * Handles drive registration, eligibility verification, stage advancement, and stage evaluations.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { EligibilityEngine } from "@/modules/eligibility/services/eligibility-engine";
import { StageService } from "@/modules/recruitment-drives/services/stage-service";
import type { Database, ApplicationStatus, StageResultStatus } from "@/types/database";

export type ApplicationRow = Database["public"]["Tables"]["drive_applications"]["Row"];
export type StageResultRow = Database["public"]["Tables"]["candidate_stage_results"]["Row"];

export class CandidateService {
  /**
   * Register a student for a recruitment drive
   */
  static async registerCandidate(params: {
    tenantId: string;
    driveId: string;
    studentId: string;
    registeredBy?: string | null;
  }): Promise<ApplicationRow> {
    const supabase = createAdminClient();

    // 1. Fetch drive and verify registration eligibility
    const { data: drive, error: driveErr } = await supabase
      .from("recruitment_drives")
      .select("*, criteria:drive_eligibility_criteria(*), stages:drive_stages(*)")
      .eq("tenant_id", params.tenantId)
      .eq("id", params.driveId)
      .single();

    if (driveErr || !drive) {
      throw new Error("Recruitment drive not found.");
    }

    if (drive.status !== "PUBLISHED" && drive.status !== "REGISTRATION_OPEN") {
      throw new Error(`Drive is not accepting registrations. Current status: ${drive.status}.`);
    }

    if (drive.registration_deadline && new Date() > new Date(drive.registration_deadline)) {
      throw new Error("Registration deadline for this drive has passed.");
    }

    // 2. Fetch student details
    const { data: student, error: studentErr } = await supabase
      .from("students")
      .select("*")
      .eq("tenant_id", params.tenantId)
      .eq("id", params.studentId)
      .single();

    if (studentErr || !student) {
      throw new Error("Student record not found.");
    }

    // 3. Evaluate eligibility
    const criteria = drive.criteria?.[0];
    if (!criteria) {
      throw new Error("Drive eligibility criteria has not been configured.");
    }

    const evaluation = EligibilityEngine.evaluate(student, criteria);
    if (!evaluation.isEligible && evaluation.status !== "NEEDS_REVIEW") {
      throw new Error(
        `Student does not meet eligibility requirements: ${evaluation.failedCriteria.map((f) => f.label).join(", ")}`
      );
    }

    // Determine initial stage
    const sortedStages = (drive.stages || []).sort((a: any, b: any) => a.stage_order - b.stage_order);
    const initialStageId = sortedStages[0]?.id || null;

    // 4. Create application
    const { data: application, error: appErr } = await supabase
      .from("drive_applications")
      .insert({
        tenant_id: params.tenantId,
        drive_id: params.driveId,
        student_id: params.studentId,
        status: evaluation.status === "NEEDS_REVIEW" ? "IN_PROCESS" : "REGISTERED",
        eligibility_snapshot: evaluation as any,
        current_stage_id: initialStageId,
        registered_by: params.registeredBy || null,
      })
      .select()
      .single();

    if (appErr) {
      if (appErr.code === "23505") {
        throw new Error("Student has already registered for this recruitment drive.");
      }
      throw new Error(`Failed to register candidate: ${appErr.message}`);
    }

    // Initialize first stage result if stage exists
    if (initialStageId) {
      await supabase.from("candidate_stage_results").insert({
        tenant_id: params.tenantId,
        application_id: application.id,
        stage_id: initialStageId,
        status: "PENDING",
      });
    }

    return application;
  }

  /**
   * List candidates registered for a drive
   */
  static async listByDrive(
    tenantId: string,
    driveId: string
  ): Promise<any[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("drive_applications")
      .select(
        "*, student:students(*, department:departments(name, code)), current_stage:drive_stages(name, stage_type, stage_order), results:candidate_stage_results(*)"
      )
      .eq("tenant_id", tenantId)
      .eq("drive_id", driveId)
      .order("registration_date", { ascending: false });

    if (error) {
      throw new Error(`Failed to list drive candidates: ${error.message}`);
    }

    return data || [];
  }

  /**
   * List applications for a specific student
   */
  static async listByStudent(tenantId: string, studentId: string): Promise<any[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("drive_applications")
      .select(
        "*, drive:recruitment_drives(*, company:companies(name, industry)), current_stage:drive_stages(name, stage_type), results:candidate_stage_results(*, stage:drive_stages(name, is_student_visible))"
      )
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .order("registration_date", { ascending: false });

    if (error) {
      throw new Error(`Failed to list student applications: ${error.message}`);
    }

    // Filter results to only student-visible feedback
    return (data || []).map((app: any) => ({
      ...app,
      results: (app.results || [])
        .filter((r: any) => r.stage?.is_student_visible !== false)
        .map((r: any) => ({
          ...r,
          internal_notes: undefined, // Never leak internal notes to student
        })),
    }));
  }

  /**
   * Update candidate stage progress and evaluation
   */
  static async recordStageResult(params: {
    tenantId: string;
    applicationId: string;
    stageId: string;
    status: StageResultStatus;
    score?: number | null;
    studentFeedback?: string | null;
    internalNotes?: string | null;
    evaluatedBy?: string | null;
  }): Promise<StageResultRow> {
    const supabase = createAdminClient();

    const { data: result, error } = await supabase
      .from("candidate_stage_results")
      .upsert(
        {
          tenant_id: params.tenantId,
          application_id: params.applicationId,
          stage_id: params.stageId,
          status: params.status,
          score: params.score ?? null,
          student_feedback: params.studentFeedback ?? null,
          internal_notes: params.internalNotes ?? null,
          evaluated_by: params.evaluatedBy ?? null,
          evaluated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "application_id,stage_id" }
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to record stage evaluation: ${error.message}`);
    }

    // If candidate passed this stage, advance current_stage_id if next stage exists
    if (params.status === "PASSED") {
      const { data: currentStage } = await supabase
        .from("drive_stages")
        .select("drive_id, stage_order")
        .eq("id", params.stageId)
        .single();

      if (currentStage) {
        const { data: nextStage } = await supabase
          .from("drive_stages")
          .select("id")
          .eq("drive_id", currentStage.drive_id)
          .eq("stage_order", currentStage.stage_order + 1)
          .maybeSingle();

        if (nextStage) {
          await supabase
            .from("drive_applications")
            .update({ current_stage_id: nextStage.id, status: "IN_PROCESS" })
            .eq("id", params.applicationId);

          // Auto-init next stage result as PENDING
          await supabase.from("candidate_stage_results").upsert(
            {
              tenant_id: params.tenantId,
              application_id: params.applicationId,
              stage_id: nextStage.id,
              status: "PENDING",
            },
            { onConflict: "application_id,stage_id" }
          );
        }
      }
    } else if (params.status === "FAILED") {
      await supabase
        .from("drive_applications")
        .update({ status: "REJECTED" })
        .eq("id", params.applicationId);
    }

    return result;
  }

  /**
   * Withdraw an application
   */
  static async withdraw(
    tenantId: string,
    applicationId: string,
    reason?: string
  ): Promise<ApplicationRow> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("drive_applications")
      .update({
        status: "WITHDRAWN",
        withdrawn_at: new Date().toISOString(),
        withdrawn_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", applicationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to withdraw candidate application: ${error.message}`);
    }

    return data;
  }
}
