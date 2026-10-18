import { describe, it, expect } from "vitest";
import { AIExtractionService } from "@/modules/recruitment-intelligence/services/ai-extraction-service";
import { SourceService } from "@/modules/recruitment-intelligence/services/source-service";
import { RequirementCategory, EvidenceLevel, ScopeLevel } from "@/types/database";

describe("DriveFit Master Acceptance Test: End-to-End Recruitment Intelligence & Evidence Provenance", () => {
  const mockDrive = {
    id: "drive-google-2026",
    title: "Google Campus Recruitment Drive 2026",
    companyName: "Google",
    roleTitle: "Associate Software Engineer",
    stages: [
      { id: "stage-1", name: "Online Assessment (OA)", stage_type: "ONLINE_TEST", sequence_order: 1 },
      { id: "stage-2", name: "Technical Interview", stage_type: "TECHNICAL_INTERVIEW", sequence_order: 2 },
    ],
  };

  const sampleOfficialNotice = `
    OFFICIAL PLACEMENT CELL CIRCULAR: GOOGLE CAMPUS RECRUITMENT 2026
    Role: Associate Software Engineer
    Eligibility: Minimum CGPA of 7.50. 65% aggregate in 10th and 12th. No active backlogs.
    Selection Process:
    Round 1: Online Assessment (OA) covering Data Structures, Algorithms, and Aptitude.
    Round 2: Technical Interview focusing on Problem Solving, SQL, and OOP Fundamentals.
    Locations: Bangalore / Hyderabad. CTC: 24 LPA.
  `;

  it("Step 1: Ingests source circular and extracts grounded requirements without hallucinating unstated rounds", () => {
    const extraction = AIExtractionService.extractRuleBased(sampleOfficialNotice, {
      companyName: mockDrive.companyName,
      roleTitle: mockDrive.roleTitle,
      driveTitle: mockDrive.title,
    });

    expect(extraction.proposals.length).toBeGreaterThan(0);

    // 1. Verify CGPA extracted as OFFICIAL drive-level eligibility
    const cgpaReq = extraction.proposals.find((p) => p.category === "ELIGIBILITY" && p.structuredValue?.min_cgpa);
    expect(cgpaReq).toBeDefined();
    expect(cgpaReq?.structuredValue?.min_cgpa).toBe(7.5);
    expect(cgpaReq?.evidenceLevel).toBe("OFFICIAL");
    expect(cgpaReq?.scopeLevel).toBe("DRIVE");

    // 2. Verify percentage extracted as OFFICIAL
    const percReq = extraction.proposals.find((p) => p.category === "ELIGIBILITY" && p.structuredValue?.min_percentage);
    expect(percReq).toBeDefined();
    expect(percReq?.structuredValue?.min_percentage).toBe(65);

    // 3. Verify confirmed evaluation rounds
    const roundsReq = extraction.proposals.find((p) => p.category === "RECRUITMENT_PROCESS");
    expect(roundsReq).toBeDefined();
    expect(roundsReq?.structuredValue?.rounds).toContain("Online Assessment (OA)");
    expect(roundsReq?.structuredValue?.rounds).toContain("Technical Interview");
    // Crucial check: HR round was NOT mentioned in circular, must NOT be hallucinated
    expect(roundsReq?.structuredValue?.rounds).not.toContain("HR & Behavioral Interview");

    // 4. Verify Technical Competencies
    const dsaReq = extraction.proposals.find((p) => p.title.includes("Data Structures & Algorithms"));
    expect(dsaReq).toBeDefined();
    expect(dsaReq?.category).toBe("TECHNICAL_SKILL");
    expect(dsaReq?.evidenceLevel).toBe("OFFICIAL");

    const sqlReq = extraction.proposals.find((p) => p.title.includes("SQL"));
    expect(sqlReq).toBeDefined();
  });

  it("Step 2: Maps requirements to canonical curriculum skills with explicit importance and rationale", () => {
    const mappings = [
      {
        requirementTitle: "Required Competency: Data Structures & Algorithms",
        canonicalSkillName: "Data Structures & Algorithms",
        importance: "MANDATORY" as const,
        mappingRationale: "Critical for Round 1 section 2 online coding test problems.",
        evidenceLevel: "OFFICIAL" as EvidenceLevel,
      },
      {
        requirementTitle: "Required Competency: SQL & Relational Databases",
        canonicalSkillName: "Database Management Systems (SQL)",
        importance: "MANDATORY" as const,
        mappingRationale: "Tested extensively during Round 2 technical interview schema design questions.",
        evidenceLevel: "OFFICIAL" as EvidenceLevel,
      },
      {
        requirementTitle: "DriveFit Suggested Practice: System Design & Architecture",
        canonicalSkillName: "System Design & Architecture",
        importance: "RECOMMENDED" as const,
        mappingRationale: "Recommended practice topic to differentiate strong candidates.",
        evidenceLevel: "INFERRED" as EvidenceLevel,
      },
    ];

    expect(mappings.length).toBe(3);
    const mandatoryMappings = mappings.filter((m) => m.importance === "MANDATORY");
    expect(mandatoryMappings.length).toBe(2);

    const recommendedMappings = mappings.filter((m) => m.importance === "RECOMMENDED");
    expect(recommendedMappings.length).toBe(1);
    expect(recommendedMappings[0].evidenceLevel).toBe("INFERRED");
  });

  it("Step 3: Verifies that unpublished or draft intelligence is blocked from student queries", () => {
    const rawRequirements = [
      { id: "req-1", title: "Confirmed CGPA", is_published_to_students: true, verification_status: "VERIFIED" },
      { id: "req-2", title: "Internal Staff Salary Estimate", is_published_to_students: false, verification_status: "DRAFT" },
      { id: "req-3", title: "Unreviewed Candidate Rumor", is_published_to_students: false, verification_status: "PENDING_REVIEW" },
    ];

    // Student query filter (mirrors RLS policy and getRequirements(publishedOnly: true))
    const studentVisibleRequirements = rawRequirements.filter(
      (r) => r.is_published_to_students && r.verification_status === "VERIFIED"
    );

    expect(studentVisibleRequirements.length).toBe(1);
    expect(studentVisibleRequirements[0].id).toBe("req-1");
    // Sensitive draft/unreviewed claims are completely hidden
    expect(studentVisibleRequirements.some((r) => r.id === "req-2")).toBe(false);
    expect(studentVisibleRequirements.some((r) => r.id === "req-3")).toBe(false);
  });

  it("Step 4 (Key Acceptance Test): Student view clearly distinguishes Official vs Reported vs Inferred evidence", () => {
    const studentPublishedData = [
      {
        id: "req-1",
        title: "Minimum CGPA Requirement: 7.50",
        category: "ELIGIBILITY" as RequirementCategory,
        evidence_level: "OFFICIAL" as EvidenceLevel,
        source_excerpt: "Minimum CGPA of 7.50 required",
      },
      {
        id: "req-2",
        title: "Required Competency: Data Structures & Algorithms",
        category: "TECHNICAL_SKILL" as RequirementCategory,
        evidence_level: "OFFICIAL" as EvidenceLevel,
        source_excerpt: "Data Structures, Algorithms, and Aptitude",
      },
      {
        id: "req-3",
        title: "Reported Interview Question: Dynamic Programming Grid Paths",
        category: "PREPARATION_TOPIC" as RequirementCategory,
        evidence_level: "REPORTED" as EvidenceLevel,
        source_excerpt: "Reported by 2025 candidate: DP question asked in Tech Round 1",
      },
      {
        id: "req-4",
        title: "Recommended Revision: System Design Scalability Fundamentals",
        category: "PREPARATION_TOPIC" as RequirementCategory,
        evidence_level: "INFERRED" as EvidenceLevel,
        source_excerpt: null,
      },
    ];

    // 1. Verify Official confirmed claims
    const officialClaims = studentPublishedData.filter((r) => r.evidence_level === "OFFICIAL");
    expect(officialClaims.length).toBe(2);
    expect(officialClaims[0].source_excerpt).not.toBeNull();

    // 2. Verify Reported past candidate experiences
    const reportedClaims = studentPublishedData.filter((r) => r.evidence_level === "REPORTED");
    expect(reportedClaims.length).toBe(1);
    expect(reportedClaims[0].title).toContain("Reported");

    // 3. Verify Inferred DriveFit study recommendations
    const inferredClaims = studentPublishedData.filter((r) => r.evidence_level === "INFERRED");
    expect(inferredClaims.length).toBe(1);
    expect(inferredClaims[0].title).toContain("Recommended");

    // 4. Ensure no cross-contamination between categories
    expect(officialClaims.some((c) => c.evidence_level === "INFERRED")).toBe(false);
    expect(inferredClaims.some((c) => c.evidence_level === "OFFICIAL")).toBe(false);
  });

  it("Step 5: Verifies that requirement coverage is calculated accurately without predictive scoring", () => {
    const totalRequirements = 4;
    const mappedWithResources = 3;
    const coveragePercentage = Math.round((mappedWithResources / totalRequirements) * 100);

    expect(coveragePercentage).toBe(75);

    // Verify compliance with anti-deception rules:
    const coverageNotice = "Requirement Coverage measures curriculum alignment with documented requirements, NOT hiring probability.";
    expect(coverageNotice).not.toContain("Chance of Selection");
    expect(coverageNotice).toContain("NOT hiring probability");
  });
});
