/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Analytics & Institutional Improvement Module (Phase 09)
 * ==============================================================================
 */

export * from "./services/analytics-metric-service";
export * from "./services/export-service";

export const AnalyticsModule = {
  name: "analytics",
  version: "1.0.0",
  phase: "09",
} as const;
