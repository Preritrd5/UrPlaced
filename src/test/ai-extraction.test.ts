import { describe, it, expect } from "vitest";
import { AIExtractionService } from "@/modules/recruitment-intelligence/services/ai-extraction-service";

describe("AIExtractionService Grounded Pattern Extraction", () => {
  it("extracts CGPA criteria accurately from job text", () => {
    const text = "Candidates must possess a minimum CGPA of 7.50 with no active backlogs.";
    const result = AIExtractionService.extractRuleBased(text, { companyName: "Acme Corp" });

    const cgpaProp = result.proposals.find((p) => p.category === "ELIGIBILITY" && p.structuredValue?.min_cgpa);
    expect(cgpaProp).toBeDefined();
    expect(cgpaProp?.structuredValue?.min_cgpa).toBe(7.5);
    expect(cgpaProp?.evidenceLevel).toBe("OFFICIAL");
    expect(cgpaProp?.scopeLevel).toBe("DRIVE");
  });

  it("extracts academic percentage threshold accurately", () => {
    const text = "Eligibility: 65% aggregate required in 10th, 12th, and graduation.";
    const result = AIExtractionService.extractRuleBased(text, { companyName: "TechCorp" });

    const percProp = result.proposals.find((p) => p.category === "ELIGIBILITY" && p.structuredValue?.min_percentage);
    expect(percProp).toBeDefined();
    expect(percProp?.structuredValue?.min_percentage).toBe(65);
  });

  it("extracts technical skills and programming languages", () => {
    const text = "Looking for candidates with strong Data Structures and Algorithms knowledge, SQL, and Python proficiency.";
    const result = AIExtractionService.extractRuleBased(text, { companyName: "StartupCo" });

    const dsaProp = result.proposals.find((p) => p.title.includes("Data Structures & Algorithms"));
    expect(dsaProp).toBeDefined();
    expect(dsaProp?.category).toBe("TECHNICAL_SKILL");

    const pyProp = result.proposals.find((p) => p.title.includes("Python Programming"));
    expect(pyProp).toBeDefined();
    expect(pyProp?.category).toBe("PROGRAMMING_LANGUAGE");

    const sqlProp = result.proposals.find((p) => p.title.includes("SQL"));
    expect(sqlProp).toBeDefined();
  });

  it("detects evaluation rounds without hallucinating unstated rounds", () => {
    const text = "Selection Process consists of an Online Assessment followed by a Technical Interview.";
    const result = AIExtractionService.extractRuleBased(text, { companyName: "EnterpriseCo" });

    const processProp = result.proposals.find((p) => p.category === "RECRUITMENT_PROCESS");
    expect(processProp).toBeDefined();
    expect(processProp?.structuredValue?.rounds).toContain("Online Assessment (OA)");
    expect(processProp?.structuredValue?.rounds).toContain("Technical Interview");
    // HR interview was not mentioned, must NOT be present
    expect(processProp?.structuredValue?.rounds).not.toContain("HR & Behavioral Interview");
  });

  it("returns zero rounds when notice text does not describe evaluation process", () => {
    const text = "Job description: Frontend developer working with React and TypeScript.";
    const result = AIExtractionService.extractRuleBased(text, { companyName: "DesignCo" });

    const processProp = result.proposals.find((p) => p.category === "RECRUITMENT_PROCESS");
    expect(processProp).toBeUndefined();
  });
});
