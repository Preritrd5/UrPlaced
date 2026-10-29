import { describe, it, expect, vi, beforeEach } from "vitest";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { QuestionSetService } from "@/modules/question-bank/services/question-set-service";
import { AssessmentService } from "@/modules/assessments/services/assessment-service";
import { DELETE as deleteQuestionRoute } from "@/app/api/questions/[id]/route";
import { DELETE as deleteSetRoute } from "@/app/api/questions/sets/[id]/route";
import { DELETE as deleteAssessmentRoute } from "@/app/api/placement/assessments/[id]/route";
import { NextRequest } from "next/server";

const tenantA = "357c432f-c54f-40f5-b634-9f92704f46fd"; // Sapthagiri NPS University
const tenantB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // Reva University
const userHeadA = "user-placement-head-a";

// In-memory test database
let mockQuestions: any[] = [];
let mockQuestionVersions: any[] = [];
let mockQuestionSets: any[] = [];
let mockQuestionSetItems: any[] = [];
let mockAssessments: any[] = [];
let mockAssessmentAttempts: any[] = [];
let mockAssessmentAssignments: any[] = [];
let mockAttemptResponses: any[] = [];

function createMockSupabaseClient() {
  return {
    from: (table: string) => {
      const filters: any = {};
      const notFilters: any = {};
      let isDelete = false;
      let countExact = false;

      const getFilteredData = () => {
        let store: any[] = [];
        if (table === "questions") store = mockQuestions;
        else if (table === "question_versions") store = mockQuestionVersions;
        else if (table === "question_sets") store = mockQuestionSets;
        else if (table === "question_set_items") store = mockQuestionSetItems;
        else if (table === "assessments") store = mockAssessments;
        else if (table === "assessment_attempts") store = mockAssessmentAttempts;
        else if (table === "assessment_assignments") store = mockAssessmentAssignments;
        else if (table === "attempt_responses") store = mockAttemptResponses;

        return store.filter((r) => {
          for (const [k, v] of Object.entries(filters)) {
            if (r[k] !== v) return false;
          }
          for (const [k, v] of Object.entries(notFilters)) {
            if (r[k] === v) return false;
          }
          return true;
        });
      };

      const executeDelete = () => {
        const deleteFilter = (r: any) => {
          for (const [k, v] of Object.entries(filters)) {
            if (r[k] !== v) return false;
          }
          return true;
        };

        if (table === "questions") mockQuestions = mockQuestions.filter((r) => !deleteFilter(r));
        if (table === "question_versions") mockQuestionVersions = mockQuestionVersions.filter((r) => !deleteFilter(r));
        if (table === "question_sets") mockQuestionSets = mockQuestionSets.filter((r) => !deleteFilter(r));
        if (table === "question_set_items") mockQuestionSetItems = mockQuestionSetItems.filter((r) => !deleteFilter(r));
        if (table === "assessments") mockAssessments = mockAssessments.filter((r) => !deleteFilter(r));
        if (table === "assessment_assignments") mockAssessmentAssignments = mockAssessmentAssignments.filter((r) => !deleteFilter(r));
        if (table === "assessment_attempts") mockAssessmentAttempts = mockAssessmentAttempts.filter((r) => !deleteFilter(r));
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
        or: vi.fn(() => builder),
        order: vi.fn(() => builder),
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
          if (table === "question_sets") targetRows = mockQuestionSets;
          if (table === "assessments") targetRows = mockAssessments;
          if (table === "assessment_assignments") targetRows = mockAssessmentAssignments;

          targetRows.forEach((r) => {
            let match = true;
            for (const [k, v] of Object.entries(filters)) {
              if (r[k] !== v) match = false;
            }
            if (match) Object.assign(r, updates);
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
          if (countExact) {
            const filtered = getFilteredData();
            return resolve({ data: null, count: filtered.length, error: null });
          }
          const filtered = getFilteredData();
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

let mockCurrentAuthContext: any = {
  tenantId: tenantA,
  userId: userHeadA,
  tenantRole: "PLACEMENT_HEAD",
  isPlatformAdmin: false,
};

vi.mock("@/lib/auth/server-context", () => ({
  requireAuthContext: vi.fn(async (permission?: string) => {
    if (mockCurrentAuthContext.tenantRole === "STUDENT") {
      throw new Error("FORBIDDEN");
    }
    return mockCurrentAuthContext;
  }),
}));

describe("UrPlaced Phase 2 — Secure Delete Actions Suite", () => {
  beforeEach(() => {
    mockQuestions = [];
    mockQuestionVersions = [];
    mockQuestionSets = [];
    mockQuestionSetItems = [];
    mockAssessments = [];
    mockAssessmentAttempts = [];
    mockAssessmentAssignments = [];
    mockAttemptResponses = [];

    mockCurrentAuthContext = {
      tenantId: tenantA,
      userId: userHeadA,
      tenantRole: "PLACEMENT_HEAD",
      isPlatformAdmin: false,
    };
  });

  describe("Area 1: QuestionBank Sentinel Question Deletion", () => {
    it("permanently deletes an unreferenced DRAFT question and versions", async () => {
      const qId = "q-draft-test";
      mockQuestions.push({ id: qId, tenant_id: tenantA, lifecycle_status: "DRAFT" });
      mockQuestionVersions.push({ id: "v-1", tenant_id: tenantA, question_id: qId });

      const res = await QuestionService.deleteQuestion(tenantA, qId);
      expect(res.success).toBe(true);
      expect(res.deleted).toBe(true);
      expect(mockQuestions.find((q) => q.id === qId)).toBeUndefined();
      expect(mockQuestionVersions.filter((v) => v.question_id === qId).length).toBe(0);
    });

    it("permanently deletes an unreferenced APPROVED question (e.g. from Batch Import)", async () => {
      const qId = "q-approved-test";
      mockQuestions.push({ id: qId, tenant_id: tenantA, lifecycle_status: "APPROVED" });
      mockQuestionVersions.push({ id: "v-2", tenant_id: tenantA, question_id: qId });

      const res = await QuestionService.deleteQuestion(tenantA, qId);
      expect(res.success).toBe(true);
      expect(res.deleted).toBe(true);
      expect(mockQuestions.find((q) => q.id === qId)).toBeUndefined();
    });

    it("safely archives a question referenced in a question set to preserve blueprint integrity", async () => {
      const qId = "q-in-set-test";
      mockQuestions.push({ id: qId, tenant_id: tenantA, lifecycle_status: "APPROVED" });
      mockQuestionSetItems.push({ id: "item-1", tenant_id: tenantA, set_id: "set-1", question_id: qId });

      const res = await QuestionService.deleteQuestion(tenantA, qId);
      expect(res.success).toBe(true);
      expect(res.archived).toBe(true);
      expect(mockQuestions.find((q) => q.id === qId)?.lifecycle_status).toBe("ARCHIVED");
    });

    it("safely archives a question referenced in student attempt responses", async () => {
      const qId = "q-attempt-test";
      mockQuestions.push({ id: qId, tenant_id: tenantA, lifecycle_status: "PUBLISHED" });
      mockAttemptResponses.push({ id: "resp-1", tenant_id: tenantA, question_id: qId });

      const res = await QuestionService.deleteQuestion(tenantA, qId);
      expect(res.success).toBe(true);
      expect(res.archived).toBe(true);
      expect(mockQuestions.find((q) => q.id === qId)?.lifecycle_status).toBe("ARCHIVED");
    });

    it("enforces tenant boundary: Tenant B cannot delete Tenant A's question", async () => {
      const qId = "q-tenant-a";
      mockQuestions.push({ id: qId, tenant_id: tenantA, lifecycle_status: "DRAFT" });

      const res = await QuestionService.deleteQuestion(tenantB, qId);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Question not found.");
      expect(mockQuestions.find((q) => q.id === qId)).toBeDefined();
    });
  });

  describe("Area 2: Question Sets & Assessment Blueprints Deletion", () => {
    it("permanently deletes an unreferenced DRAFT question set and its item bindings", async () => {
      const setId = "set-draft-1";
      mockQuestionSets.push({ id: setId, tenant_id: tenantA, status: "DRAFT", is_locked: false });
      mockQuestionSetItems.push({ id: "item-a", tenant_id: tenantA, set_id: setId, question_id: "q-a" });

      const res = await QuestionSetService.deleteSet(tenantA, setId);
      expect(res.success).toBe(true);
      expect(res.deleted).toBe(true);
      expect(mockQuestionSets.find((s) => s.id === setId)).toBeUndefined();
      expect(mockQuestionSetItems.filter((i) => i.set_id === setId).length).toBe(0);
    });

    it("safely retires and archives published 'Demo Test' question set", async () => {
      const setId = "213d9ab6-cf8b-46ce-8dbf-ca925a3ca34f"; // Target set from screenshot
      mockQuestionSets.push({
        id: setId,
        tenant_id: tenantA,
        name: "Demo Test",
        status: "PUBLISHED",
        is_locked: true,
        version_number: 1,
      });

      const res = await QuestionSetService.deleteSet(tenantA, setId);
      expect(res.success).toBe(true);
      expect(res.archived).toBe(true);
      expect(mockQuestionSets.find((s) => s.id === setId)?.status).toBe("ARCHIVED");
    });

    it("safely archives a question set that is referenced by an assessment", async () => {
      const setId = "set-referenced-1";
      mockQuestionSets.push({ id: setId, tenant_id: tenantA, status: "DRAFT", is_locked: false });
      mockAssessments.push({ id: "ass-1", tenant_id: tenantA, question_set_id: setId });

      const res = await QuestionSetService.deleteSet(tenantA, setId);
      expect(res.success).toBe(true);
      expect(res.archived).toBe(true);
      expect(mockQuestionSets.find((s) => s.id === setId)?.status).toBe("ARCHIVED");
    });

    it("QuestionSetService.listSets filters out ARCHIVED question sets from active staff listing", async () => {
      mockQuestionSets.push(
        { id: "s-active", tenant_id: tenantA, name: "Active Blueprint", status: "PUBLISHED" },
        { id: "s-archived", tenant_id: tenantA, name: "Retired Set", status: "ARCHIVED" }
      );

      const query = await QuestionSetService.listSets(tenantA, "PLACEMENT_HEAD");
      const { data } = query as any;
      expect(data.length).toBe(1);
      expect(data[0].id).toBe("s-active");
    });

    it("enforces tenant boundary: Tenant B cannot delete Tenant A's question set", async () => {
      const setId = "set-tenant-a";
      mockQuestionSets.push({ id: setId, tenant_id: tenantA, status: "DRAFT", is_locked: false });

      const res = await QuestionSetService.deleteSet(tenantB, setId);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Question set not found.");
      expect(mockQuestionSets.find((s) => s.id === setId)).toBeDefined();
    });
  });

  describe("Area 3: Assessment Engine Assessment Deletion", () => {
    it("permanently deletes published 'Demo Testing Phase' assessment with 0 attempts", async () => {
      const assessId = "assess-demo-testing-phase";
      mockAssessments.push({
        id: assessId,
        tenant_id: tenantA,
        title: "Demo Testing Phase",
        status: "PUBLISHED",
      });

      const res = await AssessmentService.deleteAssessment(tenantA, assessId);
      expect(res.success).toBe(true);
      expect(res.deleted).toBe(true);
      expect(mockAssessments.find((a) => a.id === assessId)).toBeUndefined();
    });

    it("permanently deletes an assessment, assignments and attempts when candidate attempts exist", async () => {
      const assessId = "assess-with-attempts";
      mockAssessments.push({
        id: assessId,
        tenant_id: tenantA,
        title: "Campus Mock Exam",
        status: "PUBLISHED",
      });
      mockAssessmentAttempts.push({
        id: "att-1",
        tenant_id: tenantA,
        assessment_id: assessId,
      });
      mockAssessmentAssignments.push({
        id: "assign-att-1",
        tenant_id: tenantA,
        assessment_id: assessId,
        status: "ACTIVE",
      });

      const res = await AssessmentService.deleteAssessment(tenantA, assessId);
      expect(res.success).toBe(true);
      expect(res.deleted).toBe(true);
      expect(mockAssessments.find((a) => a.id === assessId)).toBeUndefined();
      expect(mockAssessmentAssignments.find((a) => a.assessment_id === assessId)).toBeUndefined();
      expect(mockAssessmentAttempts.find((a) => a.assessment_id === assessId)).toBeUndefined();
    });

    it("successfully deletes an assessment with active assignments when attempts are zero, cleanly unlinking assignments", async () => {
      const assessId = "assess-assigned";
      mockAssessments.push({
        id: assessId,
        tenant_id: tenantA,
        title: "Active Batch Assessment",
        status: "PUBLISHED",
      });
      mockAssessmentAssignments.push({
        id: "assign-1",
        tenant_id: tenantA,
        assessment_id: assessId,
        status: "ACTIVE",
      });

      const res = await AssessmentService.deleteAssessment(tenantA, assessId);
      expect(res.success).toBe(true);
      expect(res.deleted).toBe(true);
      expect(mockAssessments.find((a) => a.id === assessId)).toBeUndefined();
      expect(mockAssessmentAssignments.find((a) => a.assessment_id === assessId)).toBeUndefined();
    });

    it("enforces tenant boundary: Tenant B cannot delete Tenant A's assessment", async () => {
      const assessId = "assess-tenant-a";
      mockAssessments.push({ id: assessId, tenant_id: tenantA, status: "DRAFT" });

      const res = await AssessmentService.deleteAssessment(tenantB, assessId);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Assessment not found.");
      expect(mockAssessments.find((a) => a.id === assessId)).toBeDefined();
    });
  });

  describe("Area 4: Route Handlers & Authorization", () => {
    it("DELETE /api/questions/[id] permanently deletes unreferenced question", async () => {
      const qId = "route-q-1";
      mockQuestions.push({ id: qId, tenant_id: tenantA, lifecycle_status: "APPROVED" });

      const req = new NextRequest(`http://localhost:3000/api/questions/${qId}`);
      const res = await deleteQuestionRoute(req, { params: Promise.resolve({ id: qId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.deleted).toBe(true);
      expect(mockQuestions.find((q) => q.id === qId)).toBeUndefined();
    });

    it("DELETE /api/questions/sets/[id] safely archives published question set", async () => {
      const setId = "route-set-1";
      mockQuestionSets.push({ id: setId, tenant_id: tenantA, status: "PUBLISHED", is_locked: true });

      const req = new NextRequest(`http://localhost:3000/api/questions/sets/${setId}`);
      const res = await deleteSetRoute(req, { params: Promise.resolve({ id: setId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.archived).toBe(true);
      expect(mockQuestionSets.find((s) => s.id === setId)?.status).toBe("ARCHIVED");
    });

    it("DELETE /api/placement/assessments/[id] deletes published assessment with 0 attempts", async () => {
      const assessId = "route-ass-1";
      mockAssessments.push({ id: assessId, tenant_id: tenantA, status: "PUBLISHED" });

      const req = new NextRequest(`http://localhost:3000/api/placement/assessments/${assessId}`);
      const res = await deleteAssessmentRoute(req, { params: Promise.resolve({ id: assessId }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.deleted).toBe(true);
      expect(mockAssessments.find((a) => a.id === assessId)).toBeUndefined();
    });

    it("strictly blocks unauthorized role (STUDENT) from executing any delete action", async () => {
      mockCurrentAuthContext = {
        tenantId: tenantA,
        userId: "student-user",
        tenantRole: "STUDENT",
        isPlatformAdmin: false,
      };

      const req = new NextRequest(`http://localhost:3000/api/placement/assessments/test-id`);
      const res = await deleteAssessmentRoute(req, { params: Promise.resolve({ id: "test-id" }) });
      expect(res.status).toBe(403);
    });
  });
});
