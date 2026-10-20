import { describe, it, expect } from "vitest";
import {
  RevisionSchedulerService,
  REVISION_STAGES,
} from "@/modules/mistake-mastery/services/revision-scheduler-service";

describe("Phase 08: Spaced Repetition Revision Scheduler Service", () => {
  it("defines exact spaced repetition stages (1d, 3d, 7d, 14d, 30d)", () => {
    expect(REVISION_STAGES[1].intervalDays).toBe(1);
    expect(REVISION_STAGES[2].intervalDays).toBe(3);
    expect(REVISION_STAGES[3].intervalDays).toBe(7);
    expect(REVISION_STAGES[4].intervalDays).toBe(14);
    expect(REVISION_STAGES[5].intervalDays).toBe(30);
  });

  it("advances revision stage and computes next due date on success", () => {
    const baseDate = new Date("2026-10-19T10:00:00.000Z");

    // Stage 1 success -> Stage 2 (3 days)
    const res1 = RevisionSchedulerService.calculateNextDueDate(1, baseDate, true);
    expect(res1.nextStage).toBe(2);
    expect(res1.intervalDays).toBe(3);
    expect(res1.nextDueAt.toISOString()).toBe("2026-10-22T10:00:00.000Z");

    // Stage 2 success -> Stage 3 (7 days)
    const res2 = RevisionSchedulerService.calculateNextDueDate(2, baseDate, true);
    expect(res2.nextStage).toBe(3);
    expect(res2.intervalDays).toBe(7);
    expect(res2.nextDueAt.toISOString()).toBe("2026-10-26T10:00:00.000Z");

    // Stage 3 success -> Stage 4 (14 days)
    const res3 = RevisionSchedulerService.calculateNextDueDate(3, baseDate, true);
    expect(res3.nextStage).toBe(4);
    expect(res3.intervalDays).toBe(14);
    expect(res3.nextDueAt.toISOString()).toBe("2026-11-02T10:00:00.000Z");

    // Stage 4 success -> Stage 5 (30 days)
    const res4 = RevisionSchedulerService.calculateNextDueDate(4, baseDate, true);
    expect(res4.nextStage).toBe(5);
    expect(res4.intervalDays).toBe(30);
    expect(res4.nextDueAt.toISOString()).toBe("2026-11-18T10:00:00.000Z");

    // Stage 5 success -> Stays at Stage 5 (30 days)
    const res5 = RevisionSchedulerService.calculateNextDueDate(5, baseDate, true);
    expect(res5.nextStage).toBe(5);
    expect(res5.intervalDays).toBe(30);
  });

  it("regresses to Stage 1 (1 day) immediately on failure/slip", () => {
    const baseDate = new Date("2026-10-19T10:00:00.000Z");

    // Even from Stage 4 or Stage 5, failing resets to Stage 1
    const failRes4 = RevisionSchedulerService.calculateNextDueDate(4, baseDate, false);
    expect(failRes4.nextStage).toBe(1);
    expect(failRes4.intervalDays).toBe(1);
    expect(failRes4.nextDueAt.toISOString()).toBe("2026-10-20T10:00:00.000Z");

    const failRes5 = RevisionSchedulerService.calculateNextDueDate(5, baseDate, false);
    expect(failRes5.nextStage).toBe(1);
    expect(failRes5.intervalDays).toBe(1);
  });
});
