/**
 * Eligibility Criteria Engine
 * Deterministic, explainable evaluation of student qualifications against recruitment drive criteria.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, StudentRow } from "@/types/database";

export type DriveCriteriaRow = Database["public"]["Tables"]["drive_eligibility_criteria"]["Row"];
export type DriveCriteriaInsert = Database["public"]["Tables"]["drive_eligibility_criteria"]["Insert"];

export type EligibilityStatus = "ELIGIBLE" | "INELIGIBLE" | "NEEDS_REVIEW";

export interface CriterionResult {
  code: string;
  label: string;
  passed: boolean;
  needsReview?: boolean;
  required: string | number | string[] | number[];
  actual: string | number | null | undefined;
  explanation: string;
}

export interface EligibilityEvaluation {
  status: EligibilityStatus;
  isEligible: boolean;
  passedCriteria: CriterionResult[];
  failedCriteria: CriterionResult[];
  missingData: CriterionResult[];
  summary: string;
  evaluatedAt: string;
}

export class EligibilityEngine {
  /**
   * Evaluate a student against recruitment drive criteria
   */
  static evaluate(
    student: {
      id: string;
      cgpa: number;
      tenth_percentage: number | null;
      twelfth_percentage: number | null;
      active_backlogs: number;
      total_backlogs: number;
      department_id: string;
      graduation_year: number;
      degree: string;
      academic_status: string;
    },
    criteria: DriveCriteriaRow | DriveCriteriaInsert
  ): EligibilityEvaluation {
    const passedCriteria: CriterionResult[] = [];
    const failedCriteria: CriterionResult[] = [];
    const missingData: CriterionResult[] = [];

    // 1. CGPA Criterion
    const minCgpa = criteria.min_cgpa ?? 0;
    if (student.cgpa >= minCgpa) {
      passedCriteria.push({
        code: "CGPA",
        label: "Minimum CGPA",
        passed: true,
        required: minCgpa,
        actual: student.cgpa,
        explanation: `Student CGPA (${student.cgpa.toFixed(2)}) meets or exceeds required minimum (${minCgpa.toFixed(2)}).`,
      });
    } else {
      failedCriteria.push({
        code: "CGPA",
        label: "Minimum CGPA",
        passed: false,
        required: minCgpa,
        actual: student.cgpa,
        explanation: `Student CGPA (${student.cgpa.toFixed(2)}) is below required minimum (${minCgpa.toFixed(2)}).`,
      });
    }

    // 2. 10th Percentage Criterion
    if (criteria.min_tenth_percentage !== null && criteria.min_tenth_percentage !== undefined) {
      if (student.tenth_percentage === null || student.tenth_percentage === undefined) {
        missingData.push({
          code: "TENTH_PERCENTAGE",
          label: "10th Grade Percentage",
          passed: false,
          needsReview: true,
          required: criteria.min_tenth_percentage,
          actual: null,
          explanation: `Drive requires minimum 10th percentage (${criteria.min_tenth_percentage}%), but student record has no 10th percentage recorded.`,
        });
      } else if (student.tenth_percentage >= criteria.min_tenth_percentage) {
        passedCriteria.push({
          code: "TENTH_PERCENTAGE",
          label: "10th Grade Percentage",
          passed: true,
          required: criteria.min_tenth_percentage,
          actual: student.tenth_percentage,
          explanation: `10th percentage (${student.tenth_percentage}%) meets or exceeds required minimum (${criteria.min_tenth_percentage}%).`,
        });
      } else {
        failedCriteria.push({
          code: "TENTH_PERCENTAGE",
          label: "10th Grade Percentage",
          passed: false,
          required: criteria.min_tenth_percentage,
          actual: student.tenth_percentage,
          explanation: `10th percentage (${student.tenth_percentage}%) is below required minimum (${criteria.min_tenth_percentage}%).`,
        });
      }
    }

    // 3. 12th Percentage Criterion
    if (criteria.min_twelfth_percentage !== null && criteria.min_twelfth_percentage !== undefined) {
      if (student.twelfth_percentage === null || student.twelfth_percentage === undefined) {
        missingData.push({
          code: "TWELFTH_PERCENTAGE",
          label: "12th Grade / Diploma Percentage",
          passed: false,
          needsReview: true,
          required: criteria.min_twelfth_percentage,
          actual: null,
          explanation: `Drive requires minimum 12th percentage (${criteria.min_twelfth_percentage}%), but student record has no 12th percentage recorded.`,
        });
      } else if (student.twelfth_percentage >= criteria.min_twelfth_percentage) {
        passedCriteria.push({
          code: "TWELFTH_PERCENTAGE",
          label: "12th Grade / Diploma Percentage",
          passed: true,
          required: criteria.min_twelfth_percentage,
          actual: student.twelfth_percentage,
          explanation: `12th percentage (${student.twelfth_percentage}%) meets or exceeds required minimum (${criteria.min_twelfth_percentage}%).`,
        });
      } else {
        failedCriteria.push({
          code: "TWELFTH_PERCENTAGE",
          label: "12th Grade / Diploma Percentage",
          passed: false,
          required: criteria.min_twelfth_percentage,
          actual: student.twelfth_percentage,
          explanation: `12th percentage (${student.twelfth_percentage}%) is below required minimum (${criteria.min_twelfth_percentage}%).`,
        });
      }
    }

    // 4. Active Backlogs
    const maxActive = criteria.max_active_backlogs ?? 0;
    if (student.active_backlogs <= maxActive) {
      passedCriteria.push({
        code: "ACTIVE_BACKLOGS",
        label: "Active Backlog Limit",
        passed: true,
        required: maxActive,
        actual: student.active_backlogs,
        explanation: `Student has ${student.active_backlogs} active backlog(s), within limit of ${maxActive}.`,
      });
    } else {
      failedCriteria.push({
        code: "ACTIVE_BACKLOGS",
        label: "Active Backlog Limit",
        passed: false,
        required: maxActive,
        actual: student.active_backlogs,
        explanation: `Student has ${student.active_backlogs} active backlog(s), which exceeds limit of ${maxActive}.`,
      });
    }

    // 5. Total Backlogs (if specified)
    if (criteria.max_total_backlogs !== null && criteria.max_total_backlogs !== undefined) {
      if (student.total_backlogs <= criteria.max_total_backlogs) {
        passedCriteria.push({
          code: "TOTAL_BACKLOGS",
          label: "Total History Backlogs Limit",
          passed: true,
          required: criteria.max_total_backlogs,
          actual: student.total_backlogs,
          explanation: `Student total backlogs (${student.total_backlogs}) within limit of ${criteria.max_total_backlogs}.`,
        });
      } else {
        failedCriteria.push({
          code: "TOTAL_BACKLOGS",
          label: "Total History Backlogs Limit",
          passed: false,
          required: criteria.max_total_backlogs,
          actual: student.total_backlogs,
          explanation: `Student total backlogs (${student.total_backlogs}) exceeds limit of ${criteria.max_total_backlogs}.`,
        });
      }
    }

    // 6. Allowed Departments
    const allowedDepts = criteria.allowed_departments || [];
    if (allowedDepts.length === 0 || allowedDepts.includes(student.department_id)) {
      passedCriteria.push({
        code: "DEPARTMENT",
        label: "Eligible Department / Branch",
        passed: true,
        required: allowedDepts.length === 0 ? "All Departments" : allowedDepts,
        actual: student.department_id,
        explanation: "Student's department is eligible for this drive.",
      });
    } else {
      failedCriteria.push({
        code: "DEPARTMENT",
        label: "Eligible Department / Branch",
        passed: false,
        required: allowedDepts,
        actual: student.department_id,
        explanation: "Student's department is not in the eligible department list for this drive.",
      });
    }

    // 7. Allowed Graduation Years
    const allowedYears = criteria.allowed_graduation_years || [];
    if (allowedYears.length === 0 || allowedYears.includes(student.graduation_year)) {
      passedCriteria.push({
        code: "GRADUATION_YEAR",
        label: "Eligible Graduation Batch",
        passed: true,
        required: allowedYears.length === 0 ? "All Batches" : allowedYears,
        actual: student.graduation_year,
        explanation: `Student's graduation year (${student.graduation_year}) is eligible.`,
      });
    } else {
      failedCriteria.push({
        code: "GRADUATION_YEAR",
        label: "Eligible Graduation Batch",
        passed: false,
        required: allowedYears,
        actual: student.graduation_year,
        explanation: `Student's graduation year (${student.graduation_year}) is not in eligible batches: ${allowedYears.join(", ")}.`,
      });
    }

    // 8. Allowed Degrees
    const allowedDegrees = criteria.allowed_degrees || [];
    if (allowedDegrees.length === 0 || allowedDegrees.includes(student.degree)) {
      passedCriteria.push({
        code: "DEGREE",
        label: "Eligible Degree Program",
        passed: true,
        required: allowedDegrees.length === 0 ? "All Programs" : allowedDegrees,
        actual: student.degree,
        explanation: `Student degree program (${student.degree}) is eligible.`,
      });
    } else {
      failedCriteria.push({
        code: "DEGREE",
        label: "Eligible Degree Program",
        passed: false,
        required: allowedDegrees,
        actual: student.degree,
        explanation: `Student degree (${student.degree}) is not in eligible programs: ${allowedDegrees.join(", ")}.`,
      });
    }

    // 9. Academic Status
    const allowedStatuses = criteria.allowed_academic_statuses || ["ACTIVE"];
    if (allowedStatuses.includes(student.academic_status)) {
      passedCriteria.push({
        code: "ACADEMIC_STATUS",
        label: "Academic Standing",
        passed: true,
        required: allowedStatuses,
        actual: student.academic_status,
        explanation: `Student academic status is ${student.academic_status}.`,
      });
    } else {
      failedCriteria.push({
        code: "ACADEMIC_STATUS",
        label: "Academic Standing",
        passed: false,
        required: allowedStatuses,
        actual: student.academic_status,
        explanation: `Student academic status (${student.academic_status}) is not in allowed statuses: ${allowedStatuses.join(", ")}.`,
      });
    }

    // Determine final status
    let status: EligibilityStatus = "ELIGIBLE";
    if (failedCriteria.length > 0) {
      status = "INELIGIBLE";
    } else if (missingData.length > 0) {
      status = "NEEDS_REVIEW";
    }

    const summary =
      status === "ELIGIBLE"
        ? "Candidate meets all criteria configured for this recruitment drive."
        : status === "NEEDS_REVIEW"
        ? `Candidate requires manual review due to missing data: ${missingData.map((m) => m.label).join(", ")}.`
        : `Candidate does not meet criteria: ${failedCriteria.map((f) => f.label).join(", ")}.`;

    return {
      status,
      isEligible: status === "ELIGIBLE",
      passedCriteria,
      failedCriteria,
      missingData,
      summary,
      evaluatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get criteria for a drive
   */
  static async getByDriveId(tenantId: string, driveId: string): Promise<DriveCriteriaRow | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("drive_eligibility_criteria")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("drive_id", driveId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get drive criteria: ${error.message}`);
    }

    return data;
  }

  /**
   * Upsert drive eligibility criteria
   */
  static async upsertCriteria(
    criteria: DriveCriteriaInsert
  ): Promise<DriveCriteriaRow> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("drive_eligibility_criteria")
      .upsert(
        {
          ...criteria,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "drive_id" }
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to configure drive eligibility criteria: ${error.message}`);
    }

    return data;
  }
}
