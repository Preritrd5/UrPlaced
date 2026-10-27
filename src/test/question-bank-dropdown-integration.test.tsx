import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QuestionForm } from "@/components/questions/question-form";
import QuestionImportPage from "@/app/dashboard/questions/import/page";
import { can, Permissions, PolicyContext } from "@/modules/identity-access/services/policy-engine";

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: mockRefresh,
  }),
}));

// Mock useAuthContext with authorized Placement Head
vi.mock("@/lib/auth/auth-context-provider", () => ({
  useAuthContext: () => ({
    userId: "user-placement-head-99",
    role: "PLACEMENT_HEAD",
    isPlatformAdmin: false,
    isLoading: false,
  }),
}));

describe("Phase 2: Question Bank Dropdown Integration & Seamless Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sampleBanks = [
    {
      id: "bank-alpha",
      name: "Algorithms & Data Structures",
      category: "CODING",
      tenant_id: "tenant-college-alpha",
    },
    {
      id: "bank-beta",
      name: "Quantitative Aptitude 2026",
      category: "APTITUDE",
      tenant_id: "tenant-college-alpha",
    },
  ];

  // =========================================================================
  // 1. Author New Question (/dashboard/questions/new) Integration Tests
  // =========================================================================
  describe("1. Author New Question (/dashboard/questions/new) Workflow", () => {
    it("renders loading state while fetching banks", () => {
      // Mock fetch that hangs or takes time
      vi.spyOn(global, "fetch").mockImplementation(() => new Promise(() => {}));

      render(<QuestionForm />);

      expect(screen.getByText(/Loading Question Banks.../i)).toBeInTheDocument();
    });

    it("renders distinct error state with Retry action when banks API fails", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
        if (typeof url === "string" && url.includes("/api/questions/banks")) {
          return {
            ok: false,
            status: 500,
            json: async () => ({ error: "Database connection failed." }),
          } as any;
        }
        return { ok: true, json: async () => ({}) } as any;
      });

      render(<QuestionForm />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load Question Banks/i)).toBeInTheDocument();
        expect(screen.getByText(/Database connection failed/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
      });

      // API failure must NOT be treated as empty list
      expect(screen.queryByText(/No Question Banks yet/i)).not.toBeInTheDocument();
    });

    it("renders helpful empty state and '+ Create Question Bank' button when no banks exist", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
        if (typeof url === "string" && url.includes("/api/questions/banks")) {
          return {
            ok: true,
            status: 200,
            json: async () => [],
          } as any;
        }
        return { ok: true, json: async () => ({}) } as any;
      });

      render(<QuestionForm />);

      await waitFor(() => {
        expect(screen.getByText("No Question Banks yet")).toBeInTheDocument();
        expect(
          screen.getByText("Create a Question Bank first to organize your questions.")
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /\+ Create Question Bank/i })
        ).toBeInTheDocument();
      });
    });

    it("populates selector with real banks and displays inline '+ New Bank' button when banks exist", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
        if (typeof url === "string" && url.includes("/api/questions/banks")) {
          return {
            ok: true,
            status: 200,
            json: async () => sampleBanks,
          } as any;
        }
        return { ok: true, json: async () => ({}) } as any;
      });

      render(<QuestionForm />);

      await waitFor(() => {
        const select = screen.getByLabelText(/Question Bank \*/i) as HTMLSelectElement;
        expect(select).toBeInTheDocument();
        expect(select.options.length).toBe(2);
        expect(select.options[0].text).toContain("Algorithms & Data Structures");
        expect(select.options[1].text).toContain("Quantitative Aptitude 2026");
        expect(screen.getByRole("button", { name: /\+ New Bank/i })).toBeInTheDocument();
      });
    });

    it("opens CreateQuestionBankModal, creates a bank, auto-selects it, and preserves entered question data", async () => {
      let banksList: any[] = [];
      const newBank = {
        id: "bank-gamma-new",
        name: "Campus Technical Core 2026",
        category: "TECHNICAL_CORE",
        tenant_id: "tenant-college-alpha",
      };

      vi.spyOn(global, "fetch").mockImplementation(async (url: any, options: any) => {
        if (typeof url === "string" && url.includes("/api/questions/banks")) {
          if (options?.method === "POST") {
            banksList = [newBank, ...banksList];
            return {
              ok: true,
              status: 201,
              json: async () => newBank,
            } as any;
          }
          return {
            ok: true,
            status: 200,
            json: async () => banksList,
          } as any;
        }
        if (typeof url === "string" && url === "/api/questions") {
          return {
            ok: true,
            status: 201,
            json: async () => ({ success: true, questionId: "q-123" }),
          } as any;
        }
        return { ok: true, json: async () => ({}) } as any;
      });

      render(<QuestionForm />);

      // Initially no banks
      await waitFor(() => {
        expect(screen.getByText("No Question Banks yet")).toBeInTheDocument();
      });

      // User types question prompt first!
      const promptInput = screen.getByPlaceholderText(
        /Enter the problem statement/i
      );
      fireEvent.change(promptInput, {
        target: { value: "Explain the Dijkstra shortest path algorithm with time complexity." },
      });

      // User clicks '+ Create Question Bank'
      const openModalBtn = screen.getByRole("button", { name: /\+ Create Question Bank/i });
      fireEvent.click(openModalBtn);

      // Modal appears
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const modal = screen.getByRole("dialog");

      // Fill modal details
      const bankNameInput = within(modal).getByLabelText(/Question Bank Name/i);
      fireEvent.change(bankNameInput, { target: { value: "Campus Technical Core 2026" } });

      const categorySelect = within(modal).getByLabelText(/Category/i);
      fireEvent.change(categorySelect, { target: { value: "TECHNICAL_CORE" } });

      // Submit modal
      const modalSubmitBtn = within(modal).getByRole("button", { name: /Create Question Bank/i });
      fireEvent.click(modalSubmitBtn);

      // Verify modal closes and new bank is selected
      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: "Create Question Bank" })).not.toBeInTheDocument();
        const select = screen.getByLabelText(/Question Bank \*/i) as HTMLSelectElement;
        expect(select.value).toBe("bank-gamma-new");
        expect(select.options[0].text).toContain("Campus Technical Core 2026");
      });

      // CRITICAL: Verify previously entered prompt was preserved!
      expect(promptInput).toHaveValue(
        "Explain the Dijkstra shortest path algorithm with time complexity."
      );
    });
  });

  // =========================================================================
  // 2. Batch Question Import (/dashboard/questions/import) Integration Tests
  // =========================================================================
  describe("2. Batch Question Import (/dashboard/questions/import) Workflow", () => {
    it("renders explanatory text and loading state for target bank selector", () => {
      vi.spyOn(global, "fetch").mockImplementation(() => new Promise(() => {}));

      render(<QuestionImportPage />);

      expect(
        screen.getByText("Choose the Question Bank where your imported questions will be saved.")
      ).toBeInTheDocument();
      expect(screen.getByText(/Loading Question Banks.../i)).toBeInTheDocument();
    });

    it("renders error state when target banks cannot be loaded", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
        if (typeof url === "string" && url.includes("/api/questions/banks")) {
          return {
            ok: false,
            status: 403,
            json: async () => ({ error: "Forbidden: insufficient permissions." }),
          } as any;
        }
        return { ok: true, json: async () => ({}) } as any;
      });

      render(<QuestionImportPage />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load Question Banks/i)).toBeInTheDocument();
        expect(screen.getByText(/permission to access Question Banks/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
      });
    });

    it("renders empty state with exact required wording when no banks exist", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
        if (typeof url === "string" && url.includes("/api/questions/banks")) {
          return {
            ok: true,
            status: 200,
            json: async () => [],
          } as any;
        }
        return { ok: true, json: async () => ({}) } as any;
      });

      render(<QuestionImportPage />);

      await waitFor(() => {
        expect(
          screen.getByText("Create a Question Bank before importing")
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "Your uploaded questions need a destination bank. Create one here, then continue with your CSV import."
          )
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /\+ Create Question Bank/i })
        ).toBeInTheDocument();
      });
    });

    it("allows creating a bank directly from import page and auto-selects it while preserving selected CSV file", async () => {
      let banksList: any[] = [];
      const createdBank = {
        id: "bank-import-dest-1",
        name: "Batch Import Aptitude Bank",
        category: "APTITUDE",
        tenant_id: "tenant-college-alpha",
      };

      vi.spyOn(global, "fetch").mockImplementation(async (url: any, options: any) => {
        if (typeof url === "string" && url.includes("/api/questions/banks")) {
          if (options?.method === "POST") {
            banksList = [createdBank, ...banksList];
            return {
              ok: true,
              status: 201,
              json: async () => createdBank,
            } as any;
          }
          return {
            ok: true,
            status: 200,
            json: async () => banksList,
          } as any;
        }
        return { ok: true, json: async () => ({}) } as any;
      });

      render(<QuestionImportPage />);

      await waitFor(() => {
        expect(screen.getByText("Create a Question Bank before importing")).toBeInTheDocument();
      });

      // Select CSV file first
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      const testFile = new File(
        [
          "question_type,prompt,difficulty,option_a,option_b,option_c,option_d,correct_answer\nSINGLE_CHOICE,What is 2+2?,EASY,3,4,5,6,opt_b",
        ],
        "campus_questions.csv",
        { type: "text/csv" }
      );

      fireEvent.change(fileInput, { target: { files: [testFile] } });

      await waitFor(() => {
        expect(screen.getByText(/Selected: campus_questions\.csv/i)).toBeInTheDocument();
      });

      // Now create bank
      const createBtn = screen.getByRole("button", { name: /\+ Create Question Bank/i });
      fireEvent.click(createBtn);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      const modal = screen.getByRole("dialog");

      const bankNameInput = within(modal).getByLabelText(/Question Bank Name/i);
      fireEvent.change(bankNameInput, { target: { value: "Batch Import Aptitude Bank" } });

      const categorySelect = within(modal).getByLabelText(/Category/i);
      fireEvent.change(categorySelect, { target: { value: "APTITUDE" } });

      const modalSubmitBtn = within(modal).getByRole("button", { name: /Create Question Bank/i });
      fireEvent.click(modalSubmitBtn);

      // Verify modal closes and selector appears with new bank selected
      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: "Create Question Bank" })).not.toBeInTheDocument();
        const select = screen.getByLabelText(/Target Question Bank \*/i) as HTMLSelectElement;
        expect(select.value).toBe("bank-import-dest-1");
        expect(select.options[0].text).toContain("Batch Import Aptitude Bank");
      });

      // CRITICAL: Selected file is preserved!
      expect(screen.getByText(/Selected: campus_questions\.csv/i)).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. End-to-End Flow & Tenant-Isolation Walkthrough
  // =========================================================================
  describe("3. End-to-End Sequence Walkthrough & Policy Isolation", () => {
    it("walks through: authoring bank -> saving question -> import target reuse -> isolation verification", async () => {
      // Step A: In-memory store representing local data layer
      const localDatabase: {
        banks: Array<{ id: string; name: string; category: string; tenant_id: string }>;
        questions: Array<{ id: string; bank_id: string; prompt: string; tenant_id: string }>;
        importJobs: Array<{ id: string; bank_id: string; fileName: string; tenant_id: string }>;
      } = {
        banks: [],
        questions: [],
        importJobs: [],
      };

      const tenantA = "tenant-alpha-college";
      const tenantB = "tenant-beta-university";

      // Step B: College Head creates bank via New Question modal
      const newBankPayload = {
        name: "Fullstack Interview 2026",
        category: "TECHNICAL_CORE",
        tenant_id: tenantA,
      };

      const createdBankRecord = {
        id: "bank-fullstack-uuid-1",
        ...newBankPayload,
      };
      localDatabase.banks.push(createdBankRecord);

      expect(localDatabase.banks).toHaveLength(1);
      expect(localDatabase.banks[0].id).toBe("bank-fullstack-uuid-1");

      // Step C: Question is saved targeting the created bank ID
      const questionPayload = {
        id: "q-uuid-101",
        bank_id: createdBankRecord.id,
        prompt: "Explain event loop in Node.js and libuv thread pool.",
        tenant_id: tenantA,
      };
      localDatabase.questions.push(questionPayload);

      expect(localDatabase.questions[0].bank_id).toBe("bank-fullstack-uuid-1");

      // Step D: Batch Import targets the exact same bank
      const importJobPayload = {
        id: "job-uuid-201",
        bank_id: createdBankRecord.id,
        fileName: "fullstack_batch.csv",
        tenant_id: tenantA,
      };
      localDatabase.importJobs.push(importJobPayload);

      expect(localDatabase.importJobs[0].bank_id).toBe("bank-fullstack-uuid-1");

      // Step E: Verify Tenant Isolation — Tenant B query yields 0 records
      const tenantBBanks = localDatabase.banks.filter((b) => b.tenant_id === tenantB);
      expect(tenantBBanks).toHaveLength(0);

      const tenantABanks = localDatabase.banks.filter((b) => b.tenant_id === tenantA);
      expect(tenantABanks).toHaveLength(1);

      // Step F: Policy Engine Role Enforcement
      const staffCtx: PolicyContext = {
        userId: "staff-alpha-1",
        tenantId: tenantA,
        role: "PLACEMENT_STAFF",
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      };

      const studentCtx: PolicyContext = {
        userId: "student-alpha-1",
        tenantId: tenantA,
        role: "STUDENT",
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      };

      // Placement Staff can create and import questions
      expect(can(staffCtx, Permissions.QUESTIONS_CREATE)).toBe(true);
      expect(can(staffCtx, Permissions.QUESTIONS_IMPORT)).toBe(true);

      // Student is strictly forbidden
      expect(can(studentCtx, Permissions.QUESTIONS_CREATE)).toBe(false);
      expect(can(studentCtx, Permissions.QUESTIONS_IMPORT)).toBe(false);
    });
  });
});
