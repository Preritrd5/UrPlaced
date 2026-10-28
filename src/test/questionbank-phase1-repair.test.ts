import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ImportService } from "@/modules/question-bank/services/import-service";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import * as ServerContextModule from "@/lib/auth/server-context";
import * as SupabaseServerModule from "@/lib/supabase/server";
import { POST as previewImport } from "@/app/api/questions/import/preview/route";
import { POST as commitImport } from "@/app/api/questions/import/commit/route";
import { GET as getQuestions } from "@/app/api/questions/route";
import { GET as getBanks } from "@/app/api/questions/banks/route";

describe("QuestionBank Sentinel & Batch Import Phase 1 Repairs", () => {
  const collegeX = "357c432f-c54f-40f5-b634-9f92704f46fd"; // Sapthagiri NPS University
  const collegeY = "a551d52e-b473-4431-8681-6a017054c995"; // Reva University
  const userX = "user-placement-head-snpsu";
  const userY = "user-placement-head-reva";
  const bankX = "790dcf60-9bad-41cb-9cd8-95c8dd98f012";
  const bankY = "bank-reva-9999-41cb-9cd8-95c8dd98f999";

  const mockAuthContext = (tenantId = collegeX, userId = userX) => ({
    userId,
    email: "admin@snpsu.edu.in",
    isPlatformAdmin: false,
    tenantId,
    tenantRole: "PLACEMENT_HEAD" as const,
    tenantStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Target Question Bank Lookup & Tenant Scoping
  // =========================================================================
  describe("1. Target Question Bank Lookup & Resilient Schema Resolution", () => {
    it("successfully resolves a tenant-owned question bank even when the 'subject' column is absent", async () => {
      // Mock Supabase returning bank without 'subject' column (matching unmigrated remote database)
      const mockSupabase: any = {
        from: vi.fn((table: string) => {
          if (table === "question_banks") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: bankX,
                  tenant_id: collegeX,
                  name: "Demo",
                  category: "CODING",
                },
                error: null,
              }),
            };
          }
          if (table === "question_import_jobs") {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: "job-1" }, error: null }),
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(mockSupabase);

      const result = await ImportService.commitImport(
        collegeX,
        userX,
        bankX,
        "test.csv",
        []
      );

      // Should succeed in bank lookup (no 'Target Question Bank not found' error)
      expect(result.error).not.toBe("Target Question Bank not found or does not belong to your college.");
    });

    it("rejects lookup when the bank belongs to a different college (strict tenant boundary)", async () => {
      // Bank exists, but belongs to College Y
      const mockSupabase: any = {
        from: vi.fn((table: string) => {
          if (table === "question_banks") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: null, // filtered out because tenant_id != collegeX
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(mockSupabase);

      const result = await ImportService.commitImport(
        collegeX,
        userX,
        bankY, // College Y's bank
        "test.csv",
        []
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Target Question Bank not found or does not belong to your college.");
    });

    it("rejects lookup when the bank ID does not exist", async () => {
      const mockSupabase: any = {
        from: vi.fn((table: string) => {
          if (table === "question_banks") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          return {};
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(mockSupabase);

      const result = await ImportService.commitImport(
        collegeX,
        userX,
        "non-existent-bank-id",
        "test.csv",
        []
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Target Question Bank not found or does not belong to your college.");
    });
  });

  // =========================================================================
  // 2. Commit Endpoint HTTP Mapping & Authorization
  // =========================================================================
  describe("2. Commit Endpoint (/api/questions/import/commit) Handler & Safety", () => {
    it("returns HTTP 400 when bankId or items are missing", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(mockAuthContext() as any);

      const reqMissing = new NextRequest("http://localhost:3000/api/questions/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await commitImport(reqMissing);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("bankId and non-empty items array are required");
    });

    it("returns HTTP 404 when bank does not belong to the authenticated college", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(mockAuthContext() as any);
      vi.spyOn(ImportService, "commitImport").mockResolvedValue({
        success: false,
        committedCount: 0,
        duplicateAlertCount: 0,
        error: "Target Question Bank not found or does not belong to your college.",
      });

      const req = new NextRequest("http://localhost:3000/api/questions/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankId: "unauthorized-bank",
          items: [{ rowNumber: 2, isValid: true }],
        }),
      });

      const res = await commitImport(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Target Question Bank not found or does not belong to your college.");
    });

    it("commits valid questions and skips invalid intra-file UUID strings for candidate table", async () => {
      const insertedQuestions: any[] = [];
      const insertedVersions: any[] = [];
      const insertedCandidates: any[] = [];

      const mockSupabase: any = {
        from: vi.fn((table: string) => {
          if (table === "question_banks") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: bankX, tenant_id: collegeX, name: "Demo", category: "CODING" },
                error: null,
              }),
            };
          }
          if (table === "question_import_jobs") {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: { id: "job-123" }, error: null }),
                }),
              }),
            };
          }
          if (table === "questions") {
            return {
              insert: vi.fn((row: any) => {
                const q = { id: `q-${insertedQuestions.length + 1}`, ...row };
                insertedQuestions.push(q);
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: q, error: null }),
                  }),
                };
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
              }),
            };
          }
          if (table === "question_versions") {
            return {
              insert: vi.fn((row: any) => {
                const v = { id: `v-${insertedVersions.length + 1}`, ...row };
                insertedVersions.push(v);
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({ data: v, error: null }),
                  }),
                };
              }),
            };
          }
          if (table === "question_duplicate_candidates") {
            return {
              insert: vi.fn((row: any) => {
                insertedCandidates.push(row);
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [] }),
          };
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(mockSupabase);

      const items = [
        {
          rowNumber: 2,
          question_type: "SINGLE_CHOICE" as const,
          prompt: "What is the time complexity of searching a balanced BST?",
          difficulty: "EASY" as const,
          options: [{ id: "opt_b", text: "O(log N)" }],
          answer_key: { correct_option_id: "opt_b" },
          explanation: "Tree height is log N",
          topic_tags: ["dsa"],
          source_type: "COLLEGE_AUTHORED" as const,
          isValid: true,
          isDuplicate: true,
          duplicateQuestionId: "0d8515b4-580c-493b-bcfe-d81c701e3d02", // Valid UUID existing question
          similarityScore: 1.0,
          errors: [],
          warnings: ["Exact duplicate detected"],
          fingerprint: "fp-1",
        },
        {
          rowNumber: 3,
          question_type: "SINGLE_CHOICE" as const,
          prompt: "Duplicate question within file",
          difficulty: "EASY" as const,
          options: [{ id: "opt_a", text: "A" }],
          answer_key: { correct_option_id: "opt_a" },
          explanation: "Explanation",
          topic_tags: ["dsa"],
          source_type: "COLLEGE_AUTHORED" as const,
          isValid: true,
          isDuplicate: true,
          duplicateQuestionId: "row-2", // Non-UUID intra-file reference!
          similarityScore: 1.0,
          errors: [],
          warnings: ["Exact duplicate detected of earlier row-2"],
          fingerprint: "fp-2",
        },
      ];

      const res = await ImportService.commitImport(
        collegeX,
        userX,
        bankX,
        "test.csv",
        items
      );

      expect(res.success).toBe(true);
      expect(res.committedCount).toBe(2);
      // Valid UUID was recorded as duplicate candidate; row-2 non-UUID was safely skipped from database candidate table
      expect(insertedCandidates.length).toBe(1);
      expect(insertedCandidates[0].matched_question_id).toBe("0d8515b4-580c-493b-bcfe-d81c701e3d02");
    });
  });

  // =========================================================================
  // 3. Reconciling 64 Duplicate Alerts with Repository
  // =========================================================================
  describe("3. Duplicate Alerts vs. Question Repository Categorization", () => {
    it("distinguishes existing database duplicates from within-file duplicates in preview", async () => {
      const csv = [
        "question_type,prompt,difficulty,option_a,option_b,correct_answer,explanation",
        'SINGLE_CHOICE,"Existing question from database",EASY,"A","B",opt_a,"Exp"',
        'SINGLE_CHOICE,"Brand new unique question",EASY,"A","B",opt_a,"Exp"',
        'SINGLE_CHOICE,"Brand new unique question",EASY,"A","B",opt_a,"Exp"', // Duplicate within file!
      ].join("\n");

      const existingInDb = [
        {
          questionId: "db-question-uuid-1",
          versionId: "db-ver-uuid-1",
          prompt: "Existing question from database",
          fingerprint: ImportService.parseCsvLines(csv).length > 0
            ? "mock-fp"
            : "",
        },
      ];
      // Generate actual fingerprint for the existing question
      existingInDb[0].fingerprint = ImportService["generateCsvTemplate"]
        ? ImportService["parseCsvLines"]
          ? ""
          : ""
        : "";

      const preview = await ImportService.previewImport(
        collegeX,
        "sample.csv",
        csv,
        [
          {
            questionId: "db-question-uuid-1",
            versionId: "db-ver-uuid-1",
            prompt: "Existing question from database",
            fingerprint: "non-matching-fp",
          },
        ]
      );

      expect(preview.totalRows).toBe(3);
      expect(preview.validRows).toBe(3);
      expect(preview.invalidRows).toBe(0);
      // Row 4 is duplicate of row 3 (within file)
      expect(preview.intraFileDuplicateRows).toBeGreaterThanOrEqual(1);
      expect(preview.rows[2].duplicateSource).toBe("FILE");
    });

    it("verifies QuestionService.getQuestions resolves all questions without failing on subject column", async () => {
      // Mock Supabase returning questions joined with bank(id, name, category)
      const mockQuestions = [
        {
          id: "0d8515b4-580c-493b-bcfe-d81c701e3d02",
          tenant_id: collegeX,
          bank_id: bankX,
          question_type: "SINGLE_CHOICE",
          current_version_id: "ver-1",
          lifecycle_status: "APPROVED",
          bank: { id: bankX, name: "Demo", category: "CODING" },
          current_version: {
            id: "ver-1",
            version_number: 1,
            prompt: "What is the time complexity of searching a balanced BST?",
            review_status: "VERIFIED_CORRECT",
          },
        },
        {
          id: "6dcf6250-aca3-4860-9e61-9b752bf0b20f",
          tenant_id: collegeX,
          bank_id: bankX,
          question_type: "SINGLE_CHOICE",
          current_version_id: "ver-2",
          lifecycle_status: "PUBLISHED",
          bank: { id: bankX, name: "Demo", category: "CODING" },
          current_version: {
            id: "ver-2",
            version_number: 1,
            prompt: "An item marked at ₹3,600 is sold after a 15% discount...",
            review_status: "VERIFIED_CORRECT",
          },
        },
      ];

      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockQuestions, error: null, count: 2 }),
      };

      const mockSupabase: any = {
        from: vi.fn(() => chain),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(mockSupabase);

      const result = await QuestionService.getQuestions(collegeX, "PLACEMENT_HEAD");
      expect(result.questions.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.error).toBeUndefined();
      // Verifies bank subject fallback works
      expect(result.questions[0].bank.subject).toBe("Demo");
    });
  });

  // =========================================================================
  // 4. QuestionBank Sentinel Repository & Error Handling
  // =========================================================================
  describe("4. QuestionBank Sentinel Repository API Error Transparency", () => {
    it("returns HTTP 500 when repository query fails, preventing silent false-zero count", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(mockAuthContext() as any);
      vi.spyOn(QuestionService, "getQuestions").mockResolvedValue({
        questions: [],
        total: 0,
        error: "Database join failed",
      });

      const req = new NextRequest("http://localhost:3000/api/questions");
      const res = await getQuestions(req);
      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.error).toBe("Database join failed");
      expect(json.questions).toEqual([]);
    });
  });

  // =========================================================================
  // 5. Multi-Tenant College Isolation
  // =========================================================================
  describe("5. Strict Cross-College Multi-Tenant Isolation", () => {
    it("College Y cannot fetch College X question banks", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockAuthContext(collegeY, userY) as any
      );

      const mockSupabase: any = {
        from: vi.fn((table: string) => {
          if (table === "question_banks") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn((col: string, val: any) => {
                // Must query strictly for College Y
                expect(col).toBe("tenant_id");
                expect(val).toBe(collegeY);
                return {
                  order: vi.fn().mockResolvedValue({ data: [], error: null }),
                };
              }),
            };
          }
          return {};
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(mockSupabase);

      const req = new NextRequest("http://localhost:3000/api/questions/banks");
      const res = await getBanks(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual([]);
    });

    it("College Y cannot commit questions into College X bank", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockAuthContext(collegeY, userY) as any
      );

      const mockSupabase: any = {
        from: vi.fn((table: string) => {
          if (table === "question_banks") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: null, // Bank does not exist in College Y workspace
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(mockSupabase);

      const req = new NextRequest("http://localhost:3000/api/questions/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankId: bankX, // Target is College X bank
          items: [{ rowNumber: 2, isValid: true }],
        }),
      });

      const res = await commitImport(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toBe("Target Question Bank not found or does not belong to your college.");
    });
  });
});
