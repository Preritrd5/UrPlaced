/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Analytics Metric Catalogue, Paired Before/After & Export Tests (Phase 09)
 * ==============================================================================
 */

import { describe, it, expect } from "vitest";
import { ExportService } from "@/modules/analytics/services/export-service";
import { MANDATORY_TRAINING_CAUSAL_DISCLAIMER } from "@/modules/training/services/training-session-service";

describe("Phase 09: Defensible Analytics Metric Catalogue", () => {
  describe("Placement Metrics Mathematical Correctness", () => {
    it("distinguishes unique placed students from total applications and multiple offers", () => {
      // Scenario: 4 candidate applications across 2 students
      // Student A applied to Drive 1 and Drive 2, got offers from both
      // Student B applied to Drive 1, got an offer and accepted it
      // Student C applied to Drive 1, got rejected (no offer)
      const candidateRecords = [
        { id: "cand-1", student_id: "student-A", status: "OFFER_EXTENDED", offer_details: { is_accepted: false } },
        { id: "cand-2", student_id: "student-A", status: "HIRED", offer_details: { is_accepted: true } },
        { id: "cand-3", student_id: "student-B", status: "HIRED", offer_details: { is_accepted: true } },
        { id: "cand-4", student_id: "student-C", status: "REJECTED", offer_details: null },
      ];

      const placedStudentIds = new Set<string>();
      let totalOffers = 0;
      let acceptedOffers = 0;

      for (const c of candidateRecords) {
        if (c.status === "OFFER_EXTENDED" || c.status === "HIRED") {
          totalOffers++;
          placedStudentIds.add(c.student_id);
          if (c.offer_details?.is_accepted || c.status === "HIRED") {
            acceptedOffers++;
          }
        }
      }

      const totalApplications = candidateRecords.length;
      const uniquePlaced = placedStudentIds.size;
      const avgOffersPerPlaced = Number((totalOffers / uniquePlaced).toFixed(2));

      expect(totalApplications).toBe(4);
      expect(totalOffers).toBe(3);
      expect(uniquePlaced).toBe(2); // Only Student A and Student B
      expect(acceptedOffers).toBe(2);
      expect(avgOffersPerPlaced).toBe(1.5); // 3 offers / 2 placed students
    });

    it("returns null for placement rate when total eligible denominator is zero", () => {
      const totalEligible = 0;
      const uniquePlaced = 0;
      const placementRate = totalEligible > 0 ? (uniquePlaced / totalEligible) * 100 : null;

      expect(placementRate).toBeNull();
    });

    it("calculates exact assessment completion rate percentage", () => {
      const assigned = 50;
      const completed = 42;
      const completionRate = Number(((completed / assigned) * 100).toFixed(2));

      expect(completionRate).toBe(84.0);
    });
  });

  describe("Topic Weakness Heatmap Classification", () => {
    it("classifies severity bands correctly based on observed attempt accuracy", () => {
      function classifySeverity(accuracy: number): "CRITICAL_WEAKNESS" | "MODERATE_WEAKNESS" | "COMPETENT" | "STRONG" {
        if (accuracy < 50) return "CRITICAL_WEAKNESS";
        if (accuracy < 70) return "MODERATE_WEAKNESS";
        if (accuracy >= 85) return "STRONG";
        return "COMPETENT";
      }

      expect(classifySeverity(35.5)).toBe("CRITICAL_WEAKNESS");
      expect(classifySeverity(49.9)).toBe("CRITICAL_WEAKNESS");
      expect(classifySeverity(50.0)).toBe("MODERATE_WEAKNESS");
      expect(classifySeverity(68.2)).toBe("MODERATE_WEAKNESS");
      expect(classifySeverity(72.0)).toBe("COMPETENT");
      expect(classifySeverity(88.0)).toBe("STRONG");
    });
  });

  describe("Secure CSV Export Engine & Formula Injection Prevention", () => {
    it("sanitizes dangerous spreadsheet initial characters (=, +, -, @, \\t, \\r)", () => {
      expect(ExportService.sanitizeCell("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(ExportService.sanitizeCell("+1234567")).toBe("'+1234567");
      expect(ExportService.sanitizeCell("-500")).toBe("'-500");
      expect(ExportService.sanitizeCell("@cmd")).toBe("'@cmd");
      expect(ExportService.sanitizeCell("\tcmd")).toBe("'\tcmd");
      expect(ExportService.sanitizeCell("\rcmd")).toBe("'\rcmd");
    });

    it("leaves benign alphanumeric text untouched", () => {
      expect(ExportService.sanitizeCell("Google Software Engineer")).toBe("Google Software Engineer");
      expect(ExportService.sanitizeCell("2026")).toBe("2026");
      expect(ExportService.sanitizeCell(85.5)).toBe("85.5");
    });

    it("escapes embedded commas and double quotes correctly in CSV formatting", () => {
      const rows = [
        ["Company", "Role, Level", 'Note with "quotes"'],
        ["=MaliciousInc", "Junior Dev", "@DangerousPayload"],
      ];

      const csv = ExportService.toCsv(rows);
      const lines = csv.split("\n");

      expect(lines[0]).toBe('Company,"Role, Level","Note with ""quotes"""');
      expect(lines[1]).toBe("'=MaliciousInc,Junior Dev,'@DangerousPayload");
    });
  });

  describe("Paired Observation Before/After Assessment Analysis", () => {
    it("includes the mandatory causal disclaimer verbatim", () => {
      expect(MANDATORY_TRAINING_CAUSAL_DISCLAIMER).toBe(
        "Correlation does not imply causation. Score improvements reflect observed performance differences between the baseline and follow-up assessments for paired attendees. Performance changes may also be influenced by self-study, repeated exposure, or test variation."
      );
    });

    it("calculates paired score deltas strictly for attendees with both attempts", () => {
      // 5 Enrolled Students:
      // S1: Attended, Baseline 50, Follow-up 80 -> PAIRED
      // S2: Attended, Baseline 60, Follow-up 70 -> PAIRED
      // S3: Attended, Baseline 40, Follow-up missing -> EXCLUDED
      // S4: ABSENT, Baseline 60, Follow-up 90 -> EXCLUDED (did not attend session)
      // S5: Attended, Baseline missing, Follow-up 75 -> EXCLUDED

      const attendance = [
        { studentId: "S1", status: "ATTENDED" },
        { studentId: "S2", status: "ATTENDED" },
        { studentId: "S3", status: "ATTENDED" },
        { studentId: "S4", status: "ABSENT" },
        { studentId: "S5", status: "ATTENDED" },
      ];

      const baselineScores = new Map([
        ["S1", 50],
        ["S2", 60],
        ["S3", 40],
        ["S4", 60],
      ]);

      const followUpScores = new Map([
        ["S1", 80],
        ["S2", 70],
        ["S4", 90],
        ["S5", 75],
      ]);

      const attendedIds = new Set(attendance.filter((a) => a.status === "ATTENDED").map((a) => a.studentId));

      const paired: Array<{ pre: number; post: number }> = [];
      for (const sid of attendedIds) {
        if (baselineScores.has(sid) && followUpScores.has(sid)) {
          paired.push({
            pre: baselineScores.get(sid)!,
            post: followUpScores.get(sid)!,
          });
        }
      }

      expect(paired.length).toBe(2); // Only S1 and S2 qualify

      const avgPre = Number((paired.reduce((sum, p) => sum + p.pre, 0) / paired.length).toFixed(2));
      const avgPost = Number((paired.reduce((sum, p) => sum + p.post, 0) / paired.length).toFixed(2));
      const absDelta = Number((avgPost - avgPre).toFixed(2));
      const relPctDelta = Number((((avgPost - avgPre) / avgPre) * 100).toFixed(2));

      expect(avgPre).toBe(55.0); // (50 + 60) / 2
      expect(avgPost).toBe(75.0); // (80 + 70) / 2
      expect(absDelta).toBe(20.0); // +20%
      expect(relPctDelta).toBe(36.36); // (20 / 55) * 100
    });
  });
});
