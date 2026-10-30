import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Student Composite Foreign Key Lifecycle & Role Consistency Enforcement", () => {
  interface StudentRecord {
    id: string;
    tenant_id: string;
    user_id: string | null;
    enrollment_number: string;
    full_name: string;
    email: string;
    cgpa: number;
    department_id: string;
    graduation_year: number;
    claimed_at: string | null;
    is_archived: boolean;
  }

  interface TenantMembership {
    id: string;
    tenant_id: string;
    user_id: string;
    role: "STUDENT" | "PLACEMENT_HEAD" | "PLACEMENT_STAFF" | "TRAINER";
    status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  }

  // Simulated in-memory database engine mimicking PostgreSQL 15+ constraints, triggers, and foreign keys
  const db = {
    students: [] as StudentRecord[],
    tenant_memberships: [] as TenantMembership[],

    // Enforces PostgreSQL 15+ composite FK: (tenant_id, user_id) REFERENCES tenant_memberships(tenant_id, user_id)
    // with ON DELETE SET NULL (user_id)
    verifyForeignKeyConstraint(student: StudentRecord) {
      if (student.user_id !== null) {
        const matchingMembership = db.tenant_memberships.find(
          (m) => m.tenant_id === student.tenant_id && m.user_id === student.user_id
        );
        if (!matchingMembership) {
          throw new Error(
            `Key (tenant_id, user_id)=(${student.tenant_id}, ${student.user_id}) is not present in table "tenant_memberships".`
          );
        }
      }
    },

    // Enforces trg_student_tenant_consistency & trg_membership_tenant_consistency:
    // 1. Same college boundary check
    // 2. Strict role consistency: student records can ONLY be linked to role = 'STUDENT'
    verifyRoleAndTenantConsistency(
      target: "students" | "tenant_memberships",
      record: StudentRecord | TenantMembership
    ) {
      if (target === "students") {
        const student = record as StudentRecord;
        if (student.user_id !== null) {
          const membership = db.tenant_memberships.find((m) => m.user_id === student.user_id);
          if (membership) {
            if (membership.tenant_id !== student.tenant_id) {
              throw new Error(
                `Cross-college student ownership violation: student record college (${student.tenant_id}) does not match membership college (${membership.tenant_id}) for user ${student.user_id}`
              );
            }
            if (membership.role !== "STUDENT") {
              throw new Error(
                `Student role violation: Account with role ${membership.role} cannot be linked to a student roster record (user ${student.user_id})`
              );
            }
          }
        }
      }

      if (target === "tenant_memberships") {
        const membership = record as TenantMembership;
        const student = db.students.find((s) => s.user_id === membership.user_id);
        if (student) {
          if (student.tenant_id !== membership.tenant_id) {
            throw new Error(
              `Cross-college student ownership violation: membership college (${membership.tenant_id}) does not match student record college (${student.tenant_id}) for user ${membership.user_id}`
            );
          }
          if (membership.role !== "STUDENT") {
            throw new Error(
              `Student role violation: Membership with role ${membership.role} cannot be assigned to an account linked to student roster record ${student.enrollment_number} (user ${membership.user_id})`
            );
          }
        }
      }
    },

    // Enforces global unique constraint on user_id in tenant_memberships
    insertMembership(membership: TenantMembership) {
      const existing = db.tenant_memberships.find((m) => m.user_id === membership.user_id);
      if (existing) {
        throw new Error(
          `duplicate key value violates unique constraint "uq_tenant_memberships_user_id"`
        );
      }
      db.verifyRoleAndTenantConsistency("tenant_memberships", membership);
      db.tenant_memberships.push({ ...membership });
    },

    updateMembership(membershipId: string, updates: Partial<TenantMembership>) {
      const mem = db.tenant_memberships.find((m) => m.id === membershipId);
      if (!mem) throw new Error("Membership not found");
      const updated = { ...mem, ...updates };
      db.verifyRoleAndTenantConsistency("tenant_memberships", updated);
      Object.assign(mem, updates);
    },

    // Simulated PostgreSQL 15+ ON DELETE SET NULL (user_id) action
    // alongside trg_student_membership_deletion
    deleteMembership(userId: string, tenantId: string) {
      const index = db.tenant_memberships.findIndex(
        (m) => m.user_id === userId && m.tenant_id === tenantId
      );
      if (index === -1) return false;

      // PostgreSQL 15+ ON DELETE SET NULL (user_id) executes:
      // It sets ONLY user_id to NULL on referencing rows in students, while preserving tenant_id.
      db.students.forEach((s) => {
        if (s.user_id === userId && s.tenant_id === tenantId) {
          s.user_id = null;
          s.claimed_at = null;
        }
      });

      db.tenant_memberships.splice(index, 1);
      return true;
    },

    insertStudent(student: StudentRecord) {
      db.verifyRoleAndTenantConsistency("students", student);
      db.verifyForeignKeyConstraint(student);
      db.students.push({ ...student });
    },

    claimStudent(studentId: string, userId: string, collegeId: string) {
      const student = db.students.find((s) => s.id === studentId);
      if (!student) throw new Error("Student not found");
      if (student.tenant_id !== collegeId) {
        throw new Error("College mismatch during student claim");
      }

      student.user_id = userId;
      student.claimed_at = new Date().toISOString();

      db.verifyRoleAndTenantConsistency("students", student);
      db.verifyForeignKeyConstraint(student);
    },
  };

  beforeEach(() => {
    db.students = [];
    db.tenant_memberships = [];
  });

  describe("1. Complete Student Lifecycle: Claim, Verification, Auth Deletion & Preservation", () => {
    it("completes the 7-step student lifecycle preserving college ownership and setting only user_id to NULL", () => {
      const collegeSapthagiri = "tenant-sapthagiri-001";
      const studentUser = "auth-user-student-789";

      // Step 1: Create a college-owned student roster record (unclaimed)
      const rosterRecord: StudentRecord = {
        id: "student-roster-101",
        tenant_id: collegeSapthagiri,
        user_id: null,
        enrollment_number: "1SG22CS045",
        full_name: "Rahul Sharma",
        email: "rahul.sharma@sapthagiri.edu",
        cgpa: 9.15,
        department_id: "dept-cse-01",
        graduation_year: 2026,
        claimed_at: null,
        is_archived: false,
      };
      db.insertStudent(rosterRecord);

      expect(db.students).toHaveLength(1);
      expect(db.students[0].user_id).toBeNull();
      expect(db.students[0].tenant_id).toBe(collegeSapthagiri);

      // Step 2: Student registers and claims their roster record
      db.insertMembership({
        id: "mem-student-01",
        tenant_id: collegeSapthagiri,
        user_id: studentUser,
        role: "STUDENT",
        status: "ACTIVE",
      });

      db.claimStudent("student-roster-101", studentUser, collegeSapthagiri);

      // Step 3: Confirm its tenant and user references match
      const claimedStudent = db.students.find((s) => s.id === "student-roster-101")!;
      const membership = db.tenant_memberships.find((m) => m.user_id === studentUser)!;

      expect(claimedStudent.user_id).toBe(studentUser);
      expect(claimedStudent.tenant_id).toBe(collegeSapthagiri);
      expect(claimedStudent.tenant_id).toBe(membership.tenant_id);
      expect(claimedStudent.user_id).toBe(membership.user_id);
      expect(membership.role).toBe("STUDENT");

      // Step 4: Delete the test student's Auth identity and tenant membership
      const deleted = db.deleteMembership(studentUser, collegeSapthagiri);
      expect(deleted).toBe(true);
      expect(db.tenant_memberships).toHaveLength(0);

      // Step 5: Confirm the student roster record remains in the database
      expect(db.students).toHaveLength(1);
      const preservedRoster = db.students[0];
      expect(preservedRoster.id).toBe("student-roster-101");

      // Step 6: Confirm its original tenant_id is 100% unchanged
      expect(preservedRoster.tenant_id).toBe(collegeSapthagiri);

      // Step 7: Confirm only user_id became NULL (and claimed_at was cleared)
      expect(preservedRoster.user_id).toBeNull();
      expect(preservedRoster.claimed_at).toBeNull();

      // Confirm all academic history and roster attributes are preserved intact
      expect(preservedRoster.enrollment_number).toBe("1SG22CS045");
      expect(preservedRoster.full_name).toBe("Rahul Sharma");
      expect(preservedRoster.email).toBe("rahul.sharma@sapthagiri.edu");
      expect(preservedRoster.cgpa).toBe(9.15);
      expect(preservedRoster.graduation_year).toBe(2026);
    });
  });

  describe("2. Student Role Consistency Enforcement", () => {
    const collegeId = "tenant-sapthagiri-001";
    const staffUser = "auth-user-pop-placement-staff";
    const headUser = "auth-user-jack-placement-head";
    const trainerUser = "auth-user-alice-trainer";

    it("strictly forbids linking a PLACEMENT_HEAD membership to a student roster record", () => {
      db.insertMembership({
        id: "mem-head-01",
        tenant_id: collegeId,
        user_id: headUser,
        role: "PLACEMENT_HEAD",
        status: "ACTIVE",
      });

      db.insertStudent({
        id: "student-roster-201",
        tenant_id: collegeId,
        user_id: null,
        enrollment_number: "1SG22CS001",
        full_name: "Jack Administrator",
        email: "jack@sapthagiri.edu",
        cgpa: 8.5,
        department_id: "dept-cse-01",
        graduation_year: 2026,
        claimed_at: null,
        is_archived: false,
      });

      expect(() => {
        db.claimStudent("student-roster-201", headUser, collegeId);
      }).toThrow(/Student role violation: Account with role PLACEMENT_HEAD cannot be linked to a student roster record/);
    });

    it("strictly forbids linking a PLACEMENT_STAFF membership to a student roster record", () => {
      db.insertMembership({
        id: "mem-staff-01",
        tenant_id: collegeId,
        user_id: staffUser,
        role: "PLACEMENT_STAFF",
        status: "ACTIVE",
      });

      db.insertStudent({
        id: "student-roster-202",
        tenant_id: collegeId,
        user_id: null,
        enrollment_number: "1SG22CS002",
        full_name: "Pop Staff",
        email: "pop@sapthagiri.edu",
        cgpa: 8.0,
        department_id: "dept-cse-01",
        graduation_year: 2026,
        claimed_at: null,
        is_archived: false,
      });

      expect(() => {
        db.claimStudent("student-roster-202", staffUser, collegeId);
      }).toThrow(/Student role violation: Account with role PLACEMENT_STAFF cannot be linked to a student roster record/);
    });

    it("strictly forbids linking a TRAINER membership to a student roster record", () => {
      db.insertMembership({
        id: "mem-trainer-01",
        tenant_id: collegeId,
        user_id: trainerUser,
        role: "TRAINER",
        status: "ACTIVE",
      });

      db.insertStudent({
        id: "student-roster-203",
        tenant_id: collegeId,
        user_id: null,
        enrollment_number: "1SG22CS003",
        full_name: "Alice Trainer",
        email: "alice@sapthagiri.edu",
        cgpa: 8.2,
        department_id: "dept-cse-01",
        graduation_year: 2026,
        claimed_at: null,
        is_archived: false,
      });

      expect(() => {
        db.claimStudent("student-roster-203", trainerUser, collegeId);
      }).toThrow(/Student role violation: Account with role TRAINER cannot be linked to a student roster record/);
    });

    it("strictly blocks updating a claimed student account's membership role to PLACEMENT_HEAD or STAFF", () => {
      const studentUser = "auth-student-legit";

      db.insertMembership({
        id: "mem-student-legit",
        tenant_id: collegeId,
        user_id: studentUser,
        role: "STUDENT",
        status: "ACTIVE",
      });

      db.insertStudent({
        id: "student-roster-204",
        tenant_id: collegeId,
        user_id: studentUser,
        enrollment_number: "1SG22CS004",
        full_name: "Legit Student",
        email: "legit@sapthagiri.edu",
        cgpa: 9.0,
        department_id: "dept-cse-01",
        graduation_year: 2026,
        claimed_at: new Date().toISOString(),
        is_archived: false,
      });

      // Attempting to assign PLACEMENT_STAFF role to this account must trigger database exception
      expect(() => {
        db.updateMembership("mem-student-legit", { role: "PLACEMENT_STAFF" });
      }).toThrow(/Student role violation: Membership with role PLACEMENT_STAFF cannot be assigned to an account linked to student roster record/);
    });
  });

  describe("3. Cross-College Student Ownership & Foreign Key Rejection", () => {
    it("rejects linking a student record in College A to a membership in College B", () => {
      const collegeA = "tenant-sapthagiri-001";
      const collegeB = "tenant-abc-college-002";
      const userCollegeB = "auth-user-abc-student";

      db.insertMembership({
        id: "mem-abc-student",
        tenant_id: collegeB,
        user_id: userCollegeB,
        role: "STUDENT",
        status: "ACTIVE",
      });

      db.insertStudent({
        id: "student-roster-sapthagiri",
        tenant_id: collegeA,
        user_id: null,
        enrollment_number: "1SG22CS099",
        full_name: "Innocent Sapthagiri Student",
        email: "student@sapthagiri.edu",
        cgpa: 8.9,
        department_id: "dept-cse-01",
        graduation_year: 2026,
        claimed_at: null,
        is_archived: false,
      });

      // Attempt to link College B's user to College A's student record
      expect(() => {
        db.claimStudent("student-roster-sapthagiri", userCollegeB, collegeA);
      }).toThrow(/Cross-college student ownership violation: student record college \(tenant-sapthagiri-001\) does not match membership college \(tenant-abc-college-002\)/);
    });

    it("enforces global single-college ownership: rejects assigning a student to a second college", () => {
      const collegeA = "tenant-sapthagiri-001";
      const collegeB = "tenant-abc-college-002";
      const user = "auth-user-student-global-unique";

      db.insertMembership({
        id: "mem-college-a",
        tenant_id: collegeA,
        user_id: user,
        role: "STUDENT",
        status: "ACTIVE",
      });

      // Attempting to create a second membership in College B violates uq_tenant_memberships_user_id
      expect(() => {
        db.insertMembership({
          id: "mem-college-b",
          tenant_id: collegeB,
          user_id: user,
          role: "STUDENT",
          status: "ACTIVE",
        });
      }).toThrow(/duplicate key value violates unique constraint "uq_tenant_memberships_user_id"/);
    });
  });
});
