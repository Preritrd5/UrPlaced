import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    let token: string | undefined;
    const authHeader = request?.headers?.get?.("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    const authContext = await requireAuthContext(Permissions.ANALYTICS_READ_OWN, undefined, token);
    const admin = createAdminClient();

    // 0. Resolve student record strictly by tenant and user
    const student = await StudentService.getByUserId(authContext.tenantId, authContext.userId);
    const studentId = student?.id || authContext.userId;

    // 1. Assessment attempts summary
    const { data: attempts, error: attemptsErr } = await admin
      .from("assessment_attempts")
      .select("id, assessment_id, score_percentage, status, started_at, submitted_at, assessments(title)")
      .eq("tenant_id", authContext.tenantId)
      .eq("student_id", studentId)
      .order("started_at", { ascending: false });

    if (attemptsErr) {
      console.error("[Student Analytics] Error fetching attempts:", attemptsErr);
    }

    const attemptList = attempts || [];
    const completedAttempts = attemptList.filter((a) =>
      ["SUBMITTED", "SCORED", "RESULT_RELEASED", "GRADED"].includes(a.status)
    );
    let avgScore: number | null = null;
    if (completedAttempts.length > 0) {
      const validScores = completedAttempts.filter((a) => a.score_percentage !== null && a.score_percentage !== undefined);
      if (validScores.length > 0) {
        const sum = validScores.reduce((acc, a) => acc + (a.score_percentage || 0), 0);
        avgScore = Number((sum / validScores.length).toFixed(1));
      }
    }

    // 2. Practice sessions
    const { count: practiceCount } = await admin
      .from("preparation_practice_sessions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", authContext.tenantId)
      .eq("student_id", studentId);

    // 3. Mistake Bank Targets
    const { data: mistakeTargets } = await admin
      .from("mistake_review_targets")
      .select("id, status")
      .eq("tenant_id", authContext.tenantId)
      .eq("student_id", studentId);

    const mList = mistakeTargets || [];
    const totalMistakes = mList.length;
    const masteredCount = mList.filter((m) => m.status === "MASTERY_DEMONSTRATED").length;
    const activeCount = mList.filter((m) =>
      ["NEEDS_REVIEW", "PRACTISING", "IMPROVING", "PROVISIONAL_MASTERY", "REVISION_DUE"].includes(m.status)
    ).length;
    const resolutionRate = totalMistakes > 0 ? Number(((masteredCount / totalMistakes) * 100).toFixed(1)) : null;

    return NextResponse.json({
      summary: {
        totalAttempts: attemptList.length,
        completedAttemptsCount: completedAttempts.length,
        averageScorePercentage: avgScore,
        totalPracticeSessions: practiceCount || 0,
        totalMistakesCaptured: totalMistakes,
        masteredMistakesCount: masteredCount,
        activeMistakesCount: activeCount,
        masteryResolutionRate: resolutionRate,
      },
      recentAttempts: attemptList.slice(0, 5),
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
