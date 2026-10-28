import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { QuestionSetService } from "@/modules/question-bank/services/question-set-service";
import { GET as getBulkReview, POST as postBulkReview } from "@/app/api/questions/bulk-review/route";
import * as ServerContextModule from "@/lib/auth/server-context";
import * as SupabaseServerModule from "@/lib/supabase/server";
import * as SupabaseAdminModule from "@/lib/supabase/admin";
import { QuestionType, QuestionDifficulty, AnswerKeyReviewStatus } from "@/types/database";

describe("QuestionBank Sentinel - Phase 2: Bulk Question Review & Accept All", () => {
  const tenantA = "tenant-college-alpha-uuid";
  const tenantB = "tenant-college-beta-uuid";
  const headUserId = "user-placement-head-1";
  const staffUserId = "user-placement-staff-1";
  const trainerUserId = "user-trainer-1";
  const studentUserId = "user-student-1";

  // In-memory data store for the test environment
  let mockBanks: any[] = [];
  let mockQuestions: any[] = [];
  let mockVersions: any[] = [];
  let mockSetItems: any[] = [];
  let mockSets: any[] = [];

  const mockUserContext = (role: string, tenantId = tenantA, userId = headUserId) => ({
    userId,
    email: `${role.toLowerCase()}@college.edu`,
    isPlatformAdmin: false,
    tenantId,
    tenantRole: role as any,
    tenantStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
  });

  const createMockSupabase = () => {
    return {
      from: vi.fn((table: string) => {
        let currentTable = table;
        let selectedFields = "*";
        let filters: Record<string, any> = {};
        let ilikeFilters: Record<string, string> = {};
        let inFilters: Record<string, any[]> = {};
        let containsFilters: Record<string, any[]> = {};

        const builder: any = {
          select: vi.fn((fields: string) => {
            selectedFields = fields;
            return builder;
          }),
          insert: vi.fn((data: any) => {
            const rows = Array.isArray(data) ? data : [data];
            const inserted = rows.map((r) => {
              const row = { id: `id-${Math.random().toString(36).substring(7)}`, ...r };
              if (currentTable === "question_banks") mockBanks.push(row);
              if (currentTable === "questions") mockQuestions.push(row);
              if (currentTable === "question_versions") mockVersions.push(row);
              if (currentTable === "question_set_items") mockSetItems.push(row);
              if (currentTable === "question_sets") mockSets.push(row);
              return row;
            });

            return {
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: inserted[0], error: null }),
              maybeSingle: vi.fn().mockResolvedValue({ data: inserted[0], error: null }),
              then: (res: any) => res({ data: inserted, error: null }),
            };
          }),
          update: vi.fn((updates: any) => {
            let uFilters: Record<string, any> = {};
            let uInFilters: Record<string, any[]> = {};
            const uBuilder: any = {
              eq: vi.fn((col: string, val: any) => {
                uFilters[col] = val;
                return uBuilder;
              }),
              in: vi.fn((col: string, vals: any[]) => {
                uInFilters[col] = vals;
                return uBuilder;
              }),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: updates, error: null }),
              then: (resolve: any) => {
                let store: any[] = [];
                if (currentTable === "questions") store = mockQuestions;
                if (currentTable === "question_versions") store = mockVersions;
                store.forEach((row) => {
                  let match = true;
                  for (const [k, v] of Object.entries(uFilters)) {
                    if (row[k] !== v) match = false;
                  }
                  for (const [k, vals] of Object.entries(uInFilters)) {
                    if (!vals.includes(row[k])) match = false;
                  }
                  if (match) {
                    Object.assign(row, updates);
                  }
                });
                return resolve({ data: updates, error: null });
              },
            };
            return uBuilder;
          }),
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn((col: string, val: any) => {
            filters[col] = val;
            return builder;
          }),
          ilike: vi.fn((col: string, val: string) => {
            ilikeFilters[col] = val;
            return builder;
          }),
          in: vi.fn((col: string, vals: any[]) => {
            inFilters[col] = vals;
            return builder;
          }),
          contains: vi.fn((col: string, vals: any[]) => {
            containsFilters[col] = vals;
            return builder;
          }),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn(() => {
            let store: any[] = [];
            if (currentTable === "question_banks") store = mockBanks;
            if (currentTable === "questions") store = mockQuestions;
            if (currentTable === "question_versions") store = mockVersions;
            if (currentTable === "question_sets") store = mockSets;

            const item = store.find((row) => {
              for (const [k, v] of Object.entries(filters)) {
                if (row[k] !== v) return false;
              }
              return true;
            });
            return Promise.resolve({ data: item || null, error: item ? null : { message: "Not found" } });
          }),
          maybeSingle: vi.fn(() => {
            let store: any[] = [];
            if (currentTable === "question_banks") store = mockBanks;
            if (currentTable === "questions") store = mockQuestions;
            if (currentTable === "question_versions") store = mockVersions;
            if (currentTable === "question_sets") store = mockSets;

            const item = store.find((row) => {
              for (const [k, v] of Object.entries(filters)) {
                if (row[k] !== v) return false;
              }
              for (const [k, valPattern] of Object.entries(ilikeFilters)) {
                const clean = valPattern.replace(/%/g, "").toLowerCase();
                if (!String(row[k] || "").toLowerCase().includes(clean)) return false;
              }
              return true;
            });
            return Promise.resolve({ data: item || null, error: null });
          }),
        };

        builder.then = (resolve: any) => {
          let store: any[] = [];
          if (currentTable === "question_banks") store = mockBanks;
          if (currentTable === "questions") store = mockQuestions;
          if (currentTable === "question_versions") store = mockVersions;
          if (currentTable === "question_set_items") store = mockSetItems;
          if (currentTable === "question_sets") store = mockSets;

          let filtered = store.filter((row) => {
            for (const [k, v] of Object.entries(filters)) {
              if (row[k] !== v) return false;
            }
            for (const [k, valPattern] of Object.entries(ilikeFilters)) {
              const clean = valPattern.replace(/%/g, "").toLowerCase();
              if (!String(row[k] || "").toLowerCase().includes(clean)) return false;
            }
            for (const [k, vals] of Object.entries(inFilters)) {
              if (!vals.includes(row[k])) return false;
            }
            for (const [k, vals] of Object.entries(containsFilters)) {
              const rowArr = (row[k] || []).map((x: string) => String(x).toLowerCase());
              const match = vals.every((v) => rowArr.includes(String(v).toLowerCase()));
              if (!match) return false;
            }
            return true;
          });

          // Embed relations if needed
          if (currentTable === "questions") {
            filtered = filtered.map((q) => {
              const bank = mockBanks.find((b) => b.id === q.bank_id);
              const curVer = mockVersions.find((v) => v.id === q.current_version_id);
              return {
                ...q,
                bank: bank ? { id: bank.id, name: bank.name, subject: bank.subject, category: bank.category } : null,
                current_version: curVer || null,
              };
            });
          }

          if (currentTable === "question_set_items") {
            filtered = filtered.map((item) => {
              const q = mockQuestions.find((row) => row.id === item.question_id);
              const v = mockVersions.find((row) => row.id === item.version_id);
              return {
                ...item,
                question: q || null,
                version: v || null,
              };
            });
          }

          resolve({ data: filtered, error: null, count: filtered.length });
        };

        return builder;
      }),
    } as any;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockBanks = [];
    mockQuestions = [];
    mockVersions = [];
    mockSetItems = [];
    mockSets = [];

    const mockSupabase = createMockSupabase();
    vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(mockSupabase);
    vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockSupabase);
    vi.spyOn(ServerContextModule, "requireAuthContext").mockImplementation(async (permission?: string) => {
      // Simulate permission check: student lacks QUESTIONS_REVIEW
      return mockUserContext("PLACEMENT_HEAD");
    });
  });

  // Helper to quickly create test questions
  const createTestQuestion = async (params: {
    tenantId: string;
    bankId: string;
    type?: QuestionType;
    prompt: string;
    difficulty?: QuestionDifficulty;
    topicTags?: string[];
    reviewStatus?: AnswerKeyReviewStatus;
    options?: any[];
    answerKey?: any;
    lifecycleStatus?: any;
  }) => {
    const qId = `q-${Math.random().toString(36).substring(7)}`;
    const vId = `v-${Math.random().toString(36).substring(7)}`;

    const version = {
      id: vId,
      tenant_id: params.tenantId,
      question_id: qId,
      version_number: 1,
      prompt: params.prompt,
      content_format: "MARKDOWN",
      options: params.options || [
        { id: "opt_1", text: "Alpha" },
        { id: "opt_2", text: "Beta" },
      ],
      answer_key: params.answerKey || { correct_option_id: "opt_1" },
      explanation: "Test explanation",
      difficulty: params.difficulty || "MEDIUM",
      topic_tags: params.topicTags || [],
      review_status: params.reviewStatus || "UNREVIEWED",
      reviewed_by: null,
      review_notes: null,
      created_by: headUserId,
      created_at: new Date().toISOString(),
    };

    const question = {
      id: qId,
      tenant_id: params.tenantId,
      bank_id: params.bankId,
      question_type: params.type || "SINGLE_CHOICE",
      current_version_id: vId,
      lifecycle_status: params.lifecycleStatus || "DRAFT",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockVersions.push(version);
    mockQuestions.push(question);
    return { qId, vId, question, version };
  };

  // =========================================================================
  // 1. Eligible Count Resolution
  // =========================================================================
  describe("1. Eligible Count Resolution", () => {
    it("accurately counts unreviewed questions across a tenant", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "General Bank",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });

      // 3 unreviewed questions
      await createTestQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "Q1" });
      await createTestQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "Q2" });
      await createTestQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "Q3" });

      // 1 already verified question
      await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Q4 Verified",
        reviewStatus: "VERIFIED_CORRECT",
      });

      const counts = await QuestionService.getEligibleReviewCount(tenantA);
      expect(counts.totalCount).toBe(4);
      expect(counts.eligibleCount).toBe(3);
    });

    it("filters count strictly by bankId", async () => {
      const { data: bank1 } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Bank 1",
        subject: "Operating Systems",
        category: "TECHNICAL_CORE",
      });
      const { data: bank2 } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Bank 2",
        subject: "Database Management Systems",
        category: "TECHNICAL_CORE",
      });

      await createTestQuestion({ tenantId: tenantA, bankId: bank1.id, prompt: "OS 1" });
      await createTestQuestion({ tenantId: tenantA, bankId: bank1.id, prompt: "OS 2" });
      await createTestQuestion({ tenantId: tenantA, bankId: bank2.id, prompt: "DBMS 1" });

      const countBank1 = await QuestionService.getEligibleReviewCount(tenantA, { bankId: bank1.id });
      expect(countBank1.eligibleCount).toBe(2);

      const countBank2 = await QuestionService.getEligibleReviewCount(tenantA, { bankId: bank2.id });
      expect(countBank2.eligibleCount).toBe(1);
    });

    it("filters count by subject with alias resolution", async () => {
      const { data: bankOS } = await QuestionService.createBank(tenantA, headUserId, {
        name: "OS Prep",
        subject: "Operating Systems",
        category: "TECHNICAL_CORE",
      });
      const { data: bankCN } = await QuestionService.createBank(tenantA, headUserId, {
        name: "CN Prep",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });

      await createTestQuestion({ tenantId: tenantA, bankId: bankOS.id, prompt: "Deadlocks" });
      await createTestQuestion({ tenantId: tenantA, bankId: bankCN.id, prompt: "Routing" });

      // Query using alias "os"
      const osCount = await QuestionService.getEligibleReviewCount(tenantA, { subject: "os" });
      expect(osCount.eligibleCount).toBe(1);
    });

    it("filters count by topic tag", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Algorithms Bank",
        subject: "Data Structures & Algorithms",
        category: "CODING",
      });

      await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Tree traversal",
        topicTags: ["trees", "recursion"],
      });
      await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Graph DFS",
        topicTags: ["graphs"],
      });

      const treesCount = await QuestionService.getEligibleReviewCount(tenantA, { topic: "trees" });
      expect(treesCount.eligibleCount).toBe(1);
    });

    it("excludes questions marked NEEDS_REVISION or REJECTED from eligible count", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Aptitude Pool",
        subject: "Aptitude",
        category: "APTITUDE",
      });

      await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Unreviewed Q",
        reviewStatus: "UNREVIEWED",
      });
      await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Needs Revision Q",
        reviewStatus: "NEEDS_REVISION",
      });
      await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Rejected Q",
        reviewStatus: "REJECTED",
      });

      const counts = await QuestionService.getEligibleReviewCount(tenantA, { bankId: bank.id });
      expect(counts.eligibleCount).toBe(1);
    });
  });

  // =========================================================================
  // 2. Bulk Acceptance Execution & State Transitions
  // =========================================================================
  describe("2. Bulk Acceptance Execution & State Transitions", () => {
    it("transitions unreviewed versions to VERIFIED_CORRECT and questions to APPROVED", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "DBMS Sentinel Bank",
        subject: "Database Management Systems",
        category: "TECHNICAL_CORE",
      });

      const q1 = await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "What is 2NF?",
        reviewStatus: "UNREVIEWED",
        lifecycleStatus: "DRAFT",
      });
      const q2 = await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "What is B-Tree index?",
        reviewStatus: "UNREVIEWED",
        lifecycleStatus: "PENDING_REVIEW",
      });

      const result = await QuestionService.bulkAcceptQuestions(tenantA, headUserId, {
        bankId: bank.id,
        reviewNotes: "Batch accepted for placement drive",
      });

      expect(result.success).toBe(true);
      expect(result.acceptedCount).toBe(2);
      expect(result.skippedCount).toBe(0);

      // Verify in-memory state of versions
      const v1 = mockVersions.find((v) => v.id === q1.vId);
      const v2 = mockVersions.find((v) => v.id === q2.vId);
      expect(v1.review_status).toBe("VERIFIED_CORRECT");
      expect(v1.reviewed_by).toBe(headUserId);
      expect(v1.review_notes).toBe("Batch accepted for placement drive");
      expect(v2.review_status).toBe("VERIFIED_CORRECT");

      // Verify in-memory state of questions
      const qu1 = mockQuestions.find((q) => q.id === q1.qId);
      const qu2 = mockQuestions.find((q) => q.id === q2.qId);
      expect(qu1.lifecycle_status).toBe("APPROVED");
      expect(qu2.lifecycle_status).toBe("APPROVED");
    });

    it("never automatically marks questions as PUBLISHED", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Security Bank",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });

      const q = await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Explain TLS handshake",
        reviewStatus: "UNREVIEWED",
        lifecycleStatus: "DRAFT",
      });

      await QuestionService.bulkAcceptQuestions(tenantA, headUserId, { bankId: bank.id });

      const updatedQ = mockQuestions.find((item) => item.id === q.qId);
      expect(updatedQ.lifecycle_status).toBe("APPROVED");
      expect(updatedQ.lifecycle_status).not.toBe("PUBLISHED");
    });

    it("preserves immutability: version number is not incremented and circular pointer remains valid", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Verbal Bank",
        subject: "Verbal Ability",
        category: "GENERAL",
      });

      const q = await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Choose the correct antonym",
      });

      await QuestionService.bulkAcceptQuestions(tenantA, headUserId, { bankId: bank.id });

      const updatedQ = mockQuestions.find((item) => item.id === q.qId);
      const updatedV = mockVersions.find((item) => item.id === q.vId);

      expect(updatedQ.current_version_id).toBe(q.vId);
      expect(updatedV.version_number).toBe(1);
    });
  });

  // =========================================================================
  // 3. Structural Validation & Selective Skipping
  // =========================================================================
  describe("3. Structural Validation & Selective Skipping", () => {
    it("skips questions with invalid answer keys and reports granular details", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Validation Test Bank",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });

      // Valid question
      const validQ = await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Valid MCQ question",
        options: [
          { id: "opt_1", text: "A" },
          { id: "opt_2", text: "B" },
        ],
        answerKey: { correct_option_id: "opt_1" },
      });

      // Invalid question: MCQ with only 1 option
      const invalidQ = await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Invalid MCQ with only one option",
        options: [{ id: "opt_1", text: "Only Option" }],
        answerKey: { correct_option_id: "opt_1" },
      });

      const result = await QuestionService.bulkAcceptQuestions(tenantA, headUserId, {
        bankId: bank.id,
      });

      expect(result.success).toBe(true);
      expect(result.acceptedCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.skippedDetails.length).toBe(1);
      expect(result.skippedDetails[0].questionId).toBe(invalidQ.qId);
      expect(result.skippedDetails[0].reason).toContain("Validation failed");

      // Verify the valid question is accepted while invalid remains UNREVIEWED / DRAFT
      const validVersion = mockVersions.find((v) => v.id === validQ.vId);
      const invalidVersion = mockVersions.find((v) => v.id === invalidQ.vId);
      expect(validVersion.review_status).toBe("VERIFIED_CORRECT");
      expect(invalidVersion.review_status).toBe("UNREVIEWED");
    });

    it("skips questions already verified without duplicating or failing", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Already Verified Bank",
        subject: "Operating Systems",
        category: "TECHNICAL_CORE",
      });

      await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Already verified OS question",
        reviewStatus: "VERIFIED_CORRECT",
      });

      const result = await QuestionService.bulkAcceptQuestions(tenantA, headUserId, {
        bankId: bank.id,
      });

      expect(result.success).toBe(true);
      expect(result.acceptedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.skippedDetails[0].reason).toContain("already verified correct");
    });

    it("skips questions marked NEEDS_REVISION or REJECTED", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Revision Test Bank",
        subject: "Operating Systems",
        category: "TECHNICAL_CORE",
      });

      await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Flagged question",
        reviewStatus: "NEEDS_REVISION",
      });

      const result = await QuestionService.bulkAcceptQuestions(tenantA, headUserId, {
        bankId: bank.id,
      });

      expect(result.success).toBe(true);
      expect(result.acceptedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.skippedDetails[0].reason).toContain("Requires manual revision");
    });
  });

  // =========================================================================
  // 4. Tenant Isolation & Security Boundaries
  // =========================================================================
  describe("4. Tenant Isolation & Security Boundaries", () => {
    it("never modifies questions belonging to another tenant", async () => {
      const { data: bankA } = await QuestionService.createBank(tenantA, headUserId, {
        name: "College A Bank",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });
      const { data: bankB } = await QuestionService.createBank(tenantB, "head-b", {
        name: "College B Bank",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });

      const qA = await createTestQuestion({ tenantId: tenantA, bankId: bankA.id, prompt: "College A Question" });
      const qB = await createTestQuestion({ tenantId: tenantB, bankId: bankB.id, prompt: "College B Question" });

      // Tenant A runs bulk accept across all questions in tenant A
      const res = await QuestionService.bulkAcceptQuestions(tenantA, headUserId);
      expect(res.acceptedCount).toBe(1);

      // College A question is verified
      const vA = mockVersions.find((v) => v.id === qA.vId);
      expect(vA.review_status).toBe("VERIFIED_CORRECT");

      // College B question remains unreviewed
      const vB = mockVersions.find((v) => v.id === qB.vId);
      expect(vB.review_status).toBe("UNREVIEWED");
    });

    it("rejects bulk accept when bankId belongs to another tenant", async () => {
      const { data: bankB } = await QuestionService.createBank(tenantB, "head-b", {
        name: "Foreign Bank",
        subject: "Aptitude",
        category: "APTITUDE",
      });

      const res = await QuestionService.bulkAcceptQuestions(tenantA, headUserId, {
        bankId: bankB.id,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("does not belong to your college");
    });
  });

  // =========================================================================
  // 5. API Routes: /api/questions/bulk-review
  // =========================================================================
  describe("5. API Routes: /api/questions/bulk-review", () => {
    it("GET /api/questions/bulk-review returns eligible counts for placement head", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "API Test Bank",
        subject: "Database Management Systems",
        category: "TECHNICAL_CORE",
      });

      await createTestQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "API Q1" });
      await createTestQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "API Q2" });

      const req = new NextRequest(`http://localhost:3000/api/questions/bulk-review?bankId=${bank.id}`);
      const res = await getBulkReview(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.eligibleCount).toBe(2);
      expect(json.totalCount).toBe(2);
    });

    it("POST /api/questions/bulk-review accepts questions and returns report", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "API Post Bank",
        subject: "Operating Systems",
        category: "TECHNICAL_CORE",
      });

      await createTestQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "OS Threading" });

      const req = new NextRequest("http://localhost:3000/api/questions/bulk-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankId: bank.id,
          reviewNotes: "API verified",
        }),
      });

      const res = await postBulkReview(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.acceptedCount).toBe(1);
    });

    it("rejects unauthorized student with 403 Forbidden", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockRejectedValue(new Error("FORBIDDEN"));

      const req = new NextRequest("http://localhost:3000/api/questions/bulk-review?bankId=some-bank");
      const res = await getBulkReview(req);
      expect(res.status).toBe(403);

      const postReq = new NextRequest("http://localhost:3000/api/questions/bulk-review", {
        method: "POST",
        body: JSON.stringify({ bankId: "some-bank" }),
      });
      const postRes = await postBulkReview(postReq);
      expect(postRes.status).toBe(403);
    });
  });

  // =========================================================================
  // 6. Question Set Downstream Eligibility
  // =========================================================================
  describe("6. Question Set Downstream Eligibility", () => {
    it("allows bulk-accepted questions to immediately enter Question Sets while keeping skipped ones out", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Set Test Bank",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });

      // Valid question
      const qValid = await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Valid for Question Set",
      });

      // Invalid question (1 option)
      const qInvalid = await createTestQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Invalid for Question Set",
        options: [{ id: "opt_1", text: "Lone" }],
      });

      // Run bulk accept
      const bulkRes = await QuestionService.bulkAcceptQuestions(tenantA, headUserId, {
        bankId: bank.id,
      });
      expect(bulkRes.acceptedCount).toBe(1);
      expect(bulkRes.skippedCount).toBe(1);

      // Create a Question Set
      const { data: set } = await QuestionSetService.createSet(tenantA, headUserId, {
        name: "CN Mid-Term 2026",
      });

      // Attempting to add the valid bulk-accepted question succeeds
      const addValidRes = await QuestionSetService.addItemsToSet(tenantA, set.id, [
        { question_id: qValid.qId, version_id: qValid.vId, sequence_order: 1 },
      ]);
      expect(addValidRes.success).toBe(true);
      expect(addValidRes.addedCount).toBe(1);

      // Attempting to add the skipped question fails strict eligibility validation
      const addInvalidRes = await QuestionSetService.addItemsToSet(tenantA, set.id, [
        { question_id: qInvalid.qId, version_id: qInvalid.vId, sequence_order: 2 },
      ]);
      expect(addInvalidRes.success).toBe(false);
      expect(addInvalidRes.error).toContain("is not eligible");
    });
  });
});
