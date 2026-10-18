/**
-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- QuestionBank Sentinel: Structural & Quality Validator
-- ==============================================================================
*/

import { QuestionType, QuestionDifficulty } from "@/types/database";

export interface McqOption {
  id: string;
  text: string;
}

export interface McqSingleAnswerKey {
  correct_option_id: string;
}

export interface McqMultipleAnswerKey {
  correct_option_ids: string[];
  partial_scoring?: boolean;
}

export interface NumericAnswerKey {
  value: number;
  tolerance?: number;
  unit?: string;
}

export interface ShortAnswerKey {
  rubric: string;
  sample_answer?: string;
  keywords?: string[];
}

export interface CodingTestCase {
  input: string;
  expected_output: string;
  is_hidden: boolean;
  explanation?: string;
}

export interface CodingAnswerKey {
  language_templates?: Record<string, string>;
  test_cases: CodingTestCase[];
}

export interface QuestionValidationInput {
  question_type: QuestionType;
  prompt: string;
  difficulty?: QuestionDifficulty;
  options?: McqOption[] | unknown;
  answer_key: unknown;
  explanation?: string | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class QuestionValidator {
  /**
   * Validates structural integrity and answer key consistency for any question type.
   */
  public static validate(input: QuestionValidationInput): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. General Prompt Validation
    if (!input.prompt || typeof input.prompt !== "string" || input.prompt.trim().length === 0) {
      errors.push("Question prompt is required and cannot be empty.");
    } else if (input.prompt.trim().length < 5) {
      errors.push("Question prompt is too short (minimum 5 characters).");
    }

    if (!input.explanation || (typeof input.explanation === "string" && input.explanation.trim().length === 0)) {
      warnings.push("Explanation is recommended for student learning and mistake review.");
    }

    // 2. Type-Specific Validation
    switch (input.question_type) {
      case "SINGLE_CHOICE":
        this.validateSingleChoice(input, errors, warnings);
        break;

      case "MULTIPLE_SELECT":
        this.validateMultipleSelect(input, errors, warnings);
        break;

      case "NUMERIC":
        this.validateNumeric(input, errors, warnings);
        break;

      case "SHORT_ANSWER":
        this.validateShortAnswer(input, errors, warnings);
        break;

      case "CODING":
        this.validateCoding(input, errors, warnings);
        break;

      default:
        errors.push(`Unsupported question type: ${input.question_type}`);
        break;
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static validateSingleChoice(
    input: QuestionValidationInput,
    errors: string[],
    warnings: string[]
  ): void {
    const options = input.options as McqOption[] | undefined;

    if (!Array.isArray(options) || options.length < 2) {
      errors.push("Single-choice question must have at least 2 options.");
      return;
    }

    const seenIds = new Set<string>();
    const seenTexts = new Set<string>();

    options.forEach((opt, idx) => {
      if (!opt.id || typeof opt.id !== "string" || opt.id.trim().length === 0) {
        errors.push(`Option at index ${idx} is missing a stable ID.`);
      } else if (seenIds.has(opt.id)) {
        errors.push(`Duplicate option ID detected: '${opt.id}'.`);
      } else {
        seenIds.add(opt.id);
      }

      if (!opt.text || typeof opt.text !== "string" || opt.text.trim().length === 0) {
        errors.push(`Option at index ${idx} cannot have empty text.`);
      } else {
        const norm = opt.text.trim().toLowerCase();
        if (seenTexts.has(norm)) {
          warnings.push(`Duplicate option text detected: "${opt.text}".`);
        }
        seenTexts.add(norm);
      }
    });

    const key = input.answer_key as McqSingleAnswerKey | undefined;
    if (!key || !key.correct_option_id || typeof key.correct_option_id !== "string") {
      errors.push("Single-choice answer key must specify 'correct_option_id'.");
    } else if (!seenIds.has(key.correct_option_id)) {
      errors.push(`Answer key references non-existent option ID: '${key.correct_option_id}'.`);
    }
  }

  private static validateMultipleSelect(
    input: QuestionValidationInput,
    errors: string[],
    warnings: string[]
  ): void {
    const options = input.options as McqOption[] | undefined;

    if (!Array.isArray(options) || options.length < 2) {
      errors.push("Multiple-select question must have at least 2 options.");
      return;
    }

    const seenIds = new Set<string>();
    options.forEach((opt, idx) => {
      if (!opt.id || typeof opt.id !== "string") {
        errors.push(`Option at index ${idx} is missing an ID.`);
      } else {
        seenIds.add(opt.id);
      }
      if (!opt.text || typeof opt.text !== "string" || opt.text.trim().length === 0) {
        errors.push(`Option at index ${idx} cannot have empty text.`);
      }
    });

    const key = input.answer_key as McqMultipleAnswerKey | undefined;
    if (!key || !Array.isArray(key.correct_option_ids) || key.correct_option_ids.length === 0) {
      errors.push("Multiple-select answer key must specify at least one 'correct_option_id'.");
    } else {
      key.correct_option_ids.forEach((id) => {
        if (!seenIds.has(id)) {
          errors.push(`Answer key references non-existent option ID: '${id}'.`);
        }
      });
      if (key.correct_option_ids.length === options.length) {
        warnings.push("All options are marked as correct. Please verify if intentional.");
      }
    }
  }

  private static validateNumeric(
    input: QuestionValidationInput,
    errors: string[],
    _warnings: string[]
  ): void {
    const key = input.answer_key as NumericAnswerKey | undefined;

    if (!key || typeof key.value !== "number" || isNaN(key.value)) {
      errors.push("Numeric question answer key must provide a valid numeric 'value'.");
      return;
    }

    if (key.tolerance !== undefined) {
      if (typeof key.tolerance !== "number" || key.tolerance < 0 || isNaN(key.tolerance)) {
        errors.push("Tolerance must be a non-negative number.");
      }
    }
  }

  private static validateShortAnswer(
    input: QuestionValidationInput,
    errors: string[],
    warnings: string[]
  ): void {
    const key = input.answer_key as ShortAnswerKey | undefined;

    if (!key || !key.rubric || typeof key.rubric !== "string" || key.rubric.trim().length === 0) {
      errors.push("Short-answer question answer key must provide an evaluation 'rubric'.");
    }

    if (!key?.sample_answer || key.sample_answer.trim().length === 0) {
      warnings.push("Providing a sample answer is strongly recommended for evaluator reference.");
    }
  }

  private static validateCoding(
    input: QuestionValidationInput,
    errors: string[],
    warnings: string[]
  ): void {
    const key = input.answer_key as CodingAnswerKey | undefined;

    if (!key || !Array.isArray(key.test_cases) || key.test_cases.length === 0) {
      errors.push("Coding questions must specify at least one test case.");
      return;
    }

    let hasPublic = false;
    let hasHidden = false;

    key.test_cases.forEach((tc, idx) => {
      if (tc.input === undefined || tc.input === null || typeof tc.input !== "string") {
        errors.push(`Test case #${idx + 1} is missing 'input' string.`);
      }
      if (tc.expected_output === undefined || tc.expected_output === null || typeof tc.expected_output !== "string") {
        errors.push(`Test case #${idx + 1} is missing 'expected_output' string.`);
      }
      if (tc.is_hidden) {
        hasHidden = true;
      } else {
        hasPublic = true;
      }
    });

    if (!hasPublic) {
      warnings.push("Coding problem has no public/example test cases for students to test against.");
    }
    if (!hasHidden) {
      warnings.push("Coding problem has no hidden test cases. Assessment submissions may not be rigorously evaluated.");
    }
  }
}
