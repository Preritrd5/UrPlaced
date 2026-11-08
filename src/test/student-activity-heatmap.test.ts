import { describe, it, expect, vi, beforeEach } from "vitest";
import { StudentActivityHeatmapService } from "@/modules/students/services/student-activity-heatmap-service";

// Mock Supabase admin client
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();

const mockQueryBuilder = {
  select: mockSelect,
  eq: mockEq,
  in: mockIn,
  gte: mockGte,
  lte: mockLte,
};

// Chain mock implementation
mockSelect.mockReturnValue(mockQueryBuilder);
mockEq.mockReturnValue(mockQueryBuilder);
mockIn.mockReturnValue(mockQueryBuilder);
mockGte.mockReturnValue(mockQueryBuilder);
mockLte.mockReturnValue(mockQueryBuilder);

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      let filterTenant = "";
      let filterStudent = "";
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((col: string, val: string) => {
            if (col === "tenant_id") filterTenant = val;
            if (col === "student_id") filterStudent = val;
            return {
              eq: vi.fn().mockImplementation((c2: string, v2: string) => {
                if (c2 === "tenant_id") filterTenant = v2;
                if (c2 === "student_id") filterStudent = v2;
                return {
                  in: vi.fn().mockReturnValue({
                    gte: vi.fn().mockReturnValue({
                      lte: vi.fn().mockImplementation(async () => {
                        if (filterTenant === "tenant-empty" || filterStudent === "student-empty") {
                          return { data: [], error: null };
                        }
                        if (table === "assessment_attempts") {
                          return {
                            data: [
                              {
                                id: "att-1",
                                submitted_at: "2026-11-06T16:38:18.757Z",
                                status: "SCORED",
                              },
                              {
                                id: "att-2",
                                submitted_at: "2026-11-06T17:00:00.000Z",
                                status: "SCORED",
                              },
                              {
                                id: "att-3",
                                submitted_at: "2026-11-05T12:00:00.000Z",
                                status: "SCORED",
                              },
                            ],
                            error: null,
                          };
                        }
                        if (table === "drive_applications") {
                          return {
                            data: [
                              {
                                id: "app-1",
                                registration_date: "2026-11-05T14:00:00.000Z",
                                status: "REGISTERED",
                              },
                            ],
                            error: null,
                          };
                        }
                        if (table === "review_sessions") {
                          return {
                            data: [
                              {
                                id: "rev-1",
                                created_at: "2026-11-04T10:00:00.000Z",
                                action_type: "REFLECTION_SAVED",
                              },
                            ],
                            error: null,
                          };
                        }
                        return { data: [], error: null };
                      }),
                    }),
                  }),
                };
              }),
            };
          }),
        }),
      };
    }),
  })),
}));

describe("StudentActivityHeatmapService Unit & Aggregation Tests", () => {
  const tenantId = "tenant-test-123";
  const studentId = "student-test-456";
  const refDate = new Date("2026-11-08T12:00:00.000Z");

  it("computes intensity levels accurately (0 to 4)", () => {
    expect(StudentActivityHeatmapService.computeLevel(0)).toBe(0);
    expect(StudentActivityHeatmapService.computeLevel(1)).toBe(1);
    expect(StudentActivityHeatmapService.computeLevel(2)).toBe(2);
    expect(StudentActivityHeatmapService.computeLevel(3)).toBe(3);
    expect(StudentActivityHeatmapService.computeLevel(4)).toBe(3);
    expect(StudentActivityHeatmapService.computeLevel(5)).toBe(4);
    expect(StudentActivityHeatmapService.computeLevel(25)).toBe(4);
  });

  it("calculates trailing 365 calendar days range", () => {
    const range = StudentActivityHeatmapService.getTrailing365DayRange({
      referenceDate: refDate,
      timezone: "Asia/Kolkata",
    });

    expect(range.endDateStr).toBe("2026-11-08");
    const [sy, sm, sd] = range.startDateStr.split("-").map(Number);
    const [ey, em, ed] = range.endDateStr.split("-").map(Number);
    const diffDays = Math.round(
      (Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000
    );
    expect(diffDays).toBe(364); // 364 days difference = 365 days inclusive
  });

  it("aggregates student submissions across assessments, applications, and reviews", async () => {
    const heatmap = await StudentActivityHeatmapService.getHeatmap(tenantId, studentId, {
      referenceDate: refDate,
      timezone: "UTC",
    });

    expect(heatmap.studentId).toBe(studentId);
    expect(heatmap.startDate).toBe("2025-11-09");
    expect(heatmap.endDate).toBe("2026-11-08");

    // Total submissions: 2 on Nov 6 + 1 att & 1 app on Nov 5 + 1 review on Nov 4 = 5 submissions
    expect(heatmap.totalSubmissions).toBe(5);
    // Active days: Nov 4, Nov 5, Nov 6 = 3 days
    expect(heatmap.totalActiveDays).toBe(3);
    // Streak: Nov 4, Nov 5, Nov 6 are consecutive = 3 days streak!
    expect(heatmap.maxStreak).toBe(3);

    // Check specific days
    const nov6 = heatmap.days["2026-11-06"];
    expect(nov6).toBeDefined();
    expect(nov6.count).toBe(2);
    expect(nov6.level).toBe(2);
    expect(nov6.breakdown.assessments).toBe(2);
    expect(nov6.breakdown.applications).toBe(0);

    const nov5 = heatmap.days["2026-11-05"];
    expect(nov5).toBeDefined();
    expect(nov5.count).toBe(2);
    expect(nov5.breakdown.assessments).toBe(1);
    expect(nov5.breakdown.applications).toBe(1);

    const nov4 = heatmap.days["2026-11-04"];
    expect(nov4).toBeDefined();
    expect(nov4.count).toBe(1);
    expect(nov4.breakdown.mistakeRemediations).toBe(1);
  });

  it("builds monthly blocks matching GitHub / LeetCode style with 7-row columns", () => {
    const daysMap: Record<string, any> = {
      "2026-11-06": {
        date: "2026-11-06",
        count: 2,
        level: 2,
        breakdown: { assessments: 2, applications: 0, mistakeRemediations: 0 },
      },
    };

    const months = StudentActivityHeatmapService.buildMonthBlocks(
      "2025-11-09",
      "2026-11-08",
      daysMap
    );

    expect(months.length).toBeGreaterThanOrEqual(12);

    // Each month has columns of exactly 7 rows
    for (const m of months) {
      expect(m.columns.length).toBeGreaterThan(0);
      for (const col of m.columns) {
        expect(col.length).toBe(7);
      }
    }

    // Verify Nov 2026 column contains Nov 6 with level 2
    const lastMonth = months[months.length - 1];
    expect(lastMonth.monthLabel).toBe("Nov");
    let foundNov6 = false;
    for (const col of lastMonth.columns) {
      for (const cell of col) {
        if (cell?.date === "2026-11-06") {
          foundNov6 = true;
          expect(cell.activity.level).toBe(2);
        }
      }
    }
    expect(foundNov6).toBe(true);
  });

  it("handles empty student activity gracefully with zero counts and full grid", async () => {
    // Override supabase to return empty arrays
    const emptyHeatmap = await StudentActivityHeatmapService.getHeatmap("tenant-empty", "student-empty", {
      referenceDate: refDate,
      timezone: "UTC",
    });

    expect(emptyHeatmap.totalSubmissions).toBe(0);
    expect(emptyHeatmap.totalActiveDays).toBe(0);
    expect(emptyHeatmap.maxStreak).toBe(0);
    expect(emptyHeatmap.currentStreak).toBe(0);
    expect(Object.keys(emptyHeatmap.days).length).toBe(365);
    expect(emptyHeatmap.months.length).toBeGreaterThanOrEqual(12);

    // All cells should be level 0
    for (const day of Object.values(emptyHeatmap.days)) {
      expect(day.count).toBe(0);
      expect(day.level).toBe(0);
    }
  });

  it("throws when required tenantId or studentId is missing", async () => {
    await expect(StudentActivityHeatmapService.getHeatmap("", "student-123")).rejects.toThrow(
      "tenantId and studentId are required"
    );
    await expect(StudentActivityHeatmapService.getHeatmap("tenant-123", "")).rejects.toThrow(
      "tenantId and studentId are required"
    );
  });
});
