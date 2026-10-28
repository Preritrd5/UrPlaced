import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { QuestionSetService, calculateDifficultyCounts } from "@/modules/question-bank/services/question-set-service";
import { POST as postAutoBuildAvailability } from "@/app/api/questions/sets/auto-build/availability/route";
import { POST as postAutoBuildPreview } from "@/app/api/questions/sets/auto-build/preview/route";
import { POST as postAutoBuildSwap } from "@/app/api/questions/sets/auto-build/swap/route";
import { POST as postAutoBuildCommit } from "@/app/api/questions/sets/auto-build/commit/route";
import { GET as getEligiblePool } from "@/app/api/questions/sets/eligible-pool/route";
import { POST as postSetAction } from "@/app/api/questions/sets/[id]/route";
import * as ServerContextModule from "@/lib/auth/server-context";
import * as SupabaseServerModule from "@/lib/supabase/server";
import * as SupabaseAdminModule from "@/lib/supabase/admin";
import { QuestionType, QuestionDifficulty, AnswerKeyReviewStatus, QuestionLifecycleStatus } from "@/types/database";

describe("QuestionBank Sentinel - Phase 3: Smart Question Set Builder (Auto-Build + Bulk Add)", () => {
  const tenantA = "tenant-college-alpha-uuid";
  const tenantB = "tenant-college-beta-uuid";
  const headUserId = "user-placement-head-1";
  const staffUserId = "user-staff-1";
  const studentUserId = "user-student-1";

  // In-memory tables
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
                if (currentTable === "question_sets") store = mockSets;
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
          delete: vi.fn(() => {
            let dFilters: Record<string, any> = {};
            const dBuilder: any = {
              eq: vi.fn((col: string, val: any) => {
                dFilters[col] = val;
                return dBuilder;
              }),
              then: (resolve: any) => {
                if (currentTable === "question_set_items") {
                  mockSetItems = mockSetItems.filter((row) => {
                    for (const [k, v] of Object.entries(dFilters)) {
                      if (row[k] === v) return false;
                    }
                    return true;
                  });
                }
                if (currentTable === "question_sets") {
                  mockSets = mockSets.filter((row) => {
                    for (const [k, v] of Object.entries(dFilters)) {
                      if (row[k] === v) return false;
                    }
                    return true;
                  });
                }
                return resolve({ data: null, error: null });
              },
            };
            return dBuilder;
          }),
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
    vi.spyOn(ServerContextModule, "requireAuthContext").mockImplementation(async () =>
      mockUserContext("PLACEMENT_HEAD")
    );
  });

  // Helper to populate test questions
  const seedQuestion = async (params: {
    tenantId: string;
    bankId: string;
    prompt: string;
    type?: QuestionType;
    difficulty?: QuestionDifficulty;
    topicTags?: string[];
    reviewStatus?: AnswerKeyReviewStatus;
    lifecycleStatus?: QuestionLifecycleStatus;
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
      options: [
        { id: "opt_1", text: "Alpha" },
        { id: "opt_2", text: "Beta" },
      ],
      answer_key: { correct_option_id: "opt_1" },
      difficulty: params.difficulty || "MEDIUM",
      topic_tags: params.topicTags || [],
      review_status: params.reviewStatus || "VERIFIED_CORRECT",
      reviewed_by: headUserId,
      created_by: headUserId,
      created_at: new Date().toISOString(),
    };

    const question = {
      id: qId,
      tenant_id: params.tenantId,
      bank_id: params.bankId,
      question_type: params.type || "SINGLE_CHOICE",
      current_version_id: vId,
      lifecycle_status: params.lifecycleStatus || "APPROVED",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockVersions.push(version);
    mockQuestions.push(question);
    return { qId, vId, question, version };
  };

  // =========================================================================
  // 1. Auto-Build: Subject Specific & Mixed Composition
  // =========================================================================
  describe("1. Auto-Build Question Set Composition", () => {
    it("builds a CN-only Question Set using only eligible Computer Networks questions", async () => {
      const { data: cnBank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Computer Networks Pool",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });
      const { data: dbmsBank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "DBMS Pool",
        subject: "Database Management Systems",
        category: "TECHNICAL_CORE",
      });

      // Seed 3 CN questions, 2 DBMS questions
      await seedQuestion({ tenantId: tenantA, bankId: cnBank.id, prompt: "CN Q1" });
      await seedQuestion({ tenantId: tenantA, bankId: cnBank.id, prompt: "CN Q2" });
      await seedQuestion({ tenantId: tenantA, bankId: cnBank.id, prompt: "CN Q3" });
      await seedQuestion({ tenantId: tenantA, bankId: dbmsBank.id, prompt: "DBMS Q1" });
      await seedQuestion({ tenantId: tenantA, bankId: dbmsBank.id, prompt: "DBMS Q2" });

      // Request 2 CN questions
      const preview = await QuestionSetService.generateAutoBuildPreview(tenantA, {
        mode: "SINGLE",
        subjects: [{ subject: "Computer Networks", count: 2 }],
        defaultPoints: 2.0,
      });

      expect(preview.success).toBe(true);
      expect(preview.previewItems.length).toBe(2);
      expect(preview.previewItems.every((item) => item.subject === "Computer Networks")).toBe(true);
      expect(preview.summary.totalPoints).toBe(4.0);
    });

    it("builds a mixed Question Set with requested counts for multiple subjects", async () => {
      const { data: cnBank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "CN Bank",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });
      const { data: osBank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "OS Bank",
        subject: "Operating Systems",
        category: "TECHNICAL_CORE",
      });
      const { data: aptBank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Aptitude Bank",
        subject: "Aptitude",
        category: "APTITUDE",
      });

      // Seed 2 CN, 2 OS, 2 Aptitude questions
      await seedQuestion({ tenantId: tenantA, bankId: cnBank.id, prompt: "CN Q1" });
      await seedQuestion({ tenantId: tenantA, bankId: cnBank.id, prompt: "CN Q2" });
      await seedQuestion({ tenantId: tenantA, bankId: osBank.id, prompt: "OS Q1" });
      await seedQuestion({ tenantId: tenantA, bankId: osBank.id, prompt: "OS Q2" });
      await seedQuestion({ tenantId: tenantA, bankId: aptBank.id, prompt: "Apt Q1" });
      await seedQuestion({ tenantId: tenantA, bankId: aptBank.id, prompt: "Apt Q2" });

      // Request mixed test: 2 CN, 1 OS, 1 Aptitude
      const preview = await QuestionSetService.generateAutoBuildPreview(tenantA, {
        mode: "MIXED",
        subjects: [
          { subject: "Computer Networks", count: 2 },
          { subject: "Operating Systems", count: 1 },
          { subject: "Aptitude", count: 1 },
        ],
      });

      expect(preview.success).toBe(true);
      expect(preview.previewItems.length).toBe(4);
      expect(preview.summary.subjectCounts["Computer Networks"]).toBe(2);
      expect(preview.summary.subjectCounts["Operating Systems"]).toBe(1);
      expect(preview.summary.subjectCounts["Aptitude"]).toBe(1);
    });

    it("applies difficulty distribution and question-type criteria correctly", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Coding Bank",
        subject: "Coding",
        category: "CODING",
      });

      await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "Easy Code", type: "CODING", difficulty: "EASY" });
      await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "Med Code", type: "CODING", difficulty: "MEDIUM" });
      await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "Hard Code", type: "CODING", difficulty: "HARD" });
      await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "MCQ Code", type: "SINGLE_CHOICE", difficulty: "EASY" });

      // Request 2 CODING questions with 50% Easy, 50% Hard
      const preview = await QuestionSetService.generateAutoBuildPreview(tenantA, {
        mode: "SINGLE",
        subjects: [{ subject: "Coding", count: 2 }],
        questionType: "CODING",
        difficultyDistribution: { EASY: 50, MEDIUM: 0, HARD: 50 },
      });

      expect(preview.success).toBe(true);
      expect(preview.previewItems.length).toBe(2);
      expect(preview.previewItems.every((it) => it.question_type === "CODING")).toBe(true);
      expect(preview.summary.difficultyCounts.EASY).toBe(1);
      expect(preview.summary.difficultyCounts.HARD).toBe(1);
    });

    it("applies topic filtering using actual topic_tags", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "DSA Bank",
        subject: "Data Structures & Algorithms",
        category: "CODING",
      });

      await seedQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Binary Search Tree",
        topicTags: ["trees", "bst"],
      });
      await seedQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Dijkstra algorithm",
        topicTags: ["graphs", "shortest-path"],
      });

      const preview = await QuestionSetService.generateAutoBuildPreview(tenantA, {
        mode: "SINGLE",
        subjects: [{ subject: "Data Structures & Algorithms", count: 1 }],
        topic: "trees",
      });

      expect(preview.success).toBe(true);
      expect(preview.previewItems.length).toBe(1);
      expect(preview.previewItems[0].prompt).toContain("Binary Search Tree");
    });

    it("converts difficulty percentages to exact integer counts deterministically (Hare-Niemeyer)", () => {
      // 30 questions: 20% Easy, 50% Medium, 30% Hard
      const res30 = calculateDifficultyCounts(30, { EASY: 20, MEDIUM: 50, HARD: 30 });
      expect(res30.counts).toEqual({ EASY: 6, MEDIUM: 15, HARD: 9 });
      expect(res30.counts!.EASY + res30.counts!.MEDIUM + res30.counts!.HARD).toBe(30);

      // 10 questions: 33% Easy, 33% Medium, 34% Hard (largest remainder gives +1 to 34% Hard)
      const res10 = calculateDifficultyCounts(10, { EASY: 33, MEDIUM: 33, HARD: 34 });
      expect(res10.counts).toEqual({ EASY: 3, MEDIUM: 3, HARD: 4 });
      expect(res10.counts!.EASY + res10.counts!.MEDIUM + res10.counts!.HARD).toBe(10);

      // Invalid percentages (sum !== 100%)
      const resInvalid = calculateDifficultyCounts(30, { EASY: 50, MEDIUM: 50, HARD: 20 });
      expect(resInvalid.error).toContain("must sum to 100%");

      // Negative values
      const resNegative = calculateDifficultyCounts(30, { EASY: -10, MEDIUM: 60, HARD: 50 });
      expect(resNegative.error).toContain("cannot be negative");
    });

    it("produces exact requested difficulty counts without variation when inventory is sufficient", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Full CN Bank",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });

      // Seed 8 Easy, 18 Medium, 12 Hard (Total 38 questions)
      for (let i = 1; i <= 8; i++) {
        await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: `Easy CN ${i}`, difficulty: "EASY" });
      }
      for (let i = 1; i <= 18; i++) {
        await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: `Med CN ${i}`, difficulty: "MEDIUM" });
      }
      for (let i = 1; i <= 12; i++) {
        await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: `Hard CN ${i}`, difficulty: "HARD" });
      }

      // Request 30 questions: 20% Easy (6), 50% Medium (15), 30% Hard (9)
      const preview = await QuestionSetService.generateAutoBuildPreview(tenantA, {
        mode: "SINGLE",
        subjects: [{ subject: "Computer Networks", count: 30 }],
        difficultyDistribution: { EASY: 20, MEDIUM: 50, HARD: 30 },
      });

      expect(preview.success).toBe(true);
      expect(preview.previewItems.length).toBe(30);
      expect(preview.summary.difficultyCounts.EASY).toBe(6);
      expect(preview.summary.difficultyCounts.MEDIUM).toBe(15);
      expect(preview.summary.difficultyCounts.HARD).toBe(9);
    });

    it("rejects contradictory configuration when subject counts do not match totalCount", async () => {
      const availability = await QuestionSetService.checkAutoBuildAvailability(tenantA, {
        mode: "MIXED",
        totalCount: 30,
        subjects: [
          { subject: "Computer Networks", count: 10 },
          { subject: "Operating Systems", count: 10 },
        ],
      } as any);

      expect(availability.isSatisfiable).toBe(false);
      expect(availability.error).toContain("do not add up to the requested total of 30");
    });
  });

  // =========================================================================
  // 2. Pre-flight Availability Check & Invariant Protections
  // =========================================================================
  describe("2. Availability Check & Invariant Protections", () => {
    it("reports shortage when requested questions exceed eligible inventory", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Shortage Bank",
        subject: "Operating Systems",
        category: "TECHNICAL_CORE",
      });

      // Seed only 2 questions
      await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "OS 1" });
      await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "OS 2" });

      // Check availability for 5 questions
      const availability = await QuestionSetService.checkAutoBuildAvailability(tenantA, {
        mode: "SINGLE",
        subjects: [{ subject: "Operating Systems", count: 5 }],
      });

      expect(availability.isSatisfiable).toBe(false);
      expect(availability.totalRequested).toBe(5);
      expect(availability.totalAvailable).toBe(2);
      expect(availability.totalShortage).toBe(3);
      expect(availability.shortageMessages[0]).toContain("shortage of 3 questions");
    });

    it("never selects unreviewed or ineligible questions to satisfy shortage", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Integrity Bank",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });

      // 1 eligible question
      await seedQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Eligible Q",
        reviewStatus: "VERIFIED_CORRECT",
        lifecycleStatus: "APPROVED",
      });

      // 1 unreviewed question (must NOT be picked)
      await seedQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Unreviewed Q",
        reviewStatus: "UNREVIEWED",
        lifecycleStatus: "DRAFT",
      });

      // 1 rejected question (must NOT be picked)
      await seedQuestion({
        tenantId: tenantA,
        bankId: bank.id,
        prompt: "Rejected Q",
        reviewStatus: "REJECTED",
        lifecycleStatus: "DRAFT",
      });

      // Request 2 questions (only 1 is eligible)
      const availability = await QuestionSetService.checkAutoBuildAvailability(tenantA, {
        mode: "SINGLE",
        subjects: [{ subject: "Computer Networks", count: 2 }],
      });

      expect(availability.isSatisfiable).toBe(false);
      expect(availability.totalAvailable).toBe(1);
    });

    it("supports swapping an unwanted preview item with another eligible question", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Swap Bank",
        subject: "Database Management Systems",
        category: "TECHNICAL_CORE",
      });

      const q1 = await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "DBMS Original" });
      const q2 = await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "DBMS Alternative" });

      const swapRes = await QuestionSetService.swapPreviewItem(tenantA, {
        currentQuestionId: q1.qId,
        subject: "Database Management Systems",
        alreadySelectedIds: [q1.qId],
      });

      expect(swapRes.success).toBe(true);
      expect(swapRes.replacement).toBeDefined();
      expect(swapRes.replacement?.question_id).toBe(q2.qId);
      expect(swapRes.replacement?.prompt).toBe("DBMS Alternative");
    });

    it("enforces exact difficulty distribution and refuses silent substitution when Hard questions are short", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "CN Shortage Pool",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });

      // Seed eligible inventory: 15 Easy, 20 Medium, but ONLY 5 Hard (Total 40 questions available > 30 requested)
      for (let i = 1; i <= 15; i++) {
        await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: `Easy CN ${i}`, difficulty: "EASY" });
      }
      for (let i = 1; i <= 20; i++) {
        await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: `Med CN ${i}`, difficulty: "MEDIUM" });
      }
      for (let i = 1; i <= 5; i++) {
        await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: `Hard CN ${i}`, difficulty: "HARD" });
      }

      // Request: 30 questions with 20% Easy (6), 50% Medium (15), 30% Hard (9)
      const criteria = {
        mode: "SINGLE" as const,
        subjects: [{ subject: "Computer Networks", count: 30 }],
        difficultyDistribution: { EASY: 20, MEDIUM: 50, HARD: 30 },
      };

      // 1. Availability check must detect shortage in the Hard bucket and reject with specific explanation
      const availability = await QuestionSetService.checkAutoBuildAvailability(tenantA, criteria);

      expect(availability.isSatisfiable).toBe(false);
      expect(availability.totalAvailable).toBe(40); // 40 total available
      expect(availability.totalRequested).toBe(30);
      expect(availability.totalShortage).toBe(4); // 9 needed - 5 available = 4 missing
      expect(availability.subjects[0].difficultyShortage?.HARD).toBe(4);
      expect(availability.shortageMessages.length).toBeGreaterThan(0);
      expect(availability.shortageMessages[0]).toContain(
        "Your requested test needs 9 Hard questions for Computer Networks, but only 5 eligible questions are available. You need 4 more Hard questions or must adjust the composition."
      );

      // 2. Preview generation must refuse silent substitution and fail with clear error
      const preview = await QuestionSetService.generateAutoBuildPreview(tenantA, criteria);

      expect(preview.success).toBe(false);
      expect(preview.previewItems.length).toBe(0);
      expect(preview.error).toContain("Insufficient eligible question inventory");
      expect(preview.error).toContain("Your requested test needs 9 Hard questions for Computer Networks");
    });

    it("rejects preview swap if no alternative of the exact difficulty exists, preserving test balance", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Single Hard Question Bank",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });

      // Seed 1 Hard question and 3 Medium questions
      const qHard = await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "Sole Hard Q", difficulty: "HARD" });
      await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "Med Q 1", difficulty: "MEDIUM" });
      await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "Med Q 2", difficulty: "MEDIUM" });

      // Attempt to swap qHard specifying difficulty: "HARD"
      const swapRes = await QuestionSetService.swapPreviewItem(tenantA, {
        currentQuestionId: qHard.qId,
        subject: "Computer Networks",
        difficulty: "HARD",
        alreadySelectedIds: [qHard.qId],
      });

      // Must NOT silently substitute a Medium question!
      expect(swapRes.success).toBe(false);
      expect(swapRes.error).toContain("No alternative eligible questions found for subject 'Computer Networks' with difficulty 'HARD'");

      // Now add a second Hard question and re-attempt swap
      const qHard2 = await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "Second Hard Q", difficulty: "HARD" });
      const swapSuccess = await QuestionSetService.swapPreviewItem(tenantA, {
        currentQuestionId: qHard.qId,
        subject: "Computer Networks",
        difficulty: "HARD",
        alreadySelectedIds: [qHard.qId],
      });

      expect(swapSuccess.success).toBe(true);
      expect(swapSuccess.replacement?.question_id).toBe(qHard2.qId);
      expect(swapSuccess.replacement?.difficulty).toBe("HARD");
    });
  });

  // =========================================================================
  // 3. Committing Auto-Build: New Set vs Existing Set
  // =========================================================================
  describe("3. Committing Auto-Build to Question Sets", () => {
    it("creates a new Question Set from previewed items with correct version references and marks", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Commit Bank",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });

      const q1 = await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "CN Q1" });
      const q2 = await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "CN Q2" });

      const commitRes = await QuestionSetService.commitAutoBuildSet(tenantA, headUserId, {
        targetType: "NEW_SET",
        setName: "CN Semester Blueprint",
        setDescription: "Auto-built test set",
        purpose: "ASSESSMENT",
        items: [
          { question_id: q1.qId, version_id: q1.vId, points: 2.5 },
          { question_id: q2.qId, version_id: q2.vId, points: 2.5 },
        ],
      });

      expect(commitRes.success).toBe(true);
      expect(commitRes.addedCount).toBe(2);
      expect(commitRes.set).toBeDefined();
      expect(commitRes.set.name).toBe("CN Semester Blueprint");

      // Verify set items were persisted in memory
      const itemsInSet = mockSetItems.filter((it) => it.set_id === commitRes.set.id);
      expect(itemsInSet.length).toBe(2);
      expect(itemsInSet[0].points).toBe(2.5);
    });

    it("adds previewed items into an existing unlocked Question Set", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Append Bank",
        subject: "Operating Systems",
        category: "TECHNICAL_CORE",
      });

      const { data: existingSet } = await QuestionSetService.createSet(tenantA, headUserId, {
        name: "Existing Draft Set",
      });

      const q = await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "Appended OS Q" });

      const commitRes = await QuestionSetService.commitAutoBuildSet(tenantA, headUserId, {
        targetType: "EXISTING_SET",
        setId: existingSet.id,
        items: [{ question_id: q.qId, version_id: q.vId, points: 1.0 }],
      });

      expect(commitRes.success).toBe(true);
      expect(commitRes.addedCount).toBe(1);
    });

    it("rejects committing to a locked Question Set", async () => {
      const { data: set } = await QuestionSetService.createSet(tenantA, headUserId, {
        name: "Locked Set",
      });
      // Lock set
      set.is_locked = true;
      set.status = "PUBLISHED";

      const commitRes = await QuestionSetService.commitAutoBuildSet(tenantA, headUserId, {
        targetType: "EXISTING_SET",
        setId: set.id,
        items: [{ question_id: "any-q", version_id: "any-v", points: 1.0 }],
      });

      expect(commitRes.success).toBe(false);
      expect(commitRes.error).toContain("locked");
    });
  });

  // =========================================================================
  // 4. Bulk Add Workflow
  // =========================================================================
  describe("4. Bulk Add Questions Workflow", () => {
    it("retrieves eligible questions with alreadyInSet flag for bulk selection", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Bulk Bank",
        subject: "Verbal Ability",
        category: "GENERAL",
      });

      const q1 = await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "Verbal Q1" });
      const q2 = await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "Verbal Q2" });

      // Add q1 to an existing set
      const { data: set } = await QuestionSetService.createSet(tenantA, headUserId, {
        name: "Verbal Drill",
      });
      await QuestionSetService.addItemsToSet(tenantA, set.id, [
        { question_id: q1.qId, version_id: q1.vId },
      ]);

      // Query eligible pool for set
      const pool = await QuestionSetService.getEligibleQuestionsForBulkAdd(tenantA, {
        excludeSetId: set.id,
      });

      expect(pool.total).toBe(2);
      expect(pool.alreadyInSetCount).toBe(1);

      const itemQ1 = pool.questions.find((q) => q.id === q1.qId);
      const itemQ2 = pool.questions.find((q) => q.id === q2.qId);
      expect(itemQ1?.alreadyInSet).toBe(true);
      expect(itemQ2?.alreadyInSet).toBe(false);
    });

    it("adds multiple questions from different banks in one operation", async () => {
      const { data: bankA } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Bank A",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });
      const { data: bankB } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Bank B",
        subject: "Aptitude",
        category: "APTITUDE",
      });

      const qA = await seedQuestion({ tenantId: tenantA, bankId: bankA.id, prompt: "Q from Bank A" });
      const qB = await seedQuestion({ tenantId: tenantA, bankId: bankB.id, prompt: "Q from Bank B" });

      const { data: set } = await QuestionSetService.createSet(tenantA, headUserId, {
        name: "Cross Bank Blueprint",
      });

      const addRes = await QuestionSetService.addItemsToSet(tenantA, set.id, [
        { question_id: qA.qId, version_id: qA.vId, points: 2.0 },
        { question_id: qB.qId, version_id: qB.vId, points: 3.0 },
      ]);

      expect(addRes.success).toBe(true);
      expect(addRes.addedCount).toBe(2);

      const itemsInSet = mockSetItems.filter((it) => it.set_id === set.id);
      expect(itemsInSet.length).toBe(2);
      expect(itemsInSet[0].points).toBe(2.0);
      expect(itemsInSet[1].points).toBe(3.0);
    });

    it("skips duplicate questions already present in set without throwing SQL constraint error", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Duplicate Prevention Bank",
        subject: "Operating Systems",
        category: "TECHNICAL_CORE",
      });

      const q1 = await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "Q1" });
      const q2 = await seedQuestion({ tenantId: tenantA, bankId: bank.id, prompt: "Q2" });

      const { data: set } = await QuestionSetService.createSet(tenantA, headUserId, {
        name: "Duplicate Test Set",
      });

      // Add q1 first
      await QuestionSetService.addItemsToSet(tenantA, set.id, [
        { question_id: q1.qId, version_id: q1.vId },
      ]);

      // Attempt to bulk add q1 AND q2
      const bulkRes = await QuestionSetService.addItemsToSet(tenantA, set.id, [
        { question_id: q1.qId, version_id: q1.vId },
        { question_id: q2.qId, version_id: q2.vId },
      ]);

      expect(bulkRes.success).toBe(true);
      expect(bulkRes.addedCount).toBe(1); // q2 added
      expect(bulkRes.skippedCount).toBe(1); // q1 skipped because it was already present
    });
  });

  // =========================================================================
  // 5. Tenant Isolation & API Security
  // =========================================================================
  describe("5. Tenant Isolation & API Security", () => {
    it("never selects questions belonging to another college", async () => {
      const { data: bankA } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Tenant A Bank",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });
      const { data: bankB } = await QuestionService.createBank(tenantB, "head-b", {
        name: "Tenant B Bank",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });

      await seedQuestion({ tenantId: tenantA, bankId: bankA.id, prompt: "Tenant A Q" });
      await seedQuestion({ tenantId: tenantB, bankId: bankB.id, prompt: "Tenant B Q" });

      // Tenant A runs availability check
      const availability = await QuestionSetService.checkAutoBuildAvailability(tenantA, {
        mode: "SINGLE",
        subjects: [{ subject: "Computer Networks", count: 1 }],
      });

      expect(availability.totalAvailable).toBe(1); // Only Tenant A's question is counted
    });

    it("rejects unauthorized student from accessing auto-build endpoints with 403 Forbidden", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockRejectedValue(new Error("FORBIDDEN"));

      const req = new NextRequest("http://localhost:3000/api/questions/sets/auto-build/availability", {
        method: "POST",
        body: JSON.stringify({ subjects: [{ subject: "Computer Networks", count: 5 }] }),
      });

      const res = await postAutoBuildAvailability(req);
      expect(res.status).toBe(403);
    });
  });
});
