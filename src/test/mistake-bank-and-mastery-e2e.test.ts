import { describe, it, expect, vi, beforeEach } from "vitest";
import { MistakeCaptureService } from "@/modules/mistake-mastery/services/mistake-capture-service";
import { RevisionSchedulerService } from "@/modules/mistake-mastery/services/revision-scheduler-service";
import { MasteryEvaluationService } from "@/modules/mistake-mastery/services/mastery-evaluation-service";
import { AssessmentScoringService } from "@/modules/assessments/services/assessment-scoring-service";

// Mock Supabase admin client
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (...args: any[]) => mockFrom(...args),
  }),
}));

describe("Mistake Bank & Skill Mastery Engine End-to-End Verification", () => {
  const tenantId = "tenant-test-100";
  const studentId = "student-test-100";
  const attemptId = "attempt-test-100";
  const assessmentId = "assessment-test-100";
  const questionSetId = "qset-test-100";
  const questionId = "question-test-100";
  const versionId = "version-test-100";
  const canonicalSkillId = "skill-dsa-100";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Captures incorrect answers, auto-resolves missing skill_id, and syncs student_skill_mastery", async () => {
    let insertedTarget: any = null;
    let insertedOccurrence: any = null;
    let upsertedMastery: any = null;

    mockFrom.mockImplementation((table: string) => {
      if (table === "assessment_attempts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: attemptId,
              tenant_id: tenantId,
              student_id: studentId,
              assessment_id: assessmentId,
            },
            error: null,
          }),
        };
      }

      if (table === "assessments") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { question_set_id: questionSetId },
            error: null,
          }),
        };
      }

      if (table === "question_set_items") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [{ question_id: questionId, version_id: versionId }],
            error: null,
          }),
        };
      }

      if (table === "attempt_responses") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: "resp-100",
                attempt_id: attemptId,
                question_id: questionId,
                version_id: versionId,
                is_correct: false,
                is_answered: true,
                is_flagged: false,
                points_awarded: 0,
                response_payload: { selected_option: "opt_wrong" },
              },
            ],
            error: null,
          }),
        };
      }

      if (table === "question_versions") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              {
                id: versionId,
                skill_id: null, // Test missing skill_id auto-resolution
                topic_tags: ["memory"],
                prompt: "What is computer memory?",
              },
            ],
            error: null,
          }),
          update: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }

      if (table === "canonical_skills") {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: canonicalSkillId,
                name: "Logical Reasoning",
                normalized_name: "logical-reasoning",
                tags: ["memory", "logic"],
              },
            ],
            error: null,
          }),
        };
      }

      if (table === "mistake_review_targets") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockImplementation((payload: any) => {
            insertedTarget = payload;
            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({
                data: { id: "target-new-100", ...payload },
                error: null,
              }),
            };
          }),
          then: (res: any) =>
            res({
              data: [
                {
                  id: "target-new-100",
                  status: "NEEDS_REVIEW",
                  next_due_at: new Date().toISOString(),
                },
              ],
            }),
        };
      }

      if (table === "mistake_occurrences") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockImplementation((payload: any) => {
            insertedOccurrence = payload;
            return { error: null };
          }),
        };
      }

      if (table === "student_skill_mastery") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockImplementation((payload: any) => {
            upsertedMastery = payload;
            return { error: null };
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (res: any) => res({ data: null }),
      };
    });

    const res = await MistakeCaptureService.captureFromAttempt(tenantId, attemptId);

    expect(res.success).toBe(true);
    expect(res.summary?.targetsCreated).toBe(1);
    expect(res.summary?.occurrencesCaptured).toBe(1);

    // Verify target created with auto-resolved skill
    expect(insertedTarget).toBeDefined();
    expect(insertedTarget.skill_id).toBe(canonicalSkillId);
    expect(insertedTarget.primary_reason).toBe("INCORRECT_ANSWER");
    expect(insertedTarget.status).toBe("NEEDS_REVIEW");

    // Verify occurrence created
    expect(insertedOccurrence).toBeDefined();
    expect(insertedOccurrence.capture_reason).toBe("INCORRECT_ANSWER");
    expect(insertedOccurrence.submitted_payload).toEqual({ selected_option: "opt_wrong" });

    // Verify student skill mastery created
    expect(upsertedMastery).toBeDefined();
    expect(upsertedMastery.skill_id).toBe(canonicalSkillId);
    expect(upsertedMastery.mastery_status).toBe("NEEDS_REVIEW");
    expect(upsertedMastery.total_mistakes_count).toBe(1);
  });

  it("2. Returns accurate revision queue metrics via RevisionSchedulerService", async () => {
    const now = new Date();
    mockFrom.mockImplementation((table: string) => {
      if (table === "mistake_review_targets") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (res: any) =>
            res({
              data: [
                {
                  id: "t-1",
                  status: "NEEDS_REVIEW",
                  next_due_at: now.toISOString(), // Due today
                },
                {
                  id: "t-2",
                  status: "MASTERY_DEMONSTRATED",
                  next_due_at: now.toISOString(), // Mastered
                },
              ],
            }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const metrics = await RevisionSchedulerService.getRevisionQueueMetrics(tenantId, studentId);

    expect(metrics.totalActiveCount).toBe(1);
    expect(metrics.dueTodayCount).toBe(1);
    expect(metrics.masteredCount).toBe(1);
    expect(metrics.overdueCount).toBe(0);
  });

  it("3. Returns formatted skills mastery and metrics via MasteryEvaluationService", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "student_skill_mastery") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (res: any) =>
            res({
              data: [
                {
                  id: "mastery-1",
                  tenant_id: tenantId,
                  student_id: studentId,
                  skill_id: canonicalSkillId,
                  mastery_status: "NEEDS_REVIEW",
                  total_mistakes_count: 1,
                  active_review_count: 1,
                  independent_correct_count: 0,
                  independent_attempts_count: 1,
                  accuracy_percentage: 0,
                  canonical_skills: {
                    name: "Logical Reasoning",
                    category: "LOGICAL_REASONING",
                  },
                },
              ],
              error: null,
            }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const overview = await MasteryEvaluationService.getStudentMasteryOverview(tenantId, studentId);

    expect(overview.success).toBe(true);
    expect(overview.skillsMastery).toHaveLength(1);
    expect(overview.skillsMastery![0].skill_name).toBe("Logical Reasoning");
    expect(overview.skillsMastery![0].category).toBe("LOGICAL_REASONING");
    expect(overview.metrics?.totalSkillsAssessed).toBe(1);
    expect(overview.metrics?.needsReviewCount).toBe(1);
    expect(overview.metrics?.averageAccuracy).toBe(0);
  });
});
