import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { DELETE as bulkDeleteRoute, POST as bulkPostRoute } from "@/app/api/questions/bulk-delete/route";
import { DELETE as singleDeleteRoute } from "@/app/api/questions/[id]/route";
import { GET as getQuestionsRoute } from "@/app/api/questions/route";
import { NextRequest } from "next/server";

const tenantA = "357c432f-c54f-40f5-b634-9f92704f46fd"; // Sapthagiri NPS University
const tenantB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // Reva University
const userHeadA = "user-placement-head-a";

// In-memory test stores
let mockQuestions: any[] = [];
let mockQuestionVersions: any[] = [];
let mockQuestionDuplicates: any[] = [];
let mockQuestionSetItems: any[] = [];
let mockAttemptResponses: any[] = [];
let mockAuditLogs: any[] = [];

function createMockSupabaseClient() {
  return {
    from: (table: string) => {
      const filters: any = {};
      const notFilters: any = {};
      const inFilters: any = {};
      let isDelete = false;
      let countExact = false;

      const getFilteredData = () => {
        let store: any[] = [];
        if (table === "questions") store = mockQuestions;
        else if (table === "question_versions") store = mockQuestionVersions;
        else if (table === "question_duplicates") store = mockQuestionDuplicates;
        else if (table === "question_set_items") store = mockQuestionSetItems;
        else if (table === "attempt_responses") store = mockAttemptResponses;
        else if (table === "audit_logs") store = mockAuditLogs;

        return store.filter((r) => {
          for (const [k, v] of Object.entries(filters)) {
            if (r[k] !== v) return false;
          }
          for (const [k, v] of Object.entries(notFilters)) {
            if (r[k] === v) return false;
          }
          for (const [k, arr] of Object.entries(inFilters)) {
            if (!Array.isArray(arr) || !arr.includes(r[k])) return false;
          }
          return true;
        });
      };

      const executeDelete = () => {
        const deleteFilter = (r: any) => {
          for (const [k, v] of Object.entries(filters)) {
            if (r[k] !== v) return false;
          }
          for (const [k, arr] of Object.entries(inFilters)) {
            if (!Array.isArray(arr) || !arr.includes(r[k])) return false;
          }
          return true;
        };

        if (table === "questions") mockQuestions = mockQuestions.filter((r) => !deleteFilter(r));
        if (table === "question_versions") mockQuestionVersions = mockQuestionVersions.filter((r) => !deleteFilter(r));
        if (table === "question_duplicates") mockQuestionDuplicates = mockQuestionDuplicates.filter((r) => !deleteFilter(r));
      };

      const builder: any = {
        select: vi.fn((_fields?: string, options?: any) => {
          if (options?.count === "exact") countExact = true;
          return builder;
        }),
        eq: vi.fn((col: string, val: any) => {
          filters[col] = val;
          return builder;
        }),
        neq: vi.fn((col: string, val: any) => {
          notFilters[col] = val;
          return builder;
        }),
        in: vi.fn((col: string, vals: any[]) => {
          inFilters[col] = vals;
          return builder;
        }),
        or: vi.fn(() => builder),
        order: vi.fn(() => builder),
        range: vi.fn(() => builder),
        single: vi.fn(async () => {
          const filtered = getFilteredData();
          return { data: filtered[0] || null, error: filtered[0] ? null : { message: "Not found" } };
        }),
        maybeSingle: vi.fn(async () => {
          const filtered = getFilteredData();
          return { data: filtered[0] || null, error: null };
        }),
        update: vi.fn((updates: any) => {
          let targetRows: any[] = [];
          if (table === "questions") targetRows = mockQuestions;

          targetRows.forEach((r) => {
            let match = true;
            for (const [k, v] of Object.entries(filters)) {
              if (r[k] !== v) match = false;
            }
            for (const [k, arr] of Object.entries(inFilters)) {
              if (!Array.isArray(arr) || !arr.includes(r[k])) match = false;
            }
            if (match) Object.assign(r, updates);
          });
          return builder;
        }),
        insert: vi.fn((rows: any) => {
          const arr = Array.isArray(rows) ? rows : [rows];
          arr.forEach((r) => {
            if (table === "audit_logs") mockAuditLogs.push(r);
          });
          return builder;
        }),
        delete: vi.fn(() => {
          isDelete = true;
          return builder;
        }),
        then: (resolve: any) => {
          if (isDelete) {
            executeDelete();
            return resolve({ data: null, error: null });
          }
          const filtered = getFilteredData();
          if (countExact) {
            return resolve({ data: filtered, count: filtered.length, error: null });
          }
          return resolve({ data: filtered, error: null });
        },
      };

      return builder;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => createMockSupabaseClient()),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => createMockSupabaseClient()),
}));

let mockCurrentAuthContext: any = {
  tenantId: tenantA,
  userId: userHeadA,
  tenantRole: "PLACEMENT_HEAD",
  isPlatformAdmin: false,
};

vi.mock("@/lib/auth/server-context", () => ({
  requireAuthContext: vi.fn(async () => {
    if (mockCurrentAuthContext.tenantRole === "STUDENT") {
      throw new Error("FORBIDDEN");
    }
    return mockCurrentAuthContext;
  }),
}));

describe("UrPlaced QuestionBank Sentinel — Delete All Questions & Repository Stats Suite", () => {
  beforeEach(() => {
    mockQuestions = [];
    mockQuestionVersions = [];
    mockQuestionDuplicates = [];
    mockQuestionSetItems = [];
    mockAttemptResponses = [];
    mockAuditLogs = [];

    mockCurrentAuthContext = {
      tenantId: tenantA,
      userId: userHeadA,
      tenantRole: "PLACEMENT_HEAD",
      isPlatformAdmin: false,
    };
  });

  describe("1. Authoritative Repository Stats Synchronization", () => {
    it("accurately calculates Total Questions and Verified Keys across all active college questions", async () => {
      // Setup 50 active questions: 49 APPROVED + 1 PUBLISHED
      for (let i = 1; i <= 50; i++) {
        const qId = `q-${i}`;
        const isPublished = i === 1;
        mockQuestions.push({
          id: qId,
          tenant_id: tenantA,
          lifecycle_status: isPublished ? "PUBLISHED" : "APPROVED",
          current_version: {
            review_status: "VERIFIED_CORRECT",
          },
        });
      }

      const stats = await QuestionService.getRepositoryStats(tenantA);
      expect(stats.totalQuestions).toBe(50);
      expect(stats.verifiedKeys).toBe(50);
      expect(stats.pendingReview).toBe(0);
      expect(stats.published).toBe(1);
      expect(stats.archived).toBe(0);
    });

    it("decreases Total Questions from 50 to 49 immediately after one permanent deletion", async () => {
      // 50 questions in DB
      for (let i = 1; i <= 50; i++) {
        mockQuestions.push({
          id: `q-${i}`,
          tenant_id: tenantA,
          lifecycle_status: "APPROVED",
          current_version: { review_status: "VERIFIED_CORRECT" },
        });
      }

      // Initial stats
      let stats = await QuestionService.getRepositoryStats(tenantA);
      expect(stats.totalQuestions).toBe(50);

      // Delete 1 unreferenced question using single delete service
      const delRes = await QuestionService.deleteQuestion(tenantA, "q-50");
      expect(delRes.success).toBe(true);
      expect(delRes.deleted).toBe(true);

      // Refreshed stats must reflect 49
      stats = await QuestionService.getRepositoryStats(tenantA);
      expect(stats.totalQuestions).toBe(49);
      expect(stats.verifiedKeys).toBe(49);
    });

    it("excludes archived questions from active repository counts while tracking archived separately", async () => {
      const qId = "q-ref-1";
      mockQuestions.push({
        id: qId,
        tenant_id: tenantA,
        lifecycle_status: "APPROVED",
        current_version: { review_status: "VERIFIED_CORRECT" },
      });
      mockQuestionSetItems.push({
        id: "item-1",
        tenant_id: tenantA,
        set_id: "set-1",
        question_id: qId,
      });

      // Initial stats
      let stats = await QuestionService.getRepositoryStats(tenantA);
      expect(stats.totalQuestions).toBe(1);
      expect(stats.archived).toBe(0);

      // Deleting a referenced question archives it
      const res = await QuestionService.deleteQuestion(tenantA, qId);
      expect(res.success).toBe(true);
      expect(res.archived).toBe(true);

      // Stats now show active = 0, archived = 1
      stats = await QuestionService.getRepositoryStats(tenantA);
      expect(stats.totalQuestions).toBe(0);
      expect(stats.archived).toBe(1);
    });
  });

  describe("2. Bulk Delete All Questions Service", () => {
    it("permanently deletes all unreferenced questions and version records in bulk", async () => {
      for (let i = 1; i <= 64; i++) {
        const qId = `q-bulk-${i}`;
        mockQuestions.push({
          id: qId,
          tenant_id: tenantA,
          lifecycle_status: "APPROVED",
        });
        mockQuestionVersions.push({
          id: `v-bulk-${i}`,
          tenant_id: tenantA,
          question_id: qId,
        });
      }

      const res = await QuestionService.bulkDeleteAllQuestions(tenantA, userHeadA);
      expect(res.success).toBe(true);
      expect(res.totalProcessed).toBe(64);
      expect(res.deletedCount).toBe(64);
      expect(res.archivedCount).toBe(0);
      expect(res.failedCount).toBe(0);

      // All 64 questions removed from store
      expect(mockQuestions.filter((q) => q.tenant_id === tenantA).length).toBe(0);
      expect(mockQuestionVersions.filter((v) => v.tenant_id === tenantA).length).toBe(0);

      // Repository stats updated to 0
      const stats = await QuestionService.getRepositoryStats(tenantA);
      expect(stats.totalQuestions).toBe(0);
    });

    it("safely archives questions referenced in question sets or attempts, while deleting unreferenced", async () => {
      // 3 unreferenced questions
      for (let i = 1; i <= 3; i++) {
        mockQuestions.push({ id: `q-clean-${i}`, tenant_id: tenantA, lifecycle_status: "APPROVED" });
      }

      // 1 question referenced in question set
      mockQuestions.push({ id: "q-in-set", tenant_id: tenantA, lifecycle_status: "PUBLISHED" });
      mockQuestionSetItems.push({ id: "set-item-1", tenant_id: tenantA, question_id: "q-in-set" });

      // 1 question referenced in student attempt response
      mockQuestions.push({ id: "q-in-attempt", tenant_id: tenantA, lifecycle_status: "PUBLISHED" });
      mockAttemptResponses.push({ id: "att-resp-1", tenant_id: tenantA, question_id: "q-in-attempt" });

      const res = await QuestionService.bulkDeleteAllQuestions(tenantA, userHeadA);
      expect(res.success).toBe(true);
      expect(res.totalProcessed).toBe(5);
      expect(res.deletedCount).toBe(3);
      expect(res.archivedCount).toBe(2);

      // Clean questions deleted
      expect(mockQuestions.find((q) => q.id === "q-clean-1")).toBeUndefined();
      // Referenced questions retained with ARCHIVED lifecycle
      expect(mockQuestions.find((q) => q.id === "q-in-set")?.lifecycle_status).toBe("ARCHIVED");
      expect(mockQuestions.find((q) => q.id === "q-in-attempt")?.lifecycle_status).toBe("ARCHIVED");

      // Active stats must be 0
      const stats = await QuestionService.getRepositoryStats(tenantA);
      expect(stats.totalQuestions).toBe(0);
      expect(stats.archived).toBe(2);
    });

    it("enforces strict multi-college isolation: College A cannot delete College B questions", async () => {
      mockQuestions.push({ id: "q-college-a", tenant_id: tenantA, lifecycle_status: "APPROVED" });
      mockQuestions.push({ id: "q-college-b", tenant_id: tenantB, lifecycle_status: "APPROVED" });

      // College A deletes all questions
      const res = await QuestionService.bulkDeleteAllQuestions(tenantA, userHeadA);
      expect(res.success).toBe(true);
      expect(res.deletedCount).toBe(1);

      // College A question deleted, College B question remains intact
      expect(mockQuestions.find((q) => q.id === "q-college-a")).toBeUndefined();
      expect(mockQuestions.find((q) => q.id === "q-college-b")).toBeDefined();
    });

    it("handles empty question repository gracefully with 0 processed", async () => {
      const res = await QuestionService.bulkDeleteAllQuestions(tenantA, userHeadA);
      expect(res.success).toBe(true);
      expect(res.totalProcessed).toBe(0);
      expect(res.deletedCount).toBe(0);
      expect(res.archivedCount).toBe(0);
    });
  });

  describe("3. Bulk Deletion Endpoints & Security", () => {
    it("DELETE /api/questions/bulk-delete executes bulk deletion for authenticated staff", async () => {
      mockQuestions.push({ id: "q-api-1", tenant_id: tenantA, lifecycle_status: "APPROVED" });
      mockQuestions.push({ id: "q-api-2", tenant_id: tenantA, lifecycle_status: "APPROVED" });

      const req = new NextRequest("http://localhost:3000/api/questions/bulk-delete", {
        method: "DELETE",
      });
      const res = await bulkDeleteRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.deletedCount).toBe(2);
      expect(mockQuestions.length).toBe(0);
    });

    it("strictly blocks unauthorized role (STUDENT) with 403 Forbidden", async () => {
      mockCurrentAuthContext = {
        tenantId: tenantA,
        userId: "student-user",
        tenantRole: "STUDENT",
        isPlatformAdmin: false,
      };

      const req = new NextRequest("http://localhost:3000/api/questions/bulk-delete", {
        method: "DELETE",
      });
      const res = await bulkDeleteRoute(req);
      expect(res.status).toBe(403);
    });
  });

  describe("4. MANDATORY PRESERVATION: Individual Delete Buttons & Functionality", () => {
    it("confirms individual Delete Question route remains functional and intact", async () => {
      const singleId = "single-delete-target";
      mockQuestions.push({ id: singleId, tenant_id: tenantA, lifecycle_status: "APPROVED" });

      const req = new NextRequest(`http://localhost:3000/api/questions/${singleId}?action=DELETE`, {
        method: "DELETE",
      });
      const res = await singleDeleteRoute(req, { params: Promise.resolve({ id: singleId }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.deleted).toBe(true);
      expect(mockQuestions.find((q) => q.id === singleId)).toBeUndefined();
    });
  });
});
