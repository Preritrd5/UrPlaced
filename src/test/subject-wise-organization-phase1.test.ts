import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { ImportService, ParsedCsvRow } from "@/modules/question-bank/services/import-service";
import { AIQuestionIntelligenceService } from "@/modules/ai/services/ai-question-intelligence-service";
import { QuestionSetService } from "@/modules/question-bank/services/question-set-service";
import { GeminiClient } from "@/modules/ai/gemini-client";
import {
  STANDARD_SUBJECTS,
  normalizeSubjectName,
  validateSubjectName,
  getDefaultCategoryForSubject,
} from "@/modules/question-bank/services/subject-constants";
import { GET as getBanks, POST as postBanks } from "@/app/api/questions/banks/route";
import { GET as getQuestions, POST as postQuestion } from "@/app/api/questions/route";
import { POST as generateAiQuestions } from "@/app/api/ai/questions/generate/route";
import { POST as commitImportRoute } from "@/app/api/questions/import/commit/route";
import * as ServerContextModule from "@/lib/auth/server-context";
import * as SupabaseServerModule from "@/lib/supabase/server";
import * as SupabaseAdminModule from "@/lib/supabase/admin";
import { BankCategory, QuestionType } from "@/types/database";

describe("Subject-wise Question Bank Organization - Phase 1: Data Foundation & Consistency", () => {
  const tenantA = "tenant-alpha-uuid";
  const tenantB = "tenant-beta-uuid";
  const headUserId = "user-placement-head-1";
  const staffUserId = "user-staff-1";

  // In-memory data store for the test environment
  let mockBanks: any[] = [];
  let mockQuestions: any[] = [];
  let mockVersions: any[] = [];
  let mockSetItems: any[] = [];
  let mockSets: any[] = [];

  const mockPlacementHeadContext = (tenantId = tenantA, userId = headUserId) => ({
    userId,
    email: "head@college.edu",
    isPlatformAdmin: false,
    tenantId,
    tenantRole: "PLACEMENT_HEAD" as const,
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
            return {
              eq: vi.fn((col: string, val: any) => {
                if (currentTable === "questions" && col === "id") {
                  const q = mockQuestions.find((item) => item.id === val);
                  if (q) Object.assign(q, updates);
                }
                return {
                  select: vi.fn().mockReturnThis(),
                  single: vi.fn().mockResolvedValue({ data: updates, error: null }),
                  then: (res: any) => res({ data: [updates], error: null }),
                };
              }),
            };
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

        // Attach promise resolution for array queries
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

          // Embed relations if requested
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
      mockPlacementHeadContext()
    );
  });

  // =========================================================================
  // 1. Subject Model, Canonical Aliases & Custom Subject Extensibility
  // =========================================================================
  describe("1. Subject Model & Canonical Extensibility", () => {
    it("recognizes all standard academic subjects and resolves common abbreviations", () => {
      expect(normalizeSubjectName("CN")).toBe("Computer Networks");
      expect(normalizeSubjectName("networking")).toBe("Computer Networks");
      expect(normalizeSubjectName("DBMS")).toBe("Database Management Systems");
      expect(normalizeSubjectName("sql")).toBe("Database Management Systems");
      expect(normalizeSubjectName("OS")).toBe("Operating Systems");
      expect(normalizeSubjectName("DSA")).toBe("Data Structures & Algorithms");
      expect(normalizeSubjectName("dsa")).toBe("Data Structures & Algorithms");
      expect(normalizeSubjectName("quant")).toBe("Aptitude");
      expect(normalizeSubjectName("verbal")).toBe("Verbal Ability");
      expect(normalizeSubjectName("coding")).toBe("Coding");
    });

    it("supports arbitrary new custom subjects without code changes", () => {
      const customSub = "Cloud Computing & Distributed Systems";
      const normalized = normalizeSubjectName(customSub);
      expect(normalized).toBe("Cloud Computing & Distributed Systems");

      const validation = validateSubjectName(customSub);
      expect(validation.isValid).toBe(true);
      expect(validation.normalized).toBe("Cloud Computing & Distributed Systems");
    });

    it("validates subject names and rejects empty or oversized strings", () => {
      expect(validateSubjectName("").isValid).toBe(false);
      expect(validateSubjectName("   ").isValid).toBe(false);
      expect(validateSubjectName("a".repeat(129)).isValid).toBe(false);
      expect(validateSubjectName("Machine Learning").isValid).toBe(true);
    });

    it("maps sensible default broad categories for standard subjects while allowing override", () => {
      expect(getDefaultCategoryForSubject("Computer Networks")).toBe("TECHNICAL_CORE");
      expect(getDefaultCategoryForSubject("DSA")).toBe("CODING");
      expect(getDefaultCategoryForSubject("Aptitude")).toBe("APTITUDE");
      expect(getDefaultCategoryForSubject("Verbal Ability")).toBe("GENERAL");
    });
  });

  // =========================================================================
  // 2. Question Bank Creation & Retrieval with Subject
  // =========================================================================
  describe("2. Question Bank Creation & Retrieval with Subject", () => {
    it("stores and retrieves a Question Bank with distinct name, subject, and category", async () => {
      const res = await QuestionService.createBank(tenantA, headUserId, {
        name: "CN - Fall 2026 Batch",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
        description: "Curated networking assessment pool",
      });

      expect(res.data).toBeDefined();
      expect(res.data.name).toBe("CN - Fall 2026 Batch");
      expect(res.data.subject).toBe("Computer Networks");
      expect(res.data.category).toBe("TECHNICAL_CORE");

      // Retrieve via listBanks
      const { data: banks } = await QuestionService.listBanks(tenantA);
      expect(banks?.length).toBe(1);
      expect(banks?.[0].subject).toBe("Computer Networks");
    });

    it("normalizes alias subjects upon creation", async () => {
      const res = await QuestionService.createBank(tenantA, headUserId, {
        name: "Operating Systems Core",
        subject: "os",
        category: "TECHNICAL_CORE",
      });

      expect(res.data).toBeDefined();
      expect(res.data.subject).toBe("Operating Systems");
    });

    it("falls back to normalized bank name if subject is omitted", async () => {
      const res = await QuestionService.createBank(tenantA, headUserId, {
        name: "DBMS",
        category: "TECHNICAL_CORE",
      });

      expect(res.data).toBeDefined();
      expect(res.data.subject).toBe("Database Management Systems");
    });

    it("rejects duplicate bank names within the same tenant", async () => {
      await QuestionService.createBank(tenantA, headUserId, {
        name: "Algorithms Pool",
        subject: "DSA",
        category: "CODING",
      });

      const dup = await QuestionService.createBank(tenantA, headUserId, {
        name: "Algorithms Pool",
        subject: "DSA",
        category: "CODING",
      });

      expect(dup.error).toBeDefined();
      expect(dup.error?.message).toContain("already exists");
    });
  });

  // =========================================================================
  // 3. Subject-wise Endpoints: POST & GET /api/questions/banks
  // =========================================================================
  describe("3. API Routes: /api/questions/banks", () => {
    it("POST /api/questions/banks creates bank with subject", async () => {
      const req = new NextRequest("http://localhost:3000/api/questions/banks", {
        method: "POST",
        body: JSON.stringify({
          name: "Verbal Prep 2026",
          subject: "Verbal Ability",
          category: "GENERAL",
        }),
      });

      const res = await postBanks(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.name).toBe("Verbal Prep 2026");
      expect(json.subject).toBe("Verbal Ability");
    });

    it("GET /api/questions/banks filters by subject query param", async () => {
      // Seed two banks with different subjects
      await QuestionService.createBank(tenantA, headUserId, {
        name: "CN Bank",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });
      await QuestionService.createBank(tenantA, headUserId, {
        name: "OS Bank",
        subject: "Operating Systems",
        category: "TECHNICAL_CORE",
      });

      const req = new NextRequest("http://localhost:3000/api/questions/banks?subject=Computer%20Networks");
      const res = await getBanks(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.length).toBe(1);
      expect(json[0].name).toBe("CN Bank");
      expect(json[0].subject).toBe("Computer Networks");
    });
  });

  // =========================================================================
  // 4. CSV Import Topic & Destination Bank Subject Consistency
  // =========================================================================
  describe("4. CSV Import Topic & Subject Consistency", () => {
    it("commits imported questions to target bank and preserves topic tags", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "DBMS Sentinel",
        subject: "Database Management Systems",
        category: "TECHNICAL_CORE",
      });

      const csvRows: ParsedCsvRow[] = [
        {
          rowNumber: 1,
          question_type: "SINGLE_CHOICE",
          prompt: "What does the 'I' in ACID stand for?",
          difficulty: "EASY",
          options: [
            { id: "opt_a", text: "Integrity" },
            { id: "opt_b", text: "Isolation" },
          ],
          answer_key: { correct_option_id: "opt_b" },
          explanation: "Isolation ensures concurrent execution preserves serializability.",
          topic_tags: ["acid", "transactions", "concurrency"],
          source_type: "COLLEGE_AUTHORED",
          isValid: true,
          isDuplicate: false,
          errors: [],
          warnings: [],
          fingerprint: "fp-test-1",
        },
      ];

      const commitRes = await ImportService.commitImport(
        tenantA,
        headUserId,
        bank.id,
        "dbms_questions.csv",
        csvRows
      );

      expect(commitRes.success).toBe(true);
      expect(commitRes.committedCount).toBe(1);

      // Verify question belongs to target bank
      const q = mockQuestions[0];
      expect(q).toBeDefined();
      expect(q.bank_id).toBe(bank.id);

      // Verify version has topic tags preserved
      const v = mockVersions[0];
      expect(v).toBeDefined();
      expect(v.topic_tags).toEqual(["acid", "transactions", "concurrency"]);
      expect(v.review_status).toBe("UNREVIEWED");
    });

    it("rejects CSV import commit if target bank belongs to a different tenant", async () => {
      // Create bank in tenantB
      const { data: bankB } = await QuestionService.createBank(tenantB, headUserId, {
        name: "Foreign Bank",
        subject: "OS",
        category: "TECHNICAL_CORE",
      });

      const commitRes = await ImportService.commitImport(
        tenantA, // Attempt cross-tenant commit
        headUserId,
        bankB.id,
        "test.csv",
        []
      );

      expect(commitRes.success).toBe(false);
      expect(commitRes.error).toContain("Target Question Bank not found or does not belong to your college");
    });
  });

  // =========================================================================
  // 5. AI Question Generation with Authoritative Bank Subject
  // =========================================================================
  describe("5. AI Question Generation & Topic Preservation", () => {
    it("uses authoritative bank subject and preserves requested topic metadata", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "CN Practice Bank",
        subject: "Computer Networks",
        category: "TECHNICAL_CORE",
      });

      // Mock Gemini API generation response
      vi.spyOn(GeminiClient, "generate").mockResolvedValue({
        text: JSON.stringify({
          questions: [
            {
              prompt: "Which OSI layer is responsible for end-to-end reliability?",
              questionType: "SINGLE_CHOICE",
              difficulty: "MEDIUM",
              options: [
                { id: "opt-a", text: "Physical" },
                { id: "opt-b", text: "Data Link" },
                { id: "opt-c", text: "Transport" },
                { id: "opt-d", text: "Network" },
              ],
              answerKey: { correctOptionId: "opt-c" },
              explanation: "Transport layer provides end-to-end transport services.",
              topicTags: ["osi model", "transport layer"],
              confidenceScore: 0.95,
            },
          ],
        }),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/ai/questions/generate", {
        method: "POST",
        body: JSON.stringify({
          bankId: bank.id,
          topic: "OSI Model",
          subtopic: "Transport Layer",
          difficulty: "MEDIUM",
          questionType: "SINGLE_CHOICE",
          count: 1,
          saveAsDraft: true,
        }),
      });

      const res = await generateAiQuestions(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.count).toBe(1);
      expect(json.questions[0].isSavedAsDraft).toBe(true);

      // Verify question was saved into bank
      const savedQ = mockQuestions.find((q) => q.bank_id === bank.id);
      expect(savedQ).toBeDefined();
      expect(savedQ.lifecycle_status).toBe("DRAFT");

      // Verify topic tags preserved
      const savedV = mockVersions.find((v) => v.question_id === savedQ.id);
      expect(savedV).toBeDefined();
      expect(savedV.topic_tags).toContain("osi model");
      expect(savedV.source_type).toBe("AI_GENERATED");
    });
  });

  // =========================================================================
  // 6. Manual Authoring & Editing Subject Association
  // =========================================================================
  describe("6. Manual Authoring Association", () => {
    it("creates question associated with selected bank and saves topic tags", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Aptitude Pool",
        subject: "Aptitude",
        category: "APTITUDE",
      });

      const req = new NextRequest("http://localhost:3000/api/questions", {
        method: "POST",
        body: JSON.stringify({
          bank_id: bank.id,
          question_type: "SINGLE_CHOICE",
          prompt: "If cost price is $100 and selling price is $120, what is the profit percentage?",
          difficulty: "EASY",
          options: [
            { id: "opt_1", text: "15%" },
            { id: "opt_2", text: "20%" },
          ],
          answer_key: { correct_option_id: "opt_2" },
          explanation: "(120-100)/100 * 100 = 20%",
          topic_tags: ["profit and loss", "arithmetic"],
        }),
      });

      const res = await postQuestion(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.questionId).toBeDefined();

      const createdQ = mockQuestions.find((q) => q.id === json.questionId);
      expect(createdQ.bank_id).toBe(bank.id);

      const createdV = mockVersions.find((v) => v.id === json.versionId);
      expect(createdV.topic_tags).toEqual(["profit and loss", "arithmetic"]);
    });

    it("rejects manual authoring without required bank_id", async () => {
      const req = new NextRequest("http://localhost:3000/api/questions", {
        method: "POST",
        body: JSON.stringify({
          question_type: "SINGLE_CHOICE",
          prompt: "What is 2+2?",
          answer_key: { correct_option_id: "opt_a" },
        }),
      });

      const res = await postQuestion(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("bank_id");
    });
  });

  // =========================================================================
  // 7. Reliable Subject & Topic Filtering
  // =========================================================================
  describe("7. Repository Subject & Topic Filtering", () => {
    it("filters questions by subject across Question Banks", async () => {
      // Seed 2 banks: CN and OS
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

      // Question in CN
      const q1 = await QuestionService.createQuestion(tenantA, headUserId, {
        bank_id: cnBank.id,
        question_type: "SINGLE_CHOICE",
        prompt: "What is the function of ARP?",
        difficulty: "MEDIUM",
        options: [
          { id: "opt_1", text: "Maps IP to MAC" },
          { id: "opt_2", text: "Resolves DNS" },
        ],
        answer_key: { correct_option_id: "opt_1" },
        topic_tags: ["arp", "protocols"],
      });
      expect(q1.success).toBe(true);

      // Question in OS
      const q2 = await QuestionService.createQuestion(tenantA, headUserId, {
        bank_id: osBank.id,
        question_type: "SINGLE_CHOICE",
        prompt: "What is a deadlock?",
        difficulty: "MEDIUM",
        options: [
          { id: "opt_1", text: "Mutual waiting condition" },
          { id: "opt_2", text: "Normal termination" },
        ],
        answer_key: { correct_option_id: "opt_1" },
        topic_tags: ["deadlocks", "concurrency"],
      });
      expect(q2.success).toBe(true);

      // Query questions filtering by subject = 'Computer Networks'
      const cnQuestions = await QuestionService.getQuestions(tenantA, "PLACEMENT_HEAD", {
        subject: "Computer Networks",
      });

      expect(cnQuestions.questions.length).toBe(1);
      expect(cnQuestions.questions[0].bank.subject).toBe("Computer Networks");
      expect(cnQuestions.questions[0].current_version.prompt).toContain("ARP");

      // Query questions filtering by topic = 'deadlocks'
      const deadlockQuestions = await QuestionService.getQuestions(tenantA, "PLACEMENT_HEAD", {
        topic: "deadlocks",
      });

      expect(deadlockQuestions.questions.length).toBe(1);
      expect(deadlockQuestions.questions[0].bank.subject).toBe("Operating Systems");
      expect(deadlockQuestions.questions[0].current_version.prompt).toContain("deadlock");
    });
  });

  // =========================================================================
  // 8. Snapshot Integrity: Question Sets & Immutable Versions
  // =========================================================================
  describe("8. Question Set Snapshot Integrity", () => {
    it("preserves question version, topics, and bank metadata within Question Set items", async () => {
      const { data: bank } = await QuestionService.createBank(tenantA, headUserId, {
        name: "Algorithms Exam Bank",
        subject: "Data Structures & Algorithms",
        category: "CODING",
      });

      const qResult = await QuestionService.createQuestion(tenantA, headUserId, {
        bank_id: bank.id,
        question_type: "SINGLE_CHOICE",
        prompt: "What is the worst-case time complexity of QuickSort?",
        difficulty: "MEDIUM",
        options: [
          { id: "opt_1", text: "O(N log N)" },
          { id: "opt_2", text: "O(N^2)" },
        ],
        answer_key: { correct_option_id: "opt_2" },
        topic_tags: ["sorting", "quicksort"],
      });

      // Mark verified
      const version = mockVersions.find((v) => v.id === qResult.versionId);
      version.review_status = "VERIFIED_CORRECT";

      // Mark approved
      const question = mockQuestions.find((q) => q.id === qResult.questionId);
      question.lifecycle_status = "APPROVED";

      // Create Question Set
      const set = {
        id: "set-snap-1",
        tenant_id: tenantA,
        name: "Midterm Diagnostic Set",
        status: "DRAFT",
        is_locked: false,
      };
      mockSets.push(set);

      // Add item to Question Set
      mockSetItems.push({
        id: "item-1",
        tenant_id: tenantA,
        set_id: set.id,
        question_id: question.id,
        version_id: version.id,
        sequence_order: 1,
        points: 2.0,
      });

      const fetchedSet = await QuestionSetService.getSetById(tenantA, "PLACEMENT_HEAD", set.id);
      expect(fetchedSet.set).toBeDefined();
      expect(fetchedSet.items.length).toBe(1);
      expect(fetchedSet.items[0].version.topic_tags).toEqual(["sorting", "quicksort"]);
      expect(fetchedSet.items[0].version_id).toBe(version.id);
    });
  });
});
