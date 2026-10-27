import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import * as ServerContextModule from "@/lib/auth/server-context";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { GET as getBanks, POST as postBanks } from "@/app/api/questions/banks/route";
import { CreateQuestionBankModal } from "@/components/questions/create-question-bank-modal";
import { BankCategory, BankSharingPolicy } from "@/types/database";

describe("Question Bank Creation & Multi-Tenant Audit Suite (Phase 1)", () => {
  const tenantA = "tenant-college-alpha-uuid";
  const tenantB = "tenant-college-beta-uuid";
  const headUserId = "user-placement-head-1";
  const staffUserId = "user-placement-staff-2";
  const studentUserId = "user-student-3";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockContext = (role: string, tenantId = tenantA, userId = headUserId) => ({
    userId,
    email: `${role.toLowerCase()}@college.edu`,
    isPlatformAdmin: false,
    tenantId,
    tenantRole: role as any,
    tenantStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
  });

  // =========================================================================
  // 1. API Authorization & Multi-Tenancy Enforcement
  // =========================================================================
  describe("1. API Authorization & Multi-Tenant Boundaries", () => {
    it("rejects unauthorized or student requests to GET /api/questions/banks with 403", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockRejectedValue(
        new Error("FORBIDDEN")
      );

      const req = new NextRequest("http://localhost:3000/api/questions/banks");
      const res = await getBanks(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("FORBIDDEN");
    });

    it("rejects unauthorized or student requests to POST /api/questions/banks with 403", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockRejectedValue(
        new Error("FORBIDDEN")
      );

      const req = new NextRequest("http://localhost:3000/api/questions/banks", {
        method: "POST",
        body: JSON.stringify({
          name: "Unauthorized Bank",
          category: "CODING",
        }),
      });
      const res = await postBanks(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toBe("FORBIDDEN");
    });

    it("allows authorized PLACEMENT_HEAD and binds tenant strictly from server context", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockContext("PLACEMENT_HEAD", tenantA, headUserId)
      );

      const listSpy = vi.spyOn(QuestionService, "listBanks").mockResolvedValue({
        data: [
          {
            id: "bank-1",
            tenant_id: tenantA,
            name: "Alpha Coding Bank",
            category: "CODING",
            sharing_policy: "COLLEGE_PRIVATE",
            created_at: new Date().toISOString(),
          },
        ] as any,
        error: null,
      } as any);

      const req = new NextRequest("http://localhost:3000/api/questions/banks");
      const res = await getBanks(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveLength(1);
      expect(json[0].name).toBe("Alpha Coding Bank");
      // Must have invoked listBanks with tenantA from server context
      expect(listSpy).toHaveBeenCalledWith(tenantA);
    });
  });

  // =========================================================================
  // 2. Input Validation & Schema Integrity
  // =========================================================================
  describe("2. Input Validation on POST /api/questions/banks", () => {
    it("rejects request if bank name is missing or whitespace only (400)", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockContext("PLACEMENT_STAFF", tenantA, staffUserId)
      );

      const req = new NextRequest("http://localhost:3000/api/questions/banks", {
        method: "POST",
        body: JSON.stringify({
          name: "    ",
          category: "CODING",
        }),
      });

      const res = await postBanks(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("name is required and cannot be empty");
    });

    it("rejects request if bank name exceeds 256 characters (400)", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockContext("PLACEMENT_HEAD", tenantA, headUserId)
      );

      const longName = "A".repeat(257);
      const req = new NextRequest("http://localhost:3000/api/questions/banks", {
        method: "POST",
        body: JSON.stringify({
          name: longName,
          category: "CODING",
        }),
      });

      const res = await postBanks(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("cannot exceed 256 characters");
    });

    it("rejects invalid or unrecognized bank category (400)", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockContext("PLACEMENT_HEAD", tenantA, headUserId)
      );

      const req = new NextRequest("http://localhost:3000/api/questions/banks", {
        method: "POST",
        body: JSON.stringify({
          name: "Standard Bank",
          category: "NON_EXISTENT_CATEGORY",
        }),
      });

      const res = await postBanks(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Invalid or missing category");
    });

    it("defaults sharing_policy to COLLEGE_PRIVATE if omitted or unlisted", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockContext("PLACEMENT_HEAD", tenantA, headUserId)
      );

      const createSpy = vi.spyOn(QuestionService, "createBank").mockResolvedValue({
        data: {
          id: "bank-new-1",
          tenant_id: tenantA,
          name: "DSA Placement 2026",
          category: "CODING",
          sharing_policy: "COLLEGE_PRIVATE",
          created_by: headUserId,
        } as any,
        error: null,
      } as any);

      const req = new NextRequest("http://localhost:3000/api/questions/banks", {
        method: "POST",
        body: JSON.stringify({
          name: "  DSA Placement 2026  ",
          category: "CODING",
          // sharing_policy omitted
        }),
      });

      const res = await postBanks(req);
      expect(res.status).toBe(201);
      expect(createSpy).toHaveBeenCalledWith(
        tenantA,
        headUserId,
        expect.objectContaining({
          name: "DSA Placement 2026",
          category: "CODING",
          sharing_policy: "COLLEGE_PRIVATE",
        })
      );
    });
  });

  // =========================================================================
  // 3. Duplicate Bank Name Handling & Conflict Response
  // =========================================================================
  describe("3. Duplicate Bank Detection & Conflict Response (409)", () => {
    it("returns 409 Conflict if bank with same name already exists in tenant", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockContext("PLACEMENT_HEAD", tenantA, headUserId)
      );

      vi.spyOn(QuestionService, "createBank").mockResolvedValue({
        data: null,
        error: {
          message: 'A Question Bank named "Campus Aptitude 2026" already exists for your college.',
        },
      } as any);

      const req = new NextRequest("http://localhost:3000/api/questions/banks", {
        method: "POST",
        body: JSON.stringify({
          name: "Campus Aptitude 2026",
          category: "APTITUDE",
        }),
      });

      const res = await postBanks(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toContain("already exists for your college");
    });
  });

  // =========================================================================
  // 4. CreateQuestionBankModal UI Component Tests
  // =========================================================================
  describe("4. CreateQuestionBankModal Component Workflow", () => {
    it("renders modal with all expected form controls when isOpen is true", () => {
      render(
        <CreateQuestionBankModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Create Question Bank" })).toBeInTheDocument();
      expect(screen.getByLabelText(/Question Bank Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Category/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Sharing Policy/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Create Question Bank/i })).toBeInTheDocument();
    });

    it("does not render when isOpen is false", () => {
      render(
        <CreateQuestionBankModal
          isOpen={false}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("shows client-side validation error if name is empty on submission", async () => {
      render(
        <CreateQuestionBankModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      const nameInput = screen.getByLabelText(/Question Bank Name/i);
      fireEvent.change(nameInput, { target: { value: "    " } });

      const submitBtn = screen.getByRole("button", { name: /Create Question Bank/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid Question Bank name/i)).toBeInTheDocument();
      });
    });

    it("submits form data, calls onSuccess callback, and resets on successful creation", async () => {
      const mockOnSuccess = vi.fn();
      const mockOnClose = vi.fn();

      const createdBank = {
        id: "bank-new-88",
        name: "Technical Core 2026",
        category: "TECHNICAL_CORE",
        description: "Operating systems and networks",
        sharing_policy: "COLLEGE_PRIVATE",
      };

      // Mock fetch
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => createdBank,
      } as any);

      render(
        <CreateQuestionBankModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );

      // Fill name
      const nameInput = screen.getByLabelText(/Question Bank Name/i);
      fireEvent.change(nameInput, { target: { value: "Technical Core 2026" } });

      // Fill description
      const descInput = screen.getByLabelText(/Description/i);
      fireEvent.change(descInput, { target: { value: "Operating systems and networks" } });

      // Change category
      const categorySelect = screen.getByLabelText(/Category/i);
      fireEvent.change(categorySelect, { target: { value: "TECHNICAL_CORE" } });

      // Submit
      const submitBtn = screen.getByRole("button", { name: /Create Question Bank/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledWith(
          "/api/questions/banks",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              name: "Technical Core 2026",
              category: "TECHNICAL_CORE",
              description: "Operating systems and networks",
              sharing_policy: "COLLEGE_PRIVATE",
            }),
          })
        );
      });

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith(createdBank);
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it("displays error alert when API returns error response", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'A Question Bank named "Existing Bank" already exists for your college.',
        }),
      } as any);

      render(
        <CreateQuestionBankModal
          isOpen={true}
          onClose={vi.fn()}
          onSuccess={vi.fn()}
        />
      );

      const nameInput = screen.getByLabelText(/Question Bank Name/i);
      fireEvent.change(nameInput, { target: { value: "Existing Bank" } });

      const submitBtn = screen.getByRole("button", { name: /Create Question Bank/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/already exists for your college/i)
        ).toBeInTheDocument();
      });
    });
  });
});
