import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { RevisionSchedulerService } from "@/modules/mistake-mastery/services/revision-scheduler-service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    let token: string | undefined;
    const authHeader = request?.headers?.get?.("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }
    const authContext = await requireAuthContext(Permissions.MISTAKE_BANK_MANAGE_OWN, undefined, token);
    const supabase = createAdminClient();

    // 1. Resolve student profile
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("tenant_id", authContext.tenantId)
      .eq("user_id", authContext.userId)
      .maybeSingle();

    let studentId = student?.id;
    if (!studentId) {
      const { data: studentByEmail } = await supabase
        .from("students")
        .select("id")
        .eq("tenant_id", authContext.tenantId)
        .eq("email", authContext.email)
        .maybeSingle();
      studentId = studentByEmail?.id;
    }

    if (!studentId) {
      return NextResponse.json({ error: "No student profile linked to this account." }, { status: 404 });
    }

    // 2. Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const primaryReason = searchParams.get("primaryReason");
    const skillId = searchParams.get("skillId");
    const dueOnly = searchParams.get("dueOnly") === "true";
    const overdueOnly = searchParams.get("overdueOnly") === "true";
    const search = searchParams.get("search");

    // 3. Build query on mistake_review_targets joined with question and canonical skill
    let query = supabase
      .from("mistake_review_targets")
      .select(`
        *,
        questions!inner(
          id,
          question_type
        ),
        question_versions!inner(
          id,
          version_number,
          prompt,
          difficulty,
          topic_tags,
          explanation
        ),
        canonical_skills(
          id,
          name,
          category
        )
      `)
      .eq("tenant_id", authContext.tenantId)
      .eq("student_id", studentId)
      .order("next_due_at", { ascending: true });

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    if (primaryReason && primaryReason !== "ALL") {
      query = query.eq("primary_reason", primaryReason);
    }

    if (skillId && skillId !== "ALL") {
      query = query.eq("skill_id", skillId);
    }

    const now = new Date();
    if (dueOnly) {
      query = query.lte("next_due_at", now.toISOString());
    }

    if (overdueOnly) {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      query = query.lt("next_due_at", yesterday.toISOString());
    }

    const { data: targets, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter by prompt search if provided
    let filteredTargets = targets || [];
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filteredTargets = filteredTargets.filter((t: any) => {
        const promptMatch = t.question_versions?.prompt?.toLowerCase().includes(q);
        const skillMatch = t.canonical_skills?.name?.toLowerCase().includes(q);
        const tagsMatch = t.question_versions?.topic_tags?.some((tag: string) =>
          tag.toLowerCase().includes(q)
        );
        return promptMatch || skillMatch || tagsMatch;
      });
    }

    // 4. Fetch metrics
    const metrics = await RevisionSchedulerService.getRevisionQueueMetrics(
      authContext.tenantId,
      studentId
    );

    // 5. Fetch available canonical skills for filter dropdown
    const { data: skills } = await supabase
      .from("canonical_skills")
      .select("id, name, category")
      .order("name", { ascending: true });

    return NextResponse.json({
      targets: filteredTargets,
      metrics,
      availableSkills: skills || [],
    });
  } catch (err: any) {
    if (err.message?.startsWith("UNAUTHORIZED")) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message?.startsWith("FORBIDDEN") || err?.statusCode === 403) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
