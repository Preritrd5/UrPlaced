/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Placement Memory & DriveFit Module (Phase 09)
 * ==============================================================================
 */

export * from "./services/historical-recruitment-service";
export * from "./services/drive-comparison-service";
export * from "./services/report-moderation-service";

export const PlacementMemoryModule = {
  name: "placement-memory",
  version: "1.0.0",
  phase: "09",
} as const;
