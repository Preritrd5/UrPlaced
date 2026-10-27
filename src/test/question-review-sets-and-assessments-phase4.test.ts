import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { QuestionSetService } from "@/modules/question-bank/services/question-set-service";
import { AssessmentService } from "@/modules/assessments/services/assessment-service";
import { AssignmentService } from "@/modules/assessments/services/assignment-service";
import { AttemptLifecycleService } from "@/modules/assessments/services/attempt-lifecycle-service";
import { can, Permissions, PolicyContext } from "@/modules/identity-access/services/policy-engine";
import * as ServerContextModule from "@/lib/auth/server-context";
import * as SupabaseServerModule from "@/lib/supabase/server";
import { POST as verifyRoute } from "@/app/api/questions/[id]/verify/route";
import { POST as publishRoute } from "@/app/api/questions/[id]/publish/route";

describe("Phase 4: Question Review, Question Sets & Assessment Integration", () => {
  const tenantA = "tenant-college-alpha-uuid";
  const tenantB = "tenant-college-beta-uuid";
  const placementHeadId = "user-placement-head-1";
  const trainerId = "user-trainer-1";
  const studentId = "student-profile-uuid-1";
  const studentUserId = "user-student-auth-1";

  const questionId1 = "question-uuid-1";
  const versionId1 = "version-uuid-1";
  const questionSetId1 = "qset-uuid-1";
  const assessmentId1 = "assessment-uuid-1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Policy Engine: Question Review & Publishing Authorizations", () => {
    it("allows PLACEMENT_HEAD and TRAINER to review question answer keys", () => {
      const headContext: PolicyContext = {
        userId: placementHeadId,
        tenantId: tenantA,
        role: "PLACEMENT_HEAD",
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
        isPlatformAdmin: false,
      };
      const trainerContext: PolicyContext = {
        userId: trainerId,
        tenantId: tenantA,
        role: "TRAINER",
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
        isPlatformAdmin: false,
      };

      expect(can(headContext, Permissions.QUESTIONS_REVIEW)).toBe(true);
      expect(can(trainerContext, Permissions.QUESTIONS_REVIEW)).toBe(true);
      expect(can(headContext, Permissions.QUESTIONS_PUBLISH)).toBe(true);
      expect(can(headContext, Permissions.QUESTION_SETS_MANAGE)).toBe(true);
    });

    it("strictly denies STUDENT role from reviewing, publishing questions or managing question sets", () => {
      const studentContext: PolicyContext = {
        userId: studentUserId,
        tenantId: tenantA,
        role: "STUDENT",
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
        isPlatformAdmin: false,
      };

      expect(can(studentContext, Permissions.QUESTIONS_REVIEW)).toBe(false);
      expect(can(studentContext, Permissions.QUESTIONS_PUBLISH)).toBe(false);
      expect(can(studentContext, Permissions.QUESTION_SETS_MANAGE)).toBe(false);
      expect(can(studentContext, Permissions.ASSESSMENTS_ATTEMPT)).toBe(true);
    });
  });

  describe("2. Review & Verification Workflow (QuestionService)", () => {
    it("promotes question lifecycle to APPROVED when answer key is verified as VERIFIED_CORRECT", async () => {
      const updatedVersions: any[] = [];
      const updatedQuestions: any[] = [];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {
            update: vi.fn((data: any) => {
              if (table === "question_versions") updatedVersions.push(data);
              if (table === "questions") updatedQuestions.push(data);
              return chain;
            }),
            eq: vi.fn(() => chain),
          };
          return chain;
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        mockSupabase as any
      );

      const res = await QuestionService.verifyAnswerKey(
        tenantA,
        placementHeadId,
        questionId1,
        versionId1,
        "VERIFIED_CORRECT",
        "Answer verified against standard algorithm text."
      );

      expect(res.success).toBe(true);
      expect(updatedVersions.length).toBeGreaterThan(0);
      expect(updatedVersions[0].review_status).toBe("VERIFIED_CORRECT");
      expect(updatedVersions[0].reviewed_by).toBe(placementHeadId);
      expect(updatedQuestions.length).toBeGreaterThan(0);
      expect(updatedQuestions[0].lifecycle_status).toBe("APPROVED");
    });

    it("reverts question lifecycle to DRAFT when answer key is rejected or marked for revision", async () => {
      const updatedVersions: any[] = [];
      const updatedQuestions: any[] = [];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {
            update: vi.fn((data: any) => {
              if (table === "question_versions") updatedVersions.push(data);
              if (table === "questions") updatedQuestions.push(data);
              return chain;
            }),
            eq: vi.fn(() => chain),
          };
          return chain;
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        mockSupabase as any
      );

      const res = await QuestionService.verifyAnswerKey(
        tenantA,
        placementHeadId,
        questionId1,
        versionId1,
        "REJECTED",
        "Ambiguous answer choices and incorrect key for option C."
      );

      expect(res.success).toBe(true);
      expect(updatedVersions[0].review_status).toBe("REJECTED");
      expect(updatedQuestions[0].lifecycle_status).toBe("DRAFT");
    });

    it("successfully publishes a question when review_status is VERIFIED_CORRECT", async () => {
      const updatedVersions: any[] = [];
      const updatedQuestions: any[] = [];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            single: vi.fn(() => {
              if (table === "questions") {
                return Promise.resolve({
                  data: { id: questionId1, current_version_id: versionId1, lifecycle_status: "APPROVED" },
                  error: null,
                });
              }
              if (table === "question_versions") {
                return Promise.resolve({
                  data: { id: versionId1, review_status: "VERIFIED_CORRECT" },
                  error: null,
                });
              }
              return Promise.resolve({ data: null, error: null });
            }),
            update: vi.fn((data: any) => {
              if (table === "question_versions") updatedVersions.push(data);
              if (table === "questions") updatedQuestions.push(data);
              return chain;
            }),
          };
          return chain;
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        mockSupabase as any
      );

      const res = await QuestionService.publishQuestion(tenantA, placementHeadId, questionId1);

      expect(res.success).toBe(true);
      expect(updatedQuestions[0].lifecycle_status).toBe("PUBLISHED");
      expect(updatedVersions[0].published_at).toBeDefined();
    });

    it("strictly blocks publishing when review_status is UNREVIEWED", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            single: vi.fn(() => {
              if (table === "questions") {
                return Promise.resolve({
                  data: { id: questionId1, current_version_id: versionId1, lifecycle_status: "DRAFT" },
                  error: null,
                });
              }
              if (table === "question_versions") {
                return Promise.resolve({
                  data: { id: versionId1, review_status: "UNREVIEWED" },
                  error: null,
                });
              }
              return Promise.resolve({ data: null, error: null });
            }),
            update: vi.fn().mockReturnThis(),
          };
          return chain;
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        mockSupabase as any
      );

      const res = await QuestionService.publishQuestion(tenantA, placementHeadId, questionId1);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/must be 'VERIFIED_CORRECT' before publishing/i);
    });
  });

  describe("3. Question Set Assembly & Eligibility Enforcement", () => {
    it("allows verified questions to be added to an active Question Set", async () => {
      const insertedItems: any[] = [];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            single: vi.fn(() => {
              if (table === "question_sets") {
                return Promise.resolve({
                  data: { id: questionSetId1, is_locked: false, status: "DRAFT" },
                  error: null,
                });
              }
              if (table === "questions") {
                return Promise.resolve({
                  data: { id: questionId1, current_version_id: versionId1, lifecycle_status: "APPROVED" },
                  error: null,
                });
              }
              if (table === "question_versions") {
                return Promise.resolve({
                  data: { id: versionId1, review_status: "VERIFIED_CORRECT" },
                  error: null,
                });
              }
              return Promise.resolve({ data: null, error: null });
            }),
            insert: vi.fn((data: any) => {
              insertedItems.push(data);
              return Promise.resolve({ error: null });
            }),
          };
          return chain;
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        mockSupabase as any
      );

      const res = await QuestionSetService.addItemsToSet(tenantA, questionSetId1, [
        { question_id: questionId1, points: 2.0 },
      ]);

      expect(res.success).toBe(true);
      expect(res.addedCount).toBe(1);
      expect(insertedItems.length).toBe(1);
      expect(insertedItems[0].points).toBe(2.0);
    });

    it("rejects unreviewed questions from being added to a Question Set", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            single: vi.fn(() => {
              if (table === "question_sets") {
                return Promise.resolve({
                  data: { id: questionSetId1, is_locked: false, status: "DRAFT" },
                  error: null,
                });
              }
              if (table === "questions") {
                return Promise.resolve({
                  data: { id: questionId1, current_version_id: versionId1, lifecycle_status: "DRAFT" },
                  error: null,
                });
              }
              if (table === "question_versions") {
                return Promise.resolve({
                  data: { id: versionId1, review_status: "UNREVIEWED" },
                  error: null,
                });
              }
              return Promise.resolve({ data: null, error: null });
            }),
            insert: vi.fn().mockReturnThis(),
          };
          return chain;
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        mockSupabase as any
      );

      const res = await QuestionSetService.addItemsToSet(tenantA, questionSetId1, [
        { question_id: questionId1 },
      ]);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/is not eligible/i);
    });

    it("rejects questions with APPROVED lifecycle but UNREVIEWED version (APPROVED + UNREVIEWED inconsistency)", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            single: vi.fn(() => {
              if (table === "question_sets") {
                return Promise.resolve({
                  data: { id: questionSetId1, is_locked: false, status: "DRAFT" },
                  error: null,
                });
              }
              if (table === "questions") {
                return Promise.resolve({
                  data: { id: questionId1, current_version_id: versionId1, lifecycle_status: "APPROVED" },
                  error: null,
                });
              }
              if (table === "question_versions") {
                return Promise.resolve({
                  data: { id: versionId1, review_status: "UNREVIEWED" },
                  error: null,
                });
              }
              return Promise.resolve({ data: null, error: null });
            }),
            insert: vi.fn().mockReturnThis(),
          };
          return chain;
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        mockSupabase as any
      );

      const res = await QuestionSetService.addItemsToSet(tenantA, questionSetId1, [
        { question_id: questionId1 },
      ]);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/is not eligible/i);
      expect(res.error).toMatch(/UNREVIEWED/i);
    });

    it("rejects questions with VERIFIED_CORRECT version but DRAFT lifecycle (DRAFT + VERIFIED_CORRECT transition bypass prevention)", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            single: vi.fn(() => {
              if (table === "question_sets") {
                return Promise.resolve({
                  data: { id: questionSetId1, is_locked: false, status: "DRAFT" },
                  error: null,
                });
              }
              if (table === "questions") {
                return Promise.resolve({
                  data: { id: questionId1, current_version_id: versionId1, lifecycle_status: "DRAFT" },
                  error: null,
                });
              }
              if (table === "question_versions") {
                return Promise.resolve({
                  data: { id: versionId1, review_status: "VERIFIED_CORRECT" },
                  error: null,
                });
              }
              return Promise.resolve({ data: null, error: null });
            }),
            insert: vi.fn().mockReturnThis(),
          };
          return chain;
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        mockSupabase as any
      );

      const res = await QuestionSetService.addItemsToSet(tenantA, questionSetId1, [
        { question_id: questionId1 },
      ]);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/is not eligible/i);
      expect(res.error).toMatch(/lifecycle: 'DRAFT'/i);
    });

    it("rejects questions with NEEDS_REVISION or REJECTED version review status", async () => {
      for (const invalidStatus of ["NEEDS_REVISION", "REJECTED"]) {
        const mockSupabase = {
          from: vi.fn((table: string) => {
            const chain: any = {
              select: vi.fn(() => chain),
              eq: vi.fn(() => chain),
              single: vi.fn(() => {
                if (table === "question_sets") {
                  return Promise.resolve({
                    data: { id: questionSetId1, is_locked: false, status: "DRAFT" },
                    error: null,
                  });
                }
                if (table === "questions") {
                  return Promise.resolve({
                    data: { id: questionId1, current_version_id: versionId1, lifecycle_status: "APPROVED" },
                    error: null,
                  });
                }
                if (table === "question_versions") {
                  return Promise.resolve({
                    data: { id: versionId1, review_status: invalidStatus },
                    error: null,
                  });
                }
                return Promise.resolve({ data: null, error: null });
              }),
              insert: vi.fn().mockReturnThis(),
            };
            return chain;
          }),
        };

        vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
          mockSupabase as any
        );

        const res = await QuestionSetService.addItemsToSet(tenantA, questionSetId1, [
          { question_id: questionId1 },
        ]);

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/is not eligible/i);
        expect(res.error).toContain(invalidStatus);
      }
    });

    it("allows properly reviewed and approved or published questions (APPROVED+VERIFIED_CORRECT and PUBLISHED+VERIFIED_CORRECT)", async () => {
      for (const validLifecycle of ["APPROVED", "PUBLISHED"]) {
        const insertedItems: any[] = [];
        const mockSupabase = {
          from: vi.fn((table: string) => {
            const chain: any = {
              select: vi.fn(() => chain),
              eq: vi.fn(() => chain),
              single: vi.fn(() => {
                if (table === "question_sets") {
                  return Promise.resolve({
                    data: { id: questionSetId1, is_locked: false, status: "DRAFT" },
                    error: null,
                  });
                }
                if (table === "questions") {
                  return Promise.resolve({
                    data: { id: questionId1, current_version_id: versionId1, lifecycle_status: validLifecycle },
                    error: null,
                  });
                }
                if (table === "question_versions") {
                  return Promise.resolve({
                    data: { id: versionId1, review_status: "VERIFIED_CORRECT" },
                    error: null,
                  });
                }
                return Promise.resolve({ data: null, error: null });
              }),
              insert: vi.fn((data: any) => {
                insertedItems.push(data);
                return Promise.resolve({ error: null });
              }),
            };
            return chain;
          }),
        };

        vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
          mockSupabase as any
        );

        const res = await QuestionSetService.addItemsToSet(tenantA, questionSetId1, [
          { question_id: questionId1 },
        ]);

        expect(res.success).toBe(true);
        expect(res.addedCount).toBe(1);
        expect(insertedItems.length).toBe(1);
      }
    });

    it("rejects lockAndPublishSet when set contains an APPROVED + UNREVIEWED question", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            single: vi.fn(() =>
              Promise.resolve({
                data: { id: questionSetId1, is_locked: false, status: "DRAFT" },
                error: null,
              })
            ),
          };
          chain.then = (resolve: any) =>
            resolve({
              data: [
                {
                  id: "item-1",
                  question_id: questionId1,
                  version_id: versionId1,
                  question: { id: questionId1, lifecycle_status: "APPROVED" },
                  version: { id: versionId1, review_status: "UNREVIEWED" },
                },
              ],
              error: null,
            });
          return chain;
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        mockSupabase as any
      );

      const res = await QuestionSetService.lockAndPublishSet(tenantA, questionSetId1);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/is not eligible/i);
      expect(res.error).toMatch(/UNREVIEWED/i);
    });

    it("rejects lockAndPublishSet when set contains a DRAFT + VERIFIED_CORRECT question", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            single: vi.fn(() =>
              Promise.resolve({
                data: { id: questionSetId1, is_locked: false, status: "DRAFT" },
                error: null,
              })
            ),
          };
          chain.then = (resolve: any) =>
            resolve({
              data: [
                {
                  id: "item-1",
                  question_id: questionId1,
                  version_id: versionId1,
                  question: { id: questionId1, lifecycle_status: "DRAFT" },
                  version: { id: versionId1, review_status: "VERIFIED_CORRECT" },
                },
              ],
              error: null,
            });
          return chain;
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        mockSupabase as any
      );

      const res = await QuestionSetService.lockAndPublishSet(tenantA, questionSetId1);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/is not eligible/i);
      expect(res.error).toMatch(/lifecycle: 'DRAFT'/i);
    });

    it("rejects lockAndPublishSet when set contains a NEEDS_REVISION or REJECTED question", async () => {
      for (const invalidStatus of ["NEEDS_REVISION", "REJECTED"]) {
        const mockSupabase = {
          from: vi.fn((table: string) => {
            const chain: any = {
              select: vi.fn(() => chain),
              eq: vi.fn(() => chain),
              single: vi.fn(() =>
                Promise.resolve({
                  data: { id: questionSetId1, is_locked: false, status: "DRAFT" },
                  error: null,
                })
              ),
            };
            chain.then = (resolve: any) =>
              resolve({
                data: [
                  {
                    id: "item-1",
                    question_id: questionId1,
                    version_id: versionId1,
                    question: { id: questionId1, lifecycle_status: "APPROVED" },
                    version: { id: versionId1, review_status: invalidStatus },
                  },
                ],
                error: null,
              });
            return chain;
          }),
        };

        vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
          mockSupabase as any
        );

        const res = await QuestionSetService.lockAndPublishSet(tenantA, questionSetId1);

        expect(res.success).toBe(false);
        expect(res.error).toMatch(/is not eligible/i);
        expect(res.error).toContain(invalidStatus);
      }
    });

    it("rejects questions belonging to a different tenant (Cross-Tenant Protection)", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            single: vi.fn(() => {
              if (table === "question_sets") {
                return Promise.resolve({
                  data: { id: questionSetId1, is_locked: false, status: "DRAFT" },
                  error: null,
                });
              }
              if (table === "questions") {
                // Tenant mismatch: not found in tenantA
                return Promise.resolve({ data: null, error: { message: "Row not found" } });
              }
              return Promise.resolve({ data: null, error: null });
            }),
            insert: vi.fn().mockReturnThis(),
          };
          return chain;
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        mockSupabase as any
      );

      const res = await QuestionSetService.addItemsToSet(tenantA, questionSetId1, [
        { question_id: "cross-tenant-question-id" },
      ]);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/not found or does not belong to this institution/i);
    });

    it("rejects locking and publishing an empty Question Set", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            single: vi.fn(() =>
              Promise.resolve({
                data: { id: questionSetId1, is_locked: false, status: "DRAFT" },
                error: null,
              })
            ),
          };
          chain.then = (resolve: any) => resolve({ data: [], error: null });
          return chain;
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        mockSupabase as any
      );

      const res = await QuestionSetService.lockAndPublishSet(tenantA, questionSetId1);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Cannot publish an empty question set/i);
    });
  });

  describe("4. Assessment Engine & Publishing Safeguards", () => {
    it("successfully creates and publishes an assessment when its Question Set is valid and populated", async () => {
      const updatedAssessments: any[] = [];

      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            single: vi.fn(() => {
              if (table === "assessments") {
                return Promise.resolve({
                  data: { id: assessmentId1, question_set_id: questionSetId1, status: "DRAFT" },
                  error: null,
                });
              }
              if (table === "question_sets") {
                return Promise.resolve({
                  data: { id: questionSetId1, is_locked: true, status: "PUBLISHED" },
                  error: null,
                });
              }
              return Promise.resolve({ data: null, error: null });
            }),
            update: vi.fn((data: any) => {
              if (table === "assessments") updatedAssessments.push(data);
              return chain;
            }),
          };
          chain.then = (resolve: any) => {
            if (table === "question_set_items") {
              return resolve({ count: 5, data: [{ id: "item-1" }], error: null });
            }
            return resolve({ data: null, error: null });
          };
          return chain;
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        mockSupabase as any
      );

      const res = await AssessmentService.publishAssessment(tenantA, assessmentId1);

      expect(res.success).toBe(true);
      expect(updatedAssessments.length).toBe(1);
      expect(updatedAssessments[0].status).toBe("PUBLISHED");
    });

    it("rejects publishing an assessment if its Question Set has 0 questions", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            single: vi.fn(() => {
              if (table === "assessments") {
                return Promise.resolve({
                  data: { id: assessmentId1, question_set_id: questionSetId1, status: "DRAFT" },
                  error: null,
                });
              }
              if (table === "question_sets") {
                return Promise.resolve({
                  data: { id: questionSetId1, is_locked: true, status: "PUBLISHED" },
                  error: null,
                });
              }
              return Promise.resolve({ data: null, error: null });
            }),
          };
          chain.then = (resolve: any) => {
            if (table === "question_set_items") {
              return resolve({ count: 0, data: [], error: null });
            }
            return resolve({ data: null, error: null });
          };
          return chain;
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        mockSupabase as any
      );

      const res = await AssessmentService.publishAssessment(tenantA, assessmentId1);

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/zero questions/i);
    });

    it("rejects assigning an assessment to students if assessment status is DRAFT", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            single: vi.fn(() => {
              if (table === "assessments") {
                return Promise.resolve({
                  data: { id: assessmentId1, status: "DRAFT" },
                  error: null,
                });
              }
              return Promise.resolve({ data: null, error: null });
            }),
          };
          return chain;
        }),
      };

      vi.spyOn(SupabaseServerModule, "createServerSupabaseClient").mockResolvedValue(
        mockSupabase as any
      );

      const res = await AssignmentService.assignAssessment(tenantA, placementHeadId, {
        assessment_id: assessmentId1,
        student_ids: [studentId],
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Only published assessments can be assigned/i);
    });
  });

  describe("5. Student Security & Sanitization Boundaries", () => {
    it("sanitizes MCQ questions so answer_key and explanation are completely stripped for students", () => {
      const rawMcqVersion = {
        id: "ver-1",
        version_number: 1,
        prompt: "What is the time complexity of quicksort average case?",
        options: [
          { id: "A", text: "O(n log n)" },
          { id: "B", text: "O(n^2)" },
        ],
        answer_key: { correct_option_id: "A" },
        explanation: "Partitioning splits the problem into two halves on average.",
      };

      const sanitized = QuestionService.sanitizeForStudent(rawMcqVersion, "SINGLE_CHOICE");

      expect(sanitized.prompt).toBe("What is the time complexity of quicksort average case?");
      expect(sanitized.options).toBeDefined();
      expect((sanitized as any).answer_key).toBeUndefined();
      expect((sanitized as any).explanation).toBeUndefined();
    });

    it("sanitizes Coding questions so hidden test cases and solutions are completely stripped", () => {
      const rawCodingVersion = {
        id: "ver-2",
        version_number: 1,
        prompt: "Write a function to return fibonacci(n).",
        answer_key: {
          language_templates: { python: "def fib(n): pass" },
          test_cases: [
            { input: "3", expected_output: "2", is_hidden: false, explanation: "Public sample" },
            { input: "10", expected_output: "55", is_hidden: true, explanation: "Hidden test 1" },
            { input: "50", expected_output: "12586269025", is_hidden: true, explanation: "Hidden test 2" },
          ],
        },
        explanation: "Use memoization or bottom-up DP to achieve O(n) time.",
      };

      const sanitized = QuestionService.sanitizeForStudent(rawCodingVersion, "CODING");

      expect(sanitized.prompt).toBe("Write a function to return fibonacci(n).");
      expect((sanitized as any).explanation).toBeUndefined();
      const studentKey = sanitized.answer_key as any;
      expect(studentKey).toBeDefined();
      expect(studentKey.language_templates).toBeDefined();
      expect(studentKey.test_cases.length).toBe(1);
      expect(studentKey.test_cases[0].is_hidden).toBe(false);
      expect(studentKey.test_cases[0].input).toBe("3");
    });
  });

  describe("6. API Route Verification & Role-Based Guard Enforcement", () => {
    it("POST /api/questions/[id]/verify rejects unauthenticated or unauthorized users", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockRejectedValue(
        new Error("FORBIDDEN")
      );

      const request = new NextRequest("http://localhost:3000/api/questions/q1/verify", {
        method: "POST",
        body: JSON.stringify({
          versionId: "v1",
          reviewStatus: "VERIFIED_CORRECT",
        }),
      });

      const res = await verifyRoute(request, { params: Promise.resolve({ id: "q1" }) });
      expect(res.status).toBe(403);
    });

    it("POST /api/questions/[id]/publish executes successfully for authorized placement staff", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue({
        userId: placementHeadId,
        email: "head@college.edu",
        isPlatformAdmin: false,
        tenantId: tenantA,
        tenantRole: "PLACEMENT_HEAD",
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      });

      vi.spyOn(QuestionService, "publishQuestion").mockResolvedValue({
        success: true,
      });

      const request = new NextRequest("http://localhost:3000/api/questions/q1/publish", {
        method: "POST",
      });

      const res = await publishRoute(request, { params: Promise.resolve({ id: "q1" }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.lifecycleStatus).toBe("PUBLISHED");
    });
  });
});
