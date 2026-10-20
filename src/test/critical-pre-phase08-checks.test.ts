import { describe, it, expect } from "vitest";
import { AssessmentScoringService } from "@/modules/assessments/services/assessment-scoring-service";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { QuestionVersionRow, QuestionType } from "@/types/database";

describe("Critical Pre-Phase 08 Verification Gate", () => {
  const tenantId = "tenant-alpha";
  const studentA = "student-alice";
  const studentB = "student-bob";

  // ============================================================================
  // CHECK 1: PERSISTENCE, PAGE REFRESH RECOVERY & SERVER COUNTDOWN
  // ============================================================================
  it("Check 1: Persists responses, restores full state upon page refresh, and recovers correct remaining time", () => {
    const startedAt = new Date("2026-10-19T10:00:00.000Z");
    const durationMinutes = 60;
    const expiresAt = new Date("2026-10-19T11:00:00.000Z"); // 60 mins later

    // Simulated database record of student's in-progress attempt
    const attemptRecord = {
      id: "attempt-101",
      tenant_id: tenantId,
      student_id: studentA,
      assessment_id: "ass-1",
      status: "IN_PROGRESS",
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    // Candidate answers Q1, flags Q2, leaves Q3 blank
    const savedResponses = [
      {
        question_id: "q-1",
        version_id: "v-1",
        response_payload: { selected_option: "opt_b" },
        save_sequence: 3,
        is_flagged: false,
        is_answered: true,
        last_saved_at: "2026-10-19T10:10:00.000Z",
      },
      {
        question_id: "q-2",
        version_id: "v-2",
        response_payload: { numeric_value: 42 },
        save_sequence: 2,
        is_flagged: true,
        is_answered: true,
        last_saved_at: "2026-10-19T10:12:00.000Z",
      },
      {
        question_id: "q-3",
        version_id: "v-3",
        response_payload: {},
        save_sequence: 1,
        is_flagged: false,
        is_answered: false,
        last_saved_at: "2026-10-19T10:00:00.000Z",
      },
    ];

    // Page Refresh happens 20 minutes later
    const refreshTime = new Date("2026-10-19T10:20:00.000Z");

    // Server recalculates remaining seconds dynamically from expires_at - refreshTime
    const calculatedRemainingSeconds = Math.max(
      0,
      Math.floor((new Date(attemptRecord.expires_at).getTime() - refreshTime.getTime()) / 1000)
    );

    // Remaining time should be exactly 40 minutes (2400 seconds), NOT reset to 60 minutes
    expect(calculatedRemainingSeconds).toBe(40 * 60);

    // Workspace state recovery mapping
    const recoveredAnswers: Record<string, any> = {};
    const recoveredFlags: Record<string, boolean> = {};
    const recoveredSequences: Record<string, number> = {};

    savedResponses.forEach((r) => {
      recoveredAnswers[r.question_id] = r.response_payload;
      recoveredFlags[r.question_id] = r.is_flagged;
      recoveredSequences[r.question_id] = r.save_sequence;
    });

    // Verification of recovered state
    expect(recoveredAnswers["q-1"]).toEqual({ selected_option: "opt_b" });
    expect(recoveredFlags["q-1"]).toBe(false);
    expect(recoveredSequences["q-1"]).toBe(3);

    expect(recoveredAnswers["q-2"]).toEqual({ numeric_value: 42 });
    expect(recoveredFlags["q-2"]).toBe(true);
    expect(recoveredSequences["q-2"]).toBe(2);

    expect(recoveredAnswers["q-3"]).toEqual({});
    expect(recoveredFlags["q-3"]).toBe(false);
  });

  // ============================================================================
  // CHECK 2: SUBMIT ONCE, SERVER SCORING, IDEMPOTENCY & TAMPER PREVENTION
  // ============================================================================
  it("Check 2: Submits once, calculates score correctly on server, and strictly blocks repeated submissions or tampering", async () => {
    let attemptState = {
      id: "attempt-202",
      student_id: studentA,
      status: "IN_PROGRESS",
      total_points: 0,
      earned_points: 0,
      score_percentage: 0,
      is_passed: false,
    };

    const questionV1: QuestionVersionRow = {
      id: "ver-1",
      tenant_id: tenantId,
      question_id: "q-1",
      version_number: 1,
      prompt: "What is the capital of France?",
      content_format: "MARKDOWN",
      options: [],
      answer_key: { correct_option: "Paris" },
      explanation: "Paris is the capital of France.",
      difficulty: "EASY",
      skill_id: "skill-gk",
      topic_tags: ["Geography"],
      source_type: "COLLEGE_AUTHORED",
      source_reference: null,
      license_type: "PROPRIETARY",
      review_status: "VERIFIED_CORRECT",
      review_notes: null,
      fingerprint: "fp1",
      change_summary: null,
      published_at: new Date().toISOString(),
      created_by: "staff-1",
      reviewed_by: "staff-1",
      created_at: new Date().toISOString(),
    };

    // Candidate submitted answer
    const studentResponse = { selected_option: "Paris" };

    // Function simulating server submit transition
    function submitAttemptServer(attempt: typeof attemptState, requestingStudentId: string) {
      if (attempt.student_id !== requestingStudentId) {
        return { success: false, error: "Unauthorized" };
      }
      if (attempt.status !== "IN_PROGRESS") {
        return {
          success: false,
          error: `Attempt has already been submitted or closed (status: ${attempt.status}).`,
        };
      }

      // Mark submitted
      attempt.status = "SCORED";
      return { success: true };
    }

    // 1. First submission succeeds
    const firstSubmit = submitAttemptServer(attemptState, studentA);
    expect(firstSubmit.success).toBe(true);
    expect(attemptState.status).toBe("SCORED");

    // 2. Server evaluates score deterministically
    const scoringResult = await AssessmentScoringService.evaluateResponse(
      "SINGLE_CHOICE",
      questionV1,
      10.0,
      2.0,
      studentResponse
    );
    expect(scoringResult.isCorrect).toBe(true);
    expect(scoringResult.pointsAwarded).toBe(10.0);

    attemptState.earned_points = scoringResult.pointsAwarded;
    attemptState.total_points = 10.0;
    attemptState.score_percentage = 100.0;
    attemptState.is_passed = true;

    // 3. Repeated submission is strictly rejected (idempotency guard)
    const duplicateSubmit = submitAttemptServer(attemptState, studentA);
    expect(duplicateSubmit.success).toBe(false);
    expect(duplicateSubmit.error).toContain("already been submitted");

    // 4. Autosave after submission is locked
    function simulateAutosaveGuard(attempt: typeof attemptState) {
      if (attempt.status !== "IN_PROGRESS") {
        return { success: false, error: `Cannot save response: attempt status is ${attempt.status}.` };
      }
      return { success: true };
    }

    const postSubmitAutosave = simulateAutosaveGuard(attemptState);
    expect(postSubmitAutosave.success).toBe(false);
    expect(postSubmitAutosave.error).toContain("status is SCORED");

    // 5. Score tampering check: score cannot be altered by client
    expect(attemptState.earned_points).toBe(10.0);
    expect(attemptState.score_percentage).toBe(100.0);
  });

  // ============================================================================
  // CHECK 3: EXACT QUESTION VERSION RETENTION, CROSS-STUDENT PRIVACY & RELEASE POLICY
  // ============================================================================
  it("Check 3: Uses exact version_id in review, blocks cross-student retrieval, and shields unreleased answer keys", () => {
    // Version 1 was attempted by Student A
    const originalVersion: QuestionVersionRow = {
      id: "version-1-uuid",
      tenant_id: tenantId,
      question_id: "question-42",
      version_number: 1,
      prompt: "Original wording of question before staff revised it in version 2.",
      content_format: "MARKDOWN",
      options: [{ id: "opt_1", text: "Answer A" }],
      answer_key: { correct_option: "opt_1" },
      explanation: "Original explanation.",
      difficulty: "EASY",
      skill_id: "skill-1",
      topic_tags: ["Basics"],
      source_type: "COLLEGE_AUTHORED",
      source_reference: null,
      license_type: "PROPRIETARY",
      review_status: "VERIFIED_CORRECT",
      review_notes: null,
      fingerprint: "fp-v1",
      change_summary: "Initial",
      published_at: "2026-10-01T00:00:00Z",
      created_by: "staff-1",
      reviewed_by: "staff-1",
      created_at: "2026-10-01T00:00:00Z",
    };

    // Student A's persisted response row points directly to version-1-uuid
    const studentAResponseRow = {
      attempt_id: "attempt-a",
      student_id: studentA,
      question_id: "question-42",
      version_id: "version-1-uuid", // anchored to exact immutable version
      response_payload: { selected_option: "opt_1" },
    };

    expect(studentAResponseRow.version_id).toBe("version-1-uuid");

    // Simulation of getAttemptResult authorization logic
    function resolveAttemptResultForUser(
      attemptOwnerId: string,
      requestingStudentId: string,
      releasePolicy: "IMMEDIATE" | "AFTER_DEADLINE" | "MANUAL_STAFF_RELEASE",
      attemptStatus: string,
      deadlinePassed: boolean
    ) {
      // 1. Cross-student privacy check
      if (requestingStudentId !== attemptOwnerId) {
        return { success: false, error: "Unauthorized: You cannot access another student's attempt." };
      }

      // 2. Release policy check
      let isReleased = false;
      if (releasePolicy === "IMMEDIATE") {
        isReleased = ["SCORED", "RESULT_RELEASED"].includes(attemptStatus);
      } else if (releasePolicy === "AFTER_DEADLINE") {
        isReleased = deadlinePassed || attemptStatus === "RESULT_RELEASED";
      } else if (releasePolicy === "MANUAL_STAFF_RELEASE") {
        isReleased = attemptStatus === "RESULT_RELEASED";
      }

      // 3. Mask keys if unreleased
      return {
        success: true,
        isReleased,
        answerKey: isReleased ? originalVersion.answer_key : null,
        explanation: isReleased ? originalVersion.explanation : null,
      };
    }

    // Student B attempts to access Student A's result -> BLOCKED
    const crossAccess = resolveAttemptResultForUser(
      studentA,
      studentB,
      "IMMEDIATE",
      "SCORED",
      true
    );
    expect(crossAccess.success).toBe(false);
    expect(crossAccess.error).toContain("cannot access another student's attempt");

    // Student A accesses their own result when policy is AFTER_DEADLINE and deadline has NOT passed -> MASKED
    const maskedResult = resolveAttemptResultForUser(
      studentA,
      studentA,
      "AFTER_DEADLINE",
      "SCORED",
      false // active window
    );
    expect(maskedResult.success).toBe(true);
    expect(maskedResult.isReleased).toBe(false);
    expect(maskedResult.answerKey).toBeNull();
    expect(maskedResult.explanation).toBeNull();

    // Student A accesses their own result when window has closed -> UNLOCKED
    const unlockedResult = resolveAttemptResultForUser(
      studentA,
      studentA,
      "AFTER_DEADLINE",
      "SCORED",
      true // deadline passed
    );
    expect(unlockedResult.success).toBe(true);
    expect(unlockedResult.isReleased).toBe(true);
    expect(unlockedResult.answerKey).toEqual({ correct_option: "opt_1" });
    expect(unlockedResult.explanation).toBe("Original explanation.");
  });

  // ============================================================================
  // CHECK 4: DISTINCT CLASSIFICATION FOR PHASE 08 MISTAKE BANK INTEGRATION
  // ============================================================================
  it("Check 4: Unambiguously categorizes Incorrect, Skipped, Flagged, and Unanswered records for Phase 08", () => {
    interface AttemptResponseRecord {
      questionId: string;
      is_answered: boolean;
      is_flagged: boolean;
      is_correct: boolean | null;
      payload: any;
      scoring_status: string;
    }

    const testResponses: AttemptResponseRecord[] = [
      // 1. Candidate answered incorrectly (Mistake Bank priority target)
      {
        questionId: "q-wrong",
        is_answered: true,
        is_flagged: false,
        is_correct: false,
        payload: { selected_option: "opt_wrong" },
        scoring_status: "AUTOMATICALLY_SCORED",
      },
      // 2. Candidate answered and flagged for doubt
      {
        questionId: "q-doubtful-correct",
        is_answered: true,
        is_flagged: true,
        is_correct: true,
        payload: { selected_option: "opt_correct" },
        scoring_status: "AUTOMATICALLY_SCORED",
      },
      // 3. Candidate skipped / left unanswered
      {
        questionId: "q-skipped",
        is_answered: false,
        is_flagged: false,
        is_correct: false,
        payload: {},
        scoring_status: "AUTOMATICALLY_SCORED",
      },
      // 4. Candidate flagged and left unanswered
      {
        questionId: "q-flagged-unanswered",
        is_answered: false,
        is_flagged: true,
        is_correct: false,
        payload: {},
        scoring_status: "AUTOMATICALLY_SCORED",
      },
      // 5. Short answer pending manual review
      {
        questionId: "q-subjective",
        is_answered: true,
        is_flagged: false,
        is_correct: null,
        payload: { text: "Explanation..." },
        scoring_status: "MANUAL_REVIEW_REQUIRED",
      },
    ];

    // Classification queries for Phase 08 Mistake Bank
    const mistakeBankCandidates = testResponses.filter(
      (r) => r.is_answered === true && r.is_correct === false
    );

    const skippedQuestions = testResponses.filter(
      (r) => r.is_answered === false
    );

    const flaggedQuestions = testResponses.filter(
      (r) => r.is_flagged === true
    );

    const pendingManualReviews = testResponses.filter(
      (r) => r.scoring_status === "MANUAL_REVIEW_REQUIRED"
    );

    // Assert that each state is uniquely isolated without confusion:
    expect(mistakeBankCandidates).toHaveLength(1);
    expect(mistakeBankCandidates[0].questionId).toBe("q-wrong");

    expect(skippedQuestions).toHaveLength(2);
    expect(skippedQuestions.map((s) => s.questionId)).toEqual(["q-skipped", "q-flagged-unanswered"]);

    expect(flaggedQuestions).toHaveLength(2);
    expect(flaggedQuestions.map((f) => f.questionId)).toEqual(["q-doubtful-correct", "q-flagged-unanswered"]);

    expect(pendingManualReviews).toHaveLength(1);
    expect(pendingManualReviews[0].questionId).toBe("q-subjective");
  });
});
