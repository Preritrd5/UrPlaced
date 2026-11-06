/**
 * ==============================================================================
 * UrPlaced: Assessment Assignment Status Persistence, Assigned Button State
 * & Duplicate Assignment Prevention Test Suite
 * ==============================================================================
 * Verifies:
 * 1. Initial State: Unassigned published assessment returns isAssigned: false.
 * 2. Assignment Persistence: Assigning assessment persists records in Supabase and
 *    listAssessments / getAssessmentById authoritatively return isAssigned: true,
 *    ASSIGNED status, and recipient counts.
 * 3. Page Refresh / Navigation Simulation: Subsequent queries retrieve the assigned
 *    state without loss or degradation.
 * 4. Duplicate Prevention: Idempotent assignment operations do not create duplicate
 *    recipient rows.
 * 5. Incremental Targeting: Adding a new department or batch only inserts new students.
 * 6. Availability Window States: Correctly transitions between SCHEDULED, ASSIGNED, and EXPIRED.
 * 7. Cross-Portal Delivery: Eligible student in the same college tenant receives the
 *    assignment; cross-college and unassigned students do not.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AssessmentService } from "@/modules/assessments/services/assessment-service";
import { AssignmentService } from "@/modules/assessments/services/assignment-service";

const mockServerFrom = vi.fn();
const mockAdminFrom = vi.fn();

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
  }),
}));

describe("UrPlaced: Assessment Assignment Status Persistence & Duplicate Prevention", () => {
  const tenantId = "357c432f-c54f-40f5-b634-9f92704f46fd"; // Sapthagiri NPS University
  const otherTenantId = "99999999-9999-4999-8999-999999999999";
  const userId = "11111111-1111-4111-8111-111111111111"; // Placement Head
  const assessmentId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"; // DemoTestExam
  const student1Id = "s1111111-1111-4111-8111-111111111111";
  const student2Id = "s2222222-2222-4222-8222-222222222222";
  const deptCseId = "dddddddd-dddd-4ddd-8ddd-dddddddddd01";
  const deptMechId = "dddddddd-dddd-4ddd-8ddd-dddddddddd02";

  // In-memory mock database state for testing persistence & idempotency
  let dbAssessments: any[] = [];
  let dbAssignments: any[] = [];
  let dbStudents: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();

    dbAssessments = [
      {
        id: assessmentId,
        tenant_id: tenantId,
        title: "DemoTestExam",
        description: "Placement diagnostic test",
        purpose: "PRACTICE",
        status: "PUBLISHED",
        question_set_id: "qqqqqqqq-qqqq-4qqq-8qqq-qqqqqqqqqqqq",
        time_limit_minutes: 20,
        allowed_attempts: 1,
        pass_percentage: 60.0,
        created_at: new Date().toISOString(),
      },
    ];

    dbAssignments = [];

    dbStudents = [
      {
        id: student1Id,
        tenant_id: tenantId,
        department_id: deptCseId,
        graduation_year: 2026,
        academic_status: "ACTIVE",
        is_archived: false,
        department: { name: "Computer Science and Engineering", code: "CSE" },
      },
      {
        id: student2Id,
        tenant_id: tenantId,
        department_id: deptMechId,
        graduation_year: 2026,
        academic_status: "ACTIVE",
        is_archived: false,
        department: { name: "Mechanical Engineering", code: "ME" },
      },
    ];

    // Mock query builder for Server and Admin clients
    const setupQueryMock = (table: string) => {
      let currentData: any[] = [];
      if (table === "assessments") currentData = dbAssessments;
      else if (table === "assessment_assignments") currentData = dbAssignments;
      else if (table === "students") currentData = dbStudents;
      else if (table === "question_sets") currentData = [{ id: "qqqqqqqq-qqqq-4qqq-8qqq-qqqqqqqqqqqq", name: "Set 1" }];

      const builder: any = {
        _filters: [] as any[],
        _selectStr: "*",
        select: vi.fn().mockImplementation((str) => {
          builder._selectStr = str;
          return builder;
        }),
        eq: vi.fn().mockImplementation((col, val) => {
          builder._filters.push((row: any) => {
            if (col === "assessment.status") {
              const ass = dbAssessments.find((a) => a.id === row.assessment_id);
              return ass?.status === val;
            }
            return row[col] === val;
          });
          return builder;
        }),
        in: vi.fn().mockImplementation((col, vals: any[]) => {
          builder._filters.push((row: any) => vals.includes(row[col]));
          return builder;
        }),
        or: vi.fn().mockImplementation((expr: string) => {
          builder._filters.push((row: any) => {
            if (expr.includes("is.null") && expr.includes("student_id.eq.")) {
              const match = expr.match(/student_id\.eq\.([a-zA-Z0-9-]+)/);
              const targetId = match ? match[1] : null;
              return row.student_id === targetId || row.student_id === null;
            }
            return true;
          });
          return builder;
        }),
        order: vi.fn().mockImplementation(() => builder),
        maybeSingle: vi.fn().mockImplementation(async () => {
          const filtered = currentData.filter((r) => builder._filters.every((f: any) => f(r)));
          return { data: filtered[0] || null, error: null };
        }),
        single: vi.fn().mockImplementation(async () => {
          const filtered = currentData.filter((r) => builder._filters.every((f: any) => f(r)));
          if (!filtered[0]) return { data: null, error: { message: "Row not found" } };
          return { data: filtered[0], error: null };
        }),
        insert: vi.fn().mockImplementation((rows: any | any[]) => {
          const toAdd = Array.isArray(rows) ? rows : [rows];
          const created = toAdd.map((r) => ({
            ...r,
            id: r.id || `assign-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            created_at: new Date().toISOString(),
          }));
          if (table === "assessment_assignments") {
            dbAssignments.push(...created);
          }
          return {
            select: vi.fn().mockResolvedValue({ data: created, error: null }),
            then: (resolve: any) => Promise.resolve({ data: created, error: null }).then(resolve),
          };
        }),
        update: vi.fn().mockImplementation((payload: any) => {
          const filtered = currentData.filter((r) => builder._filters.every((f: any) => f(r)));
          for (const item of filtered) {
            Object.assign(item, payload);
          }
          return {
            eq: builder.eq,
            then: (resolve: any) => Promise.resolve({ data: filtered, error: null }).then(resolve),
          };
        }),
        then: (resolve: any) => {
          let filtered = currentData.filter((r) => builder._filters.every((f: any) => f(r)));
          if (table === "assessment_assignments" && builder._selectStr.includes("assessment:assessments")) {
            filtered = filtered.map((item) => {
              const ass = dbAssessments.find((a) => a.id === item.assessment_id);
              return {
                ...item,
                assessment: ass || null,
              };
            });
          }
          return Promise.resolve({ data: filtered, error: null }).then(resolve);
        },
      };
      return builder;
    };

    mockServerFrom.mockImplementation(setupQueryMock);
    mockAdminFrom.mockImplementation(setupQueryMock);
  });

  it("1. Unassigned published assessment initial state returns isAssigned: false and NOT_ASSIGNED", async () => {
    const res = await AssessmentService.listAssessments(tenantId);
    expect(res.success).toBe(true);
    expect(res.assessments.length).toBe(1);

    const exam = res.assessments[0];
    expect(exam.id).toBe(assessmentId);
    expect(exam.title).toBe("DemoTestExam");
    expect(exam.isAssigned).toBe(false);
    expect(exam.is_assigned).toBe(false);
    expect(exam.assignmentStatus).toBe("NOT_ASSIGNED");
    expect(exam.assignedRecipientsCount).toBe(0);
  });

  it("2. Assigning assessment persists records in Supabase and listAssessments returns isAssigned: true and ASSIGNED", async () => {
    // Perform Assignment Operation (College-Wide)
    const assignResult = await AssignmentService.assignAssessment(tenantId, userId, {
      assessment_id: assessmentId,
      target_type: "COLLEGE_WIDE",
      cohort_name: "All Eligible Students",
    });

    expect(assignResult.success).toBe(true);
    expect(assignResult.createdCount).toBeGreaterThan(0);
    expect(assignResult.recipientCount).toBe(2); // 2 active students in college

    // Verify persisted database records
    expect(dbAssignments.length).toBe(3); // 2 students + 1 parent cohort header

    // Fetch assessments as Placement Head (College Portal listing)
    const listRes = await AssessmentService.listAssessments(tenantId);
    expect(listRes.success).toBe(true);
    const exam = listRes.assessments[0];

    expect(exam.isAssigned).toBe(true);
    expect(exam.is_assigned).toBe(true);
    expect(exam.assignmentStatus).toBe("ASSIGNED");
    expect(exam.assignedCohortName).toBe("All Eligible Students");
    expect(exam.assignedRecipientsCount).toBe(2);
  });

  it("3. Survives page reload, navigation, and re-login (authoritative database persistence)", async () => {
    // 1. Assign assessment
    await AssignmentService.assignAssessment(tenantId, userId, {
      assessment_id: assessmentId,
      target_type: "COLLEGE_WIDE",
      cohort_name: "All Eligible Students",
    });

    // 2. Simulate page reload 1: listAssessments
    const reload1 = await AssessmentService.listAssessments(tenantId);
    expect(reload1.assessments[0].isAssigned).toBe(true);
    expect(reload1.assessments[0].assignmentStatus).toBe("ASSIGNED");

    // 3. Simulate navigation to another page and back: getAssessmentById
    const singleAss = await AssessmentService.getAssessmentById(tenantId, assessmentId);
    expect(singleAss.success).toBe(true);
    expect(singleAss.assessment.isAssigned).toBe(true);
    expect(singleAss.assessment.assignmentStatus).toBe("ASSIGNED");
    expect(singleAss.assessment.assignedRecipientsCount).toBe(2);

    // 4. Simulate page reload 2
    const reload2 = await AssessmentService.listAssessments(tenantId);
    expect(reload2.assessments[0].isAssigned).toBe(true);
    expect(reload2.assessments[0].is_assigned).toBe(true);
  });

  it("4. Prevents duplicate assignments on repeated submission (Idempotency)", async () => {
    // First assignment
    const firstCall = await AssignmentService.assignAssessment(tenantId, userId, {
      assessment_id: assessmentId,
      target_type: "COLLEGE_WIDE",
      cohort_name: "All Eligible Students",
    });
    expect(firstCall.createdCount).toBe(3); // 2 students + 1 header
    const initialAssignmentCount = dbAssignments.length;

    // Second assignment (identical input, simulating double click or re-assignment)
    const secondCall = await AssignmentService.assignAssessment(tenantId, userId, {
      assessment_id: assessmentId,
      target_type: "COLLEGE_WIDE",
      cohort_name: "All Eligible Students",
    });

    expect(secondCall.success).toBe(true);
    expect(secondCall.createdCount).toBe(0); // 0 new rows created! No duplicates!
    expect(dbAssignments.length).toBe(initialAssignmentCount); // Total rows unchanged
  });

  it("5. Incremental targeting adds newly targeted students without duplicating existing records", async () => {
    // Step 1: Assign initially only to Department CSE (student1)
    const assignDept = await AssignmentService.assignAssessment(tenantId, userId, {
      assessment_id: assessmentId,
      target_type: "DEPARTMENT",
      department_ids: [deptCseId],
      cohort_name: "Dept: CSE",
    });

    expect(assignDept.success).toBe(true);
    expect(dbAssignments.filter((a) => a.student_id !== null).length).toBe(1);
    expect(dbAssignments.some((a) => a.student_id === student1Id)).toBe(true);
    expect(dbAssignments.some((a) => a.student_id === student2Id)).toBe(false);

    // Step 2: Placement Head manages assignment to add Department ME (student2)
    const manageAssign = await AssignmentService.assignAssessment(tenantId, userId, {
      assessment_id: assessmentId,
      target_type: "DEPARTMENT",
      department_ids: [deptCseId, deptMechId],
      cohort_name: "Dept: CSE, ME",
    });

    expect(manageAssign.success).toBe(true);
    expect(manageAssign.createdCount).toBe(1); // Only student 2 created!
    // Total assigned students should now be exactly 2, without duplicating student 1
    const student1Rows = dbAssignments.filter((a) => a.student_id === student1Id);
    const student2Rows = dbAssignments.filter((a) => a.student_id === student2Id);
    expect(student1Rows.length).toBe(1);
    expect(student2Rows.length).toBe(1);
  });

  it("6. Correctly reflects SCHEDULED and EXPIRED availability window statuses", async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday

    // Case A: Future scheduled window
    await AssignmentService.assignAssessment(tenantId, userId, {
      assessment_id: assessmentId,
      target_type: "COLLEGE_WIDE",
      window_start: futureDate,
    });

    let res = await AssessmentService.listAssessments(tenantId);
    expect(res.assessments[0].isAssigned).toBe(true);
    expect(res.assessments[0].assignmentStatus).toBe("SCHEDULED");

    // Case B: Expired window
    await AssignmentService.assignAssessment(tenantId, userId, {
      assessment_id: assessmentId,
      target_type: "COLLEGE_WIDE",
      window_start: new Date(Date.now() - 172800000).toISOString(),
      window_end: pastDate,
    });

    res = await AssessmentService.listAssessments(tenantId);
    expect(res.assessments[0].isAssigned).toBe(true);
    expect(res.assessments[0].assignmentStatus).toBe("EXPIRED");
  });

  it("7. Cross-Portal Delivery: Assigned assessment is delivered to student in same college, isolated from other colleges", async () => {
    // 1. Assign assessment in Sapthagiri NPS University
    await AssignmentService.assignAssessment(tenantId, userId, {
      assessment_id: assessmentId,
      target_type: "COLLEGE_WIDE",
      cohort_name: "All Eligible Students",
    });

    // 2. Student in Sapthagiri queries their assigned assessments
    const student1Feed = await AssignmentService.listAssignmentsForStudent(tenantId, student1Id);
    expect(student1Feed.success).toBe(true);
    expect(student1Feed.assignments.length).toBe(1);
    expect(student1Feed.assignments[0].title).toBe("DemoTestExam");
    expect(student1Feed.assignments[0].canAttempt).toBe(true);

    // 3. Student from another college tenant queries: must receive 0 assignments (strict tenant isolation)
    const crossTenantFeed = await AssignmentService.listAssignmentsForStudent(otherTenantId, student1Id);
    expect(crossTenantFeed.success).toBe(true);
    expect(crossTenantFeed.assignments.length).toBe(0);
  });
});
