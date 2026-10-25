import { describe, it, expect, vi, beforeEach } from "vitest";
import { GeminiClient } from "@/modules/ai/gemini-client";
import { AIStudyTutorService } from "@/modules/ai/services/ai-study-tutor-service";
import { AIQuestionIntelligenceService } from "@/modules/ai/services/ai-question-intelligence-service";
import { AIMistakeMasteryService } from "@/modules/ai/services/ai-mistake-mastery-service";
import { AIDriveFitService } from "@/modules/ai/services/ai-drivefit-service";
import { AIPlacementIntelligenceService } from "@/modules/ai/services/ai-placement-intelligence-service";

describe("AI Intelligence Services Domain Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. AI Study Tutor Service", () => {
    it("generates structured pedagogical response with follow-ups and mode handling", async () => {
      const mockGeminiResponse = {
        text: `Here is the step-by-step breakdown of QuickSort:
1. Select a pivot element.
2. Partition the array into elements less than and greater than pivot.
3. Recursively apply to subarrays.
Follow-up: How does worst-case time complexity O(N^2) occur?
Follow-up: What is the benefit of randomized pivot selection?`,
        promptTokens: 120,
        completionTokens: 80,
        totalTokens: 200,
        durationMs: 450,
        model: "gemini-2.5-flash-lite",
      };

      vi.spyOn(GeminiClient, "generate").mockResolvedValueOnce(mockGeminiResponse);

      const result = await AIStudyTutorService.chat({
        userId: "test-student-id",
        message: "Explain QuickSort step-by-step",
        mode: "EXPLAIN",
      });

      expect(result.response).toContain("QuickSort");
      expect(result.mode).toBe("EXPLAIN");
      expect(result.suggestedFollowUps?.length).toBe(2);
      expect(result.suggestedFollowUps?.[0]).toContain("worst-case");
    });
  });

  describe("2. AI Question Intelligence Service", () => {
    it("validates generated question structure and options integrity", async () => {
      const validQuestionsPayload = {
        questions: [
          {
            prompt: "What is the time complexity of searching in a balanced Binary Search Tree?",
            questionType: "SINGLE_CHOICE",
            difficulty: "MEDIUM",
            options: [
              { id: "opt-a", text: "O(1)" },
              { id: "opt-b", text: "O(log N)" },
              { id: "opt-c", text: "O(N)" },
              { id: "opt-d", text: "O(N log N)" },
            ],
            answerKey: { correctOptionId: "opt-b" },
            explanation: "In a balanced BST like an AVL tree or Red-Black tree, the height is bounded by log2(N), giving O(log N) search complexity.",
            topicTags: ["Trees", "Data Structures"],
            confidenceScore: 0.98,
          },
        ],
      };

      vi.spyOn(GeminiClient, "generate").mockResolvedValueOnce({
        text: JSON.stringify(validQuestionsPayload),
        promptTokens: 200,
        completionTokens: 150,
        totalTokens: 350,
        durationMs: 600,
        model: "gemini-2.5-flash-lite",
      });

      const drafts = await AIQuestionIntelligenceService.generateQuestions({
        tenantId: "tenant-mock-1",
        userId: "staff-mock-1",
        topic: "Binary Search Trees",
        difficulty: "MEDIUM",
        questionType: "SINGLE_CHOICE",
        count: 1,
        saveAsDraft: false,
      });

      expect(drafts.length).toBe(1);
      expect(drafts[0].question.prompt).toContain("balanced Binary Search Tree");
      expect(drafts[0].question.answerKey.correctOptionId).toBe("opt-b");
      expect(drafts[0].question.options.length).toBe(4);
    });

    it("rejects questions failing Zod validation", async () => {
      const invalidPayload = {
        questions: [
          {
            prompt: "Too short", // min length is 10
            questionType: "SINGLE_CHOICE",
          },
        ],
      };

      vi.spyOn(GeminiClient, "generate").mockResolvedValueOnce({
        text: JSON.stringify(invalidPayload),
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
        durationMs: 300,
        model: "gemini-2.5-flash-lite",
      });

      await expect(
        AIQuestionIntelligenceService.generateQuestions({
          tenantId: "tenant-mock-1",
          userId: "staff-mock-1",
          topic: "Arrays",
          difficulty: "EASY",
          questionType: "SINGLE_CHOICE",
        })
      ).rejects.toThrowError(/failed validation/);
    });
  });

  describe("3. AI Mistake-to-Mastery Service", () => {
    it("returns honest guidance when student has no recorded mistakes yet", async () => {
      const analysis = await AIMistakeMasteryService.analyzeStudentMistakes({
        userId: "non-existent-student-user-id-999",
      });

      expect(analysis.hasSufficientData).toBe(false);
      expect(analysis.totalMistakesAnalyzed).toBe(0);
      expect(analysis.summary).toContain("No recorded mistakes found");
    });
  });

  describe("4. AI Placement Intelligence Service", () => {
    it("computes readiness and anonymized insights without student PII", async () => {
      const mockInsights = {
        readinessIndex: 78,
        keyInsights: [
          {
            category: "SKILL_DEFICIENCY",
            title: "Dynamic Programming Conceptual Gap",
            description: "High error rates observed in state-transition formulation.",
            evidenceMetrics: "60% incorrect on DP questions",
            priority: "HIGH",
          },
        ],
        recommendedInterventions: [
          {
            title: "DP Intensive Workshop",
            targetDomain: "Algorithms",
            format: "BOOTCAMP",
            impactPotential: "Estimated 25% score increase",
          },
        ],
      };

      vi.spyOn(GeminiClient, "generate").mockResolvedValueOnce({
        text: JSON.stringify(mockInsights),
        promptTokens: 300,
        completionTokens: 200,
        totalTokens: 500,
        durationMs: 800,
        model: "gemini-2.5-flash-lite",
      });

      const report = await AIPlacementIntelligenceService.generateCohortInsights({
        tenantId: "tenant-test-id",
        userId: "staff-test-id",
        cohortMetricsOverride: {
          totalStudents: 150,
          activeDrivesCount: 4,
          commonMistakes: [{ category: "ALGORITHMS", count: 25 }],
        },
      });

      expect(report.cohortSummary.readinessIndex).toBe(78);
      expect(report.keyInsights.length).toBe(1);
      expect(report.keyInsights[0].title).toBe("Dynamic Programming Conceptual Gap");
      expect(report.recommendedInterventions[0].format).toBe("BOOTCAMP");
    });
  });
});
