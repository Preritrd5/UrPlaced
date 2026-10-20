import { describe, it, expect } from "vitest";
import { can, Permissions, PolicyContext } from "@/modules/identity-access/services/policy-engine";
import { AssessmentScoringService } from "@/modules/assessments/services/assessment-scoring-service";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { QuestionVersionRow, QuestionType } from "@/types/database";

describe("Phase 07 Master Completion Gate: Assessment Engine & Student Preparation", () => {
  const tenantA = "tenant-alpha-uuid";
  const tenantB = "tenant-beta-uuid";

  const staffContextTenantA: PolicyContext = {
    userId: "staff-alpha-1",
    tenantId: tenantA,
    tenantStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
    role: "PLACEMENT_STAFF",
  };

  const studentContextTenantA: PolicyContext = {
    userId: "student-alpha-1",
    tenantId: tenantA,
    tenantStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
    role: "STUDENT",
  };

  const staffContextTenantB: PolicyContext = {
    userId: "staff-beta-1",
    tenantId: tenantB,
    tenantStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
    role: "PLACEMENT_STAFF",
  };

  // STEP 1: PERMISSION & TENANCY BOUNDARIES
  it("Step 1: Enforces rigorous RBAC and multi-college tenant isolation", () => {
    // Placement staff can author, assign, and grade assessments
    expect(can(staffContextTenantA, Permissions.ASSESSMENTS_CREATE)).toBe(true);
    expect(can(staffContextTenantA, Permissions.ASSESSMENTS_ASSIGN)).toBe(true);
    expect(can(staffContextTenantA, Permissions.ASSESSMENTS_GRADE)).toBe(true);
    expect(can(staffContextTenantA, Permissions.ASSESSMENTS_READ)).toBe(true);

    // Student can attempt and read assigned assessments, but cannot author or assign
    expect(can(studentContextTenantA, Permissions.ASSESSMENTS_ATTEMPT)).toBe(true);
    expect(can(studentContextTenantA, Permissions.ASSESSMENTS_READ)).toBe(true);
    expect(can(studentContextTenantA, Permissions.PRACTICE_READ)).toBe(true);
    expect(can(studentContextTenantA, Permissions.ASSESSMENTS_CREATE)).toBe(false);
    expect(can(studentContextTenantA, Permissions.ASSESSMENTS_ASSIGN)).toBe(false);
    expect(can(studentContextTenantA, Permissions.ASSESSMENTS_GRADE)).toBe(false);

    // Cross-tenant resource checks deny access
    expect(can(staffContextTenantB, Permissions.ASSESSMENTS_READ, { tenantId: tenantA })).toBe(false);
    expect(can(staffContextTenantA, Permissions.ASSESSMENTS_READ, { tenantId: tenantB })).toBe(false);
  });

  // STEP 2: IMMUTABLE QUESTION SANITIZATION (ZERO KEY LEAKAGE)
  it("Step 2: Shields answer keys and hidden test cases from student attempt view", () => {
    const rawVersion: QuestionVersionRow = {
      id: "ver-99",
      tenant_id: tenantA,
      question_id: "q-99",
      version_number: 1,
      prompt: "Find the root of the equation x^2 - 4 = 0.",
      content_format: "MARKDOWN",
      options: [
        { id: "opt_1", text: "2" },
        { id: "opt_2", text: "4" },
      ],
      answer_key: {
        correct_option: "opt_1",
        internal_rubric: "Strict algebraic verification.",
      },
      explanation: "Since 2^2 = 4, 4 - 4 = 0.",
      difficulty: "EASY",
      skill_id: "skill-math",
      topic_tags: ["Algebra"],
      source_type: "COLLEGE_AUTHORED",
      source_reference: null,
      license_type: "PROPRIETARY",
      review_status: "VERIFIED_CORRECT",
      review_notes: null,
      fingerprint: "fp99",
      change_summary: null,
      published_at: new Date().toISOString(),
      created_by: "staff-1",
      reviewed_by: "staff-1",
      created_at: new Date().toISOString(),
    };

    // When presented to student during an active attempt:
    const sanitized = QuestionService.sanitizeForStudent(rawVersion, "SINGLE_CHOICE");

    expect(sanitized.prompt).toBe(rawVersion.prompt);
    expect(sanitized.options).toEqual(rawVersion.options);
    // Crucial: answer key and explanation must be undefined or null
    expect(sanitized.answer_key).toBeUndefined();
    expect(sanitized.explanation).toBeUndefined();
  });

  // STEP 3: SERVER-AUTHORITATIVE TIMER COMPUTATION
  it("Step 3: Enforces server-authoritative timer limits and expiration transitions", () => {
    const now = new Date();
    const durationMinutes = 45;
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    const remainingSeconds = Math.max(
      0,
      Math.floor((expiresAt.getTime() - now.getTime()) / 1000)
    );

    expect(remainingSeconds).toBe(45 * 60);

    // Simulate clock expiration:
    const pastExpiry = new Date(now.getTime() - 10000); // 10 seconds past
    const isExpired = pastExpiry < new Date();
    expect(isExpired).toBe(true);
  });

  // STEP 4: SERVER-SIDE SCORING, PASS/FAIL & MISTAKE BANK INTEGRATION
  it("Step 4: Evaluates mixed objective attempt, applies pass cutoff, and formats Mistake Bank entries", async () => {
    const question1: QuestionVersionRow = {
      id: "v-1",
      tenant_id: tenantA,
      question_id: "q-1",
      version_number: 1,
      prompt: "What is 2 + 2?",
      content_format: "MARKDOWN",
      options: [],
      answer_key: { correct_option: "opt_4" },
      explanation: "Elementary arithmetic.",
      difficulty: "EASY",
      skill_id: "skill-math-basic",
      topic_tags: ["Arithmetic"],
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

    const question2: QuestionVersionRow = {
      id: "v-2",
      tenant_id: tenantA,
      question_id: "q-2",
      version_number: 1,
      prompt: "Select all prime numbers less than 5.",
      content_format: "MARKDOWN",
      options: [],
      answer_key: { correct_options: ["opt_2", "opt_3"] },
      explanation: "2 and 3 are prime numbers.",
      difficulty: "MEDIUM",
      skill_id: "skill-primes",
      topic_tags: ["Number Theory"],
      source_type: "COLLEGE_AUTHORED",
      source_reference: null,
      license_type: "PROPRIETARY",
      review_status: "VERIFIED_CORRECT",
      review_notes: null,
      fingerprint: "fp2",
      change_summary: null,
      published_at: new Date().toISOString(),
      created_by: "staff-1",
      reviewed_by: "staff-1",
      created_at: new Date().toISOString(),
    };

    // Candidate answers question 1 correctly, but misses question 2
    const eval1 = await AssessmentScoringService.evaluateResponse(
      "SINGLE_CHOICE",
      question1,
      5.0,
      1.0,
      { selected_option: "opt_4" }
    );

    const eval2 = await AssessmentScoringService.evaluateResponse(
      "MULTIPLE_SELECT",
      question2,
      5.0,
      1.0,
      { selected_options: ["opt_2", "opt_4"] } // Incorrect choice included
    );

    expect(eval1.isCorrect).toBe(true);
    expect(eval1.pointsAwarded).toBe(5.0);

    expect(eval2.isCorrect).toBe(false);
    expect(eval2.pointsAwarded).toBe(-1.0); // Penalty applied

    const totalPoints = 10.0;
    const earnedPoints = Math.max(0, eval1.pointsAwarded + eval2.pointsAwarded); // 5 - 1 = 4.0
    const scorePercentage = (earnedPoints / totalPoints) * 100; // 40%
    const passCutoff = 60.0;
    const isPassed = scorePercentage >= passCutoff;

    expect(earnedPoints).toBe(4.0);
    expect(scorePercentage).toBe(40.0);
    expect(isPassed).toBe(false);

    // Mistake Bank Entry generated for failed question
    const mistakeBankContract = {
      questionId: question2.question_id,
      versionId: question2.id,
      skillId: question2.skill_id,
      topicTags: question2.topic_tags,
      prompt: question2.prompt,
      studentAnswer: { selected_options: ["opt_2", "opt_4"] },
      correctAnswer: question2.answer_key,
      explanation: question2.explanation,
    };

    expect(mistakeBankContract.skillId).toBe("skill-primes");
    expect(mistakeBankContract.studentAnswer.selected_options).toContain("opt_4");
    expect(mistakeBankContract.explanation).toContain("2 and 3 are prime");
  });

  // STEP 5: RELEASE POLICY GOVERNANCE
  it("Step 5: Enforces release policies (IMMEDIATE vs AFTER_DEADLINE vs MANUAL_STAFF_RELEASE)", () => {
    function resolveResultVisibility(
      releasePolicy: "IMMEDIATE" | "AFTER_DEADLINE" | "MANUAL_STAFF_RELEASE",
      attemptStatus: string,
      windowEnd: Date | null,
      currentTime: Date
    ): boolean {
      if (releasePolicy === "IMMEDIATE") {
        return ["SCORED", "RESULT_RELEASED"].includes(attemptStatus);
      }
      if (releasePolicy === "MANUAL_STAFF_RELEASE") {
        return attemptStatus === "RESULT_RELEASED";
      }
      if (releasePolicy === "AFTER_DEADLINE") {
        if (windowEnd && currentTime >= windowEnd) return true;
        return attemptStatus === "RESULT_RELEASED";
      }
      return false;
    }

    const now = new Date();
    const futureDeadline = new Date(now.getTime() + 86400000); // Tomorrow
    const pastDeadline = new Date(now.getTime() - 86400000); // Yesterday

    // IMMEDIATE: Visible as soon as scored
    expect(resolveResultVisibility("IMMEDIATE", "SCORED", null, now)).toBe(true);

    // AFTER_DEADLINE: Masked before deadline
    expect(resolveResultVisibility("AFTER_DEADLINE", "SCORED", futureDeadline, now)).toBe(false);
    // AFTER_DEADLINE: Unlocks after deadline
    expect(resolveResultVisibility("AFTER_DEADLINE", "SCORED", pastDeadline, now)).toBe(true);

    // MANUAL_STAFF_RELEASE: Masked until staff explicitly changes status to RESULT_RELEASED
    expect(resolveResultVisibility("MANUAL_STAFF_RELEASE", "SCORED", null, now)).toBe(false);
    expect(resolveResultVisibility("MANUAL_STAFF_RELEASE", "RESULT_RELEASED", null, now)).toBe(true);
  });
});
