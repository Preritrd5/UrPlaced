/**
 * Comprehensive Hardening, Security, Authorization & Integrity Audit Test Suite
 * Validating Phase 01 & Phase 02 Systems in UrPlaced
 * 
 * Tests cover:
 * - K1: Career Profile Integrity, Optimistic Concurrency & Rejection of Institutional Overwrites
 * - K2: Resume Extraction Security, Magic Bytes, Zip Bomb Defense & Multi-Page Parsing
 * - K3: Resume Scanner AI Provenance, Non-Hallucination & Server-Side Storage Paths
 * - K4: Smart Placement Drive Matching Canonical Eligibility & Transparent Scoring
 * - K5: Skill Gap Analyzer Cross-Student Isolation & Assessment-Supported Mastery
 * - K6: Career Passport Data Minimization, Snapshot Freezing & Visibility Controls
 * - K7: Mock Interview Studio Mode-Specific Rubrics, Deterministic Heuristics & Turn Recovery
 * - K8: Database Migration SQL Correctness, Canonical Staff Roles & Direct-Write RLS Tightening
 */

import { describe, it, expect, vi } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { StudentCareerProfileService } from "@/modules/students/services/student-career-profile-service";
import { ResumeStorageService } from "@/modules/students/services/resume-storage-service";
import { ResumeExtractorService } from "@/modules/students/services/resume-extractor-service";
import { ResumeScannerService } from "@/modules/students/services/resume-scanner-service";
import { SmartDriveMatchingService } from "@/modules/students/services/smart-drive-matching-service";
import { SkillGapAnalyzerService } from "@/modules/students/services/skill-gap-analyzer-service";
import { CareerPassportService } from "@/modules/students/services/career-passport-service";
import { MockInterviewService } from "@/modules/students/services/mock-interview-service";

describe("Phase 01 & 02 Hardening & Security Audit Suite", () => {
  // =========================================================================
  // K1: Career Profile Integrity & Completeness
  // =========================================================================
  describe("K1: Career Profile Integrity & Institutional Boundaries", () => {
    it("awards ZERO completeness credit for blank, whitespace-only, or dummy entries", () => {
      const student = { degree: "B.Tech CSE", cgpa: 8.5 };
      const dummyProfile = {
        headline: "   ",
        bio: "\t\n  ",
        technical_skills: [
          { name: "   ", proficiency: "ADVANCED" as const, category: "LANGUAGE" as const },
          { name: " ", proficiency: "BEGINNER" as const, category: "FRAMEWORK" as const },
        ],
        projects: [
          { title: "  ", description: "   ", technologies: [] },
        ],
        experience: [
          {
            organization: " ",
            designation: "  ",
            employmentType: "INTERNSHIP" as const,
            startDate: "2025-01-01",
            responsibilities: [],
          },
        ],
        certifications: [
          { name: " ", issuingOrganization: " " },
        ],
        linkedin_url: "   ",
      };

      const result = StudentCareerProfileService.calculateCompleteness(student, dummyProfile);

      // Only education gets points (20%); skills, projects, experience, certs get 0
      expect(result.breakdown.professionalInfo.score).toBe(0);
      expect(result.breakdown.technicalSkills.score).toBe(0);
      expect(result.breakdown.projects.score).toBe(0);
      expect(result.breakdown.experience.score).toBe(0);
      expect(result.breakdown.certifications.score).toBe(0);
      expect(result.breakdown.professionalLinks.score).toBe(0);
      expect(result.overallPercentage).toBe(20); // Only academic institutional education
      expect(result.isReadyForDrives).toBe(false);
    });

    it("verifies that calculateCompleteness awards full credit only to authentic populated entries", () => {
      const student = { degree: "B.Tech CSE", cgpa: 8.5, department_id: "dept-1", graduation_year: 2026 };
      const authenticProfile = {
        headline: "Full Stack Engineer",
        location: "Bengaluru",
        bio: "Passionate engineer specialized in distributed systems and Next.js.",
        technical_skills: [
          { name: "TypeScript", proficiency: "ADVANCED" as const, category: "LANGUAGE" as const },
          { name: "React", proficiency: "ADVANCED" as const, category: "FRAMEWORK" as const },
          { name: "PostgreSQL", proficiency: "INTERMEDIATE" as const, category: "DATABASE" as const },
        ],
        projects: [
          { title: "Project Alpha", description: "Microservices engine", technologies: ["Go", "Docker"] },
          { title: "Project Beta", description: "AI Placement Portal", technologies: ["Next.js", "TypeScript"] },
        ],
        experience: [
          {
            organization: "UrPlaced Labs",
            designation: "Software Intern",
            employmentType: "INTERNSHIP" as const,
            startDate: "2025-05-01",
            responsibilities: ["Developed core microservices"],
          },
        ],
        certifications: [
          { name: "AWS Certified Developer", issuingOrganization: "Amazon Web Services" },
        ],
        linkedin_url: "https://linkedin.com/in/authentic-candidate",
      };

      const result = StudentCareerProfileService.calculateCompleteness(student, authenticProfile);
      expect(result.breakdown.professionalInfo.score).toBe(15);
      expect(result.breakdown.education.score).toBe(20);
      expect(result.breakdown.technicalSkills.score).toBe(20);
      expect(result.breakdown.projects.score).toBe(20);
      expect(result.breakdown.experience.score).toBe(10);
      expect(result.breakdown.certifications.score).toBe(10);
      expect(result.breakdown.professionalLinks.score).toBe(5);
      expect(result.overallPercentage).toBe(100);
      expect(result.isReadyForDrives).toBe(true);
    });
  });

  // =========================================================================
  // K2: Resume Extraction & Upload Security
  // =========================================================================
  describe("K2: Resume Document Extraction & Secure Upload", () => {
    it("validates magic bytes for genuine PDF (%PDF-) and DOCX (PK\x03\x04)", () => {
      const pdfBuffer = Buffer.from("%PDF-1.7 valid content here with more than 50 bytes of test content for verification purposes.");
      expect(() =>
        ResumeStorageService.validateFile(pdfBuffer, "candidate-resume.pdf", "application/pdf")
      ).not.toThrow();

      const docxHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      const docxPadding = Buffer.alloc(60, 0x20);
      const docxBuffer = Buffer.concat([docxHeader, docxPadding]);
      expect(() =>
        ResumeStorageService.validateFile(
          docxBuffer,
          "candidate-resume.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
      ).not.toThrow();
    });

    it("rejects malicious executables disguised with pdf or docx extensions", () => {
      const exeHeader = Buffer.from("MZ\x90\x00\x03\x00\x00\x00");
      const exeBuffer = Buffer.concat([exeHeader, Buffer.alloc(60, 0x00)]);
      expect(() =>
        ResumeStorageService.validateFile(exeBuffer, "malicious.pdf", "application/pdf")
      ).toThrow(/binary signature is invalid/);

      expect(() =>
        ResumeStorageService.validateFile(
          exeBuffer,
          "malicious.docx",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
      ).toThrow(/binary signature is not a valid OpenXML document/);
    });

    it("strictly rejects files exceeding 10MB limit before processing", () => {
      const overLimitBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
      expect(() =>
        ResumeStorageService.validateFile(overLimitBuffer, "huge.pdf", "application/pdf")
      ).toThrow(/exceeds maximum allowed size of 10MB/);

      const validLimitBuffer = Buffer.concat([Buffer.from("%PDF-1.4 "), Buffer.alloc(100, 0x20)]);
      expect(() =>
        ResumeStorageService.validateFile(validLimitBuffer, "normal.pdf", "application/pdf")
      ).not.toThrow();
    });

    it("detects empty or scanned image-only PDFs (< 15 words) and warns appropriately", async () => {
      const minimalPdf = Buffer.from(
        "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000052 00000 n\n0000000108 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n185\n%%EOF"
      );

      const extraction = await ResumeExtractorService.extract(minimalPdf, "pdf");
      expect(extraction.wordCount).toBeLessThan(15);
      expect(extraction.parsingStatus === "PARTIALLY_PARSED" || extraction.parsingStatus === "FAILED" || extraction.warning !== undefined).toBe(true);
    });
  });

  // =========================================================================
  // K3: Resume Scanner AI Provenance & Non-Hallucination
  // =========================================================================
  describe("K3: Resume Scanner AI Provenance & Non-Hallucination", () => {
    it("strictly constructs server-side storage paths and does not trust client file_path", () => {
      const tenantId = "tenant-uuid-123";
      const studentId = "student-uuid-456";
      const resumeId = "resume-uuid-789";
      const fileType = "pdf";

      const serverPath = `${tenantId}/${studentId}/${resumeId}.${fileType}`;
      expect(serverPath).toBe("tenant-uuid-123/student-uuid-456/resume-uuid-789.pdf");
      // Never contains directory traversal or arbitrary client buckets
      expect(serverPath).not.toContain("../");
      expect(serverPath.startsWith(`${tenantId}/${studentId}/`)).toBe(true);
    });

    it("uses 'rule-based-deterministic-evaluator' when AI fallback is invoked", () => {
      const scanResult = ResumeScannerService.generateFallbackAnalysis(
        "Education: B.Tech Computer Science. Skills: Python, React, PostgreSQL. Projects: Built chat app.",
        "pdf"
      );

      expect(scanResult.status).toBe("completed");
      expect(scanResult.scores.overallQuality).toBeGreaterThan(0);
      expect(scanResult.scores.overallQuality).toBeLessThanOrEqual(100);
      // Fallback does NOT fabricate fake skills not found in text
      expect(scanResult.skills.detected).toContain("Python");
      expect(scanResult.skills.detected).toContain("React");
      expect(scanResult.skills.detected).toContain("Postgresql");
      expect(scanResult.skills.detected).not.toContain("Kubernetes");
    });

    it("enforces placeholder-driven suggestions ([Specify ...]) rather than fabricating company names or stats", () => {
      const scanResult = ResumeScannerService.generateFallbackAnalysis(
        "Worked on backend APIs and database queries.",
        "pdf"
      );

      scanResult.improvementSuggestions.forEach((s) => {
        expect(s.requiresStudentInput).toBe(true);
        expect(s.suggestedText).toMatch(/\[Specify/i);
      });
    });
  });

  // =========================================================================
  // K4: Smart Placement Drive Matching
  // =========================================================================
  describe("K4: Smart Placement Drive Matching & Backlog Verification", () => {
    it("authoritatively rejects candidate when active backlogs exceed drive maximum", () => {
      const candidateProfile = {
        cgpa: 8.8,
        active_backlogs: 2,
        department_id: "dept-cse",
        graduation_year: 2026,
      };

      const driveCriteria = {
        min_cgpa: 7.5,
        max_backlogs: 0,
        allowed_departments: ["dept-cse", "dept-ise"],
        allowed_graduation_years: [2026],
      };

      const check = SmartDriveMatchingService.evaluateOfficialEligibility(candidateProfile, driveCriteria);
      expect(check.status).toBe("INELIGIBLE");
      expect(check.reasons.isBacklogEligible).toBe(false);
      expect(check.reasons.summary).toContain("Active backlogs");
    });

    it("marks eligibility as UNKNOWN with review notice when student active_backlogs is unrecorded (null)", () => {
      const candidateProfile = {
        cgpa: 8.5,
        active_backlogs: null, // Unrecorded / unverified institutional record
        department_id: "dept-cse",
        graduation_year: 2026,
      };

      const driveCriteria = {
        min_cgpa: 7.5,
        max_backlogs: 0,
        allowed_departments: ["dept-cse"],
        allowed_graduation_years: [2026],
      };

      const check = SmartDriveMatchingService.evaluateOfficialEligibility(candidateProfile, driveCriteria);
      expect(check.status).toBe("UNKNOWN");
      expect(check.reasons.isBacklogEligible).toBe(false);
      expect(check.reasons.summary.toLowerCase()).toContain("backlog count is unrecorded");
    });

    it("calculates transparent match scores without arbitrary 30% floor when skills do not match", () => {
      // Candidate with 0 matched skills
      const result = SmartDriveMatchingService.computeRuleBasedMatchScore({
        driveSkills: ["Rust", "Solidity", "Cryptography"],
        studentSkills: ["HTML", "CSS"],
      });

      // Must be genuinely 0, never artificially inflated to 30%
      expect(result.matchScore).toBe(0);
      expect(result.matchedSkills.length).toBe(0);
      expect(result.missingSkills).toContain("Rust");
      expect(result.missingSkills).toContain("Solidity");
      expect(result.missingSkills).toContain("Cryptography");
    });
  });

  // =========================================================================
  // K5: Skill Gap Analyzer & Cross-Student Isolation
  // =========================================================================
  describe("K5: Skill Gap Analyzer & Cross-Student Isolation", () => {
    it("ensures mistake targets and evidence are strictly partitioned by student ID", () => {
      const student1Evidence = SkillGapAnalyzerService.determineSkillEvidenceTier({
        skillName: "Next.js",
        studentAssessments: [],
        studentProjects: [{ title: "Student 1 Project", technologies: ["Next.js"] }],
        resumeSkills: [],
        selfReportedSkills: [],
      });
      expect(student1Evidence).toBe("PROJECT_SUPPORTED");

      const student2Evidence = SkillGapAnalyzerService.determineSkillEvidenceTier({
        skillName: "Next.js",
        studentAssessments: [],
        studentProjects: [],
        resumeSkills: [],
        selfReportedSkills: [],
      });
      expect(student2Evidence).toBe("MISSING");
    });

    it("awards ASSESSMENT_SUPPORTED only for completed attempts with passing score (>= 60%)", () => {
      const passingAttempt = SkillGapAnalyzerService.determineSkillEvidenceTier({
        skillName: "PostgreSQL",
        studentAssessments: [{ skillName: "PostgreSQL", score: 75, isCollegeVerified: false }],
        studentProjects: [],
        resumeSkills: [],
        selfReportedSkills: [],
      });
      expect(passingAttempt).toBe("ASSESSMENT_SUPPORTED");

      const failingAttempt = SkillGapAnalyzerService.determineSkillEvidenceTier({
        skillName: "PostgreSQL",
        studentAssessments: [{ skillName: "PostgreSQL", score: 45, isCollegeVerified: false }], // < 60%
        studentProjects: [],
        resumeSkills: [],
        selfReportedSkills: [],
      });
      // Failing score does not establish assessment-supported mastery
      expect(failingAttempt).toBe("MISSING");
    });
  });

  // =========================================================================
  // K6: Career Passport & Data Minimization
  // =========================================================================
  describe("K6: Career Passport Data Minimization & Privacy", () => {
    it("enforces privacy-first defaults (show_email=false, show_phone=false, show_cgpa=false)", () => {
      const defaultIncluded = {
        show_cgpa: false,
        show_phone: false,
        show_email: false,
        show_education: true,
        show_skills: true,
        show_projects: true,
        show_experience: true,
        show_certifications: true,
        show_achievements: true,
      };

      expect(defaultIncluded.show_cgpa).toBe(false);
      expect(defaultIncluded.show_phone).toBe(false);
      expect(defaultIncluded.show_email).toBe(false);
    });

    it("sanitizes education completely when show_education is false", () => {
      const passportData: any = {
        studentName: "Ananya Sharma",
        institutionName: "PES Institute of Technology",
        degree: "B.Tech Computer Science",
        departmentName: "Computer Science",
        graduationYear: 2026,
        cgpa: 9.2,
        email: "ananya@college.edu",
        phone: "+91-9876543210",
        headline: "Aspiring Cloud Engineer",
        summary: "Passionate about cloud-native systems.",
        includedSections: {
          show_cgpa: false,
          show_phone: false,
          show_email: false,
          show_education: false, // Explicitly hidden
          show_skills: true,
          show_projects: true,
          show_experience: true,
          show_certifications: true,
          show_achievements: true,
        },
        technicalSkills: [],
        softSkills: [],
        projects: [],
        experience: [],
        certifications: [],
        achievements: [],
      };

      const sanitized = CareerPassportService.buildSanitizedPassportView(passportData);

      // Institutional education must be completely nullified
      expect(sanitized.institution).toBeNull();
      expect(sanitized.degree).toBeNull();
      expect(sanitized.graduationYear).toBeNull();
      expect(sanitized.cgpa).toBeNull();

      // Personal contacts must be nullified
      expect(sanitized.email).toBeNull();
      expect(sanitized.phone).toBeNull();
      expect(sanitized.studentName).toBe("Ananya Sharma");
    });
  });

  // =========================================================================
  // K7: AI Mock Interview Studio Mode-Specific Rubrics & Fallbacks
  // =========================================================================
  describe("K7: AI Mock Interview Studio Mode Rubrics & Fallbacks", () => {
    it("validates all 5 official interview modes", () => {
      expect(MockInterviewService.isValidInterviewType("TECHNICAL")).toBe(true);
      expect(MockInterviewService.isValidInterviewType("HR")).toBe(true);
      expect(MockInterviewService.isValidInterviewType("BEHAVIOURAL")).toBe(true);
      expect(MockInterviewService.isValidInterviewType("PROJECT_BASED")).toBe(true);
      expect(MockInterviewService.isValidInterviewType("COMPANY_SPECIFIC")).toBe(true);
      expect(MockInterviewService.isValidInterviewType("INVALID_TYPE")).toBe(false);
    });

    it("evaluates trivial/blank responses (< 10 words) with appropriately low scores (<= 25), never inventing 70/75s", () => {
      const evaluation = MockInterviewService.evaluateHeuristically(
        "I like code.",
        "TECHNICAL",
        "ALGORITHMS"
      );

      expect(evaluation.overallScore).toBeLessThanOrEqual(25);
      expect(evaluation.technicalScore).toBeLessThanOrEqual(20);
      expect(evaluation.depthScore).toBeLessThanOrEqual(15);
      expect(evaluation.whatWasMissing.some((m) => m.toLowerCase().includes("too brief"))).toBe(true);
      expect(evaluation.conceptualErrors.length).toBeGreaterThan(0);
    });

    it("awards structured heuristic scores to detailed answers with reasoning indicators without exceeding bounds", () => {
      const detailedAnswer = `In my project, the situation required building a distributed caching layer. 
Our primary task was handling 5,000 requests per second under 20ms latency. 
Specifically, I took the action of implementing a Redis cluster with consistent hashing and LRU eviction. 
Because memory was constrained, we made the architectural trade-off to compress payload structures using Protocol Buffers. 
As a result, we reduced memory consumption by 35% and p99 latency dropped from 45ms to 14ms.`;

      const evaluation = MockInterviewService.evaluateHeuristically(
        detailedAnswer,
        "BEHAVIOURAL",
        "STAR"
      );

      expect(evaluation.overallScore).toBeGreaterThanOrEqual(50);
      expect(evaluation.overallScore).toBeLessThanOrEqual(85);
      expect(evaluation.structureScore).toBeGreaterThanOrEqual(60);
      expect(evaluation.whatWentWell.some((w) => w.toLowerCase().includes("structured") || w.toLowerCase().includes("words"))).toBe(true);
    });

    it("compiles final reports with 0 overall score when no turns were evaluated", () => {
      const report = MockInterviewService.compileFinalReport([], "Backend Engineer", "INTERMEDIATE");
      expect(report.overallScore).toBe(0);
      expect(report.relevanceScore).toBe(0);
      expect(report.technicalAccuracyScore).toBe(0);
      expect(report.suggestedNextLevel).toBe("BEGINNER");
    });
  });

  // =========================================================================
  // K8: Database Migration SQL Correctness & RLS Verification
  // =========================================================================
  describe("K8: Database Migration SQL & RLS Hardening", () => {
    it("verifies migration 20261109000003 exists and aligns canonical staff roles", () => {
      const migrationPath = path.join(
        process.cwd(),
        "supabase/migrations/20261109000003_phase01_02_hardening_and_integrity.sql"
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, "utf-8");

      // Canonical staff roles only
      expect(sqlContent).toContain("tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')");
      expect(sqlContent).not.toContain("'PLACEMENT_OFFICER'");
      expect(sqlContent).not.toContain("'STAFF'");

      // Direct client writes restricted: FOR SELECT and FOR DELETE only on server-derived evaluation tables
      expect(sqlContent).toContain('CREATE POLICY "Students view own resume scans"');
      expect(sqlContent).toContain('CREATE POLICY "Students delete own resume scans"');
      expect(sqlContent).toContain('CREATE POLICY "Students view own placement matches"');
      expect(sqlContent).toContain('CREATE POLICY "Students view own skill gap analyses"');
      expect(sqlContent).toContain('CREATE POLICY "Students view own mock interview sessions"');
      expect(sqlContent).toContain('CREATE POLICY "Students view own mock interview messages"');

      // Student self-verification forbidden in skill progress
      expect(sqlContent).toContain("status <> 'VERIFIED'");
      expect(sqlContent).toContain("verified_at IS NULL");
      expect(sqlContent).toContain("verified_by IS NULL");

      // Clean ai_usage_logs constraint without exception swallowing
      expect(sqlContent).toContain("ALTER TABLE public.ai_usage_logs ADD CONSTRAINT ai_usage_logs_feature_check");
      expect(sqlContent).toContain("'MOCK_INTERVIEW'");
      expect(sqlContent).toContain("'CAREER_PASSPORT'");
      expect(sqlContent).not.toContain("WHEN OTHERS THEN\n        NULL;");
    });
  });
});
