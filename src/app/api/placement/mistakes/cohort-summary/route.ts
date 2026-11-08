import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.MISTAKE_BANK_READ_COHORT);
    const supabase = await createClient();

    // 1. Fetch all mistake review targets for tenant
    const { data: targets, error: targetErr } = await supabase
      .from("mistake_review_targets")
      .select(`
        id,
        student_id,
        question_id,
        version_id,
        skill_id,
        primary_reason,
        status,
        occurrence_count,
        student_reason_category,
        first_observed_at,
        canonical_skills(
          id,
          name,
          category
        ),
        question_versions(
          prompt,
          difficulty
        )
      `)
      .eq("tenant_id", authContext.tenantId);

    if (targetErr) {
      return NextResponse.json({ error: targetErr.message }, { status: 500 });
    }

    // 2. Aggregate by Skill
    const skillMap = new Map<
      string,
      {
        skillId: string;
        skillName: string;
        category: string;
        totalMistakes: number;
        activeReviews: number;
        affectedStudents: Set<string>;
      }
    >();

    // 3. Aggregate by Reason Category
    const reasonCounts: Record<string, number> = {};

    // 4. Aggregate by Question (Hotspots)
    const questionMap = new Map<
      string,
      {
        questionId: string;
        versionId: string;
        prompt: string;
        difficulty: string;
        skillName: string;
        affectedStudents: Set<string>;
        totalOccurrences: number;
      }
    >();

    let totalTargets = 0;
    let activeReviewsTotal = 0;
    const uniqueStudents = new Set<string>();

    for (const t of targets || []) {
      totalTargets++;
      uniqueStudents.add(t.student_id);

      const isActive = ["NEEDS_REVIEW", "PRACTISING", "REVISION_DUE"].includes(t.status);
      if (isActive) activeReviewsTotal++;

      // Skill aggregation
      if (t.skill_id && t.canonical_skills) {
        const s = t.canonical_skills as any;
        if (!skillMap.has(t.skill_id)) {
          skillMap.set(t.skill_id, {
            skillId: t.skill_id,
            skillName: s.name,
            category: s.category,
            totalMistakes: 0,
            activeReviews: 0,
            affectedStudents: new Set(),
          });
        }
        const skEntry = skillMap.get(t.skill_id)!;
        skEntry.totalMistakes++;
        if (isActive) skEntry.activeReviews++;
        skEntry.affectedStudents.add(t.student_id);
      }

      // Reason category aggregation
      if (t.student_reason_category) {
        reasonCounts[t.student_reason_category] =
          (reasonCounts[t.student_reason_category] || 0) + 1;
      }

      // Question hotspot aggregation
      const qKey = t.question_id;
      const qv = t.question_versions as any;
      const cs = t.canonical_skills as any;
      if (!questionMap.has(qKey)) {
        questionMap.set(qKey, {
          questionId: t.question_id,
          versionId: t.version_id,
          prompt: qv?.prompt || "Question",
          difficulty: qv?.difficulty || "MEDIUM",
          skillName: cs?.name || "General",
          affectedStudents: new Set(),
          totalOccurrences: 0,
        });
      }
      const qEntry = questionMap.get(qKey)!;
      qEntry.affectedStudents.add(t.student_id);
      qEntry.totalOccurrences += t.occurrence_count || 1;
    }

    const skillGaps = Array.from(skillMap.values())
      .map((item) => ({
        skillId: item.skillId,
        skillName: item.skillName,
        category: item.category,
        totalMistakes: item.totalMistakes,
        activeReviews: item.activeReviews,
        studentCount: item.affectedStudents.size,
      }))
      .sort((a, b) => b.totalMistakes - a.totalMistakes);

    const questionHotspots = Array.from(questionMap.values())
      .map((item) => ({
        questionId: item.questionId,
        versionId: item.versionId,
        prompt: item.prompt,
        difficulty: item.difficulty,
        skillName: item.skillName,
        studentCount: item.affectedStudents.size,
        totalOccurrences: item.totalOccurrences,
      }))
      .sort((a, b) => b.studentCount - a.studentCount)
      .slice(0, 10);

    return NextResponse.json({
      summary: {
        totalMistakes: totalTargets,
        activeReviews: activeReviewsTotal,
        affectedStudentsCount: uniqueStudents.size,
      },
      skillGaps,
      reasonDistribution: reasonCounts,
      questionHotspots,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err.message?.startsWith("FORBIDDEN") || err.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: err.message || "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
