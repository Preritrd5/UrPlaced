/**
-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- QuestionBank Sentinel Module Index
-- ==============================================================================
*/

export * from "./services/question-validator";
export * from "./services/duplicate-detector";
export * from "./services/question-service";
export * from "./services/import-service";
export * from "./services/question-set-service";

export const QuestionBankModule = {
  name: "question-bank-sentinel",
  version: "1.0.0",
  status: "active",
  features: [
    "multi_type_question_authoring",
    "structural_validation",
    "exact_and_near_duplicate_detection",
    "answer_key_verification",
    "immutable_version_control",
    "formula_safe_csv_import",
    "frozen_question_set_snapshots",
    "student_answer_key_masking",
  ],
} as const;
