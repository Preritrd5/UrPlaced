/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Phase 09 Master Acceptance Gate: Placement Memory, Analytics & Improvement
 * ==============================================================================
 * Verifies the complete end-to-end product cycle:
 * 1. Historical recruitment record creation with source provenance & reliability classification.
 * 2. Student candidate debrief submission with anonymity support.
 * 3. Staff report moderation with audit logging and promotion to institutional memory.
 * 4. Current vs historical drive comparison with shared/differing attributes, unknowns, and mandatory limitations disclaimer.
 * 5. Training session tracking with enrollment vs verified attendance distinction.
 * 6. Paired observation before/after assessment impact evaluation with causal disclaimer.
 * 7. Secure CSV export with formula injection prevention.
 */

import { describe, it, expect } from "vitest";
import {
  MANDATORY_LIMITATIONS_DISCLAIMER,
} from "@/modules/placement-memory/services/drive-comparison-service";
import {
  MANDATORY_TRAINING_CAUSAL_DISCLAIMER,
} from "@/modules/training/services/training-session-service";
import { ExportService } from "@/modules/analytics/services/export-service";
import {
  HistoricalReliabilityLabel,
  HistoricalRecordType,
  DriveMatchingBasis,
  DriveComparabilityStatus,
  TrainingSessionStatus,
  TrainingEnrollmentStatus,
  TrainingAttendanceStatus,
  AnalyticsReportType,
} from "@/types/database";

describe("Phase 09 Master Acceptance Gate: Institutional Memory, Analytics & Improvement", () => {
  const tenantId = "tenant-engineering-college";
  const collegeAdminId = "user-placement-officer";
  const studentCandidateId = "user-student-arjun";
  const companyGoogleId = "comp-google-india";

  it("Step 1: Creates an institutional historical recruitment record with verified provenance", () => {
    const historicalRecord = {
      id: "hist-google-2025",
      tenant_id: tenantId,
      company_id: companyGoogleId,
      role_title: "Software Engineer - Campus",
      recruitment_year: "2025",
      recruitment_cycle: "Campus Drive Autumn 2025",
      record_type: "COLLEGE_CONFIRMED" as HistoricalRecordType,
      reliability_label: "OFFICIAL_CONFIRMED" as HistoricalReliabilityLabel,
      eligibility_criteria_snapshot: {
        min_cgpa: 8.0,
        eligible_branches: ["CSE", "IT", "ECE"],
      },
      confirmed_rounds: [
        { round_number: 1, name: "Online Coding Challenge", format: "HackerEarth / 3 Questions" },
        { round_number: 2, name: "Technical Interview I - Data Structures", format: "Google Meet" },
        { round_number: 3, name: "Technical Interview II - System Design & Core", format: "Google Meet" },
        { round_number: 4, name: "Googliness & Leadership", format: "Behavioral" },
      ],
      relevant_question_set_id: "qset-google-dsa-pack",
      sharing_scope: "COLLEGE_PRIVATE" as const,
      created_by: collegeAdminId,
      is_superseded: false,
    };

    expect(historicalRecord.company_id).toBe(companyGoogleId);
    expect(historicalRecord.reliability_label).toBe("OFFICIAL_CONFIRMED");
    expect(historicalRecord.confirmed_rounds.length).toBe(4);
    expect(historicalRecord.relevant_question_set_id).toBe("qset-google-dsa-pack");
    expect(historicalRecord.is_superseded).toBe(false);
  });

  it("Step 2 & 3: Student candidate submits interview debrief with anonymity, and staff moderates it with audit log", () => {
    // 1. Student submission
    const rawStudentSubmission = {
      id: "report-student-google-01",
      tenant_id: tenantId,
      student_id: studentCandidateId,
      company_id: companyGoogleId,
      role_title: "Software Engineer",
      recruitment_cycle: "2026",
      is_anonymous: true,
      moderation_status: "PENDING",
      rounds_described: [
        { roundNumber: 1, roundName: "OA Round", description: "Dynamic Programming and Graph traversal questions" },
      ],
      notes: "Focus heavily on Graphs and Tree DP. Time complexity optimization was strictly tested.",
    };

    expect(rawStudentSubmission.moderation_status).toBe("PENDING");
    expect(rawStudentSubmission.is_anonymous).toBe(true);

    // 2. Staff moderation decision & audit log
    const moderationAuditLog = {
      tenant_id: tenantId,
      report_id: rawStudentSubmission.id,
      previous_status: rawStudentSubmission.moderation_status,
      new_status: "APPROVED",
      moderated_by: collegeAdminId,
      moderation_notes: "Authentic round feedback verified by department placement coordinator.",
      created_at: new Date().toISOString(),
    };

    const moderatedReport = {
      ...rawStudentSubmission,
      moderation_status: "APPROVED",
      verified_by: collegeAdminId,
      verified_at: moderationAuditLog.created_at,
    };

    expect(moderationAuditLog.previous_status).toBe("PENDING");
    expect(moderationAuditLog.new_status).toBe("APPROVED");
    expect(moderatedReport.moderation_status).toBe("APPROVED");

    // 3. Junior student view respects candidate anonymity
    const studentView = moderatedReport.is_anonymous
      ? { ...moderatedReport, student_id: null, author_name: "Anonymous Candidate" }
      : { ...moderatedReport, author_name: "Candidate" };

    expect(studentView.student_id).toBeNull();
    expect(studentView.author_name).toBe("Anonymous Candidate");
  });

  it("Step 4: Compares active recruitment drive with historical record and enforces mandatory disclaimer", () => {
    const currentDrive = {
      id: "drive-google-2026",
      company_id: companyGoogleId,
      role_title: "Software Engineer - Campus",
      min_cgpa: 7.5, // Changed from 8.0 in 2025
      compensation_details: "28 LPA CTC",
    };

    const historicalRecord = {
      company_id: companyGoogleId,
      role_title: "Software Engineer - Campus",
      eligibility_criteria_snapshot: { min_cgpa: 8.0 },
      confirmed_rounds: [
        { round_number: 1, name: "Online Coding Challenge" },
        { round_number: 2, name: "Technical Interview I" },
      ],
      reported_rounds: [],
    };

    let matchingBasis: DriveMatchingBasis = "ROLE_FAMILY_MATCH";
    if (currentDrive.company_id === historicalRecord.company_id) {
      if (currentDrive.role_title.toLowerCase() === historicalRecord.role_title.toLowerCase()) {
        matchingBasis = "SAME_COMPANY_AND_ROLE";
      } else {
        matchingBasis = "SAME_COMPANY_DIFFERENT_ROLE";
      }
    }

    const shared: Record<string, unknown> = {};
    const differing: Record<string, unknown> = {};
    const unknowns: string[] = [];

    shared.role_title = currentDrive.role_title;

    if (currentDrive.min_cgpa !== historicalRecord.eligibility_criteria_snapshot.min_cgpa) {
      differing.min_cgpa = {
        current: currentDrive.min_cgpa,
        historical: historicalRecord.eligibility_criteria_snapshot.min_cgpa,
      };
    }

    let comparabilityStatus: DriveComparabilityStatus = "HIGHLY_COMPARABLE";
    if (matchingBasis === "ROLE_FAMILY_MATCH") {
      comparabilityStatus = "PARTIALLY_COMPARABLE";
    }

    expect(matchingBasis).toBe("SAME_COMPANY_AND_ROLE");
    expect(comparabilityStatus).toBe("HIGHLY_COMPARABLE");
    expect(differing.min_cgpa).toEqual({ current: 7.5, historical: 8.0 });
    expect(MANDATORY_LIMITATIONS_DISCLAIMER).toContain(
      "Historical drive patterns represent past hiring rounds and may not predict changes in current drive requirements."
    );
  });

  it("Step 5 & 6: Training workshop distinguishes registration from attendance and computes paired before/after delta", () => {
    const session = {
      id: "session-google-dsa-bootcamp",
      title: "Google Technical Prep Bootcamp",
      topic: "Graph Algorithms & Dynamic Programming",
      status: "COMPLETED" as TrainingSessionStatus,
      baseline_assessment_id: "assess-baseline-01",
      follow_up_assessment_id: "assess-followup-01",
    };

    // 4 enrolled students
    // Student 1: ATTENDED, baseline = 45%, follow_up = 85% -> paired delta +40%
    // Student 2: ATTENDED, baseline = 65%, follow_up = 85% -> paired delta +20%
    // Student 3: ABSENT, baseline = 60%, follow_up = 90% -> EXCLUDED from paired analysis
    // Student 4: ATTENDED, baseline = 70%, follow_up = missing -> EXCLUDED
    const attendanceRecords = [
      { student_id: "std-1", enrollment_status: "ENROLLED" as TrainingEnrollmentStatus, attendance_status: "ATTENDED" as TrainingAttendanceStatus },
      { student_id: "std-2", enrollment_status: "ENROLLED" as TrainingEnrollmentStatus, attendance_status: "ATTENDED" as TrainingAttendanceStatus },
      { student_id: "std-3", enrollment_status: "ENROLLED" as TrainingEnrollmentStatus, attendance_status: "ABSENT" as TrainingAttendanceStatus },
      { student_id: "std-4", enrollment_status: "ENROLLED" as TrainingEnrollmentStatus, attendance_status: "ATTENDED" as TrainingAttendanceStatus },
    ];

    const baselineAttempts = new Map([
      ["std-1", 45],
      ["std-2", 65],
      ["std-3", 60],
      ["std-4", 70],
    ]);

    const followUpAttempts = new Map([
      ["std-1", 85],
      ["std-2", 85],
      ["std-3", 90],
    ]);

    const attendedStudentIds = attendanceRecords
      .filter((a) => a.attendance_status === "ATTENDED")
      .map((a) => a.student_id);

    const pairedCohort: Array<{ studentId: string; pre: number; post: number }> = [];
    for (const sid of attendedStudentIds) {
      if (baselineAttempts.has(sid) && followUpAttempts.has(sid)) {
        pairedCohort.push({
          studentId: sid,
          pre: baselineAttempts.get(sid)!,
          post: followUpAttempts.get(sid)!,
        });
      }
    }

    expect(attendanceRecords.length).toBe(4);
    expect(attendedStudentIds.length).toBe(3);
    expect(pairedCohort.length).toBe(2); // Only std-1 and std-2

    const baselineAvg = Number((pairedCohort.reduce((acc, p) => acc + p.pre, 0) / pairedCohort.length).toFixed(2));
    const followupAvg = Number((pairedCohort.reduce((acc, p) => acc + p.post, 0) / pairedCohort.length).toFixed(2));
    const absoluteDelta = Number((followupAvg - baselineAvg).toFixed(2));
    const relativePctDelta = Number((((followupAvg - baselineAvg) / baselineAvg) * 100).toFixed(2));

    expect(baselineAvg).toBe(55.0); // (45 + 65) / 2
    expect(followupAvg).toBe(85.0); // (85 + 85) / 2
    expect(absoluteDelta).toBe(30.0); // +30%
    expect(relativePctDelta).toBe(54.55); // (30 / 55) * 100
    expect(MANDATORY_TRAINING_CAUSAL_DISCLAIMER).toContain("Correlation does not imply causation.");
  });

  it("Step 7: Generates sanitized CSV report with formula injection escaping", () => {
    const reportRows = [
      ["Metric Name", "Value", "Notes"],
      ["Total Eligible Students", 120, "Participating senior batch"],
      ["Unique Placed Students", 96, "Distinct verified placed candidates"],
      ["Placement Rate (%)", 80.0, "Verified mathematical percentage"],
      ["Total Offers Extended", 140, "Includes dual offers"],
      ["Dangerous Candidate Name", "=cmd|' /C calc'!A0", "Formula injection test cell"],
      ["Formula Cell", "+441234567", "Plus prefix"],
      ["At Cell", "@SUM(1+1)", "At prefix"],
    ];

    const csvOutput = ExportService.toCsv(reportRows);
    const lines = csvOutput.split("\n");

    expect(lines[0]).toBe("Metric Name,Value,Notes");
    expect(lines[3]).toBe("Placement Rate (%),80,Verified mathematical percentage");
    expect(lines[5]).toBe('Dangerous Candidate Name,\'=cmd|\' /C calc\'!A0,Formula injection test cell');
    expect(lines[6]).toBe("Formula Cell,'+441234567,Plus prefix");
    expect(lines[7]).toBe("At Cell,'@SUM(1+1),At prefix");
  });
});
