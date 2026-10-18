import { describe, it, expect } from "vitest";
import { AcademicYearService } from "@/modules/academic/services/academic-year-service";

describe("Academic Year Service Validation", () => {
  it("rejects academic year when start date is after or equal to end date", async () => {
    await expect(
      AcademicYearService.create({
        tenantId: "tenant-1",
        name: "2026-2027",
        startDate: "2027-06-01",
        endDate: "2026-06-01",
      })
    ).rejects.toThrow("Academic year start date must precede end date.");
  });
});
