/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Domain Module: Assessment Engine & Student Preparation (Phase 07)
 * ==============================================================================
 */

export * from "./services/assessment-service";
export * from "./services/assignment-service";
export * from "./services/attempt-lifecycle-service";
export * from "./services/autosave-service";
export * from "./services/assessment-scoring-service";
export * from "./services/isolated-runner-boundary";
export * from "./services/practice-catalogue-service";

export const AssessmentsModule = {
  name: "assessments",
  version: "1.0.0",
  phase: "07",
  status: "active",
} as const;
