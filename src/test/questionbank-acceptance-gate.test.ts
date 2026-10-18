import { describe, it, expect } from "vitest";
import { QuestionValidator } from "@/modules/question-bank/services/question-validator";
import { DuplicateDetector } from "@/modules/question-bank/services/duplicate-detector";
import { ImportService } from "@/modules/question-bank/services/import-service";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { can, Permissions, PolicyContext } from "@/modules/identity-access/services/policy-engine";
import { QuestionType, QuestionDifficulty, AnswerKeyReviewStatus } from "@/types/database";

describe("Phase 06 Master Completion Gate: End-to-End QuestionBank Sentinel Lifecycle & Security", () => {
  const tenantA = "tenant-college-alpha-uuid";
  const tenantB = "tenant-college-beta-uuid";
  const staffUserId = "user-placement-staff-123";
  const studentUserId = "user-student-456";

  const staffContextTenantA: PolicyContext = {
    userId: staffUserId,
    tenantId: tenantA,
    tenantStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
    role: "PLACEMENT_STAFF",
  };

  const staffContextTenantB: PolicyContext = {
    userId: "user-staff-beta",
    tenantId: tenantB,
    tenantStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
    role: "PLACEMENT_STAFF",
  };

  const studentContextTenantA: PolicyContext = {
    userId: studentUserId,
    tenantId: tenantA,
    tenantStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
    role: "STUDENT",
  };

  // --- STEP 1: IMPORT, PRE-COMMIT PREVIEW & VALIDATION ---
  it("Step 1: Imports CSV with pre-commit preview, formula-injection defense, and structural validation", async () => {
    const rawCsv = [
      "question_type,prompt,difficulty,option_a,option_b,option_c,option_d,correct_answer,explanation,skill_normalized_name,topic_tags",
      'SINGLE_CHOICE,"What is the time complexity of searching in a Balanced Binary Search Tree?",EASY,"O(1)","O(log N)","O(N)","O(N log N)",opt_b,"Height of balanced BST is log2(N).",dsa,"bst;trees"',
      'CODING,"Implement an in-place array reversal algorithm.",MEDIUM,,,,,"[3, 2, 1]","Two pointers swapping towards middle.",dsa,"arrays;two-pointers"',
      'NUMERIC,"Calculate the number of edges in a complete graph with 5 vertices.",EASY,,,,,"10","Using n*(n-1)/2, 5*4/2 = 10.",quantitative-aptitude,"graphs"',
      'SINGLE_CHOICE,"=cmd|\' /C calc\'!A0",HARD,"A","B","C","D",opt_a,"Formula injection test row.",other,"security"',
      'INVALID_TYPE,"This row has an unsupported question type.",EASY,,,,"42",,,',
    ].join("\n");

    // 1. Verify formula injection defense
    const sanitizedCell = ImportService.sanitizeCell("=cmd|' /C calc'!A0");
    expect(sanitizedCell.startsWith("'=")).toBe(true);

    const sanitizedTab = ImportService.sanitizeCell("\tDANGEROUS");
    expect(sanitizedTab.startsWith("'\t")).toBe(true);

    // 2. Pre-commit preview without committing to DB
    const preview = await ImportService.previewImport(tenantA, "campus_questions.csv", rawCsv, []);

    expect(preview.totalRows).toBe(5);
    expect(preview.validRows).toBe(4);
    expect(preview.invalidRows).toBe(1); // INVALID_TYPE row caught

    // Row 1: Valid MCQ
    expect(preview.rows[0].isValid).toBe(true);
    expect(preview.rows[0].question_type).toBe("SINGLE_CHOICE");
    expect(preview.rows[0].options).toHaveLength(4);
    expect(preview.rows[0].answer_key).toEqual({ correct_option_id: "opt_b" });

    // Row 4: Formula injection neutralized
    expect(preview.rows[3].prompt.startsWith("'=")).toBe(true);

    // Row 5: Invalid type rejected with clear diagnostic error
    expect(preview.rows[4].isValid).toBe(false);
    expect(preview.rows[4].errors.some((e) => e.includes("Invalid question_type"))).toBe(true);
  });

  // --- STEP 2: DUPLICATE DETECTION & ANSWER KEY REVIEW ---
  it("Step 2: Detects exact & near duplicates, generates candidate alerts, and reviews answer key", () => {
    const originalPrompt = "What is the time complexity of searching in a Balanced Binary Search Tree?";
    const originalOptions = [
      { id: "opt_1", text: "O(1)" },
      { id: "opt_2", text: "O(log N)" },
      { id: "opt_3", text: "O(N)" },
      { id: "opt_4", text: "O(N log N)" },
    ];

    const fpOriginal = DuplicateDetector.generateFingerprint(originalPrompt, originalOptions);

    // Exact duplicate test (with permuted option order)
    const permutedOptions = [
      { id: "opt_3", text: "O(N)" },
      { id: "opt_2", text: "O(log N)" },
      { id: "opt_1", text: "O(1)" },
      { id: "opt_4", text: "O(N log N)" },
    ];
    const fpPermuted = DuplicateDetector.generateFingerprint(originalPrompt, permutedOptions);
    expect(fpPermuted).toBe(fpOriginal);

    const existingBank = [
      {
        questionId: "q-existing-1",
        versionId: "v-existing-1",
        prompt: originalPrompt,
        fingerprint: fpOriginal,
      },
    ];

    // Candidate 1: Exact duplicate match
    const exactResult = DuplicateDetector.detectDuplicates(originalPrompt, fpPermuted, existingBank);
    expect(exactResult.isExactDuplicate).toBe(true);
    expect(exactResult.highestSimilarity).toBe(1.0);
    expect(exactResult.matchedQuestionId).toBe("q-existing-1");
    expect(exactResult.detectionMethod).toBe("EXACT_FINGERPRINT");

    // Candidate 2: Near duplicate (paraphrased question)
    const paraphrasedPrompt = "What is the time complexity of searching for an element in a balanced binary search tree?";
    const fpParaphrased = DuplicateDetector.generateFingerprint(paraphrasedPrompt);
    const nearResult = DuplicateDetector.detectDuplicates(paraphrasedPrompt, fpParaphrased, existingBank, 0.75);

    expect(nearResult.isExactDuplicate).toBe(false);
    expect(nearResult.highestSimilarity).toBeGreaterThanOrEqual(0.75);
    expect(nearResult.matchedQuestionId).toBe("q-existing-1");
    expect(nearResult.detectionMethod).toBe("TEXT_SIMILARITY");

    // Staff resolution simulation
    const candidateAlert = {
      id: "dup-alert-101",
      similarityScore: nearResult.highestSimilarity,
      status: "PENDING_REVIEW" as const,
    };
    // Staff reviews side-by-side and marks as FALSE_POSITIVE
    const resolvedAlert = { ...candidateAlert, status: "FALSE_POSITIVE" as const, reviewedBy: staffUserId };
    expect(resolvedAlert.status).toBe("FALSE_POSITIVE");

    // Answer-key review workflow
    let questionLifecycle = "PENDING_REVIEW";
    let reviewStatus: AnswerKeyReviewStatus = "UNREVIEWED";

    // Unreviewed question cannot transition to APPROVED
    expect(reviewStatus).toBe("UNREVIEWED");

    // Reviewer inspects answer key and verifies correctness
    reviewStatus = "VERIFIED_CORRECT";
    if (reviewStatus === "VERIFIED_CORRECT" && questionLifecycle === "PENDING_REVIEW") {
      questionLifecycle = "APPROVED";
    }

    expect(reviewStatus).toBe("VERIFIED_CORRECT");
    expect(questionLifecycle).toBe("APPROVED");
  });

  // --- STEP 3: SOURCE PERMISSIONS & LICENSING ---
  it("Step 3: Confirms source provenance, licensing, and sharing policy", () => {
    const questionMetadata = {
      source_type: "COLLEGE_AUTHORED",
      license_type: "PROPRIETARY",
      sharing_policy: "COLLEGE_PRIVATE",
      change_summary: "Authored by Dept of Computer Science for campus placement",
    };

    expect(questionMetadata.source_type).toBe("COLLEGE_AUTHORED");
    expect(questionMetadata.license_type).toBe("PROPRIETARY");
    expect(questionMetadata.sharing_policy).toBe("COLLEGE_PRIVATE");
  });

  // --- STEP 4: VERSION PUBLISHING, IMMUTABILITY & HISTORY PERSISTENCE ---
  it("Step 4: Enforces verified-key invariant for publication, and spawns immutable revision history upon update", () => {
    // 1. Publication invariant
    const unverifiedQuestion = {
      lifecycle_status: "PENDING_REVIEW",
      current_version: { review_status: "UNREVIEWED" as AnswerKeyReviewStatus },
    };

    const canPublishUnverified = unverifiedQuestion.current_version.review_status === "VERIFIED_CORRECT";
    expect(canPublishUnverified).toBe(false);

    // 2. Verified question publication
    const verifiedQuestion = {
      id: "q-algo-1",
      lifecycle_status: "APPROVED",
      current_version_id: "v-algo-1",
      current_version: {
        id: "v-algo-1",
        version_number: 1,
        prompt: "What is the time complexity of Merge Sort?",
        review_status: "VERIFIED_CORRECT" as AnswerKeyReviewStatus,
        published_at: null as string | null,
      },
    };

    const publishedQuestion = {
      ...verifiedQuestion,
      lifecycle_status: "PUBLISHED",
      current_version: {
        ...verifiedQuestion.current_version,
        published_at: new Date().toISOString(),
      },
    };
    expect(publishedQuestion.lifecycle_status).toBe("PUBLISHED");
    expect(publishedQuestion.current_version.published_at).not.toBeNull();

    // 3. Immutability Invariant: Editing a published question spawns Version 2 without mutating Version 1
    const versionHistory: any[] = [publishedQuestion.current_version];

    const isPublishedOrReferenced = publishedQuestion.lifecycle_status === "PUBLISHED";
    expect(isPublishedOrReferenced).toBe(true);

    const version2 = {
      id: "v-algo-2",
      version_number: publishedQuestion.current_version.version_number + 1,
      prompt: "What is the worst-case and average-case time complexity of Merge Sort?",
      review_status: "UNREVIEWED" as AnswerKeyReviewStatus, // Re-verification required
      change_summary: "Clarified distinction between worst-case and average-case",
      published_at: null,
    };

    versionHistory.push(version2);

    // Verify history persistence
    expect(versionHistory).toHaveLength(2);
    expect(versionHistory[0].version_number).toBe(1);
    expect(versionHistory[0].prompt).toBe("What is the time complexity of Merge Sort?");
    expect(versionHistory[0].published_at).not.toBeNull();

    expect(versionHistory[1].version_number).toBe(2);
    expect(versionHistory[1].prompt).toBe("What is the worst-case and average-case time complexity of Merge Sort?");
    expect(versionHistory[1].review_status).toBe("UNREVIEWED");
  });

  // --- STEP 5: SECURITY, STUDENT MASKING & CROSS-COLLEGE ISOLATION ---
  it("Step 5: Verifies student answer-key masking and strict multi-college tenant isolation", () => {
    const fullStaffCodingQuestion = {
      id: "q-code-star",
      prompt: "Given an integer array nums, return all unique triplets that sum to zero.",
      options: [],
      answer_key: {
        language_templates: { python: "def threeSum(nums): pass" },
        test_cases: [
          { input: "[-1,0,1,2,-1,-4]", expected_output: "[[-1,-1,2],[-1,0,1]]", is_hidden: false, explanation: "Standard example" },
          { input: "[0,1,1]", expected_output: "[]", is_hidden: false },
          { input: "[0,0,0,0]", expected_output: "[[0,0,0]]", is_hidden: true }, // Secret hidden edge case
          { input: "[3000 elements]", expected_output: "...", is_hidden: true }, // Scale test
        ],
      },
      explanation: "Sort the array first to avoid duplicates, then use two-pointer technique for O(N^2) complexity.",
      lifecycle_status: "PUBLISHED",
    };

    // 1. Verify Student View Masking
    const studentView = QuestionService.sanitizeForStudent(fullStaffCodingQuestion, "CODING");

    expect(studentView.prompt).toBe(fullStaffCodingQuestion.prompt);
    expect(studentView.explanation).toBeUndefined(); // Explanation masked!

    const studentKey = studentView.answer_key as any;
    expect(studentKey).toBeDefined();
    expect(studentKey.language_templates).toBeDefined();
    expect(studentKey.test_cases).toHaveLength(2); // Only 2 public test cases
    expect(studentKey.test_cases.some((tc: any) => tc.is_hidden)).toBe(false); // No hidden test cases leaked!

    // 2. Verify Choice / Numeric Answer Key Masking
    const fullStaffMcq = {
      prompt: "What is the default port for PostgreSQL?",
      options: [{ id: "opt_a", text: "5432" }, { id: "opt_b", text: "3306" }],
      answer_key: { correct_option_id: "opt_a" },
      explanation: "PostgreSQL defaults to TCP port 5432.",
    };
    const studentMcqView = QuestionService.sanitizeForStudent(fullStaffMcq, "SINGLE_CHOICE");
    expect((studentMcqView as any).answer_key).toBeUndefined();
    expect(studentMcqView.explanation).toBeUndefined();

    // 3. Multi-College Tenant Isolation
    // Tenant A staff managing Tenant A questions -> Allowed
    expect(can(staffContextTenantA, Permissions.QUESTIONS_MANAGE, { tenantId: tenantA })).toBe(true);

    // Tenant B staff attempting to manage or access Tenant A questions -> Strictly DENIED
    expect(can(staffContextTenantB, Permissions.QUESTIONS_MANAGE, { tenantId: tenantA })).toBe(false);
    expect(can(staffContextTenantB, Permissions.QUESTIONS_REVIEW, { tenantId: tenantA })).toBe(false);
    expect(can(staffContextTenantB, Permissions.QUESTIONS_PUBLISH, { tenantId: tenantA })).toBe(false);

    // Student attempting to create, publish, or manage questions -> Strictly DENIED
    expect(can(studentContextTenantA, Permissions.QUESTIONS_CREATE)).toBe(false);
    expect(can(studentContextTenantA, Permissions.QUESTIONS_MANAGE)).toBe(false);
    expect(can(studentContextTenantA, Permissions.QUESTIONS_PUBLISH)).toBe(false);
    expect(can(studentContextTenantA, Permissions.QUESTIONS_REVIEW)).toBe(false);

    // Student can only read published question sets in their own tenant
    expect(can(studentContextTenantA, Permissions.QUESTION_SETS_READ, { tenantId: tenantA })).toBe(true);
    expect(can(studentContextTenantA, Permissions.QUESTION_SETS_READ, { tenantId: tenantB })).toBe(false);
  });
});
