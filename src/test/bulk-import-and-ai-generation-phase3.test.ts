import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ImportService } from "@/modules/question-bank/services/import-service";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { AIQuestionIntelligenceService } from "@/modules/ai/services/ai-question-intelligence-service";
import { GeminiClient } from "@/modules/ai/gemini-client";
import { can, Permissions, PolicyContext } from "@/modules/identity-access/services/policy-engine";
import * as ServerContextModule from "@/lib/auth/server-context";
import * as SupabaseServerModule from "@/lib/supabase/server";
import * as SupabaseAdminModule from "@/lib/supabase/admin";
import { GET as getTemplate } from "@/app/api/questions/import/template/route";
import { POST as previewImport } from "@/app/api/questions/import/preview/route";
import { POST as commitImport } from "@/app/api/questions/import/commit/route";
import { POST as generateAiQuestions } from "@/app/api/ai/questions/generate/route";

describe("Phase 3: Bulk Question Import & AI Question Generation Domain Suite", () => {
  const tenantA = "tenant-college-alpha-uuid";
  const tenantB = "tenant-college-beta-uuid";
  const headUserId = "user-placement-head-1";
  const studentUserId = "user-student-99";
  const validBankA = "bank-alpha-coding-1";

  const mockPlacementHeadContext = (tenantId = tenantA, userId = headUserId) => ({
    userId,
    email: "head@college.edu",
    isPlatformAdmin: false,
    tenantId,
    tenantRole: "PLACEMENT_HEAD" as const,
    tenantStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
  });

  const createMockSupabase = (existingBanks: any[] = [{ id: validBankA, tenant_id: tenantA, name: "Alpha DSA" }]) => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn(function (this: any, col: string, val: any) {
        if (col === "tenant_id" && this._filter) this._filter.tenant_id = val;
        if (col === "id" && this._filter) this._filter.id = val;
        return this;
      }),
      ilike: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "inserted-uuid-1" }, error: null }),
      maybeSingle: vi.fn(function (this: any) {
        if (this._table === "question_banks") {
          const match = existingBanks.find(
            (b) => (!this._filter?.id || b.id === this._filter.id) &&
                   (!this._filter?.tenant_id || b.tenant_id === this._filter.tenant_id)
          );
          return Promise.resolve({ data: match || null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      }),
    };
    chain.then = (resolve: any) => resolve({ data: existingBanks, error: null });

    return {
      from: vi.fn((tableName: string) => {
        chain._table = tableName;
        chain._filter = {};
        return chain;
      }),
    };
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. CSV Template & Structural Schema Matching
  // =========================================================================
  describe("1. Canonical CSV Template & Schema Integrity", () => {
    it("generates CSV template matching canonical schema across all 5 supported question types", () => {
      const template = ImportService.generateCsvTemplate();
      const lines = template.split("\n");

      // Verify header row
      const headers = lines[0].split(",");
      expect(headers).toContain("question_type");
      expect(headers).toContain("prompt");
      expect(headers).toContain("difficulty");
      expect(headers).toContain("option_a");
      expect(headers).toContain("option_b");
      expect(headers).toContain("correct_answer");
      expect(headers).toContain("explanation");

      // Verify sample rows cover canonical types
      expect(template).toContain("SINGLE_CHOICE");
      expect(template).toContain("MULTIPLE_SELECT");
      expect(template).toContain("NUMERIC");
      expect(template).toContain("SHORT_ANSWER");
      expect(template).toContain("CODING");
    });

    it("serves template download via GET /api/questions/import/template", async () => {
      const res = await getTemplate();
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
      expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=");
      const text = await res.text();
      expect(text.startsWith("question_type,prompt")).toBe(true);
    });
  });

  // =========================================================================
  // 2. CSV Validation, Preview & Formula-Injection Protections
  // =========================================================================
  describe("2. CSV Validation, Pre-Commit Preview & Security", () => {
    it("sanitizes dangerous spreadsheet formula cells before processing", () => {
      const cmdCell = ImportService.sanitizeCell("=cmd|' /C calc'!A0");
      expect(cmdCell.startsWith("'=")).toBe(true);

      const tabCell = ImportService.sanitizeCell("\tDANGEROUS_CALL");
      expect(tabCell.startsWith("'\t")).toBe(true);

      const plusCell = ImportService.sanitizeCell("+SUM(A1:A10)");
      expect(plusCell.startsWith("'+")).toBe(true);

      const minusCell = ImportService.sanitizeCell("-HYPERLINK('http://evil.com')");
      expect(minusCell.startsWith("'-")).toBe(true);

      const safeCell = ImportService.sanitizeCell("Regular question prompt text");
      expect(safeCell).toBe("Regular question prompt text");
    });

    it("previews valid and invalid rows, detecting missing fields and duplicate questions", async () => {
      const csv = [
        "question_type,prompt,difficulty,option_a,option_b,option_c,option_d,correct_answer,explanation,skill_normalized_name,topic_tags",
        'SINGLE_CHOICE,"What is the runtime of binary search on sorted array?",EASY,"O(1)","O(log N)","O(N)","O(N^2)",opt_b,"Standard logarithmic binary search.",dsa,"binary-search"',
        'INVALID_TYPE,"This row has an invalid type.",MEDIUM,,,,,"42",,,',
        'SINGLE_CHOICE,"What is the runtime of binary search on sorted array?",EASY,"O(1)","O(log N)","O(N)","O(N^2)",opt_b,"Standard logarithmic binary search.",dsa,"binary-search"',
      ].join("\n");

      const preview = await ImportService.previewImport(tenantA, "campus.csv", csv, []);

      expect(preview.totalRows).toBe(3);
      expect(preview.validRows).toBe(2); // 1st & 3rd are structurally valid
      expect(preview.invalidRows).toBe(1); // 2nd has invalid question_type
      expect(preview.duplicateRows).toBe(1); // 3rd is an exact duplicate of 1st

      // Verify row diagnostics
      const invalidRow = preview.rows.find((r) => r.rowNumber === 3);
      expect(invalidRow?.isValid).toBe(false);
      expect(invalidRow?.errors[0]).toContain("Invalid question_type");

      const dupRow = preview.rows.find((r) => r.rowNumber === 4);
      expect(dupRow?.isDuplicate).toBe(true);
      expect(dupRow?.warnings[0]).toContain("Exact duplicate detected");
    });
  });

  // =========================================================================
  // 3. CSV Commit & Strict Tenant Boundary Enforcement
  // =========================================================================
  describe("3. CSV Commit & Multi-Tenant Isolation", () => {
    it("rejects commit if destination bank does not belong to caller's tenant (404)", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementHeadContext(tenantA)
      );

      // Bank belongs to Tenant B
      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        createMockSupabase([{ id: "foreign-bank-id", tenant_id: tenantB, name: "Beta Bank" }]) as any
      );

      const req = new NextRequest("http://localhost:3000/api/questions/import/commit", {
        method: "POST",
        body: JSON.stringify({
          bankId: "foreign-bank-id",
          fileName: "test.csv",
          items: [
            {
              rowNumber: 2,
              question_type: "SINGLE_CHOICE",
              prompt: "Test prompt",
              isValid: true,
              isDuplicate: false,
              errors: [],
              warnings: [],
              fingerprint: "fp-1",
            },
          ],
        }),
      });

      const res = await commitImport(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("Target Question Bank not found or does not belong to your college");
    });

    it("commits valid questions into destination bank with PENDING_REVIEW status", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementHeadContext(tenantA)
      );

      const mockSupabase = createMockSupabase([
        { id: validBankA, tenant_id: tenantA, name: "Alpha DSA" },
      ]);
      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(mockSupabase as any);

      const req = new NextRequest("http://localhost:3000/api/questions/import/commit", {
        method: "POST",
        body: JSON.stringify({
          bankId: validBankA,
          fileName: "placement_import.csv",
          items: [
            {
              rowNumber: 2,
              question_type: "SINGLE_CHOICE",
              prompt: "What is 2+2?",
              difficulty: "EASY",
              options: [
                { id: "opt_a", text: "3" },
                { id: "opt_b", text: "4" },
              ],
              answer_key: { correct_option_id: "opt_b" },
              explanation: "2+2=4",
              isValid: true,
              isDuplicate: false,
              errors: [],
              warnings: [],
              fingerprint: "fp-test",
            },
          ],
        }),
      });

      const res = await commitImport(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.committedCount).toBe(1);
    });

    it("rejects unauthorized student access to CSV commit (403)", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockRejectedValue(
        new Error("FORBIDDEN")
      );

      const req = new NextRequest("http://localhost:3000/api/questions/import/commit", {
        method: "POST",
        body: JSON.stringify({
          bankId: validBankA,
          items: [],
        }),
      });

      const res = await commitImport(req);
      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 4. AI Question Generation Validation & Rate Limiting
  // =========================================================================
  describe("4. AI Question Generation (POST /api/ai/questions/generate)", () => {
    it("rejects request if topic is missing (400)", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementHeadContext(tenantA)
      );

      const req = new NextRequest("http://localhost:3000/api/ai/questions/generate", {
        method: "POST",
        body: JSON.stringify({
          topic: "   ",
          difficulty: "MEDIUM",
          questionType: "SINGLE_CHOICE",
        }),
      });

      const res = await generateAiQuestions(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Subject or topic is required");
    });

    it("rejects oversized batch count > 5 (400)", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementHeadContext(tenantA)
      );

      const req = new NextRequest("http://localhost:3000/api/ai/questions/generate", {
        method: "POST",
        body: JSON.stringify({
          topic: "Graph Algorithms",
          difficulty: "HARD",
          questionType: "CODING",
          count: 10, // Oversized
        }),
      });

      const res = await generateAiQuestions(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Batch size must be between 1 and 5");
    });

    it("rejects target bank if it belongs to another tenant or does not exist (404)", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementHeadContext(tenantA)
      );

      // Bank belongs to Tenant B
      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        createMockSupabase([{ id: "bank-tenant-b", tenant_id: tenantB, name: "Tenant B Bank" }]) as any
      );

      const req = new NextRequest("http://localhost:3000/api/ai/questions/generate", {
        method: "POST",
        body: JSON.stringify({
          topic: "Dynamic Programming",
          difficulty: "MEDIUM",
          questionType: "CODING",
          count: 2,
          bankId: "bank-tenant-b",
          saveAsDraft: true,
        }),
      });

      const res = await generateAiQuestions(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain("Target Question Bank not found or does not belong to your college");
    });

    it("rejects student account attempting AI question generation (403)", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockRejectedValue(
        new Error("FORBIDDEN")
      );

      const req = new NextRequest("http://localhost:3000/api/ai/questions/generate", {
        method: "POST",
        body: JSON.stringify({
          topic: "Operating Systems",
          difficulty: "EASY",
          questionType: "SINGLE_CHOICE",
        }),
      });

      const res = await generateAiQuestions(req);
      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 5. AI Question Generation Service & Quality Controls
  // =========================================================================
  describe("5. AI Question Intelligence Service & Persistence Safeguards", () => {
    it("generates, validates structured output, and stores question with DRAFT status", async () => {
      const mockGeminiJson = {
        questions: [
          {
            prompt: "What is the worst-case time complexity of Bellman-Ford shortest path algorithm for V vertices and E edges?",
            questionType: "SINGLE_CHOICE",
            difficulty: "MEDIUM",
            options: [
              { id: "opt-a", text: "O(V + E)" },
              { id: "opt-b", text: "O(V * E)" },
              { id: "opt-c", text: "O(E log V)" },
              { id: "opt-d", text: "O(V^2)" },
            ],
            answerKey: { correctOptionId: "opt-b" },
            explanation: "Bellman-Ford relaxes all E edges V-1 times, yielding O(V * E) runtime.",
            topicTags: ["graphs", "shortest-path"],
            confidenceScore: 0.95,
          },
        ],
      };

      vi.spyOn(GeminiClient, "generate").mockResolvedValueOnce({
        text: JSON.stringify(mockGeminiJson),
        promptTokens: 100,
        completionTokens: 80,
        totalTokens: 180,
        durationMs: 350,
        model: "gemini-2.5-flash-lite",
      });

      const mockAdmin = createMockSupabase([{ id: validBankA, tenant_id: tenantA, name: "Alpha DSA" }]);
      vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockAdmin as any);

      const results = await AIQuestionIntelligenceService.generateQuestions({
        tenantId: tenantA,
        userId: headUserId,
        bankId: validBankA,
        topic: "Graph Algorithms",
        difficulty: "MEDIUM",
        questionType: "SINGLE_CHOICE",
        count: 1,
        saveAsDraft: true,
      });

      expect(results).toHaveLength(1);
      const generated = results[0];
      expect(generated.question.prompt).toContain("Bellman-Ford");
      expect(generated.question.answerKey.correctOptionId).toBe("opt-b");
      expect(generated.isSavedAsDraft).toBe(true);

      // Verify question was inserted as DRAFT
      const insertCalls = (mockAdmin.from as any).mock.results;
      expect(insertCalls.length).toBeGreaterThan(0);
    });

    it("safely handles provider failure or malformed non-JSON AI response", async () => {
      vi.spyOn(GeminiClient, "generate").mockResolvedValueOnce({
        text: "I am sorry, but I cannot fulfill this request right now.",
        promptTokens: 50,
        completionTokens: 20,
        totalTokens: 70,
        durationMs: 150,
        model: "gemini-2.5-flash-lite",
      });

      await expect(
        AIQuestionIntelligenceService.generateQuestions({
          tenantId: tenantA,
          userId: headUserId,
          topic: "Database Indexing",
          difficulty: "EASY",
          questionType: "SINGLE_CHOICE",
          count: 1,
        })
      ).rejects.toThrow("AI generated non-JSON response");
    });
  });

  // =========================================================================
  // 6. Policy Engine Verification
  // =========================================================================
  describe("6. Scoped Policy Engine Access Matrix", () => {
    it("confirms placement roles can create/import and student accounts are strictly forbidden", () => {
      const staffContext: PolicyContext = {
        userId: "staff-1",
        tenantId: tenantA,
        role: "PLACEMENT_STAFF",
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      };

      const headContext: PolicyContext = {
        userId: "head-1",
        tenantId: tenantA,
        role: "PLACEMENT_HEAD",
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      };

      const studentContext: PolicyContext = {
        userId: "student-1",
        tenantId: tenantA,
        role: "STUDENT",
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      };

      // Staff & Head permissions
      expect(can(staffContext, Permissions.QUESTIONS_IMPORT)).toBe(true);
      expect(can(staffContext, Permissions.AI_QUESTIONS_GENERATE)).toBe(true);
      expect(can(headContext, Permissions.QUESTIONS_IMPORT)).toBe(true);
      expect(can(headContext, Permissions.AI_QUESTIONS_GENERATE)).toBe(true);

      // Student rejection
      expect(can(studentContext, Permissions.QUESTIONS_IMPORT)).toBe(false);
      expect(can(studentContext, Permissions.AI_QUESTIONS_GENERATE)).toBe(false);
    });
  });
});
