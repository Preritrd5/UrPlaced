/**
 * Unit & Integration Tests: Global Student Career Intelligence System
 * Phase 01: Career Profile, AI Resume ATS Scanner & Smart Placement Drive Matching
 */

import { describe, it, expect } from "vitest";
import { StudentCareerProfileService } from "@/modules/students/services/student-career-profile-service";
import { ResumeStorageService } from "@/modules/students/services/resume-storage-service";
import { ResumeExtractorService } from "@/modules/students/services/resume-extractor-service";
import { ResumeScannerService } from "@/modules/students/services/resume-scanner-service";
import { SmartDriveMatchingService } from "@/modules/students/services/smart-drive-matching-service";

describe("Phase 01: Student Career Intelligence System", () => {
  // =========================================================================
  // 1. Career Profile Completeness Calculation Engine
  // =========================================================================
  describe("StudentCareerProfileService - Completeness Engine", () => {
    it("returns 0% completeness and lists missing sections for an empty profile", () => {
      const completeness = StudentCareerProfileService.calculateCompleteness({}, {});
      expect(completeness.overallPercentage).toBe(0);
      expect(completeness.missingSections.some((m) => m.sectionKey === "professionalInfo")).toBe(true);
      expect(completeness.missingSections.some((m) => m.sectionKey === "education")).toBe(true);
      expect(completeness.missingSections.some((m) => m.sectionKey === "technicalSkills")).toBe(true);
      expect(completeness.missingSections.some((m) => m.sectionKey === "projects")).toBe(true);
      expect(completeness.isReadyForDrives).toBe(false);
    });

    it("calculates partial completeness accurately across weighted sections", () => {
      const partialStudent = {
        degree: "B.Tech Computer Science",
        cgpa: 8.4,
      };
      const partialProfile = {
        headline: "Aspiring Cloud Solutions Architect",
        location: "Bengaluru",
        bio: "Focused on cloud architectures, distributed backend microservices, and modern web applications.",
        technical_skills: [
          { name: "TypeScript", proficiency: "ADVANCED" as const, category: "LANGUAGE" as const },
          { name: "React", proficiency: "INTERMEDIATE" as const, category: "FRAMEWORK" as const },
          { name: "Node.js", proficiency: "ADVANCED" as const, category: "FRAMEWORK" as const },
        ],
      };

      const result = StudentCareerProfileService.calculateCompleteness(partialStudent, partialProfile);
      // Professional Info (15%) + Education (20%) + Technical Skills (20%) = 55%
      expect(result.overallPercentage).toBe(55);
      expect(result.breakdown.professionalInfo.score).toBe(15);
      expect(result.breakdown.education.score).toBe(20);
      expect(result.breakdown.technicalSkills.score).toBe(20);
      expect(result.missingSections.some((m) => m.sectionKey === "projects")).toBe(true);
      expect(result.missingSections.some((m) => m.sectionKey === "experience")).toBe(true);
    });

    it("evaluates a fully populated profile to 100% completeness and drive readiness", () => {
      const fullStudent = {
        degree: "B.Tech Computer Science",
        cgpa: 8.9,
        department_id: "dept-cse",
        graduation_year: 2026,
      };
      const fullProfile = {
        headline: "Full Stack Engineer & Distributed Systems Enthusiast",
        location: "Bengaluru, India",
        bio: "Experienced in building scalable TypeScript microservices with PostgreSQL and Supabase.",
        technical_skills: [
          { name: "TypeScript", proficiency: "ADVANCED" as const, category: "LANGUAGE" as const },
          { name: "Python", proficiency: "INTERMEDIATE" as const, category: "LANGUAGE" as const },
          { name: "PostgreSQL", proficiency: "ADVANCED" as const, category: "DATABASE" as const },
        ],
        soft_skills: [
          { name: "Communication", proficiency: "ADVANCED" as const },
          { name: "System Design", proficiency: "ADVANCED" as const },
        ],
        projects: [
          {
            title: "UrPlaced Placement Platform",
            description: "Built high-performance multi-tenant placement examination workflow.",
            technologies: ["Next.js", "PostgreSQL", "Supabase"],
            liveUrl: "https://urplaced.edu",
          },
          {
            title: "Distributed Memory Cache",
            description: "Built Redis-compatible in-memory key value store with LRU eviction.",
            technologies: ["Go", "TCP", "Docker"],
          },
        ],
        experience: [
          {
            organization: "Tech Mahindra",
            designation: "Cloud Engineering Intern",
            employmentType: "INTERNSHIP" as const,
            startDate: "2025-05-01",
            endDate: "2025-08-31",
            responsibilities: ["Optimized serverless latency and built automated CI/CD pipelines."],
          },
        ],
        certifications: [
          {
            name: "AWS Certified Solutions Architect",
            issuingOrganization: "Amazon Web Services",
            issueDate: "2025-09-01",
          },
        ],
        linkedin_url: "https://linkedin.com/in/mayapatel",
        github_url: "https://github.com/mayapatel",
        portfolio_url: "https://mayapatel.dev",
      };

      const result = StudentCareerProfileService.calculateCompleteness(fullStudent, fullProfile);
      expect(result.overallPercentage).toBe(100);
      expect(result.missingSections).toHaveLength(0);
      expect(result.isReadyForDrives).toBe(true);
    });
  });

  // =========================================================================
  // 2. Resume File Validation & Security
  // =========================================================================
  describe("ResumeStorageService - File Security & Magic Byte Validation", () => {
    it("accepts a valid PDF with correct magic bytes %PDF-", () => {
      const pdfBuffer = Buffer.from(
        "%PDF-1.7\nSample valid PDF document binary with at least 50 bytes of binary data for validation."
      );
      const validation = ResumeStorageService.validateFile(
        pdfBuffer,
        "Alex_Rivera_Resume.pdf",
        "application/pdf"
      );
      expect(validation).toEqual({ fileType: "pdf" });
    });

    it("accepts a valid DOCX with correct zip magic bytes PK\\x03\\x04", () => {
      const docxBuffer = Buffer.alloc(60);
      docxBuffer[0] = 0x50; // P
      docxBuffer[1] = 0x4b; // K
      docxBuffer[2] = 0x03;
      docxBuffer[3] = 0x04;
      const validation = ResumeStorageService.validateFile(
        docxBuffer,
        "Maya_Patel_CV.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      expect(validation).toEqual({ fileType: "docx" });
    });

    it("rejects an executable spoofed as a PDF", () => {
      // Windows PE executable magic byte MZ (0x4D, 0x5A) renamed to .pdf
      const exeBuffer = Buffer.alloc(60);
      exeBuffer[0] = 0x4d;
      exeBuffer[1] = 0x5a;
      expect(() =>
        ResumeStorageService.validateFile(exeBuffer, "trojan_resume.pdf", "application/pdf")
      ).toThrow(/binary signature is invalid/i);
    });

    it("rejects unsupported file extensions (.exe, .zip, .png)", () => {
      const dummyBuffer = Buffer.alloc(60);
      expect(() =>
        ResumeStorageService.validateFile(dummyBuffer, "script.sh", "text/x-shellscript")
      ).toThrow(/only pdf.*and.*docx/i);
    });

    it("rejects files exceeding the 10MB limit", () => {
      const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 100);
      expect(() =>
        ResumeStorageService.validateFile(oversizedBuffer, "huge_resume.pdf", "application/pdf")
      ).toThrow(/exceeds maximum allowed size of 10mb/i);
    });
  });

  // =========================================================================
  // 3. Document Extraction & Section Detection
  // =========================================================================
  describe("ResumeExtractorService - Section Detection", () => {
    it("identifies common ATS section headers from resume text", () => {
      const sampleResumeText = `
        ALEX RIVERA
        alex.rivera@example.com | +91 9876543210 | Bengaluru, India

        EDUCATION
        Apex Institute of Technology, B.Tech Computer Science (2022 - 2026)
        CGPA: 8.6/10.0

        TECHNICAL SKILLS
        Languages: TypeScript, JavaScript, Python, SQL
        Frameworks: React, Next.js, Node.js, Express
        Tools: Docker, Git, Linux, Supabase

        WORK EXPERIENCE
        Software Engineering Intern - CloudCraft Ltd (May 2025 - Jul 2025)
        - Developed REST APIs in Node.js reducing endpoint latency by 25%.
        - Designed database migration scripts and configured PostgreSQL indexes.

        PROJECTS
        Campus Placement Portal
        - Implemented student activity contribution heatmap and AI resume scanning.
      `;

      const detected = ResumeExtractorService.detectSectionHeaders(sampleResumeText);
      expect(detected).toContain("EDUCATION");
      expect(detected).toContain("SKILLS");
      expect(detected).toContain("EXPERIENCE");
      expect(detected).toContain("PROJECTS");
    });
  });

  // =========================================================================
  // 4. Resume Scanner & Non-Hallucination Invariants
  // =========================================================================
  describe("ResumeScannerService - ATS Scoring & Rule Fallback", () => {
    it("generates deterministic fallback ATS scores within 0-100 bounds when AI is offline", () => {
      const resumeText = `
        Alex Rivera
        EDUCATION
        B.Tech Computer Science, Apex University, CGPA: 8.5
        SKILLS
        JavaScript, TypeScript, React, Node.js, SQL
        PROJECTS
        UrPlaced - SaaS platform for placements
      `;

      const scanResult = ResumeScannerService.generateFallbackAnalysis(resumeText, "pdf");

      expect(scanResult.scores.overallQuality).toBeGreaterThanOrEqual(0);
      expect(scanResult.scores.overallQuality).toBeLessThanOrEqual(100);
      expect(scanResult.scores.parseability).toBeGreaterThanOrEqual(0);
      expect(scanResult.scores.parseability).toBeLessThanOrEqual(100);
      expect(scanResult.scores.contentQuality).toBeGreaterThanOrEqual(0);
      expect(scanResult.scores.skillsCoverage).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(scanResult.strengths)).toBe(true);
      expect(Array.isArray(scanResult.detectedSections)).toBe(true);
      expect(Array.isArray(scanResult.improvementSuggestions)).toBe(true);
    });

    it("enforces non-hallucination placeholders in bullet point recommendations", () => {
      const scanResult = ResumeScannerService.generateFallbackAnalysis(
        "Worked on database optimization and wrote code.",
        "pdf"
      );

      // Verify that bullet recommendations guide the student with metric placeholders (e.g. [Specify ...])
      // rather than fabricating unverified stats or companies.
      scanResult.improvementSuggestions.forEach((suggestion) => {
        expect(suggestion.requiresStudentInput).toBe(true);
        expect(suggestion.suggestedText).toMatch(/\[Specify/i);
        expect(typeof suggestion.explanation).toBe("string");
      });
    });
  });

  // =========================================================================
  // 5. Smart Placement Drive Matching: Collegiate Eligibility vs. AI Fit
  // =========================================================================
  describe("SmartDriveMatchingService - Eligibility & AI Alignment", () => {
    const collegiateCriteria = {
      min_cgpa: 7.5,
      max_active_backlogs: 0,
      allowed_departments: ["dept-cse", "dept-it"],
      graduation_year: 2026,
    };

    it("authoritatively marks student as ELIGIBLE when all academic thresholds are satisfied", () => {
      const eligibleStudent = {
        cgpa: 8.2,
        active_backlogs: 0,
        department_id: "dept-cse",
        graduation_year: 2026,
      };

      const result = SmartDriveMatchingService.evaluateOfficialEligibility(
        eligibleStudent,
        collegiateCriteria
      );

      expect(result.status).toBe("ELIGIBLE");
      expect(result.reasons.isCgpaEligible).toBe(true);
      expect(result.reasons.isBacklogEligible).toBe(true);
      expect(result.reasons.isDepartmentEligible).toBe(true);
      expect(result.reasons.isGraduationYearEligible).toBe(true);
    });

    it("authoritatively marks student as INELIGIBLE when CGPA is below cutoff", () => {
      const lowCgpaStudent = {
        cgpa: 7.1, // Required: 7.5
        active_backlogs: 0,
        department_id: "dept-cse",
        graduation_year: 2026,
      };

      const result = SmartDriveMatchingService.evaluateOfficialEligibility(
        lowCgpaStudent,
        collegiateCriteria
      );

      expect(result.status).toBe("INELIGIBLE");
      expect(result.reasons.isCgpaEligible).toBe(false);
      expect(result.reasons.summary).toMatch(/CGPA is 7\.10/i);
    });

    it("authoritatively marks student as INELIGIBLE when active backlogs exceed maximum allowed", () => {
      const backloggedStudent = {
        cgpa: 8.0,
        active_backlogs: 1, // Required: 0
        department_id: "dept-cse",
        graduation_year: 2026,
      };

      const result = SmartDriveMatchingService.evaluateOfficialEligibility(
        backloggedStudent,
        collegiateCriteria
      );

      expect(result.status).toBe("INELIGIBLE");
      expect(result.reasons.isBacklogEligible).toBe(false);
      expect(result.reasons.summary).toMatch(/Active backlogs: 1/i);
    });

    it("authoritatively marks student as INELIGIBLE when department is not in eligible branch list", () => {
      const mechStudent = {
        cgpa: 8.5,
        active_backlogs: 0,
        department_id: "dept-mech", // Allowed: CSE, IT
        graduation_year: 2026,
      };

      const result = SmartDriveMatchingService.evaluateOfficialEligibility(
        mechStudent,
        collegiateCriteria
      );

      expect(result.status).toBe("INELIGIBLE");
      expect(result.reasons.isDepartmentEligible).toBe(false);
      expect(result.reasons.summary).toMatch(/department is not on the invited department roster/i);
    });

    it("strictly separates advisory AI match score from official collegiate eligibility", () => {
      // Even if a student has high competency match in skills,
      // if their CGPA does not meet the collegiate criteria, officialEligibility MUST remain INELIGIBLE.
      const studentProfile = {
        cgpa: 7.0, // Criteria requires 7.5 -> Ineligible
        active_backlogs: 0,
        department_id: "dept-cse",
        graduation_year: 2026,
      };

      const eligibility = SmartDriveMatchingService.evaluateOfficialEligibility(
        studentProfile,
        collegiateCriteria
      );

      const aiMatch = SmartDriveMatchingService.computeRuleBasedMatchScore({
        studentSkills: ["TypeScript", "React", "Node.js", "Docker", "PostgreSQL"],
        driveSkills: ["TypeScript", "React", "Node.js"],
        driveTitle: "Frontend Software Engineer",
      });

      expect(eligibility.status).toBe("INELIGIBLE");
      expect(aiMatch.matchScore).toBeGreaterThanOrEqual(60);
      expect(aiMatch.matchedSkills).toContain("TypeScript");
      expect(aiMatch.matchedSkills).toContain("React");

      // Invariant: AI match score NEVER mutates official eligibility
      expect(eligibility.status).toBe("INELIGIBLE");
    });
  });
});
