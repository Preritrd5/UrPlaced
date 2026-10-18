import { describe, it, expect } from "vitest";
import { EligibilityEngine } from "@/modules/eligibility/services/eligibility-engine";

describe("Eligibility Criteria Engine", () => {
  const baseStudent = {
    id: "student-1",
    cgpa: 8.5,
    tenth_percentage: 92.0,
    twelfth_percentage: 88.0,
    active_backlogs: 0,
    total_backlogs: 0,
    department_id: "dept-cse",
    graduation_year: 2026,
    degree: "B.Tech",
    academic_status: "ACTIVE",
  };

  const baseCriteria = {
    min_cgpa: 7.5,
    min_tenth_percentage: 60.0,
    min_twelfth_percentage: 60.0,
    max_active_backlogs: 0,
    max_total_backlogs: 2,
    allowed_departments: ["dept-cse", "dept-it"],
    allowed_graduation_years: [2026],
    allowed_degrees: ["B.Tech"],
    allowed_academic_statuses: ["ACTIVE"],
    criteria_version: 1,
  };

  it("marks a qualified candidate as ELIGIBLE with full criteria breakdown", () => {
    const result = EligibilityEngine.evaluate(baseStudent, baseCriteria as any);
    expect(result.isEligible).toBe(true);
    expect(result.status).toBe("ELIGIBLE");
    expect(result.failedCriteria.length).toBe(0);
    expect(result.missingData.length).toBe(0);
    expect(result.passedCriteria.length).toBeGreaterThan(0);
  });

  it("marks a candidate INELIGIBLE when CGPA is below threshold", () => {
    const lowCgpaStudent = { ...baseStudent, cgpa: 7.2 };
    const result = EligibilityEngine.evaluate(lowCgpaStudent, baseCriteria as any);
    expect(result.isEligible).toBe(false);
    expect(result.status).toBe("INELIGIBLE");
    expect(result.failedCriteria.some((f) => f.code === "CGPA")).toBe(true);
  });

  it("marks a candidate INELIGIBLE when active backlogs exceed maximum limit", () => {
    const backloggedStudent = { ...baseStudent, active_backlogs: 1 };
    const result = EligibilityEngine.evaluate(backloggedStudent, baseCriteria as any);
    expect(result.isEligible).toBe(false);
    expect(result.status).toBe("INELIGIBLE");
    expect(result.failedCriteria.some((f) => f.code === "ACTIVE_BACKLOGS")).toBe(true);
  });

  it("marks a candidate INELIGIBLE when department is not in allowed list", () => {
    const mechStudent = { ...baseStudent, department_id: "dept-mech" };
    const result = EligibilityEngine.evaluate(mechStudent, baseCriteria as any);
    expect(result.isEligible).toBe(false);
    expect(result.status).toBe("INELIGIBLE");
    expect(result.failedCriteria.some((f) => f.code === "DEPARTMENT")).toBe(true);
  });

  it("marks a candidate INELIGIBLE when graduation year does not match", () => {
    const batch2025Student = { ...baseStudent, graduation_year: 2025 };
    const result = EligibilityEngine.evaluate(batch2025Student, baseCriteria as any);
    expect(result.isEligible).toBe(false);
    expect(result.status).toBe("INELIGIBLE");
    expect(result.failedCriteria.some((f) => f.code === "GRADUATION_YEAR")).toBe(true);
  });

  it("marks a candidate as NEEDS_REVIEW when required 10th percentage data is missing", () => {
    const missingTenthStudent = { ...baseStudent, tenth_percentage: null };
    const result = EligibilityEngine.evaluate(missingTenthStudent, baseCriteria as any);
    expect(result.isEligible).toBe(false);
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.missingData.some((m) => m.code === "TENTH_PERCENTAGE")).toBe(true);
  });
});
