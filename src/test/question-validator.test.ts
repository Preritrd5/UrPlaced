import { describe, it, expect } from "vitest";
import { QuestionValidator } from "@/modules/question-bank/services/question-validator";

describe("QuestionValidator", () => {
  describe("SINGLE_CHOICE (MCQ)", () => {
    it("validates a properly formatted single-choice question", () => {
      const res = QuestionValidator.validate({
        question_type: "SINGLE_CHOICE",
        prompt: "What is the time complexity of binary search in a sorted array?",
        difficulty: "EASY",
        options: [
          { id: "opt_1", text: "O(1)" },
          { id: "opt_2", text: "O(log n)" },
          { id: "opt_3", text: "O(n)" },
          { id: "opt_4", text: "O(n log n)" },
        ],
        answer_key: { correct_option_id: "opt_2" },
        explanation: "Binary search cuts the search space in half at each iteration.",
      });

      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("rejects an MCQ with fewer than 2 options", () => {
      const res = QuestionValidator.validate({
        question_type: "SINGLE_CHOICE",
        prompt: "Is binary search efficient?",
        options: [{ id: "opt_1", text: "Yes" }],
        answer_key: { correct_option_id: "opt_1" },
      });

      expect(res.isValid).toBe(false);
      expect(res.errors).toContain("Single-choice question must have at least 2 options.");
    });

    it("rejects an answer key with non-existent option ID", () => {
      const res = QuestionValidator.validate({
        question_type: "SINGLE_CHOICE",
        prompt: "Which protocol operates at the Transport layer of OSI?",
        options: [
          { id: "opt_1", text: "TCP" },
          { id: "opt_2", text: "IP" },
        ],
        answer_key: { correct_option_id: "opt_999" },
      });

      expect(res.isValid).toBe(false);
      expect(res.errors).toContain("Answer key references non-existent option ID: 'opt_999'.");
    });
  });

  describe("MULTIPLE_SELECT", () => {
    it("validates multi-select question with multiple correct options", () => {
      const res = QuestionValidator.validate({
        question_type: "MULTIPLE_SELECT",
        prompt: "Which of the following are ACID properties in relational databases?",
        options: [
          { id: "opt_a", text: "Atomicity" },
          { id: "opt_b", text: "Consistency" },
          { id: "opt_c", text: "Concurrency" },
          { id: "opt_d", text: "Durability" },
        ],
        answer_key: { correct_option_ids: ["opt_a", "opt_b", "opt_d"] },
        explanation: "ACID stands for Atomicity, Consistency, Isolation, Durability.",
      });

      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("rejects empty correct_option_ids array", () => {
      const res = QuestionValidator.validate({
        question_type: "MULTIPLE_SELECT",
        prompt: "Which features are supported?",
        options: [
          { id: "opt_1", text: "Feature A" },
          { id: "opt_2", text: "Feature B" },
        ],
        answer_key: { correct_option_ids: [] },
      });

      expect(res.isValid).toBe(false);
      expect(res.errors).toContain("Multiple-select answer key must specify at least one 'correct_option_id'.");
    });
  });

  describe("NUMERIC", () => {
    it("validates a numeric question with tolerance", () => {
      const res = QuestionValidator.validate({
        question_type: "NUMERIC",
        prompt: "Calculate the value of Euler's number e rounded to 2 decimal places.",
        answer_key: { value: 2.72, tolerance: 0.01 },
      });

      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("rejects a negative tolerance value", () => {
      const res = QuestionValidator.validate({
        question_type: "NUMERIC",
        prompt: "What is 10 + 20?",
        answer_key: { value: 30, tolerance: -1 },
      });

      expect(res.isValid).toBe(false);
      expect(res.errors).toContain("Tolerance must be a non-negative number.");
    });
  });

  describe("SHORT_ANSWER", () => {
    it("validates short answer with rubric", () => {
      const res = QuestionValidator.validate({
        question_type: "SHORT_ANSWER",
        prompt: "Explain the difference between synchronous and asynchronous execution in Node.js.",
        answer_key: {
          rubric: "Must mention event loop, non-blocking I/O, and callback queues.",
          sample_answer: "Synchronous blocking executes sequentially while asynchronous delegates to libuv.",
        },
      });

      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("rejects short answer without rubric", () => {
      const res = QuestionValidator.validate({
        question_type: "SHORT_ANSWER",
        prompt: "Explain inheritance in object-oriented programming.",
        answer_key: { rubric: "" },
      });

      expect(res.isValid).toBe(false);
      expect(res.errors).toContain("Short-answer question answer key must provide an evaluation 'rubric'.");
    });
  });

  describe("CODING", () => {
    it("validates coding problem with public and hidden test cases", () => {
      const res = QuestionValidator.validate({
        question_type: "CODING",
        prompt: "Write a function that reverses an array of integers in-place.",
        explanation: "Two pointers approach swapping elements until pointers meet.",
        answer_key: {
          test_cases: [
            { input: "[1, 2, 3]", expected_output: "[3, 2, 1]", is_hidden: false },
            { input: "[]", expected_output: "[]", is_hidden: true },
          ],
        },
      });

      expect(res.isValid).toBe(true);
      expect(res.errors).toHaveLength(0);
      expect(res.warnings).toHaveLength(0);
    });

    it("warns when coding problem lacks hidden test cases", () => {
      const res = QuestionValidator.validate({
        question_type: "CODING",
        prompt: "Return sum of two numbers.",
        answer_key: {
          test_cases: [{ input: "1 2", expected_output: "3", is_hidden: false }],
        },
      });

      expect(res.isValid).toBe(true);
      expect(res.warnings).toContain("Coding problem has no hidden test cases. Assessment submissions may not be rigorously evaluated.");
    });
  });
});
