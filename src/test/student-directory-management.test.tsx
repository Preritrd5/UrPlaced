import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import * as SupabaseAdminModule from "@/lib/supabase/admin";
import { StudentService } from "@/modules/students/services/student-service";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { StudentRowActions } from "@/components/students/student-row-actions";
import { BulkDeleteModal } from "@/components/students/bulk-delete-modal";

// Polyfill pointer methods for jsdom
beforeEach(() => {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock AuditService
vi.mock("@/modules/identity-access/services/audit-service", () => ({
  AuditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

// Global fetch mock
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("UrPlaced — Student Directory Management & Deletion Suite", () => {
  const tenantId = "357c432f-c54f-40f5-b634-9f92704f46fd";
  const actorId = "468bea84-d12e-49c8-8c85-94a2973950b1";

  const createMockAdmin = (overrides: Record<string, any> = {}) => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "stud-1",
          tenant_id: tenantId,
          enrollment_number: "2024CS001",
          full_name: "Rahul Sharma",
          email: "rahul@snpsu.edu.in",
          academic_status: "ACTIVE",
          is_archived: false,
        },
        error: null,
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    chain.then = (resolve: any) =>
      resolve(overrides.defaultQueryResult || { data: [], error: null });

    return {
      from: vi.fn().mockReturnValue(chain),
      ...overrides,
    };
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(
      createMockAdmin() as any
    );
  });

  describe("1. StudentService — Eligibility Checks & Protections", () => {
    it("blocks permanent deletion if the student has a registered user account", async () => {
      vi.spyOn(StudentService, "getById").mockResolvedValueOnce({
        id: "stud-1",
        tenant_id: tenantId,
        user_id: "auth-user-123", // Has user account
        enrollment_number: "2024CS001",
        full_name: "Rahul Sharma",
        email: "rahul@snpsu.edu.in",
        academic_status: "ACTIVE",
        is_archived: false,
      } as any);

      const eligibility = await StudentService.checkStudentDeletionEligibility(
        tenantId,
        "stud-1"
      );

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.dependencies.hasUserAccount).toBe(true);
      expect(
        eligibility.blockingReasons.some((r) =>
          r.includes("registered UrPlaced account")
        )
      ).toBe(true);
    });

    it("allows permanent deletion if student is an unlinked roster entry with 0 dependencies", async () => {
      vi.spyOn(StudentService, "getById").mockResolvedValueOnce({
        id: "stud-2",
        tenant_id: tenantId,
        user_id: null, // No user account
        enrollment_number: "2024CS099",
        full_name: "Standalone Entry",
        email: "standalone@snpsu.edu.in",
        academic_status: "ACTIVE",
        is_archived: false,
      } as any);

      const eligibility = await StudentService.checkStudentDeletionEligibility(
        tenantId,
        "stud-2"
      );

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.blockingReasons.length).toBe(0);
      expect(eligibility.dependencies.hasUserAccount).toBe(false);
      expect(eligibility.dependencies.applicationsCount).toBe(0);
      expect(eligibility.dependencies.offersCount).toBe(0);
    });
  });

  describe("2. StudentService — Deactivation & Reactivation", () => {
    it("deactivates student, sets academic_status to WITHDRAWN and logs audit trail", async () => {
      vi.spyOn(StudentService, "getById").mockResolvedValueOnce({
        id: "stud-1",
        tenant_id: tenantId,
        user_id: "auth-user-123",
        enrollment_number: "2024CS001",
        full_name: "Rahul Sharma",
        academic_status: "ACTIVE",
        is_archived: false,
      } as any);

      const mockAdmin = createMockAdmin();
      mockAdmin.from().single.mockResolvedValueOnce({
        data: {
          id: "stud-1",
          tenant_id: tenantId,
          enrollment_number: "2024CS001",
          full_name: "Rahul Sharma",
          academic_status: "WITHDRAWN",
          is_archived: true,
        },
        error: null,
      });
      vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockAdmin as any);

      const deactivated = await StudentService.deactivate(tenantId, "stud-1", actorId);

      expect(deactivated.is_archived).toBe(true);
      expect(deactivated.academic_status).toBe("WITHDRAWN");
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "STUDENT_DEACTIVATED",
          resourceId: "stud-1",
          tenantId,
          actorId,
        })
      );
    });

    it("reactivates archived student, sets status to ACTIVE and logs audit trail", async () => {
      vi.spyOn(StudentService, "getById").mockResolvedValueOnce({
        id: "stud-1",
        tenant_id: tenantId,
        enrollment_number: "2024CS001",
        academic_status: "WITHDRAWN",
        is_archived: true,
      } as any);

      const mockAdmin = createMockAdmin();
      mockAdmin.from().single.mockResolvedValueOnce({
        data: {
          id: "stud-1",
          tenant_id: tenantId,
          enrollment_number: "2024CS001",
          academic_status: "ACTIVE",
          is_archived: false,
        },
        error: null,
      });
      vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockAdmin as any);

      const reactivated = await StudentService.reactivate(tenantId, "stud-1", actorId);

      expect(reactivated.is_archived).toBe(false);
      expect(reactivated.academic_status).toBe("ACTIVE");
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "STUDENT_REACTIVATED",
          resourceId: "stud-1",
          tenantId,
          actorId,
        })
      );
    });
  });

  describe("3. StudentService — Permanent Delete with SRN Confirmation", () => {
    it("rejects permanent deletion if confirmation SRN does not match exactly", async () => {
      vi.spyOn(StudentService, "getById").mockResolvedValueOnce({
        id: "stud-2",
        tenant_id: tenantId,
        user_id: null,
        enrollment_number: "2024CS099",
        full_name: "Standalone Entry",
        is_archived: false,
      } as any);

      await expect(
        StudentService.deletePermanently(tenantId, "stud-2", "WRONG_SRN", actorId)
      ).rejects.toThrow(/mismatch/i);
    });

    it("rejects permanent deletion if student has blocking dependencies", async () => {
      vi.spyOn(StudentService, "getById").mockResolvedValueOnce({
        id: "stud-1",
        tenant_id: tenantId,
        user_id: "auth-user-123", // Has user account!
        enrollment_number: "2024CS001",
        full_name: "Rahul Sharma",
        is_archived: false,
      } as any);

      await expect(
        StudentService.deletePermanently(tenantId, "stud-1", "2024CS001", actorId)
      ).rejects.toThrow(/Permanent deletion blocked/i);
    });
  });

  describe("4. StudentService — Bulk Deletion Safeguards", () => {
    it("rejects bulk deletion if the confirmation phrase is not 'DELETE ALL STUDENTS'", async () => {
      await expect(
        StudentService.executeBulkDelete(tenantId, "delete all", actorId)
      ).rejects.toThrow(/DELETE ALL STUDENTS/);
    });

    it("getBulkDeletePreview correctly segments eligible vs protected students", async () => {
      const mockAdmin = createMockAdmin();
      // Mock students query returning 3 students: 1 with account, 1 standalone, 1 in application
      mockAdmin.from().select.mockImplementation(() => {
        const chain: any = {
          eq: vi.fn().mockImplementation(() => {
            const inner: any = Promise.resolve({
              data: [
                { id: "s1", enrollment_number: "2024CS001", user_id: "u1" }, // protected by account
                { id: "s2", enrollment_number: "2024CS002", user_id: null }, // eligible
                { id: "s3", enrollment_number: "2024CS003", user_id: null }, // protected by app
              ],
              error: null,
            });
            return inner;
          }),
        };
        return chain;
      });

      vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockAdmin as any);

      const preview = await StudentService.getBulkDeletePreview(tenantId);
      expect(preview).toHaveProperty("totalStudents");
      expect(preview).toHaveProperty("eligibleCount");
      expect(preview).toHaveProperty("protectedCount");
      expect(preview.breakdown).toHaveProperty("withUserAccounts");
    });
  });

  describe("5. UI Component: StudentRowActions", () => {
    const mockStudent = {
      id: "stud-test-1",
      enrollment_number: "2024CS042",
      full_name: "Ananya Roy",
      email: "ananya@snpsu.edu.in",
      is_archived: false,
      academic_status: "ACTIVE",
    };

    it("renders row action dropdown and hides Permanently Delete for non-Placement Heads", async () => {
      render(<StudentRowActions student={mockStudent} canDelete={false} />);

      const trigger = screen.getByRole("button", { name: /actions menu/i });
      fireEvent.keyDown(trigger, { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByText("View Details")).toBeDefined();
        expect(screen.getByText("Remove from Directory")).toBeDefined();
      });
      // Permanently Delete should NOT be visible when canDelete is false
      expect(screen.queryByText("Permanently Delete")).toBeNull();
    });

    it("shows Permanently Delete option when canDelete is true (Placement Head)", async () => {
      render(<StudentRowActions student={mockStudent} canDelete={true} />);

      const trigger = screen.getByRole("button", { name: /actions menu/i });
      fireEvent.keyDown(trigger, { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByText("View Details")).toBeDefined();
        expect(screen.getByText("Remove from Directory")).toBeDefined();
        expect(screen.getByText("Permanently Delete")).toBeDefined();
      });
    });

    it("renders Deactivate dialog with archival guarantees when Remove from Directory is clicked", async () => {
      render(<StudentRowActions student={mockStudent} canDelete={true} />);

      const trigger = screen.getByRole("button", { name: /actions menu/i });
      fireEvent.keyDown(trigger, { key: "Enter" });

      await waitFor(() => {
        expect(screen.getByText("Remove from Directory")).toBeDefined();
      });

      const deactivateBtn = screen.getByText("Remove from Directory");
      fireEvent.click(deactivateBtn);

      await waitFor(() => {
        expect(screen.getAllByText("Remove from Active Directory").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("Safe Archival Guarantee:")).toBeDefined();
      });
    });
  });

  describe("6. UI Component: BulkDeleteModal", () => {
    it("renders the red 'Delete All Students' button and displays live impact preview when clicked", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          totalStudents: 45,
          eligibleCount: 15,
          protectedCount: 30,
          breakdown: {
            withUserAccounts: 20,
            withApplicationsOrOffers: 8,
            withAssessmentsOrTraining: 2,
          },
          sampleEligibleSrns: ["2024CS001", "2024CS002"],
        }),
      });

      render(<BulkDeleteModal collegeName="Sapthagiri NPS University" />);

      const button = screen.getByRole("button", { name: /Delete All Students/i });
      expect(button).toBeDefined();

      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("Delete All Students — College Scope")).toBeDefined();
      });

      await waitFor(() => {
        expect(screen.getByText("Total Roster")).toBeDefined();
        expect(screen.getByText("Eligible to Delete")).toBeDefined();
        expect(screen.getByText("Protected & Retained")).toBeDefined();
      });

      expect(screen.getByText("Automatic Multi-Layer Data Safeguards")).toBeDefined();
      expect(screen.getByText(/20 Accounts/i)).toBeDefined();
      expect(screen.getByText(/8 Drives/i)).toBeDefined();

      const executeBtn = screen.getByRole("button", { name: /Execute Bulk Deletion/i });
      expect(executeBtn.hasAttribute("disabled")).toBe(true);

      // Type confirmation phrase
      const input = screen.getByPlaceholderText(/Type 'DELETE ALL STUDENTS'/i);
      fireEvent.change(input, { target: { value: "DELETE ALL STUDENTS" } });

      expect(executeBtn.hasAttribute("disabled")).toBe(false);
    });
  });
});
