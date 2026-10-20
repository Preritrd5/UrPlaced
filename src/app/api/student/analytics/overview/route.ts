import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.ANALYTICS_READ_OWN);
    const supabase = await createServerSupabaseClient();
    const studentId = authContext.userId;

    // 1. Assessment attempts summary
    const { data: attempts } = await supabase
      .from("assessment_attempts")
      .select("id, assessment_id, score_percentage, status, started_at, completed_at, assessments(title)")
      .eq("tenant_id", authContext.tenantId)
      .eq("student_id", studentId)
      .order("started_at", { ascending: false });

    const attemptList = attempts || [];
    const completedAttempts = attemptList.filter((a) => a.status === "SUBMITTED" || a.status === "GRADED");
    let avgScore: number | null = null;
    if (completedAttempts.length > 0) {
      const validScores = completedAttempts.filter((a) => a.score_percentage !== null);
      if (validScores.length > 0) {
        const sum = validScores.reduce((acc, a) => acc + (a.score_percentage || 0), 0);
        avgScore = Number((sum / validScores.length).toFixed(1));
      }
    }

    // 2. Practice sessions
    const { count: practiceCount } = await supabase
      .from("preparation_practice_sessions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", authContext.tenantId)
      .eq("student_id", studentId);

    // 3. Mistake Bank Targets
    const { data: mistakeTargets } = await supabase
      .from("mistake_review_targets")
      .select("id, mastery_state")
      .eq("tenant_id", authContext.tenantId)
      .eq("student_id", studentId);

    const mList = mistakeTargets || [];
    const totalMistakes = mList.length;
    const masteredCount = mList.filter((m) => m.mastery_state === "MASTERED").length;
    const activeCount = mList.filter((m) => m.mastery_state === "ACTIVE" || m.mastery_state === "IN_PRACTICE").length;
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
