import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import { AIQuestionIntelligenceService } from "@/modules/ai/services/ai-question-intelligence-service";
import { GeminiClient } from "@/modules/ai/gemini-client";
import { POST as generateRoute } from "@/app/api/ai/questions/generate/route";
import * as ServerContextModule from "@/lib/auth/server-context";
import * as SupabaseAdminModule from "@/lib/supabase/admin";
import * as SupabaseServerModule from "@/lib/supabase/server";
import { AIGenerateQuestionModal } from "@/components/questions/ai-generate-question-modal";
import { AnswerKeyReviewModal } from "@/components/questions/answer-key-review-modal";
import { DuplicateDetector } from "@/modules/question-bank/services/duplicate-detector";

describe("UrPlaced — AI Question Generation & Quantity Numeric Input Suite", () => {
  const tenantA = "tenant-a-1111-1111";
  const userId = "user-placement-head";
  const bankId = "bank-dsa-1111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Complete Question Content & Schema Validation", () => {
    it("generates complete questions with prompt, options, answer key, explanation and SHA-256 fingerprint", async () => {
      const mockGeminiResponse = {
        questions: [
          {
            prompt: "What is the worst-case time complexity of QuickSort with standard median pivot?",
            questionType: "SINGLE_CHOICE",
            difficulty: "MEDIUM",
            options: [
              { id: "opt-a", text: "O(N log N)" },
              { id: "opt-b", text: "O(N^2)" },
              { id: "opt-c", text: "O(N)" },
              { id: "opt-d", text: "O(log N)" },
            ],
            answerKey: { correctOptionId: "opt-b" },
            explanation: "When partitions are maximally unbalanced, QuickSort degrades to quadratic O(N^2).",
            topicTags: ["quicksort", "algorithms"],
            confidenceScore: 0.95,
          },
        ],
      };

      vi.spyOn(GeminiClient, "generate").mockResolvedValueOnce({
        text: JSON.stringify(mockGeminiResponse),
        promptTokens: 100,
        completionTokens: 80,
        totalTokens: 180,
        durationMs: 250,
        model: "gemini-2.5-flash-lite",
      });

      const mockInsertedQuestions: any[] = [];
      const mockInsertedVersions: any[] = [];
      const mockUpdates: any[] = [];

      const mockAdmin = {
        from: vi.fn((table: string) => {
          if (table === "question_versions") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              insert: vi.fn((vData: any) => {
                mockInsertedVersions.push(vData);
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: "version-uuid-1", ...vData },
                      error: null,
                    }),
                  }),
                };
              }),
            };
          }
          if (table === "questions") {
            return {
              insert: vi.fn((qData: any) => {
                mockInsertedQuestions.push(qData);
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { id: "question-uuid-1", ...qData },
                      error: null,
                    }),
                  }),
                };
              }),
              update: vi.fn((upData: any) => {
                mockUpdates.push(upData);
                return {
                  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
                };
              }),
              delete: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
            };
          }
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }),
      };

      vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockAdmin as any);

      const results = await AIQuestionIntelligenceService.generateQuestions({
        tenantId: tenantA,
        userId,
        bankId,
        topic: "Sorting Algorithms",
        difficulty: "MEDIUM",
        questionType: "SINGLE_CHOICE",
        count: 1,
        saveAsDraft: true,
      });

      expect(results).toHaveLength(1);
      const res = results[0];
      expect(res.isSavedAsDraft).toBe(true);
      expect(res.questionId).toBe("question-uuid-1");
      expect(res.versionId).toBe("version-uuid-1");
      expect(res.question.prompt).toContain("QuickSort");

      // Verify complete version record in DB was provided with required fingerprint
      expect(mockInsertedVersions).toHaveLength(1);
      const savedVersion = mockInsertedVersions[0];
      expect(savedVersion.fingerprint).toBeDefined();
      expect(savedVersion.fingerprint).toHaveLength(64);
      expect(savedVersion.source_type).toBe("AI_GENERATED");
      expect(savedVersion.review_status).toBe("UNREVIEWED");
      expect(savedVersion.prompt).toBe(mockGeminiResponse.questions[0].prompt);

      // Verify circular pointer linked
      expect(mockUpdates).toContainEqual({ current_version_id: "version-uuid-1" });
    });

    it("rolls back orphaned question container if question_versions persistence fails", async () => {
      const mockGeminiResponse = {
        questions: [
          {
            prompt: "What is an AVL Tree balance factor range?",
            questionType: "SINGLE_CHOICE",
            difficulty: "EASY",
            options: [
              { id: "opt-a", text: "-1, 0, +1" },
              { id: "opt-b", text: "-2 to +2" },
              { id: "opt-c", text: "0 only" },
              { id: "opt-d", text: "Any positive integer" },
            ],
            answerKey: { correctOptionId: "opt-a" },
            explanation: "AVL trees strictly maintain balance factor in {-1, 0, 1}.",
            topicTags: ["trees"],
            confidenceScore: 0.95,
          },
        ],
      };

      vi.spyOn(GeminiClient, "generate").mockResolvedValueOnce({
        text: JSON.stringify(mockGeminiResponse),
        promptTokens: 100,
        completionTokens: 80,
        totalTokens: 180,
        durationMs: 200,
        model: "gemini-2.5-flash-lite",
      });

      let questionDeleted = false;
      const mockAdmin = {
        from: vi.fn((table: string) => {
          if (table === "question_versions") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              limit: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              insert: vi.fn(() => ({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Database version constraint error" },
                  }),
                }),
              })),
            };
          }
          if (table === "questions") {
            return {
              insert: vi.fn(() => ({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "orphaned-q-id" },
                    error: null,
                  }),
                }),
              })),
              delete: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => {
                    questionDeleted = true;
                    return Promise.resolve({ error: null });
                  }),
                })),
              })),
            };
          }
          return {};
        }),
      };

      vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockAdmin as any);

      const results = await AIQuestionIntelligenceService.generateQuestions({
        tenantId: tenantA,
        userId,
        bankId,
        topic: "Binary Search Trees",
        difficulty: "EASY",
        questionType: "SINGLE_CHOICE",
        count: 1,
        saveAsDraft: true,
      });

      expect(results).toHaveLength(1);
      expect(results[0].isSavedAsDraft).toBe(false);
      expect(results[0].versionId).toBeUndefined();
      expect(questionDeleted).toBe(true);
    });
  });

  describe("2. Numeric Quantity Input & Configurable Max Bounds", () => {
    it("backend route accepts valid count within bounds (e.g. count = 10)", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue({
        tenantId: tenantA,
        userId,
        tenantRole: "PLACEMENT_HEAD",
        permissions: ["ai:questions:generate"],
        accountCategory: "COLLEGE",
        isAuthenticated: true,
        isLoading: false,
        user: null,
        profile: null,
        tenant: null,
        availableTenants: [],
        session: null,
        isPlatformAdmin: false,
        hasPermission: () => true,
        hasRole: () => true,
        switchTenant: async () => {},
        signOut: async () => {},
      } as any);

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue({
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { id: bankId, tenant_id: tenantA, name: "DSA", category: "TECH" },
            error: null,
          }),
        })),
      } as any);

      const mockGenerateSpy = vi.spyOn(AIQuestionIntelligenceService, "generateQuestions").mockResolvedValueOnce([
        {
          question: {
            prompt: "Test Question",
            questionType: "SINGLE_CHOICE",
            difficulty: "MEDIUM",
            options: [],
            answerKey: {},
            explanation: "Explanation",
            topicTags: [],
            confidenceScore: 0.95,
          },
          isSavedAsDraft: true,
        },
      ]);

      const req = new NextRequest("http://localhost:3000/api/ai/questions/generate", {
        method: "POST",
        body: JSON.stringify({
          topic: "Dynamic Programming",
          difficulty: "HARD",
          questionType: "CODING",
          count: 10,
          bankId,
          saveAsDraft: true,
        }),
      });

      const res = await generateRoute(req);
      expect(res.status).toBe(200);
      expect(mockGenerateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 10,
          topic: "Dynamic Programming",
        })
      );
    });

    it("backend route rejects invalid counts: 0, negative, decimals, and > 20", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue({
        tenantId: tenantA,
        userId,
        tenantRole: "PLACEMENT_HEAD",
        permissions: ["ai:questions:generate"],
      } as any);

      const invalidCounts = [0, -5, 2.5, 25, "abc"];

      for (const invalidCount of invalidCounts) {
        const req = new NextRequest("http://localhost:3000/api/ai/questions/generate", {
          method: "POST",
          body: JSON.stringify({
            topic: "Operating Systems",
            difficulty: "MEDIUM",
            questionType: "SINGLE_CHOICE",
            count: invalidCount,
          }),
        });

        const res = await generateRoute(req);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toMatch(/between 1 and 20/i);
      }
    });

    it("splits requests > 5 into bounded sub-batches of <= 5 to protect token quality", async () => {
      const generatedBatchOf5 = Array.from({ length: 5 }, (_, i) => ({
        prompt: `Question #${i + 1} on Graph Theory with long derivation details`,
        questionType: "SINGLE_CHOICE" as const,
        difficulty: "MEDIUM" as const,
        options: [
          { id: "opt-a", text: "Answer A" },
          { id: "opt-b", text: "Answer B" },
          { id: "opt-c", text: "Answer C" },
          { id: "opt-d", text: "Answer D" },
        ],
        answerKey: { correctOptionId: "opt-a" },
        explanation: `Step-by-step mathematical proof for Question #${i + 1}`,
        topicTags: ["graph"],
        confidenceScore: 0.95,
      }));

      const geminiSpy = vi.spyOn(GeminiClient, "generate").mockImplementation(async () => ({
        text: JSON.stringify({ questions: generatedBatchOf5 }),
        promptTokens: 150,
        completionTokens: 250,
        totalTokens: 400,
        durationMs: 300,
        model: "gemini-2.5-flash-lite",
      }));

      const mockAdmin = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        })),
      };
      vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockAdmin as any);

      // Request 10 questions -> should trigger exactly 2 sub-batches of 5
      const results = await AIQuestionIntelligenceService.generateQuestions({
        tenantId: tenantA,
        userId,
        topic: "Graph Theory",
        difficulty: "MEDIUM",
        questionType: "SINGLE_CHOICE",
        count: 10,
        saveAsDraft: false,
      });

      expect(geminiSpy).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(10);
    });
  });

  describe("3. Frontend UI Component Verification", () => {
    it("renders numeric input for question quantity and allows typing custom count > 3", () => {
      const mockBanks = [{ id: "bank-1", name: "Core Java", category: "CODING" }];

      render(
        <AIGenerateQuestionModal
          isOpen={true}
          onClose={() => {}}
          banks={mockBanks}
        />
      );

      // Verify the old dropdown is completely absent
      const selects = screen.queryAllByRole("combobox");
      const quantitySelect = selects.find((s) => s.innerHTML.includes("1 Question"));
      expect(quantitySelect).toBeUndefined();

      // Verify numeric input exists with label
      const countInput = screen.getByLabelText(/Number of Questions/i) as HTMLInputElement;
      expect(countInput).toBeInTheDocument();
      expect(countInput.type).toBe("number");
      expect(countInput.value).toBe("3"); // Default value

      // Type a larger number (e.g. 10)
      fireEvent.change(countInput, { target: { value: "10" } });
      expect(countInput.value).toBe("10");

      // Validate bounds message when entering invalid numbers
      fireEvent.change(countInput, { target: { value: "0" } });
      expect(screen.getByText(/Minimum quantity is 1 question/i)).toBeInTheDocument();

      fireEvent.change(countInput, { target: { value: "25" } });
      expect(screen.getByText(/Maximum quantity is 20 questions/i)).toBeInTheDocument();
    });

    it("renders complete question content and highlights correct option in Review & Verify Answer Key Modal", () => {
      const testQuestion = {
        prompt: "What is the maximum number of nodes at level L in a binary tree?",
        questionType: "SINGLE_CHOICE" as const,
        difficulty: "MEDIUM",
        options: [
          { id: "opt-a", text: "2^L" },
          { id: "opt-b", text: "2^(L - 1)" },
          { id: "opt-c", text: "2^(L + 1)" },
          { id: "opt-d", text: "L^2" },
        ],
        answerKey: { correctOptionId: "opt-a" }, // AI generated camelCase format
        explanation: "At level 0 (root), max nodes = 2^0 = 1. At level L, max nodes = 2^L.",
        sourceType: "AI_GENERATED",
      };

      render(
        <AnswerKeyReviewModal
          isOpen={true}
          questionId="q-uuid-test"
          versionId="v-uuid-test"
          currentStatus="UNREVIEWED"
          question={testQuestion}
          onClose={() => {}}
          onSuccess={() => {}}
        />
      );

      // Verify prompt is rendered, NOT "No prompt provided"
      expect(screen.getByText(testQuestion.prompt)).toBeInTheDocument();
      expect(screen.queryByText("No prompt provided.")).toBeNull();

      // Verify options are rendered
      expect(screen.getByText("2^L")).toBeInTheDocument();
      expect(screen.getByText("2^(L - 1)")).toBeInTheDocument();

      // Verify correct key is highlighted
      expect(screen.getByText("Correct Key")).toBeInTheDocument();

      // Verify explanation is displayed
      expect(screen.getByText(/At level 0 \(root\)/i)).toBeInTheDocument();

      // Verify AI Generated badge is shown
      expect(screen.getByText("AI Generated")).toBeInTheDocument();
    });
  });
});
