import { describe, it, expect } from "vitest";
import { AssessmentScoringService } from "@/modules/assessments/services/assessment-scoring-service";
import { QuestionVersionRow } from "@/types/database";

describe("Phase 07: Assessment Server-Side Scoring Service", () => {
  const baseVersion: QuestionVersionRow = {
    id: "ver-123",
    tenant_id: "tenant-456",
    question_id: "q-123",
    version_number: 1,
    prompt: "Sample question prompt",
    content_format: "MARKDOWN",
    options: [],
    answer_key: {},
    explanation: "Detailed explanation text.",
    difficulty: "MEDIUM",
    skill_id: "skill-789",
    topic_tags: ["Algorithms", "Arrays"],
    source_type: "COLLEGE_AUTHORED",
    source_reference: null,
    license_type: "PROPRIETARY",
    review_status: "VERIFIED_CORRECT",
    review_notes: null,
    fingerprint: "fp123",
    change_summary: null,
    published_at: new Date().toISOString(),
    created_by: "user-1",
    reviewed_by: "user-1",
    created_at: new Date().toISOString(),
  };

  it("evaluates SINGLE_CHOICE correctly on match and awards full points", async () => {
    const version: QuestionVersionRow = {
      ...baseVersion,
      answer_key: { correct_option: "opt_b" },
    };

    const res = await AssessmentScoringService.evaluateResponse(
      "SINGLE_CHOICE",
      version,
      2.0,
      0.5,
      { selected_option: "opt_b" }
    );

    expect(res.isCorrect).toBe(true);
    expect(res.pointsAwarded).toBe(2.0);
    expect(res.scoringStatus).toBe("AUTOMATICALLY_SCORED");
  });

  it("evaluates SINGLE_CHOICE on mismatch and deducts negative points", async () => {
    const version: QuestionVersionRow = {
      ...baseVersion,
      answer_key: { correct_option: "opt_b" },
    };

    const res = await AssessmentScoringService.evaluateResponse(
      "SINGLE_CHOICE",
      version,
      2.0,
      0.5,
      { selected_option: "opt_c" }
    );

    expect(res.isCorrect).toBe(false);
    expect(res.pointsAwarded).toBe(-0.5);
    expect(res.scoringStatus).toBe("AUTOMATICALLY_SCORED");
  });

  it("evaluates MULTIPLE_SELECT exact set matching and penalizes partial/incorrect sets", async () => {
    const version: QuestionVersionRow = {
      ...baseVersion,
      answer_key: { correct_options: ["opt_a", "opt_c"] },
    };

    // Exact match regardless of ordering
    const matchRes = await AssessmentScoringService.evaluateResponse(
      "MULTIPLE_SELECT",
      version,
      3.0,
      1.0,
      { selected_options: ["opt_c", "opt_a"] }
    );
    expect(matchRes.isCorrect).toBe(true);
    expect(matchRes.pointsAwarded).toBe(3.0);

    // Partial selection (only opt_a)
    const partialRes = await AssessmentScoringService.evaluateResponse(
      "MULTIPLE_SELECT",
      version,
      3.0,
      1.0,
      { selected_options: ["opt_a"] }
    );
    expect(partialRes.isCorrect).toBe(false);
    expect(partialRes.pointsAwarded).toBe(-1.0);
  });

  it("evaluates NUMERIC with tolerance", async () => {
    const version: QuestionVersionRow = {
      ...baseVersion,
      answer_key: { correct_value: 3.14, tolerance: 0.01 },
    };

    // Within tolerance
    const matchRes = await AssessmentScoringService.evaluateResponse(
      "NUMERIC",
      version,
      2.0,
      0.0,
      { numeric_value: 3.145 }
    );
    expect(matchRes.isCorrect).toBe(true);
    expect(matchRes.pointsAwarded).toBe(2.0);

    // Outside tolerance
    const mismatchRes = await AssessmentScoringService.evaluateResponse(
      "NUMERIC",
      version,
      2.0,
      0.0,
      { numeric_value: 3.2 }
    );
    expect(mismatchRes.isCorrect).toBe(false);
    expect(mismatchRes.pointsAwarded).toBe(0.0);
  });

  it("marks SHORT_ANSWER for MANUAL_REVIEW_REQUIRED with provisional 0 points", async () => {
    const res = await AssessmentScoringService.evaluateResponse(
      "SHORT_ANSWER",
      baseVersion,
      5.0,
      0.0,
      { text: "My thoughtful explanation of quicksort." }
    );

    expect(res.isCorrect).toBeNull();
    expect(res.pointsAwarded).toBe(0);
    expect(res.scoringStatus).toBe("MANUAL_REVIEW_REQUIRED");
  });

  it("handles CODING questions when runner is not configured without fabricating execution", async () => {
    delete process.env.CODE_RUNNER_ENDPOINT;

    const version: QuestionVersionRow = {
      ...baseVersion,
      answer_key: {
        test_cases: [{ input: "5", expectedOutput: "25" }],
      },
    };

    const res = await AssessmentScoringService.evaluateResponse(
      "CODING",
      version,
      10.0,
      0.0,
      { code: "def square(x):\n    return x*x", language: "python" }
    );

    expect(res.isCorrect).toBeNull();
    expect(res.pointsAwarded).toBe(0);
    expect(res.scoringStatus).toBe("MANUAL_REVIEW_REQUIRED");
    expect(res.notes).toContain("not configured");
  });
});
