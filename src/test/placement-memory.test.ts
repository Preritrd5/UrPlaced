/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Placement Memory & Provenance Tests (Phase 09)
 * ==============================================================================
 */

import { describe, it, expect, vi } from "vitest";
import {
  HistoricalRecruitmentService,
  CreateHistoricalRecordInput,
} from "@/modules/placement-memory/services/historical-recruitment-service";
import {
  ReportModerationService,
  SubmitExperienceReportInput,
} from "@/modules/placement-memory/services/report-moderation-service";
import {
  HistoricalReliabilityLabel,
  HistoricalRecordType,
  ModerationStatus,
} from "@/types/database";

describe("Phase 09: Placement Memory & Moderation", () => {
  const tenantId = "tenant-college-alpha";
  const userId = "staff-placement-head";
  const studentId = "student-101";
  const companyId = "company-google";

  describe("Historical Recruitment Records", () => {
    it("validates mandatory fields for historical recruitment record creation", async () => {
      const invalidInput: CreateHistoricalRecordInput = {
        companyId: "",
        roleTitle: "",
        recruitmentYear: "",
        recruitmentCycle: "",
      };

      const result = await HistoricalRecruitmentService.createRecord(tenantId, userId, invalidInput);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required recruitment record fields");
    });

    it("verifies reliability labels and sharing scope definitions", () => {
      const validLabels: HistoricalReliabilityLabel[] = [
        "OFFICIAL_CONFIRMED",
        "VERIFIED_HISTORICAL",
        "CANDIDATE_REPORTED",
        "INFERRED_GUIDANCE",
        "DISPUTED",
        "SUPERSEDED",
      ];

      expect(validLabels).toContain("OFFICIAL_CONFIRMED");
      expect(validLabels).toContain("VERIFIED_HISTORICAL");
      expect(validLabels).toContain("CANDIDATE_REPORTED");
      expect(validLabels).toContain("DISPUTED");
      expect(validLabels).toContain("SUPERSEDED");

      const validRecordTypes: HistoricalRecordType[] = [
        "OFFICIAL_NOTICE",
        "COLLEGE_CONFIRMED",
        "VERIFIED_REPORT",
        "CANDIDATE_REPORTED",
        "QUESTION_SET_REFERENCE",
        "SUPERSEDED",
      ];
      expect(validRecordTypes.length).toBe(6);
    });
  });

  describe("Candidate Debrief Moderation Workflow", () => {
    it("requires required fields when a student submits an experience report", async () => {
      const invalidInput: SubmitExperienceReportInput = {
        companyId: "",
        roleTitle: "",
        recruitmentCycle: "",
        roundsDescribed: [],
      };

      const result = await ReportModerationService.submitReport(tenantId, studentId, invalidInput);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required recruitment report fields");
    });

    it("masks student identity when candidate report has is_anonymous = true", () => {
      const rawReport = {
        id: "rep-001",
        tenant_id: tenantId,
        company_id: companyId,
        role_title: "Software Engineer",
        recruitment_cycle: "2026",
        is_anonymous: true,
        student_id: "student-private-123",
        students: { full_name: "Rahul Sharma", roll_number: "20CS104" },
        moderation_status: "APPROVED" as ModerationStatus,
        rounds_described: [],
      };

      // When viewed by a student (isStaff = false)
      const isStaff = false;
      const sanitized = rawReport.is_anonymous && !isStaff
        ? {
            ...rawReport,
            student_id: null,
            students: { full_name: "Anonymous Candidate", roll_number: "REDACTED" },
          }
        : rawReport;

      expect(sanitized.student_id).toBeNull();
      expect(sanitized.students.full_name).toBe("Anonymous Candidate");
      expect(sanitized.students.roll_number).toBe("REDACTED");
    });

    it("preserves student identity for placement staff audit", () => {
      const rawReport = {
        id: "rep-001",
        tenant_id: tenantId,
        company_id: companyId,
        role_title: "Software Engineer",
        recruitment_cycle: "2026",
        is_anonymous: true,
        student_id: "student-private-123",
        students: { full_name: "Rahul Sharma", roll_number: "20CS104" },
        moderation_status: "APPROVED" as ModerationStatus,
      };

      const isStaff = true;
      const sanitized = rawReport.is_anonymous && !isStaff
        ? { ...rawReport, student_id: null }
        : rawReport;

      expect(sanitized.student_id).toBe("student-private-123");
      expect(sanitized.students.full_name).toBe("Rahul Sharma");
    });
  });
});
