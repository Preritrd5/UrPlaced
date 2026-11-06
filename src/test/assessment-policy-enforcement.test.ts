import { describe, it, expect, vi, beforeEach } from "vitest";
import { AttemptLifecycleService } from "@/modules/assessments/services/attempt-lifecycle-service";
import { AssignmentService } from "@/modules/assessments/services/assignment-service";

// Mock Supabase admin client
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (...args: any[]) => mockFrom(...args),
  }),
}));

describe("Assessment Policy Enforcement (Review Policy & Release Policy)", () => {
  const tenantId = "tenant-alpha";
  const studentUserId = "user-student-1";
  const studentId = "student-1-uuid";
  const staffUserId = "user-staff-1";
  const attemptId = "attempt-uuid-100";
  const assessmentId = "assessment-uuid-100";
  const assignmentId = "assignment-uuid-100";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMockDb({
    reviewPolicy,
    releasePolicy,
    attemptStatus = "SCORED",
    windowEnd,
    isStaff = false,
  }: {
    reviewPolicy: "IMMEDIATE" | "AFTER_DEADLINE" | "NEVER";
    releasePolicy: "IMMEDIATE" | "AFTER_DEADLINE" | "MANUAL_STAFF_RELEASE";
    attemptStatus?: string;
    windowEnd?: string;
    isStaff?: boolean;
  }) {
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
              assignment_id: assignmentId,
              status: attemptStatus,
              attempt_number: 1,
              total_points: 10,
              earned_points: 10,
              score_percentage: 100,
              is_passed: true,
              scoring_status: "FINAL",
              assessment: {
                id: assessmentId,
                title: "Network Security Assessment",
                pass_percentage: 60,
                review_policy: reviewPolicy,
                release_policy: releasePolicy,
                question_set_id: "qs-1",
              },
            },
            error: null,
          }),
        };
      }

      if (table === "students") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: isStaff ? null : { id: studentId },
            error: null,
          }),
        };
      }

      if (table === "assessment_assignments") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: windowEnd ? { window_end: windowEnd } : null,
            error: null,
          }),
        };
      }

      if (table === "attempt_responses") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          then: (res: any) =>
            res({
              data: [
                {
                  id: "resp-1",
                  question_id: "q-1",
                  version_id: "v-1",
                  response_payload: { selected_option: "opt_1" },
                  is_answered: true,
                  points_awarded: 10,
                  is_correct: true,
                  scoring_status: "CORRECT",
                  question: {
                    id: "q-1",
                    question_type: "SINGLE_CHOICE",
                  },
                  version: {
                    id: "v-1",
                    prompt: "What is Computer Network?",
                    content_format: "TEXT",
                    options: [
                      { id: "opt_1", text: "Interconnected devices sharing resources" },
                      { id: "opt_2", text: "A standalone PC" },
                    ],
                    answer_key: { correct_option: "opt_1" },
                    explanation: "Networks connect devices.",
                    difficulty: "MEDIUM",
                    topic_tags: ["Networking"],
                  },
                },
              ],
            }),
        };
      }

      if (table === "assessment_violations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          then: (res: any) => res({ data: [] }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        then: (res: any) => res({ data: null }),
      };
    });
  }

  // --------------------------------------------------------------------------
  // Scenario 1: Both AFTER_DEADLINE, Active Assessment Window (User's Case)
  // --------------------------------------------------------------------------
  it("Scenario 1: Withholds scores and questions when both policies are AFTER_DEADLINE and deadline is in the future", async () => {
    const futureDeadline = new Date(Date.now() + 24 * 3600 * 1000).toISOString(); // Tomorrow
    setupMockDb({
      reviewPolicy: "AFTER_DEADLINE",
      releasePolicy: "AFTER_DEADLINE",
      attemptStatus: "SCORED",
      windowEnd: futureDeadline,
      isStaff: false,
    });

    const result = await AttemptLifecycleService.getAttemptResult(
      tenantId,
      studentUserId,
      attemptId,
      false
    );

    expect(result.success).toBe(true);
    expect(result.isScoreReleased).toBe(false);
    expect(result.isReviewable).toBe(false);
    expect(result.isAnswerKeyReleased).toBe(false);

    // Score metrics must be masked
    expect(result.breakdown.earnedPoints).toBeNull();
    expect(result.breakdown.scorePercentage).toBeNull();
    expect(result.breakdown.isPassed).toBeNull();
    expect(result.breakdown.scoringStatus).toBe("PENDING_RELEASE");

    // Questions array must be withheld (0 leaked questions/prompts/answers)
    expect(result.breakdown.questions).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 2: Both AFTER_DEADLINE, Deadline Has Concluded
  // --------------------------------------------------------------------------
  it("Scenario 2: Unlocks scores, answers, and solutions when deadline has passed", async () => {
    const pastDeadline = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 hour ago
    setupMockDb({
      reviewPolicy: "AFTER_DEADLINE",
      releasePolicy: "AFTER_DEADLINE",
      attemptStatus: "SCORED",
      windowEnd: pastDeadline,
      isStaff: false,
    });

    const result = await AttemptLifecycleService.getAttemptResult(
      tenantId,
      studentUserId,
      attemptId,
      false
    );

    expect(result.success).toBe(true);
    expect(result.isScoreReleased).toBe(true);
    expect(result.isReviewable).toBe(true);
    expect(result.isAnswerKeyReleased).toBe(true);

    // Score metrics must be revealed
    expect(result.breakdown.earnedPoints).toBe(10);
    expect(result.breakdown.scorePercentage).toBe(100);
    expect(result.breakdown.isPassed).toBe(true);

    // Questions and answer keys are revealed
    expect(result.breakdown.questions).toHaveLength(1);
    expect(result.breakdown.questions[0].prompt).toBe("What is Computer Network?");
    expect(result.breakdown.questions[0].isCorrect).toBe(true);
    expect(result.breakdown.questions[0].answerKey).toBeDefined();
    expect(result.breakdown.questions[0].explanation).toBe("Networks connect devices.");
  });

  // --------------------------------------------------------------------------
  // Scenario 3: Release Policy AFTER_DEADLINE, Review Policy IMMEDIATE
  // --------------------------------------------------------------------------
  it("Scenario 3: Allows reviewing submitted responses but masks score and correctness when release is AFTER_DEADLINE", async () => {
    const futureDeadline = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    setupMockDb({
      reviewPolicy: "IMMEDIATE",
      releasePolicy: "AFTER_DEADLINE",
      attemptStatus: "SCORED",
      windowEnd: futureDeadline,
      isStaff: false,
    });

    const result = await AttemptLifecycleService.getAttemptResult(
      tenantId,
      studentUserId,
      attemptId,
      false
    );

    expect(result.success).toBe(true);
    expect(result.isScoreReleased).toBe(false);
    expect(result.isReviewable).toBe(true);
    expect(result.isAnswerKeyReleased).toBe(false);

    // Overall score is masked
    expect(result.breakdown.scorePercentage).toBeNull();
    expect(result.breakdown.isPassed).toBeNull();

    // Questions can be reviewed, but pointsAwarded, isCorrect, and answerKeys are strictly masked
    expect(result.breakdown.questions).toHaveLength(1);
    expect(result.breakdown.questions[0].prompt).toBe("What is Computer Network?");
    expect(result.breakdown.questions[0].studentAnswerText).toBe("Interconnected devices sharing resources");
    expect(result.breakdown.questions[0].isCorrect).toBeNull();
    expect(result.breakdown.questions[0].pointsAwarded).toBeNull();
    expect(result.breakdown.questions[0].answerKey).toBeNull();
    expect(result.breakdown.questions[0].explanation).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Scenario 4: Review Policy NEVER, Release Policy IMMEDIATE
  // --------------------------------------------------------------------------
  it("Scenario 4: Reveals overall score but permanently disables question breakdown when Review Policy is NEVER", async () => {
    setupMockDb({
      reviewPolicy: "NEVER",
      releasePolicy: "IMMEDIATE",
      attemptStatus: "SCORED",
      isStaff: false,
    });

    const result = await AttemptLifecycleService.getAttemptResult(
      tenantId,
      studentUserId,
      attemptId,
      false
    );

    expect(result.success).toBe(true);
    expect(result.isScoreReleased).toBe(true);
    expect(result.isReviewable).toBe(false);
    expect(result.isAnswerKeyReleased).toBe(false);

    // Score is visible
    expect(result.breakdown.scorePercentage).toBe(100);
    expect(result.breakdown.isPassed).toBe(true);

    // Questions breakdown is disabled
    expect(result.breakdown.questions).toHaveLength(0);
  });

  // --------------------------------------------------------------------------
  // Scenario 5: Release Policy MANUAL_STAFF_RELEASE
  // --------------------------------------------------------------------------
  it("Scenario 5: Holds score until status is RESULT_RELEASED when Release Policy is MANUAL_STAFF_RELEASE", async () => {
    // 1. SCORED but not yet released by staff
    setupMockDb({
      reviewPolicy: "IMMEDIATE",
      releasePolicy: "MANUAL_STAFF_RELEASE",
      attemptStatus: "SCORED",
      isStaff: false,
    });

    const unreleasedResult = await AttemptLifecycleService.getAttemptResult(
      tenantId,
      studentUserId,
      attemptId,
      false
    );
    expect(unreleasedResult.isScoreReleased).toBe(false);
    expect(unreleasedResult.breakdown.scorePercentage).toBeNull();

    // 2. Staff publishes results (status becomes RESULT_RELEASED)
    setupMockDb({
      reviewPolicy: "IMMEDIATE",
      releasePolicy: "MANUAL_STAFF_RELEASE",
      attemptStatus: "RESULT_RELEASED",
      isStaff: false,
    });

    const releasedResult = await AttemptLifecycleService.getAttemptResult(
      tenantId,
      studentUserId,
      attemptId,
      false
    );
    expect(releasedResult.isScoreReleased).toBe(true);
    expect(releasedResult.breakdown.scorePercentage).toBe(100);
  });

  // --------------------------------------------------------------------------
  // Scenario 6: Institutional Staff Inspection Override
  // --------------------------------------------------------------------------
  it("Scenario 6: Placement staff has full inspection override regardless of student deadline or policies", async () => {
    const futureDeadline = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    setupMockDb({
      reviewPolicy: "NEVER",
      releasePolicy: "AFTER_DEADLINE",
      attemptStatus: "SCORED",
      windowEnd: futureDeadline,
      isStaff: true,
    });

    const staffResult = await AttemptLifecycleService.getAttemptResult(
      tenantId,
      staffUserId,
      attemptId,
      true // isStaff
    );

    expect(staffResult.success).toBe(true);
    expect(staffResult.isScoreReleased).toBe(true);
    expect(staffResult.isReviewable).toBe(true);
    expect(staffResult.isAnswerKeyReleased).toBe(true);
    expect(staffResult.breakdown.scorePercentage).toBe(100);
    expect(staffResult.breakdown.questions).toHaveLength(1);
    expect(staffResult.breakdown.questions[0].answerKey).toBeDefined();
    expect(staffResult.breakdown.questions[0].explanation).toBeDefined();
  });
});
