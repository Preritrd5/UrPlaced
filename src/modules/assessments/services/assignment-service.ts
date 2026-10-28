/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Assessment Engine: Assignment & Cohort Scheduling Service
 * ==============================================================================
 * Handles scheduling availability windows, assigning cohorts and individual students,
 * and mapping active assessments to student preparation feeds.
 */

import {
  AssessmentAssignmentRow,
  AssignmentStatus,
} from "@/types/database";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AssignAssessmentInput {
  assessment_id: string;
  student_ids?: string[];
  cohort_name?: string;
  window_start?: string | null;
  window_end?: string | null;
  max_attempts_override?: number | null;
}

export interface StudentCohortProfile {
  id: string;
  is_archived?: boolean;
  academic_status?: string;
  department_id?: string | null;
  graduation_year?: number | null;
  degree?: string | null;
  department?: {
    name?: string | null;
    code?: string | null;
  } | null;
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const EXACT_COLLEGE_WIDE_LABELS = new Set([
  "all eligible students",
  "all enrolled students",
  "all students",
  "college-wide",
  "college wide",
  "campus-wide",
  "campus wide",
  "entire college",
  "institution-wide",
  "institution wide",
]);

/**
 * Checks if a cohort name explicitly designates a college-wide / institution-wide audience.
 * Strictly performs exact, normalized matching against canonical college-wide values.
 * Never matches by prefix; cohort labels with additional restrictions (e.g. '- Mechanical')
 * are rejected so they are evaluated as cohort-specific assignments.
 */
export function isCollegeWideCohort(cohortName: string | null | undefined): boolean {
  if (!cohortName) return false;
  const normalized = cohortName.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return false;

  // Exact normalized match only — must never match prefixes or strings with additional restrictions
  return EXACT_COLLEGE_WIDE_LABELS.has(normalized);
}

/**
 * Checks if a cohort specifies another department that does not match the student.
 */
function mentionsOtherDepartment(
  cohortLower: string,
  studentDeptCode?: string | null,
  studentDeptName?: string | null
): boolean {
  const departments: Array<{ codes: string[]; keywords: string[] }> = [
    { codes: ["cse", "cs"], keywords: ["computer science", "computer engineering"] },
    { codes: ["it"], keywords: ["information technology"] },
    { codes: ["ece"], keywords: ["electronics and communication", "electronics & communication", "electronics"] },
    { codes: ["eee"], keywords: ["electrical and electronics", "electrical & electronics", "electrical"] },
    { codes: ["me", "mech"], keywords: ["mechanical engineering", "mechanical"] },
    { codes: ["ce", "civil"], keywords: ["civil engineering", "civil"] },
    { codes: ["aiml", "ai"], keywords: ["artificial intelligence", "machine learning"] },
    { codes: ["ds"], keywords: ["data science"] },
    { codes: ["che"], keywords: ["chemical engineering", "chemical"] },
    { codes: ["bt"], keywords: ["biotechnology", "biotech"] },
  ];

  const studentDeptCodeLower = studentDeptCode?.toLowerCase() || "";
  const studentDeptNameLower = studentDeptName?.toLowerCase() || "";

  for (const dept of departments) {
    const isStudentDept =
      (studentDeptCodeLower && dept.codes.includes(studentDeptCodeLower)) ||
      (studentDeptNameLower && dept.keywords.some((kw) => studentDeptNameLower.includes(kw)));

    if (!isStudentDept) {
      for (const kw of dept.keywords) {
        if (cohortLower.includes(kw)) {
          return true;
        }
      }
      for (const code of dept.codes) {
        const regex = new RegExp(`\\b${escapeRegExp(code)}\\b`, "i");
        if (regex.test(cohortLower)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Validates whether a student matches a cohort specification.
 * Fails closed on missing or ambiguous scope.
 */
export function studentMatchesCohort(
  student: StudentCohortProfile,
  cohortName: string | null | undefined
): boolean {
  if (!cohortName || !cohortName.trim()) {
    // Missing or ambiguous cohort name: fail-closed, not college-wide
    return false;
  }

  const trimmed = cohortName.trim();

  // 1. Explicit college-wide designation
  if (isCollegeWideCohort(trimmed)) {
    return true;
  }

  const lower = trimmed.toLowerCase();

  // 2. Year check: If cohort specifies a 4-digit graduation year
  const yearMatch = lower.match(/\b(20\d\d)\b/);
  if (yearMatch) {
    const specifiedYear = parseInt(yearMatch[1], 10);
    if (student.graduation_year && student.graduation_year !== specifiedYear) {
      return false;
    }
  }

  // 3. Degree check: If cohort specifies a known degree
  const knownDegrees = [
    "b.tech", "btech", "m.tech", "mtech", "mca", "mba", "bca", "b.sc", "bsc", "m.sc", "msc", "b.e", "be", "m.e", "me"
  ];
  const studentDegreeNorm = student.degree?.toLowerCase().replace(/[^a-z]/g, "") || "";
  for (const deg of knownDegrees) {
    const regex = new RegExp(`\\b${escapeRegExp(deg)}\\b`, "i");
    if (regex.test(lower)) {
      const cleanDeg = deg.replace(/[^a-z]/g, "");
      if (studentDegreeNorm && studentDegreeNorm !== cleanDeg) {
        return false;
      }
    }
  }

  // 4. Department checks
  const deptCode = student.department?.code?.toLowerCase().trim();
  const deptName = student.department?.name?.toLowerCase().trim();

  // Does the cohort mention another department?
  if (mentionsOtherDepartment(lower, deptCode, deptName)) {
    return false;
  }

  // Does the cohort match student's department code?
  let matchesDept = false;
  if (deptCode) {
    const codeRegex = new RegExp(`\\b${escapeRegExp(deptCode)}\\b`, "i");
    if (codeRegex.test(lower)) {
      matchesDept = true;
    }
  }

  // Does the cohort match student's department name?
  if (deptName && !matchesDept) {
    if (lower.includes(deptName)) {
      matchesDept = true;
    } else {
      const deptKeywords = deptName
        .split(/[\s,&/-]+/)
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length > 3 && !["engineering", "technology", "department", "sciences"].includes(w));

      if (deptKeywords.length > 0 && deptKeywords.some((k) => lower.includes(k))) {
        matchesDept = true;
      }
    }
  }

  if (matchesDept) {
    return true;
  }

  // 5. Batch / Year only match (e.g. "Batch 2026", "2026 Passouts", "Class of 2026")
  if (yearMatch && student.graduation_year === parseInt(yearMatch[1], 10)) {
    return true;
  }

  // 6. Degree only match
  if (studentDegreeNorm && knownDegrees.some((deg) => {
    const cleanDeg = deg.replace(/[^a-z]/g, "");
    const regex = new RegExp(`\\b${escapeRegExp(deg)}\\b`, "i");
    return cleanDeg === studentDegreeNorm && regex.test(lower);
  })) {
    return true;
  }

  return false;
}

export class AssignmentService {
  /**
   * Assigns a published assessment to individual students or an entire cohort.
   */
  public static async assignAssessment(
    tenantId: string,
    assignedByUserId: string,
    input: AssignAssessmentInput
  ): Promise<{ success: boolean; createdCount: number; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // Verify assessment exists and is PUBLISHED
    const { data: assessment, error: assErr } = await supabase
      .from("assessments")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("id", input.assessment_id)
      .single();

    if (assErr || !assessment) {
      return { success: false, createdCount: 0, error: "Assessment not found." };
    }

    if (assessment.status !== "PUBLISHED") {
      return {
        success: false,
        createdCount: 0,
        error: "Only published assessments can be assigned to students.",
      };
    }

    const rowsToInsert: Array<{
      tenant_id: string;
      assessment_id: string;
      student_id: string | null;
      cohort_name: string | null;
      window_start: string | null;
      window_end: string | null;
      max_attempts_override: number | null;
      status: AssignmentStatus;
      assigned_by: string;
    }> = [];

    if (Array.isArray(input.student_ids) && input.student_ids.length > 0) {
      for (const studentId of input.student_ids) {
        rowsToInsert.push({
          tenant_id: tenantId,
          assessment_id: input.assessment_id,
          student_id: studentId,
          cohort_name: input.cohort_name || null,
          window_start: input.window_start || null,
          window_end: input.window_end || null,
          max_attempts_override: input.max_attempts_override ?? null,
          status: "ACTIVE",
          assigned_by: assignedByUserId,
        });
      }
    } else {
      // Cohort-wide assignment (student_id is null)
      rowsToInsert.push({
        tenant_id: tenantId,
        assessment_id: input.assessment_id,
        student_id: null,
        cohort_name: input.cohort_name || "All Enrolled Students",
        window_start: input.window_start || null,
        window_end: input.window_end || null,
        max_attempts_override: input.max_attempts_override ?? null,
        status: "ACTIVE",
        assigned_by: assignedByUserId,
      });
    }

    const { data, error } = await supabase
      .from("assessment_assignments")
      .insert(rowsToInsert)
      .select("id");

    if (error) {
      return { success: false, createdCount: 0, error: error.message };
    }

    return { success: true, createdCount: data ? data.length : 0 };
  }

  /**
   * Lists all available and assigned assessments for a student,
   * enriched with window status and attempt records.
   */
  public static async listAssignmentsForStudent(
    tenantId: string,
    studentId: string
  ): Promise<{ success: boolean; assignments: any[]; error?: string }> {
    const supabase = await createServerSupabaseClient();
    const now = new Date();

    // 0. Verify candidate is an active, non-archived student in this college tenant
    const { data: studentRecord, error: studentErr } = await supabase
      .from("students")
      .select(`
        id,
        is_archived,
        academic_status,
        department_id,
        graduation_year,
        degree,
        department:departments(name, code)
      `)
      .eq("tenant_id", tenantId)
      .eq("id", studentId)
      .maybeSingle();

    if (studentErr || !studentRecord || studentRecord.is_archived || studentRecord.academic_status !== "ACTIVE") {
      return { success: true, assignments: [] };
    }

    const rawDept = (studentRecord as any).department;
    const dept = Array.isArray(rawDept) ? rawDept[0] : rawDept;
    const studentProfile: StudentCohortProfile = {
      id: studentRecord.id,
      is_archived: studentRecord.is_archived,
      academic_status: studentRecord.academic_status,
      department_id: (studentRecord as any).department_id,
      graduation_year: (studentRecord as any).graduation_year,
      degree: (studentRecord as any).degree,
      department: dept,
    };

    // 1. Fetch active assignments matching student directly or cohort-wide
    const { data: assignments, error: assErr } = await supabase
      .from("assessment_assignments")
      .select(`
        id,
        assessment_id,
        student_id,
        cohort_name,
        window_start,
        window_end,
        max_attempts_override,
        status,
        created_at,
        assessment:assessments!inner(
          id,
          title,
          description,
          purpose,
          time_limit_minutes,
          allowed_attempts,
          pass_percentage,
          review_policy,
          release_policy,
          status,
          drive_id
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "ACTIVE")
      .eq("assessment.status", "PUBLISHED")
      .or(`student_id.eq.${studentId},student_id.is.null`);

    if (assErr) {
      return { success: false, assignments: [], error: assErr.message };
    }

    // 2. Filter assignments that this student is actually eligible for:
    // Either directly assigned to this student, or matching cohort criteria
    const eligibleAssignments = (assignments || []).filter((item: any) => {
      if (item.student_id === studentId) {
        return true;
      }
      if (item.student_id == null) {
        return studentMatchesCohort(studentProfile, item.cohort_name);
      }
      return false;
    });

    // Resolve precedence: When both direct assignment and cohort/college-wide assignment exist
    // for the same assessment, the direct individual assignment takes precedence
    const eligibleByAssessment: Record<string, any[]> = {};
    for (const item of eligibleAssignments) {
      if (!eligibleByAssessment[item.assessment_id]) {
        eligibleByAssessment[item.assessment_id] = [];
      }
      eligibleByAssessment[item.assessment_id].push(item);
    }

    const resolvedAssignments: any[] = [];
    for (const assId of Object.keys(eligibleByAssessment)) {
      const items = eligibleByAssessment[assId];
      const direct = items.find((a: any) => a.student_id === studentId);
      resolvedAssignments.push(direct || items[0]);
    }

    // 3. Fetch student's attempt records for these assessments
    const assessmentIds = Array.from(
      new Set(resolvedAssignments.map((a: any) => a.assessment_id))
    );

    let attemptsByAssessment: Record<string, any[]> = {};
    if (assessmentIds.length > 0) {
      const { data: attempts } = await supabase
        .from("assessment_attempts")
        .select(`
          id,
          assessment_id,
          attempt_number,
          status,
          started_at,
          expires_at,
          submitted_at,
          earned_points,
          total_points,
          score_percentage,
          is_passed,
          scoring_status
        `)
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId)
        .in("assessment_id", assessmentIds);

      (attempts || []).forEach((att) => {
        if (!attemptsByAssessment[att.assessment_id]) {
          attemptsByAssessment[att.assessment_id] = [];
        }
        attemptsByAssessment[att.assessment_id].push(att);
      });
    }

    // 4. Format and enrich output
    const enriched = resolvedAssignments.map((item: any) => {
      const ass = item.assessment;
      const atts = attemptsByAssessment[item.assessment_id] || [];

      const maxAttempts = item.max_attempts_override ?? ass.allowed_attempts ?? 1;
      const attemptsCount = atts.length;

      let windowStatus: "UPCOMING" | "OPEN" | "CLOSED" = "OPEN";
      if (item.window_start && new Date(item.window_start) > now) {
        windowStatus = "UPCOMING";
      } else if (item.window_end && new Date(item.window_end) < now) {
        windowStatus = "CLOSED";
      }

      const activeAttempt = atts.find((a) => a.status === "IN_PROGRESS");
      const canAttempt =
        windowStatus === "OPEN" && (attemptsCount < maxAttempts || Boolean(activeAttempt));

      const highestScore = atts.reduce(
        (max, a) => Math.max(max, Number(a.score_percentage || 0)),
        0
      );

      const latestAttempt = atts.sort(
        (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      )[0];

      return {
        assignmentId: item.id,
        assessmentId: ass.id,
        title: ass.title,
        description: ass.description,
        purpose: ass.purpose,
        timeLimitMinutes: ass.time_limit_minutes,
        allowedAttempts: maxAttempts,
        passPercentage: Number(ass.pass_percentage ?? 60.0),
        windowStart: item.window_start,
        windowEnd: item.window_end,
        windowStatus,
        cohortName: item.cohort_name,
        attemptsCount,
        canAttempt,
        hasActiveAttempt: Boolean(activeAttempt),
        activeAttemptId: activeAttempt?.id || null,
        highestScore: attemptsCount > 0 ? highestScore : null,
        latestAttempt: latestAttempt || null,
        driveId: ass.drive_id,
      };
    });

    return { success: true, assignments: enriched };
  }

  /**
   * Retrieves all assignments and participation metrics for a specific assessment.
   */
  public static async listAssignmentsForAssessment(
    tenantId: string,
    assessmentId: string
  ): Promise<{ success: boolean; assignments: any[]; error?: string }> {
    const supabase = await createServerSupabaseClient();

    const { data: assignments, error } = await supabase
      .from("assessment_assignments")
      .select(`
        *,
        student:students(
          id,
          full_name,
          enrollment_number,
          department_id
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("assessment_id", assessmentId)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, assignments: [], error: error.message };
    }

    return { success: true, assignments: assignments || [] };
  }
}
