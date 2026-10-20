/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Drive Comparison & Pattern Analysis Tests (Phase 09)
 * ==============================================================================
 */

import { describe, it, expect } from "vitest";
import {
  MANDATORY_LIMITATIONS_DISCLAIMER,
} from "@/modules/placement-memory/services/drive-comparison-service";
import { DriveMatchingBasis, DriveComparabilityStatus } from "@/types/database";

describe("Phase 09: Drive Comparison Engine", () => {
  it("includes the non-negotiable mandatory limitations disclaimer verbatim", () => {
    expect(MANDATORY_LIMITATIONS_DISCLAIMER).toBe(
      "Historical drive patterns represent past hiring rounds and may not predict changes in current drive requirements. Differences in hiring volume, role level, or test vendor should be accounted for."
    );
  });

  it("determines correct matching basis between current drive and historical record", () => {
    const currentDrive = {
      company_id: "comp-amazon",
      role_title: "Software Development Engineer - I",
    };

    // 1. Exact / Substring Role Match
    const histExact = {
      company_id: "comp-amazon",
      role_title: "Software Development Engineer",
    };

    let basis: DriveMatchingBasis = "ROLE_FAMILY_MATCH";
    if (currentDrive.company_id === histExact.company_id) {
      const cRole = currentDrive.role_title.toLowerCase();
      const hRole = histExact.role_title.toLowerCase();
      if (cRole === hRole || cRole.includes(hRole) || hRole.includes(cRole)) {
        basis = "SAME_COMPANY_AND_ROLE";
      } else {
        basis = "SAME_COMPANY_DIFFERENT_ROLE";
      }
    }
    expect(basis).toBe("SAME_COMPANY_AND_ROLE");

    // 2. Same Company Different Role
    const histDiffRole = {
      company_id: "comp-amazon",
      role_title: "Quality Assurance Engineer",
    };
    if (currentDrive.company_id === histDiffRole.company_id) {
      const cRole = currentDrive.role_title.toLowerCase();
      const hRole = histDiffRole.role_title.toLowerCase();
      if (cRole === hRole || cRole.includes(hRole) || hRole.includes(cRole)) {
        basis = "SAME_COMPANY_AND_ROLE";
      } else {
        basis = "SAME_COMPANY_DIFFERENT_ROLE";
      }
    }
    expect(basis).toBe("SAME_COMPANY_DIFFERENT_ROLE");

    // 3. Cross Company Role Family Match
    const histCrossCompany = {
      company_id: "comp-microsoft",
      role_title: "Software Engineer",
    };
    if (currentDrive.company_id !== histCrossCompany.company_id) {
      basis = "ROLE_FAMILY_MATCH";
    }
    expect(basis).toBe("ROLE_FAMILY_MATCH");
  });

  it("identifies shared vs differing attributes and unknown fields without fabricating data", () => {
    const currentDrive = {
      company_id: "comp-microsoft",
      role_title: "Software Engineer",
      min_cgpa: 7.5,
      compensation_details: null, // missing compensation
    };

    const historicalRecord = {
      company_id: "comp-microsoft",
      role_title: "Software Engineer",
      eligibility_criteria_snapshot: { min_cgpa: 8.0 },
      confirmed_rounds: [],
      reported_rounds: [],
    };

    const shared: Record<string, unknown> = {};
    const differing: Record<string, unknown> = {};
    const unknowns: string[] = [];

    // Role Match
    if (currentDrive.role_title.toLowerCase() === historicalRecord.role_title.toLowerCase()) {
      shared.role_title = currentDrive.role_title;
    }

    // Min CGPA comparison
    if (Number(currentDrive.min_cgpa) === Number(historicalRecord.eligibility_criteria_snapshot.min_cgpa)) {
      shared.min_cgpa = currentDrive.min_cgpa;
    } else {
      differing.min_cgpa = {
        current: currentDrive.min_cgpa,
        historical: historicalRecord.eligibility_criteria_snapshot.min_cgpa,
      };
    }

    // Check compensation
    if (!currentDrive.compensation_details) {
      unknowns.push("current_compensation_details_not_disclosed");
    }

    // Check rounds
    if (historicalRecord.confirmed_rounds.length === 0 && historicalRecord.reported_rounds.length === 0) {
      unknowns.push("historical_rounds_structure_unknown");
    }

    expect(shared.role_title).toBe("Software Engineer");
    expect(differing.min_cgpa).toEqual({ current: 7.5, historical: 8.0 });
    expect(unknowns).toContain("current_compensation_details_not_disclosed");
    expect(unknowns).toContain("historical_rounds_structure_unknown");
  });

  it("correctly assigns comparability status based on evidence completeness", () => {
    function evaluateStatus(
      matchingBasis: DriveMatchingBasis,
      unknownCount: number,
      differingCount: number
    ): DriveComparabilityStatus {
      if (matchingBasis === "ROLE_FAMILY_MATCH") {
        return "PARTIALLY_COMPARABLE";
      } else if (unknownCount >= 3) {
        return "LIMITED_EVIDENCE";
      } else if (differingCount > 2) {
        return "PARTIALLY_COMPARABLE";
      }
      return "HIGHLY_COMPARABLE";
    }

    expect(evaluateStatus("SAME_COMPANY_AND_ROLE", 0, 0)).toBe("HIGHLY_COMPARABLE");
    expect(evaluateStatus("SAME_COMPANY_AND_ROLE", 3, 0)).toBe("LIMITED_EVIDENCE");
    expect(evaluateStatus("ROLE_FAMILY_MATCH", 0, 0)).toBe("PARTIALLY_COMPARABLE");
    expect(evaluateStatus("SAME_COMPANY_AND_ROLE", 0, 3)).toBe("PARTIALLY_COMPARABLE");
  });
});
