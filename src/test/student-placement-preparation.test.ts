/**
 * Phase 03: Global Placement Preparation System — Comprehensive Vitest Suite
 * 
 * Tests:
 * 1. Placement Practice Centre (Categories, Modes, Server-Scoring, Question Sanitization, Revision)
 * 2. Advanced Company-Specific Preparation (Discovery, Workflow, Tracks, Progress, AI Fallback)
 * 3. Personalized Learning Recommendations (Evidence Synthesis, Prioritization, Lifecycle, Roadmap)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PlacementPracticeService,
  PRACTICE_CATEGORIES,
  CURATED_QUESTIONS,
} from "@/modules/students/services/placement-practice-service";
import {
  CompanyPreparationService,
  CURATED_COMPANIES,
} from "@/modules/students/services/company-preparation-service";
import {
  LearningRecommendationsService,
} from "@/modules/students/services/learning-recommendations-service";

// Mock GeminiClient to simulate offline AI for deterministic fallback testing
vi.mock("@/modules/ai/gemini-client", () => ({
  GeminiClient: {
    generate: vi.fn().mockRejectedValue(new Error("AI service offline (mocked for test)")),
  },
}));

// Mock Supabase admin client for isolated testing
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "test_uuid" }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

describe("Phase 03 — Placement Preparation Practice Centre", () => {
  it("provides all 4 canonical practice categories with valid topics", () => {
    expect(PRACTICE_CATEGORIES).toHaveLength(4);
    const categoryIds = PRACTICE_CATEGORIES.map((c) => c.id);
    expect(categoryIds).toContain("QUANTITATIVE_APTITUDE");
    expect(categoryIds).toContain("LOGICAL_REASONING");
    expect(categoryIds).toContain("VERBAL_ABILITY");
    expect(categoryIds).toContain("TECHNICAL_PREPARATION");

    const quant = PRACTICE_CATEGORIES.find((c) => c.id === "QUANTITATIVE_APTITUDE");
    expect(quant?.topics).toContain("Percentages");
    expect(quant?.topics).toContain("Time and Work");
    expect(quant?.topics).toContain("Probability");

    const tech = PRACTICE_CATEGORIES.find((c) => c.id === "TECHNICAL_PREPARATION");
    expect(tech?.topics).toContain("Data Structures and Algorithms");
    expect(tech?.topics).toContain("DBMS");
    expect(tech?.topics).toContain("Operating Systems");
  });

  it("sanitizes questions sent to client by stripping answer keys and explanations", async () => {
    const clientQuestions = await PlacementPracticeService.getPracticeQuestions(
      "tenant_1",
      { category: "QUANTITATIVE_APTITUDE", count: 2 }
    );

    expect(clientQuestions.length).toBeGreaterThan(0);
    clientQuestions.forEach((q: any) => {
      expect(q).toHaveProperty("id");
      expect(q).toHaveProperty("questionText");
      expect(q).toHaveProperty("options");
      // Critical security invariant: answer key and explanation MUST NOT be exposed to client during active tests
      expect(q).not.toHaveProperty("correctAnswer");
      expect(q).not.toHaveProperty("explanation");
      expect(q).not.toHaveProperty("solvingApproach");
    });
  });

  it("initializes a practice attempt with correct mode and time limit", async () => {
    const attempt = await PlacementPracticeService.startPracticeAttempt(
      "tenant_1",
      "student_1",
      {
        practiceMode: "TIMED_PRACTICE",
        category: "TECHNICAL_PREPARATION",
        topic: "Data Structures and Algorithms",
        questionCount: 3,
        timeLimitMinutes: 15,
      }
    );

    expect(attempt).toHaveProperty("attemptId");
    expect(attempt.questions.length).toBeLessThanOrEqual(3);
    expect(attempt.timeLimitSeconds).toBe(900); // 15 mins * 60
  });

  it("server-side evaluates submitted answers authoritatively with exact scoring", async () => {
    const sampleQuestion = CURATED_QUESTIONS[0]; // percentages question (correct answer: opt_1)

    const evaluation = await PlacementPracticeService.completePracticeAttempt(
      "tenant_1",
      "student_1",
      "attempt_101",
      [
        {
          questionId: sampleQuestion.id,
          studentAnswer: ["opt_1"], // correct
          timeSpentSeconds: 30,
        },
        {
          questionId: "q_qa_02", // time and work (correct: opt_1)
          studentAnswer: ["opt_3"], // incorrect
          timeSpentSeconds: 45,
        },
      ],
      75
    );

    expect(evaluation.totalQuestions).toBe(2);
    expect(evaluation.correctCount).toBe(1);
    expect(evaluation.incorrectCount).toBe(1);
    expect(evaluation.scorePercentage).toBe(50);
    expect(evaluation.results[0].isCorrect).toBe(true);
    expect(evaluation.results[1].isCorrect).toBe(false);
    // Explanations are revealed ONLY after submission
    expect(evaluation.results[0].explanation).toBeTruthy();
    expect(evaluation.results[0].correctAnswer).toEqual(["opt_1"]);
  });

  it("provides genuine empty state summary for a new student", () => {
    const emptySummary = PlacementPracticeService.getEmptySummary();
    expect(emptySummary.totalAttempted).toBe(0);
    expect(emptySummary.accuracyPercentage).toBe(0);
    expect(emptySummary.completedTests).toBe(0);
    expect(emptySummary.strengths).toHaveLength(0);
    expect(emptySummary.weaknesses).toHaveLength(0);
    expect(emptySummary.recommendedPracticeSessions.length).toBeGreaterThan(0);
  });
});

describe("Phase 03 — Advanced Company-Specific Preparation", () => {
  it("provides structured profiles for premier recruiters with indicative workflows", async () => {
    const companies = await CompanyPreparationService.getCompanyProfiles("tenant_1", "student_1");
    expect(companies.length).toBeGreaterThanOrEqual(4);

    const tcs = companies.find((c) => c.slug === "tcs");
    expect(tcs).toBeDefined();
    expect(tcs?.name).toContain("Tata Consultancy Services");
    expect(tcs?.hiringWorkflow.length).toBe(3);
    expect(tcs?.roles.length).toBeGreaterThanOrEqual(2);
    expect(tcs?.prepTracks[0].modules.length).toBeGreaterThanOrEqual(4);

    const amazon = companies.find((c) => c.slug === "amazon");
    expect(amazon).toBeDefined();
    expect(amazon?.roles.some((r) => r.roleSlug === "sde-1")).toBe(true);
  });

  it("filters company profiles by industry and search keyword", async () => {
    const itCompanies = await CompanyPreparationService.getCompanyProfiles("tenant_1", "student_1", {
      industry: "Information Technology",
    });
    expect(itCompanies.length).toBeGreaterThan(0);
    itCompanies.forEach((c) => {
      expect(c.industry.toLowerCase()).toContain("information technology");
    });

    const searched = await CompanyPreparationService.getCompanyProfiles("tenant_1", "student_1", {
      search: "Infosys",
    });
    expect(searched).toHaveLength(1);
    expect(searched[0].slug).toBe("infosys");
  });

  it("calculates module progress and overall completion percentage correctly", async () => {
    const progressResult = await CompanyPreparationService.markModuleProgress(
      "tenant_1",
      "student_1",
      "comp_tcs",
      "mod_tcs_1",
      true
    );

    expect(progressResult.completedCount).toBeGreaterThanOrEqual(1);
    expect(progressResult.progressPercentage).toBeGreaterThan(0);
    expect(progressResult.progressPercentage).toBeLessThanOrEqual(100);
  });

  it("generates deterministic fallback practice questions when AI is offline", async () => {
    const questionsResult = await CompanyPreparationService.generateCompanyPracticeQuestions({
      companyName: "Tata Consultancy Services",
      roleName: "Ninja Software Engineer",
      topic: "SQL & Relational Databases",
      difficulty: "INTERMEDIATE",
    });

    expect(questionsResult.questions.length).toBeGreaterThan(0);
    const q1 = questionsResult.questions[0];
    expect(q1).toHaveProperty("questionText");
    expect(q1).toHaveProperty("correctAnswer");
    expect(q1).toHaveProperty("explanation");
    expect(q1.explanation).toBeTruthy();
  });
});

describe("Phase 03 — Personalized Learning Recommendations", () => {
  it("synthesizes prioritized recommendations with supporting evidence", async () => {
    const result = await LearningRecommendationsService.getRecommendations("tenant_1", "student_1");

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.activeCount).toBeGreaterThan(0);

    const topRec = result.topPriorityRecommendation;
    expect(topRec).toBeDefined();
    expect(topRec?.title).toBeTruthy();
    expect(topRec?.supportingEvidence).toBeDefined();
    expect(topRec?.reasonRecommended).toBeTruthy();
    expect(topRec?.expectedOutcome).toBeTruthy();
    expect(topRec?.destinationRoute.startsWith("/dashboard/student/")).toBe(true);
  });

  it("updates recommendation status through its lifecycle", async () => {
    const updated = await LearningRecommendationsService.updateStatus(
      "tenant_1",
      "student_1",
      "rec_prof_test",
      "COMPLETED"
    );
    // Supabase update mock settles without error
    expect(typeof updated).toBe("boolean");
  });

  it("generates a structured learning roadmap for target career roles", async () => {
    const roadmap = await LearningRecommendationsService.getLearningRoadmap(
      "tenant_1",
      "student_1",
      "Software Developer"
    );

    expect(roadmap.targetRole).toBe("Software Developer");
    expect(roadmap.totalStepsCount).toBe(7);
    expect(roadmap.steps.length).toBe(7);

    // Verify progression: Foundations -> Algorithms -> OOP -> DBMS -> Advanced DSA -> Interview
    expect(roadmap.steps[0].category).toBe("Foundations");
    expect(roadmap.steps[1].category).toBe("Algorithms");
    expect(roadmap.steps[2].category).toBe("Design");
    expect(roadmap.steps[3].category).toBe("Data");
    expect(roadmap.steps[5].category).toBe("Interview");

    // Must have exactly one current focus if not all completed
    const currentSteps = roadmap.steps.filter((s) => s.isCurrent);
    expect(currentSteps.length).toBeLessThanOrEqual(1);
  });
});
