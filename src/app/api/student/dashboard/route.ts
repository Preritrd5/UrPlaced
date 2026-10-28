import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AssignmentService } from "@/modules/assessments/services/assignment-service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.ASSESSMENTS_ATTEMPT);
    const supabase = await createClient();

    let studentId: string | null = null;
    let studentName: string | null = null;

    const { data: student } = await supabase
      .from("students")
      .select("id, full_name, is_archived, academic_status")
      .eq("tenant_id", authContext.tenantId)
      .eq("user_id", authContext.userId)
      .maybeSingle();

    if (student && !student.is_archived && student.academic_status === "ACTIVE") {
      studentId = student.id;
      studentName = student.full_name;
    }

    if (!studentId) {
      return NextResponse.json(
        { error: "No active verified student profile linked to this account." },
        { status: 403 }
      );
    }

    // 1. Attempts
    let attempts: any[] = [];
    try {
      const { data: attemptsData } = await supabase
        .from("assessment_attempts")
        .select(
          "id, status, earned_points, total_points, score_percentage, submitted_at, assessments(title, time_limit_minutes)"
        )
        .eq("tenant_id", authContext.tenantId)
        .eq("student_id", studentId)
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .limit(5);

      attempts = attemptsData || [];
    } catch {
      attempts = [];
    }

    const completedAttempts =
      attempts.filter((a: any) =>
        ["SUBMITTED", "SCORED", "RESULT_RELEASED"].includes(a.status)
      ) || [];
    const inProgressAttempts =
      attempts.filter((a: any) => a.status === "IN_PROGRESS") || [];

    // 2. Mistakes
    let mistakes: any[] = [];
    try {
      const { data: mistakesData } = await supabase
        .from("mistake_review_targets")
        .select("id, status, next_due_at, questions(content, subject, topic)")
        .eq("tenant_id", authContext.tenantId)
        .eq("student_id", studentId);

      mistakes = mistakesData || [];
    } catch {
      mistakes = [];
    }

    const totalMistakes = mistakes.length;
    const pendingReviews =
      mistakes.filter(
        (m: any) =>
          m.status !== "MASTERY_DEMONSTRATED" &&
          (!m.next_due_at || new Date(m.next_due_at) <= new Date())
      ).length;
    const masteredMistakes =
      mistakes.filter((m: any) => m.status === "MASTERY_DEMONSTRATED").length;

    // 3. Assigned assessments
    let assignedAssessments: any[] = [];
    let availableAssessmentsCount = 0;
    let totalAssignedCount = 0;
    try {
      const assignResult = await AssignmentService.listAssignmentsForStudent(
        authContext.tenantId,
        studentId
      );
      if (assignResult.success && assignResult.assignments) {
        assignedAssessments = assignResult.assignments;
        totalAssignedCount = assignedAssessments.length;
        availableAssessmentsCount = assignedAssessments.filter(
          (a: any) => a.canAttempt === true
        ).length;
      }
    } catch {
      assignedAssessments = [];
    }

    // 4. Calculate average score
    let averageScore = 0;
    if (completedAttempts.length > 0) {
      const totalPercent = completedAttempts.reduce(
        (acc: number, cur: any) => acc + (Number(cur.score_percentage) || 0),
        0
      );
      averageScore = Math.round(totalPercent / completedAttempts.length);
    }

    return NextResponse.json({
      studentId,
      studentName,
      tenantId: authContext.tenantId,
      metrics: {
        totalAssignedCount,
        availableAssessmentsCount,
        averageScore,
        totalMistakes,
        pendingReviews,
        masteredMistakes,
      },
      assignedAssessments,
      attempts,
      mistakes: mistakes.slice(0, 5),
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
