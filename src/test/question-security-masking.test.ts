import { describe, it, expect } from "vitest";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { can, Permissions } from "@/modules/identity-access/services/policy-engine";

describe("Question Security & Masking", () => {
  describe("Student Answer-Key Sanitization", () => {
    it("completely removes answer_key and explanation from MCQ for students", () => {
      const staffVersion = {
        id: "v_123",
        prompt: "What is the primary key in a relational database?",
        options: [
          { id: "opt_1", text: "Unique record identifier" },
          { id: "opt_2", text: "Foreign key pointer" },
        ],
        answer_key: { correct_option_id: "opt_1" },
        explanation: "A primary key uniquely identifies each record in a database table.",
      };

      const sanitized = QuestionService.sanitizeForStudent(staffVersion, "SINGLE_CHOICE");

      expect(sanitized.prompt).toBe(staffVersion.prompt);
      expect((sanitized as any).answer_key).toBeUndefined();
      expect(sanitized.explanation).toBeUndefined();
    });

    it("strips hidden test cases from CODING problems while keeping public test cases", () => {
      const staffCodingVersion = {
        id: "v_code",
        prompt: "Implement twoSum algorithm.",
        answer_key: {
          language_templates: { python: "def twoSum(nums, target): pass" },
          test_cases: [
            { input: "[2, 7, 11, 15], 9", expected_output: "[0, 1]", is_hidden: false, explanation: "Standard example" },
            { input: "[3, 2, 4], 6", expected_output: "[1, 2]", is_hidden: false },
            { input: "[-1, -2, -3, -4], -6", expected_output: "[1, 3]", is_hidden: true }, // hidden edge case
            { input: "[1000000 elements]", expected_output: "...", is_hidden: true }, // hidden scale test
          ],
        },
        explanation: "Use a hash map to achieve O(N) linear time complexity.",
      };

      const sanitized = QuestionService.sanitizeForStudent(staffCodingVersion, "CODING");

      expect(sanitized.explanation).toBeUndefined();
      const studentKey = sanitized.answer_key as any;
      expect(studentKey).toBeDefined();
      expect(studentKey.language_templates).toBeDefined();
      expect(studentKey.test_cases).toHaveLength(2); // Only 2 public test cases
      expect(studentKey.test_cases.every((tc: any) => !tc.is_hidden)).toBe(true);
    });
  });

  describe("Policy Engine Permissions for QuestionBank Sentinel", () => {
    const headPolicy = {
      userId: "user_head",
      tenantId: "tenant_alpha",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
      role: "PLACEMENT_HEAD" as const,
    };

    const staffPolicy = {
      userId: "user_staff",
      tenantId: "tenant_alpha",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
      role: "PLACEMENT_STAFF" as const,
    };

    const studentPolicy = {
      userId: "user_student",
      tenantId: "tenant_alpha",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
      role: "STUDENT" as const,
    };

    it("grants full question lifecycle access to Placement Head and Staff", () => {
      expect(can(headPolicy, Permissions.QUESTIONS_CREATE)).toBe(true);
      expect(can(headPolicy, Permissions.QUESTIONS_MANAGE)).toBe(true);
      expect(can(headPolicy, Permissions.QUESTIONS_REVIEW)).toBe(true);
      expect(can(headPolicy, Permissions.QUESTIONS_PUBLISH)).toBe(true);
      expect(can(headPolicy, Permissions.QUESTIONS_IMPORT)).toBe(true);
      expect(can(headPolicy, Permissions.QUESTION_SETS_MANAGE)).toBe(true);

      expect(can(staffPolicy, Permissions.QUESTIONS_CREATE)).toBe(true);
      expect(can(staffPolicy, Permissions.QUESTIONS_REVIEW)).toBe(true);
      expect(can(staffPolicy, Permissions.QUESTIONS_PUBLISH)).toBe(true);
      expect(can(staffPolicy, Permissions.QUESTIONS_IMPORT)).toBe(true);
    });

    it("strictly denies question management and publication to Student role", () => {
      expect(can(studentPolicy, Permissions.QUESTIONS_CREATE)).toBe(false);
      expect(can(studentPolicy, Permissions.QUESTIONS_MANAGE)).toBe(false);
      expect(can(studentPolicy, Permissions.QUESTIONS_REVIEW)).toBe(false);
      expect(can(studentPolicy, Permissions.QUESTIONS_PUBLISH)).toBe(false);
      expect(can(studentPolicy, Permissions.QUESTIONS_IMPORT)).toBe(false);
      expect(can(studentPolicy, Permissions.QUESTION_SETS_MANAGE)).toBe(false);

      // Student can read published question sets
      expect(can(studentPolicy, Permissions.QUESTION_SETS_READ)).toBe(true);
    });
  });
});
