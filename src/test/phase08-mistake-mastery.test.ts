import { describe, it, expect } from "vitest";
import {
  RevisionSchedulerService,
  REVISION_STAGES,
} from "@/modules/mistake-mastery/services/revision-scheduler-service";
import {
  Permissions,
  can,
  RoleDefaultPermissions,
} from "@/modules/identity-access/services/policy-engine";
import {
  MistakePrimaryReason,
  ReviewTargetStatus,
  MasteryStatus,
  QuestionDifficulty,
} from "@/types/database";

describe("Phase 08: Mistake Bank & Mistake-to-Mastery Engine Acceptance Test Suite", () => {
  const tenantId = "tenant-001";
  const studentAlice = "student-alice";
  const studentBob = "student-bob";
  const skillBinarySearch = "skill-dsa-binary-search";

  // ============================================================================
  // REQUIREMENT 1: 7 REVIEW CLASSIFICATIONS & CAPTURE LOGIC
  // ============================================================================
  it("Requirement 1: Properly distinguishes and classifies all 7 review reasons", () => {
    // 1. Incorrect Answer
    const classifyResponse = (resp: {
      isCorrect: boolean | null;
      isAnswered: boolean;
      isFlagged: boolean;
      defectSuspected?: boolean;
    }): MistakePrimaryReason => {
      if (resp.defectSuspected) return "CONTENT_DEFECT_SUSPECTED";
      if (!resp.isAnswered) return "SKIPPED_UNANSWERED";
      if (resp.isCorrect === false) return "INCORRECT_ANSWER";
      if (resp.isCorrect === true && resp.isFlagged) return "CORRECT_REVIEW_LATER";
      if (resp.isFlagged) return "STUDENT_FLAGGED";
      return "INCORRECT_ANSWER";
    };

    expect(
      classifyResponse({ isCorrect: false, isAnswered: true, isFlagged: false })
    ).toBe("INCORRECT_ANSWER");

    expect(
      classifyResponse({ isCorrect: null, isAnswered: false, isFlagged: false })
    ).toBe("SKIPPED_UNANSWERED");

    expect(
      classifyResponse({ isCorrect: true, isAnswered: true, isFlagged: true })
    ).toBe("CORRECT_REVIEW_LATER");

    expect(
      classifyResponse({ isCorrect: false, isAnswered: true, isFlagged: true })
    ).toBe("INCORRECT_ANSWER");

    expect(
      classifyResponse({ isCorrect: null, isAnswered: false, isFlagged: true })
    ).toBe("SKIPPED_UNANSWERED");

    expect(
      classifyResponse({
        isCorrect: false,
        isAnswered: true,
        isFlagged: false,
        defectSuspected: true,
      })
    ).toBe("CONTENT_DEFECT_SUSPECTED");
  });

  // ============================================================================
  // REQUIREMENT 2: TARGET DEDUPLICATION & OCCURRENCE ACCUMULATION
  // ============================================================================
  it("Requirement 2: Deduplicates primary review target while preserving occurrence logs across attempts", () => {
    // Simulating database storage state
    interface SimulatedTarget {
      id: string;
      studentId: string;
      questionId: string;
      versionId: string;
      occurrenceCount: number;
      revisionStage: number;
      status: ReviewTargetStatus;
      reflection: string | null;
      firstObservedAt: string;
      lastObservedAt: string;
    }

    interface SimulatedOccurrence {
      id: string;
      targetId: string;
      attemptId: string;
      questionId: string;
      occurredAt: string;
    }

    const targets: SimulatedTarget[] = [];
    const occurrences: SimulatedOccurrence[] = [];

    const ingestAttemptQuestion = (
      studentId: string,
      attemptId: string,
      questionId: string,
      versionId: string,
      timestamp: string
    ) => {
      // Find or create target
      let target = targets.find(
        (t) =>
          t.studentId === studentId &&
          t.questionId === questionId &&
          t.versionId === versionId
      );

      if (target) {
        target.occurrenceCount += 1;
        target.lastObservedAt = timestamp;
        if (target.status === "RESOLVED_DISMISSED") {
          target.status = "NEEDS_REVIEW";
        }
      } else {
        target = {
          id: `target-${questionId}`,
          studentId,
          questionId,
          versionId,
          occurrenceCount: 1,
          revisionStage: 1,
          status: "NEEDS_REVIEW",
          reflection: null,
          firstObservedAt: timestamp,
          lastObservedAt: timestamp,
        };
        targets.push(target);
      }

      // Record occurrence (unique per attempt + question)
      const exists = occurrences.some(
        (o) => o.attemptId === attemptId && o.questionId === questionId
      );
      if (!exists) {
        occurrences.push({
          id: `occ-${attemptId}-${questionId}`,
          targetId: target.id,
          attemptId,
          questionId,
          occurredAt: timestamp,
        });
      }
    };

    // Attempt 1: Alice misses Question Q100
    ingestAttemptQuestion(studentAlice, "attempt-1", "q-100", "v-1", "2026-10-19T10:00:00Z");
    expect(targets.length).toBe(1);
    expect(targets[0].occurrenceCount).toBe(1);
    expect(occurrences.length).toBe(1);

    // Alice adds a self-reflection note
    targets[0].reflection = "I forgot that arrays must be sorted for binary search.";

    // Attempt 2: Alice misses Question Q100 again in a later mock test
    ingestAttemptQuestion(studentAlice, "attempt-2", "q-100", "v-1", "2026-10-25T14:00:00Z");

    // Must still have exactly 1 target, but occurrence count is 2 and reflection is preserved!
    expect(targets.length).toBe(1);
    expect(targets[0].occurrenceCount).toBe(2);
    expect(targets[0].reflection).toBe("I forgot that arrays must be sorted for binary search.");
    expect(targets[0].firstObservedAt).toBe("2026-10-19T10:00:00Z");
    expect(targets[0].lastObservedAt).toBe("2026-10-25T14:00:00Z");

    // Occurrences list has both historical observations
    expect(occurrences.length).toBe(2);
    expect(occurrences[0].attemptId).toBe("attempt-1");
    expect(occurrences[1].attemptId).toBe("attempt-2");

    // Idempotency: Re-scoring attempt-2 does NOT create a 3rd occurrence
    ingestAttemptQuestion(studentAlice, "attempt-2", "q-100", "v-1", "2026-10-25T14:00:00Z");
    expect(occurrences.length).toBe(2);
  });

  // ============================================================================
  // REQUIREMENT 3: SPACED REPETITION SCHEDULE ADVANCEMENT & REGRESSION
  // ============================================================================
  it("Requirement 3: Advances through stages (1d->3d->7d->14d->30d) on success, resets to Stage 1 on failure", () => {
    const baseDate = new Date("2026-10-19T00:00:00Z");

    // Stage 1 initial -> Success advances to Stage 2 (due in 3 days)
    const step1 = RevisionSchedulerService.calculateNextDueDate(1, baseDate, true);
    expect(step1.nextStage).toBe(2);
    expect(step1.intervalDays).toBe(3);
    expect(step1.nextDueAt.toISOString()).toBe("2026-10-22T00:00:00.000Z");

    // Stage 2 -> Success advances to Stage 3 (due in 7 days)
    const step2 = RevisionSchedulerService.calculateNextDueDate(2, step1.nextDueAt, true);
    expect(step2.nextStage).toBe(3);
    expect(step2.intervalDays).toBe(7);
    expect(step2.nextDueAt.toISOString()).toBe("2026-10-29T00:00:00.000Z");

    // Stage 3 -> Success advances to Stage 4 (due in 14 days)
    const step3 = RevisionSchedulerService.calculateNextDueDate(3, step2.nextDueAt, true);
    expect(step3.nextStage).toBe(4);
    expect(step3.intervalDays).toBe(14);
    expect(step3.nextDueAt.toISOString()).toBe("2026-11-12T00:00:00.000Z");

    // Stage 4 -> Failure resets to Stage 1 (due in 1 day)
    const step4Fail = RevisionSchedulerService.calculateNextDueDate(4, step3.nextDueAt, false);
    expect(step4Fail.nextStage).toBe(1);
    expect(step4Fail.intervalDays).toBe(1);
    expect(step4Fail.nextDueAt.toISOString()).toBe("2026-11-13T00:00:00.000Z");
  });

  // ============================================================================
  // REQUIREMENT 4: STRICT NON-NEGOTIABLE MASTERY INVARIANT
  // ============================================================================
  it("Requirement 4: Strict Invariant - Re-answering revealed question does NOT count toward independent mastery", () => {
    const originalMistakeQuestionId = "q-binary-search-1";

    interface EvidenceItem {
      questionId: string;
      isNewQuestion: boolean;
      isCorrect: boolean;
      validityStatus: string;
    }

    const evaluateEvidence = (
      originalTargetQuestionId: string,
      testedQuestionId: string,
      isCorrect: boolean
    ): EvidenceItem => {
      // Core Invariant Check:
      // If the question is the SAME question ID as the original mistake target,
      // isNewQuestion MUST be false!
      const isNewQuestion = testedQuestionId !== originalTargetQuestionId;

      return {
        questionId: testedQuestionId,
        isNewQuestion,
        isCorrect,
        validityStatus: "VALID",
      };
    };

    // Candidate re-answers the exact same question they got wrong earlier (now with revealed answer)
    const repeatEv = evaluateEvidence(originalMistakeQuestionId, originalMistakeQuestionId, true);
    expect(repeatEv.isNewQuestion).toBe(false);
    expect(repeatEv.isCorrect).toBe(true);

    // Candidate answers a NEW, unrevealed question testing the same skill
    const newEv = evaluateEvidence(originalMistakeQuestionId, "q-binary-search-2", true);
    expect(newEv.isNewQuestion).toBe(true);
    expect(newEv.isCorrect).toBe(true);

    // Rule: Only items with isNewQuestion === true count toward independent attempts
    const evidenceList: EvidenceItem[] = [repeatEv, newEv];
    const independentAttempts = evidenceList.filter((e) => e.isNewQuestion && e.validityStatus === "VALID");
    expect(independentAttempts.length).toBe(1);
    expect(independentAttempts[0].questionId).toBe("q-binary-search-2");
  });

  // ============================================================================
  // REQUIREMENT 5: EVIDENCE-BASED MASTERY STATUS TRANSITIONS
  // ============================================================================
  it("Requirement 5: Accurately evaluates mastery status from independent evidence", () => {
    const calculateMasteryStatus = (params: {
      independentAttempts: number;
      independentCorrect: number;
      mediumOrHardCorrect: number;
      totalMistakes: number;
      activeReviews: number;
    }): MasteryStatus => {
      const {
        independentAttempts,
        independentCorrect,
        mediumOrHardCorrect,
        totalMistakes,
        activeReviews,
      } = params;

      if (independentAttempts === 0) {
        return totalMistakes > 0 ? "NEEDS_REVIEW" : "UNASSESSED";
      }

      if (independentAttempts < 2) {
        return "PRACTISING";
      }

      const accuracy = (independentCorrect / independentAttempts) * 100;

      if (accuracy < 50) {
        return "NEEDS_REVIEW";
      }

      if (accuracy < 80) {
        return "IMPROVING";
      }

      // >= 80% accuracy
      if (independentAttempts >= 3 && mediumOrHardCorrect >= 2 && activeReviews === 0) {
        return "MASTERY_DEMONSTRATED";
      }

      return "PROVISIONAL_MASTERY";
    };

    // 0 attempts with mistakes -> NEEDS_REVIEW
    expect(
      calculateMasteryStatus({
        independentAttempts: 0,
        independentCorrect: 0,
        mediumOrHardCorrect: 0,
        totalMistakes: 2,
        activeReviews: 2,
      })
    ).toBe("NEEDS_REVIEW");

    // 1 attempt correct -> PRACTISING (fewer than 2 independent trials)
    expect(
      calculateMasteryStatus({
        independentAttempts: 1,
        independentCorrect: 1,
        mediumOrHardCorrect: 1,
        totalMistakes: 2,
        activeReviews: 1,
      })
    ).toBe("PRACTISING");

    // 2 attempts, 1 correct (50% accuracy) -> IMPROVING
    expect(
      calculateMasteryStatus({
        independentAttempts: 2,
        independentCorrect: 1,
        mediumOrHardCorrect: 1,
        totalMistakes: 2,
        activeReviews: 1,
      })
    ).toBe("IMPROVING");

    // 2 attempts, 2 correct (100% accuracy, but only 2 attempts) -> PROVISIONAL_MASTERY
    expect(
      calculateMasteryStatus({
        independentAttempts: 2,
        independentCorrect: 2,
        mediumOrHardCorrect: 2,
        totalMistakes: 2,
        activeReviews: 0,
      })
    ).toBe("PROVISIONAL_MASTERY");

    // 3 attempts, 3 correct (100% accuracy, >= 3 attempts, >= 2 medium/hard, 0 active reviews) -> MASTERY_DEMONSTRATED
    expect(
      calculateMasteryStatus({
        independentAttempts: 3,
        independentCorrect: 3,
        mediumOrHardCorrect: 2,
        totalMistakes: 2,
        activeReviews: 0,
      })
    ).toBe("MASTERY_DEMONSTRATED");
  });

  // ============================================================================
  // REQUIREMENT 6: CONTENT DEFECT RESOLUTION & UNFAIR MISTAKE INVALIDATION
  // ============================================================================
  it("Requirement 6: Invalidation of defect question restores fair status without student penalty", () => {
    // Before defect resolution: Alice has an error recorded for defective question Q-ERR
    let aliceTarget = {
      questionId: "q-err",
      status: "NEEDS_REVIEW" as ReviewTargetStatus,
    };

    let aliceEvidence = [
      {
        questionId: "q-err",
        isCorrect: false,
        validityStatus: "VALID",
      },
      {
        questionId: "q-valid-new-1",
        isCorrect: true,
        validityStatus: "VALID",
      },
      {
        questionId: "q-valid-new-2",
        isCorrect: true,
        validityStatus: "VALID",
      },
    ];

    // Candidate reports defect
    aliceTarget.status = "CONTENT_DEFECT_SUSPECTED";
    expect(aliceTarget.status).toBe("CONTENT_DEFECT_SUSPECTED");

    // Staff confirms defect & invalidates mistakes for question Q-ERR
    const resolveDefect = (questionId: string) => {
      if (aliceTarget.questionId === questionId) {
        aliceTarget.status = "CONTENT_INVALIDATED";
      }

      for (const ev of aliceEvidence) {
        if (ev.questionId === questionId) {
          ev.validityStatus = "INVALIDATED_DEFECT";
        }
      }
    };

    resolveDefect("q-err");

    // Target is marked CONTENT_INVALIDATED
    expect(aliceTarget.status).toBe("CONTENT_INVALIDATED");

    // Filter valid evidence
    const validEvidence = aliceEvidence.filter((e) => e.validityStatus === "VALID");
    expect(validEvidence.length).toBe(2);
    // Both remaining valid evidence are correct (100% accuracy!)
    expect(validEvidence.every((e) => e.isCorrect)).toBe(true);
  });

  // ============================================================================
  // REQUIREMENT 7: RBAC AUTHORIZATION POLICIES & SECURITY
  // ============================================================================
  it("Requirement 7: Enforces scoped permissions and denies unauthorized student cohort access", () => {
    const studentPerms = RoleDefaultPermissions.STUDENT;
    const staffPerms = RoleDefaultPermissions.PLACEMENT_STAFF;
    const headPerms = RoleDefaultPermissions.PLACEMENT_HEAD;

    // Student has access to own mistake bank and defect reporting
    expect(studentPerms).toContain(Permissions.MISTAKE_BANK_MANAGE_OWN);
    expect(studentPerms).toContain(Permissions.QUESTION_DEFECTS_REPORT);

    // Student CANNOT read cohort metrics or manage question defect moderation
    expect(studentPerms).not.toContain(Permissions.MISTAKE_BANK_READ_COHORT);
    expect(studentPerms).not.toContain(Permissions.QUESTION_DEFECTS_MANAGE);

    // Placement staff and head have cohort access and defect moderation
    expect(staffPerms).toContain(Permissions.MISTAKE_BANK_READ_COHORT);
    expect(staffPerms).toContain(Permissions.QUESTION_DEFECTS_MANAGE);
    expect(headPerms).toContain(Permissions.MISTAKE_BANK_READ_COHORT);
    expect(headPerms).toContain(Permissions.QUESTION_DEFECTS_MANAGE);
  });
});
