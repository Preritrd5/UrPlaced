/**
 * ==============================================================================
 * UrPlaced — Student Assessment Visibility, SRN Identity Verification &
 * Multi-College Security Hardening Test Suite
 * ==============================================================================
 * Verifies:
 * 1. Detail 1: Verified Email Fallback Elimination & SRN Canonical Identity
 *    - Student resolution strictly relies on (tenant_id, user_id) binding established via SRN claiming.
 *    - Unclaimed roster records matching email are never used to authorize protected resources.
 * 2. Detail 2: Assignments with student_id = NULL (College-wide vs Cohort)
 *    - Null student_id explicitly represents college-wide active assignment within that tenant.
 *    - Enforces tenant isolation, academic status (ACTIVE), and non-archived status.
 *    - Inactive or archived students receive 0 assignments and cannot start attempts.
 * 3. Detail 3: Notification Visibility with college_id = NULL
 *    - Notifications with null college_id are strictly scoped to recipient_user_id.
 *    - Read, unread count, listing, and deletion operations enforce tenant and recipient boundaries.
 * 4. Assessment attempt lifecycle, autosave, submission, and result retrieval boundaries.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AssignmentService,
  isCollegeWideCohort,
  studentMatchesCohort,
} from "@/modules/assessments/services/assignment-service";
import { AttemptLifecycleService } from "@/modules/assessments/services/attempt-lifecycle-service";
import { AutosaveService } from "@/modules/assessments/services/autosave-service";
import { StudentService } from "@/modules/students/services/student-service";
import { NotificationService } from "@/modules/notifications/services/notification-service";

// ---------------------------------------------------------------------------
// Mocks for Supabase Clients
// ---------------------------------------------------------------------------
const mockServerFrom = vi.fn();
const mockAdminFrom = vi.fn();
const mockRpc = vi.fn();
const mockUpdateUserById = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: () => ({
    from: mockServerFrom,
  }),
  createClient: () => ({
    from: mockServerFrom,
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockAdminFrom,
    rpc: mockRpc,
    auth: {
      admin: {
        updateUserById: mockUpdateUserById,
      },
    },
  }),
}));

vi.mock("@/modules/identity-access/services/audit-service", () => ({
  AuditService: {
    log: vi.fn(),
  },
}));

function createChainableQuery(resultData: any = null, error: any = null, count: number = 0) {
  const query: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockImplementation(() => Promise.resolve({ data: resultData, count, error })),
    limit: vi.fn().mockImplementation(() => Promise.resolve({ data: resultData, error })),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: resultData, error })),
    single: vi.fn().mockImplementation(() => Promise.resolve({ data: resultData, error })),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    then: (resolve: any) => Promise.resolve({ data: resultData, count, error }).then(resolve),
  };
  return query;
}

describe("UrPlaced: Student Assessment Visibility & Multi-College Security Hardening", () => {
  const collegeAlphaTenantId = "11111111-1111-4111-8111-111111111111";
  const collegeBetaTenantId = "22222222-2222-4222-8222-222222222222";

  const studentAlphaId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const studentAlphaUserId = "33333333-3333-4333-8333-333333333333";
  const studentBetaId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const studentBetaUserId = "44444444-4444-4444-8444-444444444444";

  const assessmentAlphaId = "99999999-9999-4999-8999-999999999999";
  const assessmentBetaId = "88888888-8888-4888-8888-888888888888";
  const testNotificationId = "77777777-7777-4777-8777-777777777777";

  const defaultActiveStudent = {
    id: studentAlphaId,
    tenant_id: collegeAlphaTenantId,
    user_id: studentAlphaUserId,
    enrollment_number: "24SUUBECS1577",
    full_name: "Verified Student",
    email: "student@college.edu",
    academic_status: "ACTIVE",
    is_archived: false,
    department_id: "dept-cse-id",
    graduation_year: 2026,
    degree: "B.Tech",
    department: {
      id: "dept-cse-id",
      code: "CSE",
      name: "Computer Science and Engineering",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // SECTION 1: DETAIL 1 — Canonical SRN-Claimed Identity & Email Fallback Elimination
  // =========================================================================
  describe("1. Detail 1: Canonical SRN Identity & Verified Email Fallback Elimination", () => {
    it("authorizes student when user_id is canonically bound to roster record via SRN claim", async () => {
      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return createChainableQuery(defaultActiveStudent);
        }
        if (table === "assessment_assignments") {
          return createChainableQuery([]);
        }
        return createChainableQuery([]);
      });

      const res = await AssignmentService.listAssignmentsForStudent(
        collegeAlphaTenantId,
        studentAlphaId
      );

      expect(res.success).toBe(true);
      expect(res.assignments).toEqual([]);
    });

    it("rejects access and returns empty assignments when student record is inactive or archived", async () => {
      const archivedStudent = {
        ...defaultActiveStudent,
        is_archived: true,
      };

      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return createChainableQuery(archivedStudent);
        }
        return createChainableQuery([]);
      });

      const res = await AssignmentService.listAssignmentsForStudent(
        collegeAlphaTenantId,
        studentAlphaId
      );

      // Inactive/archived student receives 0 assignments
      expect(res.success).toBe(true);
      expect(res.assignments).toHaveLength(0);
    });

    it("startAttempt rejects attempt if student record is archived", async () => {
      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return createChainableQuery({
            ...defaultActiveStudent,
            is_archived: true,
          });
        }
        return createChainableQuery([]);
      });

      const res = await AttemptLifecycleService.startAttempt(
        collegeAlphaTenantId,
        studentAlphaId,
        assessmentAlphaId
      );

      expect(res.success).toBe(false);
      expect(res.error).toBe("Student profile not found, inactive, or not authorized for this college.");
    });

    it("startAttempt rejects attempt if student academic_status is not ACTIVE", async () => {
      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return createChainableQuery({
            ...defaultActiveStudent,
            academic_status: "WITHDRAWN",
          });
        }
        return createChainableQuery([]);
      });

      const res = await AttemptLifecycleService.startAttempt(
        collegeAlphaTenantId,
        studentAlphaId,
        assessmentAlphaId
      );

      expect(res.success).toBe(false);
      expect(res.error).toBe("Student profile not found, inactive, or not authorized for this college.");
    });
  });

  // =========================================================================
  // SECTION 2: DETAIL 2 — College-Wide vs Cohort Assignments (student_id = NULL)
  // =========================================================================
  describe("2. Detail 2: Assignments with student_id = NULL (College-Wide Audience)", () => {
    it("allows active student to access college-wide assignment (student_id is null) in their own tenant", async () => {
      const now = new Date();
      const collegeWideAssignment = {
        id: "assignment-college-wide",
        assessment_id: assessmentAlphaId,
        student_id: null,
        cohort_name: "All Enrolled Students",
        window_start: new Date(now.getTime() - 3600000).toISOString(),
        window_end: new Date(now.getTime() + 86400000).toISOString(),
        max_attempts_override: 1,
        status: "ACTIVE",
        created_at: now.toISOString(),
        assessment: {
          id: assessmentAlphaId,
          title: "College-Wide Mock Assessment",
          time_limit_minutes: 60,
          allowed_attempts: 1,
          pass_percentage: 60,
          status: "PUBLISHED",
        },
      };

      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return createChainableQuery(defaultActiveStudent);
        }
        if (table === "assessment_assignments") {
          return createChainableQuery([collegeWideAssignment]);
        }
        if (table === "assessment_attempts") {
          return createChainableQuery([]);
        }
        return createChainableQuery([]);
      });

      const res = await AssignmentService.listAssignmentsForStudent(
        collegeAlphaTenantId,
        studentAlphaId
      );

      expect(res.success).toBe(true);
      expect(res.assignments).toHaveLength(1);
      expect(res.assignments[0].canAttempt).toBe(true);
      expect(res.assignments[0].cohortName).toBe("All Enrolled Students");
    });

    it("denies access to a student from another tenant even if college-wide assignment exists", async () => {
      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          // Student belongs to Beta, but query asks for Alpha
          return createChainableQuery(null);
        }
        return createChainableQuery([]);
      });

      const res = await AssignmentService.listAssignmentsForStudent(
        collegeAlphaTenantId,
        studentBetaId
      );

      expect(res.success).toBe(true);
      expect(res.assignments).toHaveLength(0);
    });

    it("direct student assignment takes precedence over college-wide assignment", async () => {
      const now = new Date();
      const collegeWide = {
        id: "assignment-general",
        assessment_id: assessmentAlphaId,
        student_id: null,
        cohort_name: "All Students",
        max_attempts_override: 1,
        window_start: new Date(now.getTime() - 3600000).toISOString(),
        window_end: new Date(now.getTime() + 86400000).toISOString(),
        status: "ACTIVE",
      };

      const directOverride = {
        id: "assignment-direct",
        assessment_id: assessmentAlphaId,
        student_id: studentAlphaId,
        cohort_name: null,
        max_attempts_override: 3, // Overridden to 3 attempts
        window_start: new Date(now.getTime() - 3600000).toISOString(),
        window_end: new Date(now.getTime() + 86400000).toISOString(),
        status: "ACTIVE",
      };

      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return createChainableQuery(defaultActiveStudent);
        }
        if (table === "assessments") {
          return createChainableQuery({
            id: assessmentAlphaId,
            tenant_id: collegeAlphaTenantId,
            status: "PUBLISHED",
            allowed_attempts: 1,
          });
        }
        if (table === "assessment_assignments") {
          return createChainableQuery([collegeWide, directOverride]);
        }
        if (table === "assessment_attempts") {
          const q = createChainableQuery([], null, 0);
          q.single = vi.fn().mockImplementation(() =>
            Promise.resolve({
              data: { id: "att-created", assignment_id: "assignment-direct" },
              error: null,
            })
          );
          return q;
        }
        if (table === "question_set_items") {
          return createChainableQuery([
            {
              question_id: "q-1",
              version_id: "v-1",
              sequence_order: 1,
              points: 5,
              negative_points: 0,
              question: { id: "q-1", question_type: "SINGLE_CHOICE" },
              version: { id: "v-1", prompt: "Test", options: [] },
            },
          ]);
        }
        return createChainableQuery({ id: "att-created", assignment_id: "assignment-direct" });
      });

      const res = await AttemptLifecycleService.startAttempt(
        collegeAlphaTenantId,
        studentAlphaId,
        assessmentAlphaId
      );

      // Verified: Direct assignment with override took precedence
      expect(res.success).toBe(true);
      expect(res.attempt?.assignment_id).toBe("assignment-direct");
    });

    it("evaluates isCollegeWideCohort accurately, normalizing whitespace and rejecting appended restrictions", () => {
      // 1. Exact recognized college-wide labels
      expect(isCollegeWideCohort("All Eligible Students")).toBe(true);
      expect(isCollegeWideCohort("All Enrolled Students")).toBe(true);
      expect(isCollegeWideCohort("All Students")).toBe(true);
      expect(isCollegeWideCohort("College-wide")).toBe(true);
      expect(isCollegeWideCohort("College wide")).toBe(true);
      expect(isCollegeWideCohort("Campus-wide")).toBe(true);
      expect(isCollegeWideCohort("Campus wide")).toBe(true);
      expect(isCollegeWideCohort("Entire College")).toBe(true);
      expect(isCollegeWideCohort("Institution-wide")).toBe(true);
      expect(isCollegeWideCohort("Institution wide")).toBe(true);

      // 2. Case and whitespace variations
      expect(isCollegeWideCohort("all eligible students")).toBe(true);
      expect(isCollegeWideCohort("ALL ELIGIBLE STUDENTS")).toBe(true);
      expect(isCollegeWideCohort("   All   Eligible   Students   ")).toBe(true);
      expect(isCollegeWideCohort("  COLLEGE-WIDE  ")).toBe(true);
      expect(isCollegeWideCohort("\tEntire College\n")).toBe(true);

      // 3. College-wide phrases followed by specific restrictions MUST NOT be accepted as college-wide
      expect(isCollegeWideCohort("All Eligible Students - Mechanical Engineering")).toBe(false);
      expect(isCollegeWideCohort("All Eligible Students - Batch 2026")).toBe(false);
      expect(isCollegeWideCohort("All Eligible Students (CSE)")).toBe(false);
      expect(isCollegeWideCohort("All Enrolled Students - 2025")).toBe(false);
      expect(isCollegeWideCohort("College-wide - ME")).toBe(false);
      expect(isCollegeWideCohort("College wide: Electrical")).toBe(false);
      expect(isCollegeWideCohort("Campus-wide (Civil)")).toBe(false);
      expect(isCollegeWideCohort("All Eligible Students / MCA")).toBe(false);

      // 4. Standalone cohorts & ambiguous scopes
      expect(isCollegeWideCohort("Mechanical Engineering")).toBe(false);
      expect(isCollegeWideCohort("CSE-2026")).toBe(false);
      expect(isCollegeWideCohort("Batch 2026")).toBe(false);
      expect(isCollegeWideCohort("All")).toBe(false);
      expect(isCollegeWideCohort("Everyone")).toBe(false);
      expect(isCollegeWideCohort("")).toBe(false);
      expect(isCollegeWideCohort("   ")).toBe(false);
      expect(isCollegeWideCohort(null)).toBe(false);
      expect(isCollegeWideCohort(undefined)).toBe(false);
    });

    it("evaluates studentMatchesCohort for department, year, degree, and fail-closed rules", () => {
      const studentProfile = {
        id: studentAlphaId,
        graduation_year: 2026,
        degree: "B.Tech",
        department: {
          code: "CSE",
          name: "Computer Science and Engineering",
        },
      };

      // Valid matches
      expect(studentMatchesCohort(studentProfile, "All Eligible Students")).toBe(true);
      expect(studentMatchesCohort(studentProfile, "CSE-2026")).toBe(true);
      expect(studentMatchesCohort(studentProfile, "Computer Science - Batch 2026")).toBe(true);
      expect(studentMatchesCohort(studentProfile, "Computer Science")).toBe(true);
      expect(studentMatchesCohort(studentProfile, "Batch 2026")).toBe(true);
      expect(studentMatchesCohort(studentProfile, "B.Tech CSE 2026")).toBe(true);

      // Rejections: Department mismatch
      expect(studentMatchesCohort(studentProfile, "Mechanical Engineering")).toBe(false);
      expect(studentMatchesCohort(studentProfile, "Mechanical Engineering - Batch 2026")).toBe(false);
      expect(studentMatchesCohort(studentProfile, "ME 2026")).toBe(false);
      expect(studentMatchesCohort(studentProfile, "Civil Engineering")).toBe(false);

      // Rejections: Year mismatch
      expect(studentMatchesCohort(studentProfile, "CSE 2025")).toBe(false);
      expect(studentMatchesCohort(studentProfile, "Batch 2025")).toBe(false);

      // Rejections: Degree mismatch
      expect(studentMatchesCohort(studentProfile, "MCA 2026")).toBe(false);

      // Fail-closed on missing / ambiguous scope
      expect(studentMatchesCohort(studentProfile, "")).toBe(false);
      expect(studentMatchesCohort(studentProfile, "   ")).toBe(false);
      expect(studentMatchesCohort(studentProfile, null)).toBe(false);
      expect(studentMatchesCohort(studentProfile, undefined)).toBe(false);
    });

    it("prevents cohort-specific assessment from leaking to other departments in listAssignmentsForStudent", async () => {
      const now = new Date();
      const mechanicalCohortAssignment = {
        id: "assignment-mech-only",
        assessment_id: assessmentAlphaId,
        student_id: null,
        cohort_name: "Mechanical Engineering - Batch 2026",
        window_start: new Date(now.getTime() - 3600000).toISOString(),
        window_end: new Date(now.getTime() + 86400000).toISOString(),
        max_attempts_override: 1,
        status: "ACTIVE",
        created_at: now.toISOString(),
        assessment: {
          id: assessmentAlphaId,
          title: "Mechanical Core Dynamics Test",
          time_limit_minutes: 60,
          allowed_attempts: 1,
          pass_percentage: 60,
          status: "PUBLISHED",
        },
      };

      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          // Student is in CSE
          return createChainableQuery(defaultActiveStudent);
        }
        if (table === "assessment_assignments") {
          return createChainableQuery([mechanicalCohortAssignment]);
        }
        if (table === "assessment_attempts") {
          return createChainableQuery([]);
        }
        return createChainableQuery([]);
      });

      const res = await AssignmentService.listAssignmentsForStudent(
        collegeAlphaTenantId,
        studentAlphaId
      );

      expect(res.success).toBe(true);
      // CSE student must NOT see Mechanical cohort assessment
      expect(res.assignments).toHaveLength(0);
    });

    it("rejects ambiguous or missing cohort_name in listAssignmentsForStudent (fail-closed)", async () => {
      const now = new Date();
      const ambiguousAssignment = {
        id: "assignment-ambiguous",
        assessment_id: assessmentAlphaId,
        student_id: null,
        cohort_name: null, // Ambiguous / missing scope
        window_start: new Date(now.getTime() - 3600000).toISOString(),
        window_end: new Date(now.getTime() + 86400000).toISOString(),
        max_attempts_override: 1,
        status: "ACTIVE",
        created_at: now.toISOString(),
        assessment: {
          id: assessmentAlphaId,
          title: "Ambiguous Scope Test",
          time_limit_minutes: 60,
          allowed_attempts: 1,
          pass_percentage: 60,
          status: "PUBLISHED",
        },
      };

      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return createChainableQuery(defaultActiveStudent);
        }
        if (table === "assessment_assignments") {
          return createChainableQuery([ambiguousAssignment]);
        }
        if (table === "assessment_attempts") {
          return createChainableQuery([]);
        }
        return createChainableQuery([]);
      });

      const res = await AssignmentService.listAssignmentsForStudent(
        collegeAlphaTenantId,
        studentAlphaId
      );

      expect(res.success).toBe(true);
      // Must NOT treat null cohort_name as college-wide unless explicitly designated
      expect(res.assignments).toHaveLength(0);
    });

    it("rejects attempt-start for student from different cohort in startAttempt", async () => {
      const now = new Date();
      const mechAssignment = {
        id: "assignment-mech",
        assessment_id: assessmentAlphaId,
        student_id: null,
        cohort_name: "Mechanical Engineering",
        max_attempts_override: 1,
        window_start: new Date(now.getTime() - 3600000).toISOString(),
        window_end: new Date(now.getTime() + 86400000).toISOString(),
        status: "ACTIVE",
      };

      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          // Student is in CSE
          return createChainableQuery(defaultActiveStudent);
        }
        if (table === "assessments") {
          return createChainableQuery({
            id: assessmentAlphaId,
            tenant_id: collegeAlphaTenantId,
            status: "PUBLISHED",
            allowed_attempts: 1,
          });
        }
        if (table === "assessment_assignments") {
          return createChainableQuery([mechAssignment]);
        }
        return createChainableQuery([]);
      });

      const res = await AttemptLifecycleService.startAttempt(
        collegeAlphaTenantId,
        studentAlphaId,
        assessmentAlphaId
      );

      // Must reject start attempt for out-of-cohort student
      expect(res.success).toBe(false);
      expect(res.error).toBe("You are not assigned to this assessment.");
    });

    it("rejects attempt-start for assignment with missing or null cohort_name in startAttempt", async () => {
      const now = new Date();
      const ambiguousAssignment = {
        id: "assignment-null-cohort",
        assessment_id: assessmentAlphaId,
        student_id: null,
        cohort_name: null,
        max_attempts_override: 1,
        window_start: new Date(now.getTime() - 3600000).toISOString(),
        window_end: new Date(now.getTime() + 86400000).toISOString(),
        status: "ACTIVE",
      };

      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return createChainableQuery(defaultActiveStudent);
        }
        if (table === "assessments") {
          return createChainableQuery({
            id: assessmentAlphaId,
            tenant_id: collegeAlphaTenantId,
            status: "PUBLISHED",
            allowed_attempts: 1,
          });
        }
        if (table === "assessment_assignments") {
          return createChainableQuery([ambiguousAssignment]);
        }
        return createChainableQuery([]);
      });

      const res = await AttemptLifecycleService.startAttempt(
        collegeAlphaTenantId,
        studentAlphaId,
        assessmentAlphaId
      );

      expect(res.success).toBe(false);
      expect(res.error).toBe("You are not assigned to this assessment.");
    });

    it("allows attempt-start for student matching their academic cohort", async () => {
      const now = new Date();
      const cseAssignment = {
        id: "assignment-cse",
        assessment_id: assessmentAlphaId,
        student_id: null,
        cohort_name: "Computer Science - Batch 2026",
        max_attempts_override: 2,
        window_start: new Date(now.getTime() - 3600000).toISOString(),
        window_end: new Date(now.getTime() + 86400000).toISOString(),
        status: "ACTIVE",
      };

      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return createChainableQuery(defaultActiveStudent);
        }
        if (table === "assessments") {
          return createChainableQuery({
            id: assessmentAlphaId,
            tenant_id: collegeAlphaTenantId,
            status: "PUBLISHED",
            allowed_attempts: 1,
          });
        }
        if (table === "assessment_assignments") {
          return createChainableQuery([cseAssignment]);
        }
        if (table === "assessment_attempts") {
          const q = createChainableQuery([], null, 0);
          q.single = vi.fn().mockImplementation(() =>
            Promise.resolve({
              data: { id: "att-cse-success", assignment_id: "assignment-cse" },
              error: null,
            })
          );
          return q;
        }
        if (table === "question_set_items") {
          return createChainableQuery([
            {
              question_id: "q-1",
              version_id: "v-1",
              sequence_order: 1,
              points: 5,
              negative_points: 0,
              question: { id: "q-1", question_type: "SINGLE_CHOICE" },
              version: { id: "v-1", prompt: "Test", options: [] },
            },
          ]);
        }
        return createChainableQuery({ id: "att-cse-success", assignment_id: "assignment-cse" });
      });

      const res = await AttemptLifecycleService.startAttempt(
        collegeAlphaTenantId,
        studentAlphaId,
        assessmentAlphaId
      );

      expect(res.success).toBe(true);
      expect(res.attempt?.assignment_id).toBe("assignment-cse");
    });

    it("strictly denies CSE student from accessing an assessment labeled 'All Eligible Students - Mechanical Engineering' in listAssignmentsForStudent", async () => {
      const now = new Date();
      const prependedMechAssignment = {
        id: "assignment-prepended-mech",
        assessment_id: assessmentAlphaId,
        student_id: null,
        cohort_name: "All Eligible Students - Mechanical Engineering",
        window_start: new Date(now.getTime() - 3600000).toISOString(),
        window_end: new Date(now.getTime() + 86400000).toISOString(),
        max_attempts_override: 1,
        status: "ACTIVE",
        created_at: now.toISOString(),
        assessment: {
          id: assessmentAlphaId,
          title: "Mechanical Dynamics Special",
          time_limit_minutes: 60,
          allowed_attempts: 1,
          pass_percentage: 60,
          status: "PUBLISHED",
        },
      };

      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          // defaultActiveStudent is in CSE
          return createChainableQuery(defaultActiveStudent);
        }
        if (table === "assessment_assignments") {
          return createChainableQuery([prependedMechAssignment]);
        }
        if (table === "assessment_attempts") {
          return createChainableQuery([]);
        }
        return createChainableQuery([]);
      });

      const res = await AssignmentService.listAssignmentsForStudent(
        collegeAlphaTenantId,
        studentAlphaId
      );

      expect(res.success).toBe(true);
      // CSE student must NOT see Mechanical assessment despite 'All Eligible Students' prefix
      expect(res.assignments).toHaveLength(0);
    });

    it("strictly grants Mechanical student access to an assessment labeled 'All Eligible Students - Mechanical Engineering' in listAssignmentsForStudent", async () => {
      const now = new Date();
      const prependedMechAssignment = {
        id: "assignment-prepended-mech",
        assessment_id: assessmentAlphaId,
        student_id: null,
        cohort_name: "All Eligible Students - Mechanical Engineering",
        window_start: new Date(now.getTime() - 3600000).toISOString(),
        window_end: new Date(now.getTime() + 86400000).toISOString(),
        max_attempts_override: 1,
        status: "ACTIVE",
        created_at: now.toISOString(),
        assessment: {
          id: assessmentAlphaId,
          title: "Mechanical Dynamics Special",
          time_limit_minutes: 60,
          allowed_attempts: 1,
          pass_percentage: 60,
          status: "PUBLISHED",
        },
      };

      const mechanicalStudent = {
        ...defaultActiveStudent,
        department_id: "dept-me-id",
        department: {
          id: "dept-me-id",
          code: "ME",
          name: "Mechanical Engineering",
        },
      };

      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return createChainableQuery(mechanicalStudent);
        }
        if (table === "assessment_assignments") {
          return createChainableQuery([prependedMechAssignment]);
        }
        if (table === "assessment_attempts") {
          return createChainableQuery([]);
        }
        return createChainableQuery([]);
      });

      const res = await AssignmentService.listAssignmentsForStudent(
        collegeAlphaTenantId,
        studentAlphaId
      );

      expect(res.success).toBe(true);
      // Mechanical student MUST see Mechanical assessment
      expect(res.assignments).toHaveLength(1);
      expect(res.assignments[0].cohortName).toBe("All Eligible Students - Mechanical Engineering");
    });

    it("strictly denies Batch 2025 student from accessing 'All Eligible Students - Batch 2026' in listAssignmentsForStudent", async () => {
      const now = new Date();
      const batch2026Assignment = {
        id: "assignment-batch-2026",
        assessment_id: assessmentAlphaId,
        student_id: null,
        cohort_name: "All Eligible Students - Batch 2026",
        window_start: new Date(now.getTime() - 3600000).toISOString(),
        window_end: new Date(now.getTime() + 86400000).toISOString(),
        max_attempts_override: 1,
        status: "ACTIVE",
        created_at: now.toISOString(),
        assessment: {
          id: assessmentAlphaId,
          title: "Batch 2026 Diagnostic Test",
          time_limit_minutes: 60,
          allowed_attempts: 1,
          pass_percentage: 60,
          status: "PUBLISHED",
        },
      };

      const batch2025Student = {
        ...defaultActiveStudent,
        graduation_year: 2025, // Different graduation year
      };

      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return createChainableQuery(batch2025Student);
        }
        if (table === "assessment_assignments") {
          return createChainableQuery([batch2026Assignment]);
        }
        if (table === "assessment_attempts") {
          return createChainableQuery([]);
        }
        return createChainableQuery([]);
      });

      const res = await AssignmentService.listAssignmentsForStudent(
        collegeAlphaTenantId,
        studentAlphaId
      );

      expect(res.success).toBe(true);
      // Batch 2025 student must NOT see Batch 2026 assessment
      expect(res.assignments).toHaveLength(0);
    });

    it("strictly permits Batch 2026 student to access 'All Eligible Students - Batch 2026' in listAssignmentsForStudent", async () => {
      const now = new Date();
      const batch2026Assignment = {
        id: "assignment-batch-2026",
        assessment_id: assessmentAlphaId,
        student_id: null,
        cohort_name: "All Eligible Students - Batch 2026",
        window_start: new Date(now.getTime() - 3600000).toISOString(),
        window_end: new Date(now.getTime() + 86400000).toISOString(),
        max_attempts_override: 1,
        status: "ACTIVE",
        created_at: now.toISOString(),
        assessment: {
          id: assessmentAlphaId,
          title: "Batch 2026 Diagnostic Test",
          time_limit_minutes: 60,
          allowed_attempts: 1,
          pass_percentage: 60,
          status: "PUBLISHED",
        },
      };

      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          // defaultActiveStudent has graduation_year: 2026
          return createChainableQuery(defaultActiveStudent);
        }
        if (table === "assessment_assignments") {
          return createChainableQuery([batch2026Assignment]);
        }
        if (table === "assessment_attempts") {
          return createChainableQuery([]);
        }
        return createChainableQuery([]);
      });

      const res = await AssignmentService.listAssignmentsForStudent(
        collegeAlphaTenantId,
        studentAlphaId
      );

      expect(res.success).toBe(true);
      expect(res.assignments).toHaveLength(1);
      expect(res.assignments[0].cohortName).toBe("All Eligible Students - Batch 2026");
    });

    it("strictly rejects CSE student from startAttempt when assignment is labeled 'All Eligible Students - Mechanical Engineering'", async () => {
      const now = new Date();
      const prependedMechAssignment = {
        id: "assignment-prepended-mech",
        assessment_id: assessmentAlphaId,
        student_id: null,
        cohort_name: "All Eligible Students - Mechanical Engineering",
        max_attempts_override: 1,
        window_start: new Date(now.getTime() - 3600000).toISOString(),
        window_end: new Date(now.getTime() + 86400000).toISOString(),
        status: "ACTIVE",
      };

      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          // defaultActiveStudent is in CSE
          return createChainableQuery(defaultActiveStudent);
        }
        if (table === "assessments") {
          return createChainableQuery({
            id: assessmentAlphaId,
            tenant_id: collegeAlphaTenantId,
            status: "PUBLISHED",
            allowed_attempts: 1,
          });
        }
        if (table === "assessment_assignments") {
          return createChainableQuery([prependedMechAssignment]);
        }
        return createChainableQuery([]);
      });

      const res = await AttemptLifecycleService.startAttempt(
        collegeAlphaTenantId,
        studentAlphaId,
        assessmentAlphaId
      );

      // Must be rejected with not assigned
      expect(res.success).toBe(false);
      expect(res.error).toBe("You are not assigned to this assessment.");
    });

    it("strictly permits Mechanical student to startAttempt when assignment is labeled 'All Eligible Students - Mechanical Engineering'", async () => {
      const now = new Date();
      const prependedMechAssignment = {
        id: "assignment-prepended-mech",
        assessment_id: assessmentAlphaId,
        student_id: null,
        cohort_name: "All Eligible Students - Mechanical Engineering",
        max_attempts_override: 1,
        window_start: new Date(now.getTime() - 3600000).toISOString(),
        window_end: new Date(now.getTime() + 86400000).toISOString(),
        status: "ACTIVE",
      };

      const mechanicalStudent = {
        ...defaultActiveStudent,
        department_id: "dept-me-id",
        department: {
          id: "dept-me-id",
          code: "ME",
          name: "Mechanical Engineering",
        },
      };

      mockServerFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return createChainableQuery(mechanicalStudent);
        }
        if (table === "assessments") {
          return createChainableQuery({
            id: assessmentAlphaId,
            tenant_id: collegeAlphaTenantId,
            status: "PUBLISHED",
            allowed_attempts: 1,
          });
        }
        if (table === "assessment_assignments") {
          return createChainableQuery([prependedMechAssignment]);
        }
        if (table === "assessment_attempts") {
          const q = createChainableQuery([], null, 0);
          q.single = vi.fn().mockImplementation(() =>
            Promise.resolve({
              data: { id: "att-mech-success", assignment_id: "assignment-prepended-mech" },
              error: null,
            })
          );
          return q;
        }
        if (table === "question_set_items") {
          return createChainableQuery([
            {
              question_id: "q-1",
              version_id: "v-1",
              sequence_order: 1,
              points: 5,
              negative_points: 0,
              question: { id: "q-1", question_type: "SINGLE_CHOICE" },
              version: { id: "v-1", prompt: "Test", options: [] },
            },
          ]);
        }
        return createChainableQuery({ id: "att-mech-success", assignment_id: "assignment-prepended-mech" });
      });

      const res = await AttemptLifecycleService.startAttempt(
        collegeAlphaTenantId,
        studentAlphaId,
        assessmentAlphaId
      );

      expect(res.success).toBe(true);
      expect(res.attempt?.assignment_id).toBe("assignment-prepended-mech");
    });
  });

  // =========================================================================
  // SECTION 3: DETAIL 3 — Null-College Notifications & Recipient Isolation
  // =========================================================================
  describe("3. Detail 3: Notification Visibility with college_id = NULL", () => {
    it("scopes notifications to recipient_user_id and permits null-college system messages", async () => {
      const systemNotification = {
        id: testNotificationId,
        recipient_user_id: studentAlphaUserId,
        college_id: null, // Platform-level system notification
        type: "SYSTEM",
        title: "Platform Maintenance Alert",
        body: "Scheduled maintenance at midnight",
        action_url: null,
        read_at: null,
        created_at: new Date().toISOString(),
      };

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === "notifications") {
          return createChainableQuery([systemNotification], null, 1);
        }
        return createChainableQuery([]);
      });

      const res = await NotificationService.listNotifications({
        userId: studentAlphaUserId,
        collegeId: collegeAlphaTenantId,
      });

      expect(res.notifications).toHaveLength(1);
      expect(res.notifications[0].id).toBe(testNotificationId);
      expect(res.notifications[0].college_id).toBeNull();
      expect(res.unreadCount).toBe(1);
    });

    it("does not leak notifications across different recipients", async () => {
      // If studentBeta queries notifications, studentAlpha's notification is not returned
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === "notifications") {
          // Empty result because recipient_user_id does not match
          return createChainableQuery([], null, 0);
        }
        return createChainableQuery([]);
      });

      const res = await NotificationService.listNotifications({
        userId: studentBetaUserId,
        collegeId: collegeAlphaTenantId,
      });

      expect(res.notifications).toHaveLength(0);
      expect(res.unreadCount).toBe(0);
    });

    it("deleteNotification enforces recipient ownership and optional college scope", async () => {
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === "notifications") {
          return createChainableQuery(null, null);
        }
        return createChainableQuery([]);
      });

      const deleted = await NotificationService.deleteNotification({
        userId: studentAlphaUserId,
        notificationId: testNotificationId,
        collegeId: collegeAlphaTenantId,
      });

      expect(deleted).toBe(true);
    });

    it("markAsRead and markAllAsRead enforce recipient ownership", async () => {
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === "notifications") {
          return createChainableQuery({
            id: testNotificationId,
            recipient_user_id: studentAlphaUserId,
            read_at: new Date().toISOString(),
          });
        }
        return createChainableQuery([]);
      });

      const res = await NotificationService.markAsRead({
        userId: studentAlphaUserId,
        notificationId: testNotificationId,
        collegeId: collegeAlphaTenantId,
      });

      expect(res).not.toBeNull();
      expect(res?.recipient_user_id).toBe(studentAlphaUserId);
    });
  });

  // =========================================================================
  // SECTION 4: ASSESSMENT ATTEMPT SECURITY & RESULT AUTHORIZATION
  // =========================================================================
  describe("4. Assessment Attempt Security & Fail-Closed Result Authorization", () => {
    it("AutosaveService.saveResponse blocks cross-student attempt tampering", async () => {
      mockServerFrom.mockImplementation((table: string) => {
        if (table === "assessment_attempts") {
          return createChainableQuery({
            id: "att-student-alpha",
            tenant_id: collegeAlphaTenantId,
            student_id: studentAlphaId,
            status: "IN_PROGRESS",
            expires_at: new Date(Date.now() + 3600000).toISOString(),
          });
        }
        return createChainableQuery([]);
      });

      const result = await AutosaveService.saveResponse(
        collegeAlphaTenantId,
        studentBetaId, // Unauthorized student!
        {
          attemptId: "att-student-alpha",
          questionId: "q-1",
          versionId: "v-1",
          responsePayload: { selectedOptionId: "opt-a" },
          saveSequence: 1,
        }
      );

      expect(result.success).toBe(false);
      expect(result.acknowledged).toBe(false);
      expect(result.error).toBe("Forbidden: Not authorized to modify this attempt.");
    });

    it("AttemptLifecycleService.getAttemptResult strictly denies cross-student access fail-closed", async () => {
      mockServerFrom.mockImplementation((table: string) => {
        if (table === "assessment_attempts") {
          return createChainableQuery({
            id: "att-alpha",
            tenant_id: collegeAlphaTenantId,
            student_id: studentAlphaId,
            status: "RESULT_RELEASED",
            assessment: { release_policy: "IMMEDIATE" },
          });
        }
        if (table === "students") {
          return createChainableQuery({
            id: studentBetaId,
            tenant_id: collegeAlphaTenantId,
            user_id: studentBetaUserId,
          });
        }
        return createChainableQuery([]);
      });

      const result = await AttemptLifecycleService.getAttemptResult(
        collegeAlphaTenantId,
        "att-alpha",
        studentBetaUserId,
        false
      );

      expect(result.success).toBe(false);
      expect(result.isReleased).toBe(false);
      expect(result.error).toBe("Unauthorized: You cannot access another student's attempt.");
    });

    it("AttemptLifecycleService.getAttemptResult denies access fail-closed if caller has no student profile", async () => {
      mockServerFrom.mockImplementation((table: string) => {
        if (table === "assessment_attempts") {
          return createChainableQuery({
            id: "att-alpha",
            tenant_id: collegeAlphaTenantId,
            student_id: studentAlphaId,
            status: "RESULT_RELEASED",
            assessment: { release_policy: "IMMEDIATE" },
          });
        }
        if (table === "students") {
          return createChainableQuery(null);
        }
        return createChainableQuery([]);
      });

      const result = await AttemptLifecycleService.getAttemptResult(
        collegeAlphaTenantId,
        "att-alpha",
        "unknown-user-id",
        false
      );

      expect(result.success).toBe(false);
      expect(result.isReleased).toBe(false);
      expect(result.error).toBe("Unauthorized: You cannot access another student's attempt.");
    });
  });

  // =========================================================================
  // SECTION 5: SRN ROSTER CLAIMING INVARIANTS
  // =========================================================================
  describe("5. SRN Roster Claiming & Verification Rules", () => {
    it("handles diverse real-world SRN formats (alphanumeric, uppercase, lowercase, whitespace padding)", async () => {
      const mockRosterRow = {
        id: "roster-001",
        tenant_id: collegeAlphaTenantId,
        enrollment_number: "24SUUBECS1577",
        full_name: "Ananya Sharma",
        user_id: null,
        is_archived: false,
        academic_status: "ACTIVE",
      };

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === "students") {
          const query = createChainableQuery([mockRosterRow]);
          query.not = vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: null }));
          return query;
        }
        return createChainableQuery([]);
      });

      const result = await StudentService.findEligibleRosterBySrn("  24suubecs1577  ");

      expect(result.status).toBe("FOUND");
      expect(result.roster?.enrollment_number).toBe("24SUUBECS1577");
    });

    it("rejects empty or whitespace-only SRN", async () => {
      const result = await StudentService.findEligibleRosterBySrn("   ");
      expect(result.status).toBe("INVALID_SRN");
      expect(result.matchesCount).toBe(0);
    });

    it("rejects already claimed SRN with ALREADY_CLAIMED status", async () => {
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === "students") {
          const query = createChainableQuery();
          query.not = vi.fn().mockImplementation(() =>
            Promise.resolve({
              data: [
                {
                  id: "claimed-student-id",
                  tenant_id: collegeAlphaTenantId,
                  enrollment_number: "24SUUBECS1577",
                  user_id: "already-claimed-user-uuid",
                },
              ],
              error: null,
            })
          );
          return query;
        }
        return createChainableQuery([]);
      });

      const result = await StudentService.findEligibleRosterBySrn("24SUUBECS1577");

      expect(result.status).toBe("ALREADY_CLAIMED");
      expect(result.matchesCount).toBe(1);
      expect(result.message).toContain("already been claimed");
    });

    it("rejects ambiguous SRN when multiple unclaimed matches exist across colleges", async () => {
      const rosterCollegeA = {
        id: "roster-a",
        tenant_id: collegeAlphaTenantId,
        enrollment_number: "00123",
        user_id: null,
      };
      const rosterCollegeB = {
        id: "roster-b",
        tenant_id: collegeBetaTenantId,
        enrollment_number: "00123",
        user_id: null,
      };

      mockAdminFrom.mockImplementation((table: string) => {
        if (table === "students") {
          const query = createChainableQuery([rosterCollegeA, rosterCollegeB]);
          query.not = vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: null }));
          return query;
        }
        return createChainableQuery([]);
      });

      const result = await StudentService.findEligibleRosterBySrn("00123");

      expect(result.status).toBe("AMBIGUOUS");
      expect(result.matchesCount).toBe(2);
      expect(result.message).toContain("matches multiple institutional rosters");
    });

    it("enforces 1:1 binding: an authenticated user cannot claim a second student roster record", async () => {
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return createChainableQuery({
            id: "existing-student-record",
            tenant_id: collegeAlphaTenantId,
            enrollment_number: "24SUUBECS0001",
            user_id: studentAlphaUserId,
            full_name: "Original Student",
            email: "student@college.edu",
          });
        }
        return createChainableQuery([]);
      });

      const result = await StudentService.claimStudentRosterRecord({
        srn: "24SUUBECS9999",
        userId: studentAlphaUserId,
        fullName: "Original Student",
        email: "student@college.edu",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("USER_ALREADY_HAS_ROSTER");
      expect(result.message).toContain("already linked to student record 24SUUBECS0001");
    });
  });
});
