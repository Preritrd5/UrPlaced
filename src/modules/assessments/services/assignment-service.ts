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
import { createAdminClient } from "@/lib/supabase/admin";

export interface AssignAssessmentInput {
  assessment_id: string;
  student_ids?: string[];
  department_ids?: string[];
  graduation_years?: number[];
  target_type?: "COLLEGE_WIDE" | "DEPARTMENT" | "BATCH" | "INDIVIDUAL" | "COHORT";
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
   * Authoritatively assigns a published assessment to students within an institution.
   * Resolves eligible student recipients based on targeting criteria (College-wide,
   * Academic Department, Graduation Year Batch, Cohort label, or explicit Student IDs)
   * and persists durable recipient records with explicit student_id bindings.
   */
  public static async assignAssessment(
    tenantId: string,
    assignedByUserId: string,
    input: AssignAssessmentInput
  ): Promise<{ success: boolean; createdCount: number; recipientCount?: number; error?: string }> {
    let supabase: any = null;
    try {
      supabase = await createServerSupabaseClient();
    } catch {
      supabase = null;
    }
    const admin = createAdminClient();
    const db = supabase || admin;

    // 1. Verify assessment exists, belongs to tenant, and is PUBLISHED
    let { data: assessment, error: assErr } = await db
      .from("assessments")
      .select("id, status, title")
      .eq("tenant_id", tenantId)
      .eq("id", input.assessment_id)
      .single();

    if ((assErr || !assessment) && db !== admin) {
      const { data: fallbackAss } = await admin
        .from("assessments")
        .select("id, status, title")
        .eq("tenant_id", tenantId)
        .eq("id", input.assessment_id)
        .single();
      if (fallbackAss) {
        assessment = fallbackAss;
        assErr = null;
      }
    }

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

    // 2. Resolve eligible student recipients within this college tenant
    let resolvedStudentIds: string[] = [];

    const isExplicitIndividual =
      input.target_type === "INDIVIDUAL" ||
      (Array.isArray(input.student_ids) && input.student_ids.length > 0);

    const isExplicitDepartment =
      input.target_type === "DEPARTMENT" ||
      (Array.isArray(input.department_ids) && input.department_ids.length > 0);

    const isExplicitBatch =
      input.target_type === "BATCH" ||
      (Array.isArray(input.graduation_years) && input.graduation_years.length > 0);

    if (isExplicitIndividual && Array.isArray(input.student_ids) && input.student_ids.length > 0) {
      // Validate that all supplied student IDs belong to this tenant, are active and non-archived
      const { data: validStudents } = await admin
        .from("students")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("is_archived", false)
        .eq("academic_status", "ACTIVE")
        .in("id", input.student_ids);

      resolvedStudentIds = (validStudents || []).map((s: any) => s.id);
    } else if (isExplicitDepartment && Array.isArray(input.department_ids) && input.department_ids.length > 0) {
      // Resolve students belonging to selected departments
      const { data: deptStudents } = await admin
        .from("students")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("is_archived", false)
        .eq("academic_status", "ACTIVE")
        .in("department_id", input.department_ids);

      resolvedStudentIds = (deptStudents || []).map((s: any) => s.id);
    } else if (isExplicitBatch && Array.isArray(input.graduation_years) && input.graduation_years.length > 0) {
      // Resolve students belonging to selected graduation batches
      const { data: batchStudents } = await admin
        .from("students")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("is_archived", false)
        .eq("academic_status", "ACTIVE")
        .in("graduation_year", input.graduation_years);

      resolvedStudentIds = (batchStudents || []).map((s: any) => s.id);
    } else if (input.cohort_name && !isCollegeWideCohort(input.cohort_name)) {
      // Cohort string (e.g. "CSE 2026", "Mechanical 2025") — resolve matching students
      const { data: allActiveStudents } = await admin
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
        .eq("is_archived", false)
        .eq("academic_status", "ACTIVE");

      resolvedStudentIds = (allActiveStudents || [])
        .filter((s: any) => {
          const rawDept = s.department;
          const dept = Array.isArray(rawDept) ? rawDept[0] : rawDept;
          return studentMatchesCohort(
            {
              id: s.id,
              is_archived: s.is_archived,
              academic_status: s.academic_status,
              department_id: s.department_id,
              graduation_year: s.graduation_year,
              degree: s.degree,
              department: dept,
            },
            input.cohort_name
          );
        })
        .map((s: any) => s.id);
    } else {
      // College-Wide: All active, non-archived enrolled students in this college tenant
      const { data: allStudents } = await admin
        .from("students")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("is_archived", false)
        .eq("academic_status", "ACTIVE");

      resolvedStudentIds = (allStudents || []).map((s: any) => s.id);
    }

    // 3. Check existing active assignments for this assessment & tenant to prevent duplicates
    const { data: existingAssignments } = await admin
      .from("assessment_assignments")
      .select("id, student_id")
      .eq("tenant_id", tenantId)
      .eq("assessment_id", input.assessment_id);

    const existingStudentMap = new Map<string, string>();
    let hasCohortHeaderRow = false;

    if (existingAssignments) {
      for (const a of existingAssignments) {
        if (a.student_id) {
          existingStudentMap.set(a.student_id, a.id);
        } else {
          hasCohortHeaderRow = true;
        }
      }
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

    const effectiveCohortName = input.cohort_name || (
      isExplicitDepartment ? "Department Assignment" :
      isExplicitBatch ? "Batch Assignment" :
      isExplicitIndividual ? "Individual Selection" :
      "All Eligible Students"
    );

    // 4. Update existing active assignments if window or attempt overrides or cohort name are specified
    const updatePayload: Record<string, any> = {};
    if (input.window_start !== undefined) updatePayload.window_start = input.window_start || null;
    if (input.window_end !== undefined) updatePayload.window_end = input.window_end || null;
    if (input.max_attempts_override !== undefined) {
      updatePayload.max_attempts_override = input.max_attempts_override ?? null;
    }
    if (input.cohort_name) {
      updatePayload.cohort_name = effectiveCohortName;
    }

    if (Object.keys(updatePayload).length > 0 && (existingStudentMap.size > 0 || hasCohortHeaderRow)) {
      await admin
        .from("assessment_assignments")
        .update(updatePayload)
        .eq("tenant_id", tenantId)
        .eq("assessment_id", input.assessment_id)
        .eq("status", "ACTIVE");
    }

    // 5. Build durable recipient rows for resolved students that are not yet assigned
    for (const sId of resolvedStudentIds) {
      if (!existingStudentMap.has(sId)) {
        rowsToInsert.push({
          tenant_id: tenantId,
          assessment_id: input.assessment_id,
          student_id: sId,
          cohort_name: effectiveCohortName,
          window_start: input.window_start || null,
          window_end: input.window_end || null,
          max_attempts_override: input.max_attempts_override ?? null,
          status: "ACTIVE",
          assigned_by: assignedByUserId,
        });
      }
    }

    // 6. Also insert / ensure parent cohort summary record (student_id = null)
    // for institutional oversight and historical reporting if none exists
    if (!hasCohortHeaderRow) {
      rowsToInsert.push({
        tenant_id: tenantId,
        assessment_id: input.assessment_id,
        student_id: null,
        cohort_name: effectiveCohortName,
        window_start: input.window_start || null,
        window_end: input.window_end || null,
        max_attempts_override: input.max_attempts_override ?? null,
        status: "ACTIVE",
        assigned_by: assignedByUserId,
      });
    }

    const totalActiveRecipients = Math.max(
      resolvedStudentIds.length,
      existingStudentMap.size + rowsToInsert.filter((r) => r.student_id !== null).length,
      (hasCohortHeaderRow || rowsToInsert.length > 0) ? 1 : 0
    );

    if (rowsToInsert.length > 0) {
      const { data, error } = await admin
        .from("assessment_assignments")
        .insert(rowsToInsert)
        .select("id");

      if (error) {
        return { success: false, createdCount: 0, error: error.message };
      }

      return {
        success: true,
        createdCount: data ? data.length : 0,
        recipientCount: totalActiveRecipients,
      };
    }

    return {
      success: true,
      createdCount: 0,
      recipientCount: totalActiveRecipients,
    };
  }

  /**
   * Lists all available and assigned assessments for a student,
   * enriched with window status and attempt records.
   */
  public static async listAssignmentsForStudent(
    tenantId: string,
    studentId: string
  ): Promise<{ success: boolean; assignments: any[]; error?: string }> {
    const admin = createAdminClient();
    const now = new Date();

    // 0. Verify candidate is an active, non-archived student in this college tenant
    const { data: studentRecord, error: studentErr } = await admin
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
    const { data: assignments, error: assErr } = await admin
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
      const { data: attempts } = await admin
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

      const releasePolicy = ass.release_policy || "IMMEDIATE";
      const reviewPolicy = ass.review_policy || "IMMEDIATE";
      const isDeadlinePassed = item.window_end ? now >= new Date(item.window_end) : false;

      let isScoreReleased = false;
      if (releasePolicy === "IMMEDIATE") {
        isScoreReleased = atts.some((a) => ["SCORED", "RESULT_RELEASED"].includes(a.status));
      } else if (releasePolicy === "AFTER_DEADLINE") {
        isScoreReleased = isDeadlinePassed || atts.some((a) => a.status === "RESULT_RELEASED");
      } else if (releasePolicy === "MANUAL_STAFF_RELEASE") {
        isScoreReleased = atts.some((a) => a.status === "RESULT_RELEASED");
      }

      let isReviewable = false;
      if (reviewPolicy === "IMMEDIATE") {
        isReviewable = true;
      } else if (reviewPolicy === "AFTER_DEADLINE") {
        isReviewable = isDeadlinePassed || atts.some((a) => a.status === "RESULT_RELEASED");
      } else if (reviewPolicy === "NEVER") {
        isReviewable = false;
      }

      const highestScore = atts.reduce(
        (max, a) => Math.max(max, Number(a.score_percentage || 0)),
        0
      );

      const latestAttempt = atts.sort(
        (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      )[0];

      const safeLatestAttempt = latestAttempt
        ? {
            ...latestAttempt,
            score_percentage: isScoreReleased ? latestAttempt.score_percentage : null,
            earned_points: isScoreReleased ? latestAttempt.earned_points : null,
            is_passed: isScoreReleased ? latestAttempt.is_passed : null,
            isScoreReleased,
            isReviewable,
          }
        : null;

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
        highestScore: attemptsCount > 0 && isScoreReleased ? highestScore : null,
        isScoreReleased,
        isReviewable,
        reviewPolicy,
        releasePolicy,
        latestAttempt: safeLatestAttempt,
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
    const admin = createAdminClient();

    const { data: assignments, error } = await admin
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
