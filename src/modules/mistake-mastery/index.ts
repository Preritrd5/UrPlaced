/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Domain Module: Mistake Bank & Mistake-to-Mastery Engine (Phase 08)
 * ==============================================================================
 */

export * from "./services/mistake-capture-service";
export * from "./services/revision-scheduler-service";
export * from "./services/practice-recommendation-service";
export * from "./services/mastery-evaluation-service";
export * from "./services/content-defect-service";

export const MistakeMasteryModule = {
  name: "mistake-mastery",
  version: "1.0.0",
  phase: "08",
  status: "active",
} as const;
