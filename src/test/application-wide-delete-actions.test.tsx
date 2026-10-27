import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestionSetService } from "@/modules/question-bank/services/question-set-service";
import { AssessmentService } from "@/modules/assessments/services/assessment-service";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import {
  deleteInvitation,
  listTenantInvitations,
} from "@/modules/identity-access/services/invitation-service";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import * as SupabaseServerModule from "@/lib/supabase/server";
import * as SupabaseAdminModule from "@/lib/supabase/admin";
import * as ServerContextModule from "@/lib/auth/server-context";
import { DELETE as deleteSetRoute, POST as postSetRoute } from "@/app/api/questions/sets/[id]/route";
import { DELETE as deleteAssessmentRoute } from "@/app/api/placement/assessments/[id]/route";
import { DELETE as deleteQuestionRoute, GET as getQuestionRoute } from "@/app/api/questions/[id]/route";
import { NextRequest } from "next/server";

// In-memory test stores
let mockQuestionSets: any[] = [];
let mockQuestionSetItems: any[] = [];
let mockAssessments: any[] = [];
let mockAssessmentAttempts: any[] = [];
let mockAssessmentAssignments: any[] = [];
let mockQuestions: any[] = [];
let mockQuestionVersions: any[] = [];
let mockQuestionBanks: any[] = [];
let mockInvitations: any[] = [];
let mockMemberships: any[] = [];

function createMockSupabaseClient() {
  return {
    from: (table: string) => {
      const filters: any = {};
      let isDelete = false;
      let countExact = false;
      let isHead = false;

      const getFilteredData = () => {
        let store: any[] = [];
        if (table === "question_sets") store = mockQuestionSets;
        else if (table === "question_set_items") store = mockQuestionSetItems;
        else if (table === "assessments") store = mockAssessments;
        else if (table === "assessment_attempts") store = mockAssessmentAttempts;
        else if (table === "assessment_assignments") store = mockAssessmentAssignments;
        else if (table === "questions") store = mockQuestions;
        else if (table === "question_versions") store = mockQuestionVersions;
        else if (table === "question_banks") store = mockQuestionBanks;
        else if (table === "invitations") store = mockInvitations;
        else if (table === "tenant_memberships") store = mockMemberships;

        return store.filter((r) => {
          for (const [k, v] of Object.entries(filters)) {
            if (r[k] !== v) return false;
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

        if (table === "question_sets") mockQuestionSets = mockQuestionSets.filter((r) => !deleteFilter(r));
        if (table === "question_set_items") mockQuestionSetItems = mockQuestionSetItems.filter((r) => !deleteFilter(r));
        if (table === "assessments") mockAssessments = mockAssessments.filter((r) => !deleteFilter(r));
        if (table === "questions") mockQuestions = mockQuestions.filter((r) => !deleteFilter(r));
        if (table === "question_versions") mockQuestionVersions = mockQuestionVersions.filter((r) => !deleteFilter(r));
        if (table === "question_banks") mockQuestionBanks = mockQuestionBanks.filter((r) => !deleteFilter(r));
        if (table === "invitations") mockInvitations = mockInvitations.filter((r) => !deleteFilter(r));
      };

      const builder: any = {
        select: vi.fn((_fields?: string, options?: any) => {
          if (options?.count === "exact") countExact = true;
          if (options?.head) isHead = true;
          return builder;
        }),
        eq: vi.fn((col: string, val: any) => {
          filters[col] = val;
          return builder;
        }),
        ilike: vi.fn((col: string, val: any) => {
          filters[col] = val;
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
        insert: vi.fn((rows: any) => {
          const arr = Array.isArray(rows) ? rows : [rows];
          arr.forEach((r) => {
            const row = { id: r.id || `row-${Date.now()}-${Math.random()}`, ...r };
            if (table === "question_sets") mockQuestionSets.push(row);
            if (table === "question_set_items") mockQuestionSetItems.push(row);
            if (table === "assessments") mockAssessments.push(row);
            if (table === "questions") mockQuestions.push(row);
            if (table === "question_versions") mockQuestionVersions.push(row);
            if (table === "question_banks") mockQuestionBanks.push(row);
            if (table === "invitations") mockInvitations.push(row);
          });
          return builder;
        }),
        update: vi.fn((updates: any) => {
          let targetRows: any[] = [];
          if (table === "question_sets") targetRows = mockQuestionSets;
          if (table === "assessments") targetRows = mockAssessments;
          if (table === "questions") targetRows = mockQuestions;
          if (table === "invitations") targetRows = mockInvitations;

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

          const filtered = getFilteredData();

          if (countExact) {
            return resolve({ data: isHead ? null : filtered, count: filtered.length, error: null });
          }

          return resolve({ data: filtered, error: null });
        },
      };

      return builder;
    },
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(async () => ({ data: null, error: { message: "Not found" } })),
        upload: vi.fn(async () => ({ error: null })),
        remove: vi.fn(async () => ({ error: null })),
        list: vi.fn(async () => ({ data: [], error: null })),
      })),
      getBucket: vi.fn(async () => ({ data: { name: "system_invitations" }, error: null })),
      createBucket: vi.fn(async () => ({ data: null, error: null })),
    },
  };
}

describe("Application-Wide Delete Actions Audit & Verification Suite", () => {
  const tenantA = "00000000-0000-0000-0000-000000000001";
  const tenantB = "00000000-0000-0000-0000-000000000002";
  const userId = "00000000-0000-0000-0000-000000000010";

  beforeEach(() => {
    mockQuestionSets = [];
    mockQuestionSetItems = [];
    mockAssessments = [];
    mockAssessmentAttempts = [];
    mockAssessmentAssignments = [];
    mockQuestions = [];
    mockQuestionVersions = [];
    mockQuestionBanks = [];
    mockInvitations = [];
    mockMemberships = [];

    vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockImplementation(async () => {
      return createMockSupabaseClient() as any;
    });

    vi.spyOn(SupabaseAdminModule, "createAdminClient").mockImplementation(() => {
      return createMockSupabaseClient() as any;
    });
  });

  describe("1. Question Set & Item Deletion (`QuestionSetService`)", () => {
    it("successfully deletes a draft, unlocked question set and cleans up bound items", async () => {
      const qsetId = "qset-draft-1";
      mockQuestionSets.push({
        id: qsetId,
        tenant_id: tenantA,
        name: "Demo Test (Draft)",
        status: "DRAFT",
        is_locked: false,
        version_number: 1,
      });

      mockQuestionSetItems.push(
        { id: "item-1", tenant_id: tenantA, set_id: qsetId, question_id: "q-1" },
        { id: "item-2", tenant_id: tenantA, set_id: qsetId, question_id: "q-2" }
      );

      const res = await QuestionSetService.deleteSet(tenantA, qsetId);
      expect(res.success).toBe(true);

      // Verify set removed
      expect(mockQuestionSets.find((s) => s.id === qsetId)).toBeUndefined();
      // Verify items deleted
      expect(mockQuestionSetItems.filter((i) => i.set_id === qsetId).length).toBe(0);
    });

    it("rejects deletion of a locked question set snapshot to preserve historical integrity", async () => {
      const qsetId = "qset-locked-1";
      mockQuestionSets.push({
        id: qsetId,
        tenant_id: tenantA,
        name: "Published Final Exam Snapshot",
        status: "PUBLISHED",
        is_locked: true,
        version_number: 1,
      });

      const res = await QuestionSetService.deleteSet(tenantA, qsetId);
      expect(res.success).toBe(false);
      expect(res.error).toContain("locked or published");
      expect(mockQuestionSets.find((s) => s.id === qsetId)).toBeDefined();
    });

    it("rejects deletion of a question set referenced by an existing assessment", async () => {
      const qsetId = "qset-referenced-1";
      mockQuestionSets.push({
        id: qsetId,
        tenant_id: tenantA,
        name: "Midterm Assessment Bank",
        status: "DRAFT",
        is_locked: false,
        version_number: 1,
      });

      mockAssessments.push({
        id: "assess-1",
        tenant_id: tenantA,
        title: "Active Midterm",
        question_set_id: qsetId,
        status: "DRAFT",
      });

      const res = await QuestionSetService.deleteSet(tenantA, qsetId);
      expect(res.success).toBe(false);
      expect(res.error).toContain("referenced by one or more assessments");
      expect(mockQuestionSets.find((s) => s.id === qsetId)).toBeDefined();
    });

    it("enforces strict tenant isolation: rejects deleting another institution's question set", async () => {
      const qsetId = "qset-tenant-b";
      mockQuestionSets.push({
        id: qsetId,
        tenant_id: tenantB,
        name: "College Beta Test",
        status: "DRAFT",
        is_locked: false,
      });

      const res = await QuestionSetService.deleteSet(tenantA, qsetId);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Question set not found.");
      expect(mockQuestionSets.find((s) => s.id === qsetId)).toBeDefined();
    });

    it("successfully removes an individual question item from an unlocked draft set", async () => {
      const qsetId = "qset-draft-remove";
      mockQuestionSets.push({
        id: qsetId,
        tenant_id: tenantA,
        name: "Test Blueprint",
        status: "DRAFT",
        is_locked: false,
      });
      mockQuestionSetItems.push(
        { id: "item-keep", tenant_id: tenantA, set_id: qsetId, question_id: "q-1" },
        { id: "item-remove", tenant_id: tenantA, set_id: qsetId, question_id: "q-2" }
      );

      const res = await QuestionSetService.removeItemFromSet(tenantA, qsetId, "item-remove");
      expect(res.success).toBe(true);
      expect(mockQuestionSetItems.find((i) => i.id === "item-remove")).toBeUndefined();
      expect(mockQuestionSetItems.find((i) => i.id === "item-keep")).toBeDefined();
    });

    it("rejects removing an item from a locked question set snapshot", async () => {
      const qsetId = "qset-locked-remove";
      mockQuestionSets.push({
        id: qsetId,
        tenant_id: tenantA,
        name: "Locked Exam Snapshot",
        status: "PUBLISHED",
        is_locked: true,
      });
      mockQuestionSetItems.push({
        id: "item-1",
        tenant_id: tenantA,
        set_id: qsetId,
        question_id: "q-1",
      });

      const res = await QuestionSetService.removeItemFromSet(tenantA, qsetId, "item-1");
      expect(res.success).toBe(false);
      expect(res.error).toContain("locked question set snapshot");
      expect(mockQuestionSetItems.length).toBe(1);
    });
  });

  describe("2. Issued Invitations Deletion (`invitation-service`)", () => {
    it("successfully deletes a REVOKED invitation row", async () => {
      const invId = "11111111-1111-1111-1111-111111111111";
      mockInvitations.push({
        id: invId,
        tenant_id: tenantA,
        email: "revoked.staff@college.edu",
        role: "PLACEMENT_STAFF",
        status: "REVOKED",
        token_hash: "hash-revoked-1",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
      });

      const res = await deleteInvitation(invId, tenantA);
      expect(res.success).toBe(true);
      expect(mockInvitations.find((i) => i.id === invId)).toBeUndefined();
    });

    it("successfully deletes an EXPIRED invitation row", async () => {
      const invId = "22222222-2222-2222-2222-222222222222";
      mockInvitations.push({
        id: invId,
        tenant_id: tenantA,
        email: "expired.trainer@college.edu",
        role: "TRAINER",
        status: "EXPIRED",
        token_hash: "hash-expired-2",
        expires_at: new Date(Date.now() - 86400000).toISOString(),
        created_at: new Date(Date.now() - 172800000).toISOString(),
      });

      const res = await deleteInvitation(invId, tenantA);
      expect(res.success).toBe(true);
      expect(mockInvitations.find((i) => i.id === invId)).toBeUndefined();
    });

    it("strictly rejects deleting an ACCEPTED invitation to preserve member onboarding audit trail", async () => {
      const invId = "33333333-3333-3333-3333-333333333333";
      mockInvitations.push({
        id: invId,
        tenant_id: tenantA,
        email: "active.head@college.edu",
        role: "PLACEMENT_HEAD",
        status: "ACCEPTED",
        token_hash: "hash-accepted-3",
        accepted_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        created_at: new Date().toISOString(),
      });

      // Also ensure staff account exists
      mockMemberships.push({
        id: "member-head-1",
        tenant_id: tenantA,
        user_id: "usr-head-1",
        role: "PLACEMENT_HEAD",
        status: "ACTIVE",
      });

      const res = await deleteInvitation(invId, tenantA);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Accepted invitations cannot be deleted");
      expect(mockInvitations.find((i) => i.id === invId)).toBeDefined();
      expect(mockMemberships.length).toBe(1);
    });

    it("strictly isolates tenants: rejects deleting another tenant's invitation", async () => {
      const invId = "44444444-4444-4444-4444-444444444444";
      mockInvitations.push({
        id: invId,
        tenant_id: tenantB,
        email: "beta.staff@college.edu",
        role: "PLACEMENT_STAFF",
        status: "REVOKED",
        token_hash: "hash-tenant-b",
        expires_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

      const res = await deleteInvitation(invId, tenantA);
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Access denied|not found/i);
      expect(mockInvitations.find((i) => i.id === invId)).toBeDefined();
    });
  });

  describe("3. Assessment Deletion (`AssessmentService`)", () => {
    it("successfully deletes an unassigned DRAFT assessment with zero attempts", async () => {
      const assessId = "assess-draft-clean";
      mockAssessments.push({
        id: assessId,
        tenant_id: tenantA,
        title: "Draft Screening Test (Mistake)",
        status: "DRAFT",
        question_set_id: "qset-1",
      });

      const res = await AssessmentService.deleteAssessment(tenantA, assessId);
      expect(res.success).toBe(true);
      expect(mockAssessments.find((a) => a.id === assessId)).toBeUndefined();
    });

    it("rejects deletion of a PUBLISHED assessment to protect institutional records", async () => {
      const assessId = "assess-published";
      mockAssessments.push({
        id: assessId,
        tenant_id: tenantA,
        title: "Live Campus Drive Test",
        status: "PUBLISHED",
        question_set_id: "qset-1",
      });

      const res = await AssessmentService.deleteAssessment(tenantA, assessId);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Only draft assessments can be deleted");
      expect(mockAssessments.find((a) => a.id === assessId)).toBeDefined();
    });

    it("rejects deletion of an assessment with student attempts recorded", async () => {
      const assessId = "assess-with-attempts";
      mockAssessments.push({
        id: assessId,
        tenant_id: tenantA,
        title: "Trial Test with Student Submissions",
        status: "DRAFT",
        question_set_id: "qset-1",
      });

      mockAssessmentAttempts.push({
        id: "attempt-1",
        tenant_id: tenantA,
        assessment_id: assessId,
        student_id: "stud-1",
        status: "SCORED",
      });

      const res = await AssessmentService.deleteAssessment(tenantA, assessId);
      expect(res.success).toBe(false);
      expect(res.error).toContain("student attempts have already been recorded");
      expect(mockAssessments.find((a) => a.id === assessId)).toBeDefined();
    });

    it("rejects deletion of an assessment with active cohort assignments", async () => {
      const assessId = "assess-with-assignments";
      mockAssessments.push({
        id: assessId,
        tenant_id: tenantA,
        title: "Assigned Test",
        status: "DRAFT",
        question_set_id: "qset-1",
      });

      mockAssessmentAssignments.push({
        id: "assign-1",
        tenant_id: tenantA,
        assessment_id: assessId,
        cohort_id: "cohort-cse-2026",
      });

      const res = await AssessmentService.deleteAssessment(tenantA, assessId);
      expect(res.success).toBe(false);
      expect(res.error).toContain("currently assigned to one or more cohorts");
      expect(mockAssessments.find((a) => a.id === assessId)).toBeDefined();
    });

    it("enforces tenant boundary on assessment deletion", async () => {
      const assessId = "assess-college-b";
      mockAssessments.push({
        id: assessId,
        tenant_id: tenantB,
        title: "College B Draft Test",
        status: "DRAFT",
      });

      const res = await AssessmentService.deleteAssessment(tenantA, assessId);
      expect(res.success).toBe(false);
      expect(res.error).toBe("Assessment not found.");
      expect(mockAssessments.find((a) => a.id === assessId)).toBeDefined();
    });
  });

  describe("4. Draft Question Deletion (`QuestionService`)", () => {
    it("successfully deletes an unreferenced DRAFT question and its versions", async () => {
      const qId = "q-draft-1";
      mockQuestions.push({
        id: qId,
        tenant_id: tenantA,
        lifecycle_status: "DRAFT",
      });

      mockQuestionVersions.push(
        { id: "ver-1", tenant_id: tenantA, question_id: qId, version_number: 1 },
        { id: "ver-2", tenant_id: tenantA, question_id: qId, version_number: 2 }
      );

      const res = await QuestionService.deleteQuestion(tenantA, qId);
      expect(res.success).toBe(true);
      expect(mockQuestions.find((q) => q.id === qId)).toBeUndefined();
      expect(mockQuestionVersions.filter((v) => v.question_id === qId).length).toBe(0);
    });

    it("rejects deleting an APPROVED question (directing to Archive/Withdraw instead)", async () => {
      const qId = "q-approved-1";
      mockQuestions.push({
        id: qId,
        tenant_id: tenantA,
        lifecycle_status: "APPROVED",
      });

      const res = await QuestionService.deleteQuestion(tenantA, qId);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Only draft questions can be permanently deleted");
      expect(mockQuestions.find((q) => q.id === qId)).toBeDefined();
    });

    it("rejects deleting a question referenced in Question Sets", async () => {
      const qId = "q-in-set-1";
      mockQuestions.push({
        id: qId,
        tenant_id: tenantA,
        lifecycle_status: "DRAFT",
      });

      mockQuestionSetItems.push({
        id: "item-ref-1",
        tenant_id: tenantA,
        set_id: "qset-1",
        question_id: qId,
      });

      const res = await QuestionService.deleteQuestion(tenantA, qId);
      expect(res.success).toBe(false);
      expect(res.error).toContain("referenced in one or more question sets");
      expect(mockQuestions.find((q) => q.id === qId)).toBeDefined();
    });

    it("successfully deletes an empty Question Bank", async () => {
      const bankId = "bank-empty-1";
      mockQuestionBanks.push({
        id: bankId,
        tenant_id: tenantA,
        name: "Temporary Scratch Bank",
      });

      const res = await QuestionService.deleteBank(tenantA, bankId);
      expect(res.success).toBe(true);
      expect(mockQuestionBanks.find((b) => b.id === bankId)).toBeUndefined();
    });

    it("rejects deleting a Question Bank that still contains questions", async () => {
      const bankId = "bank-populated-1";
      mockQuestionBanks.push({
        id: bankId,
        tenant_id: tenantA,
        name: "Core Java Bank",
      });

      mockQuestions.push({
        id: "q-in-bank-1",
        tenant_id: tenantA,
        bank_id: bankId,
        lifecycle_status: "DRAFT",
      });

      const res = await QuestionService.deleteBank(tenantA, bankId);
      expect(res.success).toBe(false);
      expect(res.error).toContain("contains questions");
      expect(mockQuestionBanks.find((b) => b.id === bankId)).toBeDefined();
    });

    it("QuestionService.getQuestionById returns question, bank, and versions seamlessly", async () => {
      const qId = "service-q-get";
      const bankId = "service-b-get";
      mockQuestionBanks.push({
        id: bankId,
        tenant_id: tenantA,
        name: "Algorithms Bank",
      });
      mockQuestions.push({
        id: qId,
        tenant_id: tenantA,
        bank_id: bankId,
        question_type: "SINGLE_CHOICE",
        lifecycle_status: "DRAFT",
      });
      mockQuestionVersions.push({
        id: "ver-service-1",
        tenant_id: tenantA,
        question_id: qId,
        version_number: 1,
        prompt: "Binary search tree lookup",
      });

      const res = await QuestionService.getQuestionById(tenantA, "PLACEMENT_HEAD", qId);
      expect(res.data).toBeDefined();
      expect(res.data.id).toBe(qId);
      expect(res.data.bank.name).toBe("Algorithms Bank");
      expect(res.data.versions.length).toBe(1);
    });
  });

  describe("5. Endpoints & Route Handlers Integration", () => {
    beforeEach(() => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockImplementation(async () => ({
        userId,
        email: "head@college.edu",
        tenantId: tenantA,
        tenantRole: "PLACEMENT_HEAD",
        isPlatformAdmin: false,
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      }));
    });

    it("DELETE /api/questions/sets/[id] deletes draft question set", async () => {
      const qsetId = "route-qset-draft";
      mockQuestionSets.push({
        id: qsetId,
        tenant_id: tenantA,
        name: "Draft Set for Endpoint Test",
        status: "DRAFT",
        is_locked: false,
      });

      const req = new NextRequest(`http://localhost:3000/api/questions/sets/${qsetId}`);
      const res = await deleteSetRoute(req, { params: Promise.resolve({ id: qsetId }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockQuestionSets.find((s) => s.id === qsetId)).toBeUndefined();
    });

    it("POST /api/questions/sets/[id] with REMOVE_ITEM removes item", async () => {
      const qsetId = "route-qset-items";
      mockQuestionSets.push({
        id: qsetId,
        tenant_id: tenantA,
        name: "Set for Item Removal",
        status: "DRAFT",
        is_locked: false,
      });
      mockQuestionSetItems.push({
        id: "item-to-remove",
        tenant_id: tenantA,
        set_id: qsetId,
        question_id: "q-1",
      });

      const req = new NextRequest(`http://localhost:3000/api/questions/sets/${qsetId}`, {
        method: "POST",
        body: JSON.stringify({ action: "REMOVE_ITEM", itemId: "item-to-remove" }),
      });
      const res = await postSetRoute(req, { params: Promise.resolve({ id: qsetId }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockQuestionSetItems.length).toBe(0);
    });

    it("DELETE /api/placement/assessments/[id] deletes draft assessment", async () => {
      const assessId = "route-assess-draft";
      mockAssessments.push({
        id: assessId,
        tenant_id: tenantA,
        title: "Endpoint Assessment",
        status: "DRAFT",
      });

      const req = new NextRequest(`http://localhost:3000/api/placement/assessments/${assessId}`);
      const res = await deleteAssessmentRoute(req, { params: Promise.resolve({ id: assessId }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(mockAssessments.find((a) => a.id === assessId)).toBeUndefined();
    });

    it("DELETE /api/questions/[id]?action=DELETE deletes draft question", async () => {
      const qId = "route-q-draft";
      mockQuestions.push({
        id: qId,
        tenant_id: tenantA,
        lifecycle_status: "DRAFT",
      });

      const req = new NextRequest(`http://localhost:3000/api/questions/${qId}?action=DELETE`);
      const res = await deleteQuestionRoute(req, { params: Promise.resolve({ id: qId }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.deleted).toBe(true);
      expect(mockQuestions.find((q) => q.id === qId)).toBeUndefined();
    });

    it("GET /api/questions/[id] returns full question detail with bank and versions", async () => {
      const qId = "route-q-detail";
      const bankId = "bank-detail-1";
      const verId = "ver-detail-1";

      mockQuestionBanks.push({
        id: bankId,
        tenant_id: tenantA,
        name: "Technical Core Bank",
        category: "TECHNICAL_CORE",
        sharing_policy: "COLLEGE_PRIVATE",
      });

      mockQuestions.push({
        id: qId,
        tenant_id: tenantA,
        bank_id: bankId,
        question_type: "SINGLE_CHOICE",
        current_version_id: verId,
        lifecycle_status: "DRAFT",
      });

      mockQuestionVersions.push({
        id: verId,
        tenant_id: tenantA,
        question_id: qId,
        version_number: 1,
        prompt: "What is time complexity of quicksort average case?",
        options: [{ id: "opt-1", text: "O(n log n)" }],
        answer_key: { correct_option_id: "opt-1" },
        review_status: "UNREVIEWED",
      });

      const req = new NextRequest(`http://localhost:3000/api/questions/${qId}`);
      const res = await getQuestionRoute(req, { params: Promise.resolve({ id: qId }) });
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.id).toBe(qId);
      expect(json.bank?.name).toBe("Technical Core Bank");
      expect(json.versions.length).toBe(1);
      expect(json.versions[0].prompt).toContain("quicksort");
    });

    it("GET /api/questions/[id] returns 404 for non-existent question or cross-tenant question", async () => {
      const otherTenantQId = "q-other-tenant";
      mockQuestions.push({
        id: otherTenantQId,
        tenant_id: tenantB,
        lifecycle_status: "DRAFT",
      });

      const req = new NextRequest(`http://localhost:3000/api/questions/${otherTenantQId}`);
      const res = await getQuestionRoute(req, { params: Promise.resolve({ id: otherTenantQId }) });
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBe("Question not found.");
    });
  });

  describe("6. UI Component: `<DeleteConfirmationDialog>`", () => {
    it("renders title, description, and itemName properly", () => {
      render(
        <DeleteConfirmationDialog
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Delete Assessment Test"
          description="Are you sure you want to delete this test?"
          itemName="Demo Placement Mock"
          confirmLabel="Delete Blueprint"
        />
      );

      expect(screen.getByText("Delete Assessment Test")).toBeDefined();
      expect(screen.getByText("Are you sure you want to delete this test?")).toBeDefined();
      expect(screen.getByText(/Demo Placement Mock/)).toBeDefined();
      expect(screen.getByRole("button", { name: /Delete Blueprint/i })).toBeDefined();
    });

    it("fires onConfirm when delete button is clicked", () => {
      const onConfirm = vi.fn();
      render(
        <DeleteConfirmationDialog
          isOpen={true}
          onClose={() => {}}
          onConfirm={onConfirm}
          title="Confirm Removal"
          description="Remove record permanently."
          confirmLabel="Confirm Delete"
        />
      );

      const deleteBtn = screen.getByRole("button", { name: /Confirm Delete/i });
      fireEvent.click(deleteBtn);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("fires onClose when cancel button is clicked", () => {
      const onClose = vi.fn();
      render(
        <DeleteConfirmationDialog
          isOpen={true}
          onClose={onClose}
          onConfirm={() => {}}
          title="Confirm Removal"
          description="Remove record permanently."
        />
      );

      const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
      fireEvent.click(cancelBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("disables buttons and indicates loading state when isLoading is true", () => {
      render(
        <DeleteConfirmationDialog
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Deleting In Progress"
          description="Removing data..."
          isLoading={true}
        />
      );

      expect(screen.getByText("Deleting...")).toBeDefined();
      const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
      expect((cancelBtn as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
