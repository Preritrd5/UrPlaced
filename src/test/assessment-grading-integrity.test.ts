/**
 * ==============================================================================
 * UrPlaced: Assessment Grading Integrity & Answer Validation Test Suite (P0)
 * ==============================================================================
 * Comprehensive verification of single-choice option mapping, Question Bank Sentinel
 * answer-key schema compatibility, numeric currency stripping, semantic option
 * resolution, and Mistake Bank historical reconciliation.
 */

import { describe, it, expect, vi } from "vitest";
import {
  AssessmentScoringService,
  normalizeAnswerToken,
  resolveOptionTokenToId,
} from "@/modules/assessments/services/assessment-scoring-service";
import { QuestionVersionRow } from "@/types/database";

describe("P0: Assessment Grading Integrity & Correct Answer Validation", () => {
  const screenshotOptions = [
    { id: "opt_a", text: "₹2,550" },
    { id: "opt_b", text: "₹2,400" },
    { id: "opt_c", text: "₹2,700" },
    { id: "opt_d", text: "₹2,850" },
  ];

  const baseScreenshotVersion: QuestionVersionRow = {
    id: "ver-profit-loss-001",
    tenant_id: "tenant-demo",
    question_id: "q-profit-loss-001",
    version_number: 1,
    prompt:
      "An item marked at ₹3,600 is sold after a 15% discount. If the profit is 20%, what is the cost price?",
    content_format: "MARKDOWN",
    options: screenshotOptions,
    answer_key: {
      correct_option_id: "opt_a", // Stored canonical schema from Question Bank Sentinel
    },
    explanation:
      "Selling price = ₹3,600 × 0.85 = ₹3,060. Since SP = 1.20 × CP, CP = ₹3,060 / 1.2 = ₹2,550.",
    difficulty: "MEDIUM",
    skill_id: "skill-quant-arithmetic",
    topic_tags: ["Profit and Loss", "Percentages"],
    source_type: "COLLEGE_AUTHORED",
    source_reference: null,
    license_type: "PROPRIETARY",
    review_status: "VERIFIED_CORRECT",
    review_notes: null,
    fingerprint: "fp-profit-loss-3600",
    change_summary: null,
    published_at: new Date().toISOString(),
    created_by: "staff-1",
    reviewed_by: "staff-1",
    created_at: new Date().toISOString(),
  };

  describe("Phase 01: Exact Screenshot Question Resolution", () => {
    it("marks student answer opt_a as CORRECT (1.0 pt) when answer_key has correct_option_id: 'opt_a'", async () => {
      // Student selected opt_a (₹2,550)
      const studentPayload = { selected_option: "opt_a" };

      const result = await AssessmentScoringService.evaluateResponse(
        "SINGLE_CHOICE",
        baseScreenshotVersion,
        1.0, // points
        0.0, // negative points
        studentPayload
      );

      expect(result.isCorrect).toBe(true);
      expect(result.pointsAwarded).toBe(1.0);
      expect(result.scoringStatus).toBe("AUTOMATICALLY_SCORED");
    });

    it("marks student answer opt_b as INCORRECT (0 pts) for correct_option_id: 'opt_a'", async () => {
      const studentPayload = { selected_option: "opt_b" };

      const result = await AssessmentScoringService.evaluateResponse(
        "SINGLE_CHOICE",
        baseScreenshotVersion,
        1.0,
        0.25, // negative points
        studentPayload
      );

      expect(result.isCorrect).toBe(false);
      expect(result.pointsAwarded).toBe(-0.25);
      expect(result.scoringStatus).toBe("AUTOMATICALLY_SCORED");
    });
  });

  describe("Phase 02: Resilient Schema & Semantic Token Resolution", () => {
    it("resolves option tokens using resolveOptionTokenToId", () => {
      // Direct ID
      expect(resolveOptionTokenToId("opt_a", screenshotOptions)).toBe("opt_a");
      expect(resolveOptionTokenToId("OPT_A", screenshotOptions)).toBe("opt_a");

      // Option Text with currency
      expect(resolveOptionTokenToId("₹2,550", screenshotOptions)).toBe("opt_a");
      expect(resolveOptionTokenToId("2550", screenshotOptions)).toBe("opt_a");

      // Option Letter Index ('A' -> opt_a, 'B' -> opt_b)
      expect(resolveOptionTokenToId("A", screenshotOptions)).toBe("opt_a");
      expect(resolveOptionTokenToId("a", screenshotOptions)).toBe("opt_a");
      expect(resolveOptionTokenToId("B", screenshotOptions)).toBe("opt_b");

      // 0-based index ('0' -> opt_a, '1' -> opt_b)
      expect(resolveOptionTokenToId("0", screenshotOptions)).toBe("opt_a");
      expect(resolveOptionTokenToId("1", screenshotOptions)).toBe("opt_b");
    });

    it("evaluates correctly across all historical answer_key schema variations", async () => {
      const testSchemas = [
        { correct_option_id: "opt_a" },
        { correct_option: "opt_a" },
        { correctOptionId: "opt_a" },
        { correctOption: "opt_a" },
        { correct_answer: "opt_a" },
        { correct_options: ["opt_a"] },
        { correct_option_ids: ["opt_a"] },
        { correct_option: "₹2,550" }, // Plain text stored in answer key
      ];

      for (const ak of testSchemas) {
        const ver: QuestionVersionRow = {
          ...baseScreenshotVersion,
          answer_key: ak,
        };

        const res = await AssessmentScoringService.evaluateResponse(
          "SINGLE_CHOICE",
          ver,
          1.0,
          0.0,
          { selected_option: "opt_a" }
        );

        expect(res.isCorrect, `Failed for schema: ${JSON.stringify(ak)}`).toBe(true);
        expect(res.pointsAwarded).toBe(1.0);
      }
    });

    it("evaluates correctly across all student response payload variations", async () => {
      const studentPayloads = [
        { selected_option: "opt_a" },
        { selected_option_id: "opt_a" },
        { selectedOption: "opt_a" },
        { selectedOptionId: "opt_a" },
        { option_id: "opt_a" },
        { selected_options: ["opt_a"] },
        { selected_option: "₹2,550" }, // Student answered with option text
        { selected_option: "2550" }, // Student answered with normalized text
        { selected_option: "A" }, // Student answered with letter 'A'
      ];

      for (const payload of studentPayloads) {
        const res = await AssessmentScoringService.evaluateResponse(
          "SINGLE_CHOICE",
          baseScreenshotVersion,
          1.0,
          0.0,
          payload
        );

        expect(res.isCorrect, `Failed for payload: ${JSON.stringify(payload)}`).toBe(true);
        expect(res.pointsAwarded).toBe(1.0);
      }
    });
  });

  describe("Phase 03: MULTIPLE_SELECT Evaluation Integrity", () => {
    const multiVersion: QuestionVersionRow = {
      ...baseScreenshotVersion,
      options: [
        { id: "opt_1", text: "React" },
        { id: "opt_2", text: "Vue" },
        { id: "opt_3", text: "Angular" },
        { id: "opt_4", text: "Django" },
      ],
      answer_key: {
        correct_option_ids: ["opt_1", "opt_2"], // Frontend frameworks
      },
    };

    it("awards full points when student selects exact correct option set (in any order)", async () => {
      const res = await AssessmentScoringService.evaluateResponse(
        "MULTIPLE_SELECT",
        multiVersion,
        2.0,
        0.5,
        { selected_options: ["opt_2", "opt_1"] } // Reverse order
      );

      expect(res.isCorrect).toBe(true);
      expect(res.pointsAwarded).toBe(2.0);
    });

    it("marks partial/incorrect selection as incorrect and applies negative marks", async () => {
      const resPartial = await AssessmentScoringService.evaluateResponse(
        "MULTIPLE_SELECT",
        multiVersion,
        2.0,
        0.5,
        { selected_options: ["opt_1"] } // Missing opt_2
      );
      expect(resPartial.isCorrect).toBe(false);
      expect(resPartial.pointsAwarded).toBe(-0.5);

      const resExtra = await AssessmentScoringService.evaluateResponse(
        "MULTIPLE_SELECT",
        multiVersion,
        2.0,
        0.5,
        { selected_options: ["opt_1", "opt_2", "opt_4"] } // opt_4 is backend
      );
      expect(resExtra.isCorrect).toBe(false);
      expect(resExtra.pointsAwarded).toBe(-0.5);
    });
  });

  describe("Phase 04: NUMERIC Evaluation with Currency and Comma Formatting", () => {
    const numericVersion: QuestionVersionRow = {
      ...baseScreenshotVersion,
      answer_key: {
        value: 2550,
        tolerance: 5,
      },
    };

    it("accepts currency symbols, commas, and numeric numbers within tolerance", async () => {
      const validAnswers = [
        { numeric_value: 2550 },
        { numeric_value: "2550" },
        { numeric_value: "2,550" },
        { numeric_value: "₹2,550" },
        { numeric_value: "2554" }, // Within ±5 tolerance
        { numeric_value: "2546" }, // Within ±5 tolerance
      ];

      for (const payload of validAnswers) {
        const res = await AssessmentScoringService.evaluateResponse(
          "NUMERIC",
          numericVersion,
          3.0,
          0.0,
          payload
        );
        expect(res.isCorrect, `Failed for numeric payload: ${JSON.stringify(payload)}`).toBe(true);
        expect(res.pointsAwarded).toBe(3.0);
      }
    });

    it("rejects numbers outside tolerance", async () => {
      const res = await AssessmentScoringService.evaluateResponse(
        "NUMERIC",
        numericVersion,
        3.0,
        1.0,
        { numeric_value: "2560" } // > tolerance 5
      );
      expect(res.isCorrect).toBe(false);
      expect(res.pointsAwarded).toBe(-1.0);
    });
  });

  describe("Phase 05: TRUE_FALSE Evaluation Integrity (via SINGLE_CHOICE)", () => {
    const tfVersion: QuestionVersionRow = {
      ...baseScreenshotVersion,
      answer_key: {
        correct_option: "true",
      },
    };

    it("normalizes boolean and string truthy representations", async () => {
      for (const val of [true, "true", "True", "TRUE", "yes", "1", "t"]) {
        const res = await AssessmentScoringService.evaluateResponse(
          "SINGLE_CHOICE",
          tfVersion,
          1.0,
          0.0,
          { selected_option: val }
        );
        expect(res.isCorrect, `Failed for truthy value: ${val}`).toBe(true);
      }
    });

    it("marks opposing falsy values as incorrect", async () => {
      const res = await AssessmentScoringService.evaluateResponse(
        "SINGLE_CHOICE",
        tfVersion,
        1.0,
        0.0,
        { selected_option: false }
      );
      expect(res.isCorrect).toBe(false);
    });
  });

  describe("Phase 06: normalizeAnswerToken Sanity", () => {
    it("handles whitespace, currency symbols, and casing", () => {
      expect(normalizeAnswerToken("  ₹ 2,550  ")).toBe("2550");
      expect(normalizeAnswerToken("$ 1,200.50")).toBe("1200.50");
      expect(normalizeAnswerToken("OPT_A")).toBe("opt_a");
      expect(normalizeAnswerToken(null)).toBe("");
      expect(normalizeAnswerToken(undefined)).toBe("");
    });
  });
});
