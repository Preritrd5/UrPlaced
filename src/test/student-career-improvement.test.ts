/**
 * Comprehensive Unit & Integration Tests
 * Phase 02: Global Student Career Improvement System
 * 
 * 1. AI Skill Gap Analyzer: Evidence hierarchy, classification, phased roadmap, progress tracking.
 * 2. Student Career Passport: SHA-256 token security, recruiter view data minimization, visibility controls.
 * 3. AI Mock Interview Studio: 5 interview types, 6-dimension rubric evaluation, turn-based state machine, final report compilation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { SkillGapAnalyzerService } from "@/modules/students/services/skill-gap-analyzer-service";
import { CareerPassportService } from "@/modules/students/services/career-passport-service";
import { MockInterviewService } from "@/modules/students/services/mock-interview-service";

describe("Phase 02: Global Student Career Improvement System", () => {
  // =========================================================================
  // 1. AI Skill Gap Analyzer: Evidence Hierarchy & Milestone Generation
  // =========================================================================
  describe("SkillGapAnalyzerService - Evidence & Classification Engine", () => {
    it("correctly classifies student skill evidence across the 5 authoritative tiers", () => {
      // 1. Authoritative verified assessment record
      const verifiedTier = SkillGapAnalyzerService.determineSkillEvidenceTier({
        skillName: "PostgreSQL",
        studentAssessments: [
          { skillName: "PostgreSQL", score: 85, isCollegeVerified: true },
        ],
        studentProjects: [],
        resumeSkills: [],
        selfReportedSkills: [{ name: "PostgreSQL", proficiency: "ADVANCED" }],
      });
      expect(verifiedTier).toBe("VERIFIED");

      // 2. High score in campus practice test, but not college-certified
      const assessmentTier = SkillGapAnalyzerService.determineSkillEvidenceTier({
        skillName: "React",
        studentAssessments: [
          { skillName: "React", score: 78, isCollegeVerified: false },
        ],
        studentProjects: [],
        resumeSkills: [],
        selfReportedSkills: [{ name: "React", proficiency: "INTERMEDIATE" }],
      });
      expect(assessmentTier).toBe("ASSESSMENT_SUPPORTED");

      // 3. Project implementation evidence
      const projectTier = SkillGapAnalyzerService.determineSkillEvidenceTier({
        skillName: "Docker",
        studentAssessments: [],
        studentProjects: [
          {
            title: "Microservices Platform",
            technologies: ["Docker", "Node.js", "Redis"],
          },
        ],
        resumeSkills: [],
        selfReportedSkills: [],
      });
      expect(projectTier).toBe("PROJECT_SUPPORTED");

      // 4. Resume keyword presence without project backing
      const resumeTier = SkillGapAnalyzerService.determineSkillEvidenceTier({
        skillName: "Kubernetes",
        studentAssessments: [],
        studentProjects: [],
        resumeSkills: ["Kubernetes", "AWS"],
        selfReportedSkills: [],
      });
      expect(resumeTier).toBe("RESUME_SUPPORTED");

      // 5. Self-reported claim only
      const selfReportedTier = SkillGapAnalyzerService.determineSkillEvidenceTier({
        skillName: "GraphQL",
        studentAssessments: [],
        studentProjects: [],
        resumeSkills: [],
        selfReportedSkills: [{ name: "GraphQL", proficiency: "BEGINNER" }],
      });
      expect(selfReportedTier).toBe("SELF_REPORTED");

      // 6. Not possessed / Missing
      const missingTier = SkillGapAnalyzerService.determineSkillEvidenceTier({
        skillName: "Apache Kafka",
        studentAssessments: [],
        studentProjects: [],
        resumeSkills: [],
        selfReportedSkills: [],
      });
      expect(missingTier).toBe("MISSING");
    });

    it("enforces invariant: self-reported skills can NEVER be marked VERIFIED without authoritative assessment", () => {
      const tier = SkillGapAnalyzerService.determineSkillEvidenceTier({
        skillName: "System Architecture",
        studentAssessments: [],
        studentProjects: [],
        resumeSkills: ["System Architecture"],
        selfReportedSkills: [
          { name: "System Architecture", proficiency: "ADVANCED" },
        ],
      });

      // Must strictly be RESUME_SUPPORTED or SELF_REPORTED, never VERIFIED
      expect(tier).not.toBe("VERIFIED");
      expect(tier).not.toBe("ASSESSMENT_SUPPORTED");
      expect(tier).toBe("RESUME_SUPPORTED");
    });

    it("generates structured 4-phase learning milestones with effort estimates", () => {
      const missingSkills = [
        {
          skillName: "Redis",
          category: "DATABASE",
          importance: "CRITICAL" as const,
          prerequisites: ["Data Structures"],
        },
        {
          skillName: "Docker",
          category: "DEVOPS",
          importance: "HIGH" as const,
          prerequisites: ["Linux Basics"],
        },
        {
          skillName: "Microservices System Design",
          category: "ARCHITECTURE",
          importance: "MEDIUM" as const,
          prerequisites: ["REST APIs", "Docker"],
        },
      ];

      const roadmap = SkillGapAnalyzerService.buildPhasedRoadmap(missingSkills, "Full Stack Developer");

      expect(roadmap).toHaveLength(4);
      expect(roadmap.map((phase) => phase.phase)).toEqual([
        "IMMEDIATE",
        "SHORT_TERM",
        "MEDIUM_TERM",
        "LONG_TERM",
      ]);

      // Immediate phase should address critical prerequisites
      const immediatePhase = roadmap.find((p) => p.phase === "IMMEDIATE");
      expect(immediatePhase).toBeDefined();
      expect(immediatePhase?.timeframeWeeks).toBe("Weeks 1–2");
      expect(immediatePhase?.milestones.length).toBeGreaterThan(0);

      // Verify each milestone has actionable attributes
      const milestone = immediatePhase?.milestones[0];
      expect(milestone).toHaveProperty("skillName");
      expect(milestone).toHaveProperty("learningObjective");
      expect(milestone).toHaveProperty("estimatedEffortHours");
      expect(typeof milestone?.estimatedEffortHours).toBe("number");
      expect(milestone?.estimatedEffortHours).toBeGreaterThan(0);
      expect(milestone).toHaveProperty("recommendedPractice");
    });

    it("calculates readiness score accurately based on critical, high, and medium skill gaps", () => {
      const totalRequired = 8;
      const matched = 6;
      const missingCritical = 1;
      const missingHigh = 1;

      const score = SkillGapAnalyzerService.calculateReadinessScore({
        totalRequiredSkills: totalRequired,
        matchedSkillsCount: matched,
        missingCriticalCount: missingCritical,
        missingHighCount: missingHigh,
        verifiedSkillsCount: 4,
      });

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
      // Because 1 critical skill is missing, score cannot be 100%
      expect(score).toBeLessThan(90);
    });
  });

  // =========================================================================
  // 2. Student Career Passport: Cryptographic Hashing & Data Minimization
  // =========================================================================
  describe("CareerPassportService - Token Hashing & Data Minimization", () => {
    it("generates a 64-character hex cryptographic token and produces a matching SHA-256 hash", () => {
      const rawToken = CareerPassportService.generateSecureToken();
      expect(rawToken).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(rawToken)).toBe(true);

      const computedHash = CareerPassportService.hashToken(rawToken);
      expect(computedHash).toHaveLength(64);

      // Verify that re-hashing yields exact match (deterministic lookup)
      const expectedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      expect(computedHash).toBe(expectedHash);
    });

    it("strictly minimises public recruiter data: removes studentId, tenantId, and disabled sections", () => {
      const fullRawStudentData = {
        id: "student-uuid-9988-7766",
        tenant_id: "college-tenant-1122",
        user_id: "auth-user-id-5544",
        first_name: "Aditi",
        last_name: "Sharma",
        email: "aditi.sharma@example.edu",
        phone: "+91-9876543210",
        cgpa: 9.25,
        degree: "B.Tech Computer Science",
        graduation_year: 2026,
        headline: "Aspiring Cloud Backend Engineer",
        summary: "Specialised in high-concurrency microservices with Go and PostgreSQL.",
        technical_skills: [
          { name: "Go", proficiency: "ADVANCED", isVerified: true },
          { name: "PostgreSQL", proficiency: "ADVANCED", isVerified: true },
          { name: "Docker", proficiency: "INTERMEDIATE", isVerified: false },
        ],
        projects: [
          {
            title: "Real-time Telemetry Engine",
            description: "High throughput MQTT ingestion pipeline.",
            technologies: ["Go", "Kafka", "TimescaleDB"],
          },
        ],
      };

      // Configuration where student hides CGPA and Phone number
      const privacyConfig = {
        show_cgpa: false,
        show_phone: false,
        show_email: true,
        show_education: true,
        show_skills: true,
        show_projects: true,
        show_experience: true,
        show_certifications: false,
        show_achievements: true,
      };

      const publicView = CareerPassportService.filterPublicPassportData(
        fullRawStudentData,
        privacyConfig,
        "Techno Institute of Technology"
      );

      // 1. Mandatory Security: Internal identifiers MUST NOT leak to public view
      expect((publicView as any).id).toBeUndefined();
      expect((publicView as any).tenant_id).toBeUndefined();
      expect((publicView as any).user_id).toBeUndefined();
      expect((publicView as any).student_id).toBeUndefined();

      // 2. Student-controlled privacy flags: Hidden fields MUST be undefined/omitted
      expect(publicView.cgpa).toBeUndefined();
      expect(publicView.phone).toBeUndefined();

      // 3. Approved visible fields MUST remain intact
      expect(publicView.fullName).toBe("Aditi Sharma");
      expect(publicView.email).toBe("aditi.sharma@example.edu");
      expect(publicView.institutionName).toBe("Techno Institute of Technology");
      expect(publicView.degree).toBe("B.Tech Computer Science");
      expect(publicView.headline).toBe("Aspiring Cloud Backend Engineer");
      expect(publicView.skills).toHaveLength(3);
      expect(publicView.projects).toHaveLength(1);
    });

    it("includes verification status badges only for skills corroborated by institutional tests", () => {
      const rawData = {
        first_name: "Karan",
        last_name: "Patel",
        technical_skills: [
          { name: "Python", proficiency: "ADVANCED", isVerified: true },
          { name: "Rust", proficiency: "BEGINNER", isVerified: false },
        ],
      };

      const publicView = CareerPassportService.filterPublicPassportData(
        rawData,
        {
          show_cgpa: true,
          show_phone: true,
          show_email: true,
          show_education: true,
          show_skills: true,
          show_projects: true,
          show_experience: true,
          show_certifications: true,
          show_achievements: true,
        },
        "National Engineering College"
      );

      const pythonSkill = publicView.skills.find((s) => s.name === "Python");
      const rustSkill = publicView.skills.find((s) => s.name === "Rust");

      expect(pythonSkill?.isVerified).toBe(true);
      expect(rustSkill?.isVerified).toBe(false);
    });
  });

  // =========================================================================
  // 3. AI Mock Interview Studio: 6-Dimension Rubric & Session Lifecycle
  // =========================================================================
  describe("MockInterviewService - 6-Dimension Rubric & Turn Evaluation", () => {
    it("supports all 5 mandatory interview types", () => {
      const supportedTypes = [
        "TECHNICAL",
        "HR",
        "BEHAVIOURAL",
        "PROJECT_BASED",
        "COMPANY_SPECIFIC",
      ];

      for (const type of supportedTypes) {
        expect(MockInterviewService.isValidInterviewType(type)).toBe(true);
      }

      expect(MockInterviewService.isValidInterviewType("RANDOM_INVALID_TYPE")).toBe(false);
    });

    it("evaluates a student answer strictly across all 6 rubric dimensions", () => {
      const mockRawLLMResponse = JSON.stringify({
        relevanceScore: 88,
        technicalScore: 82,
        depthScore: 75,
        structureScore: 90,
        practicalReasoningScore: 80,
        communicationScore: 85,
        whatWentWell: [
          "Clearly outlined the time complexity of QuickSort (O(n log n) average, O(n^2) worst case).",
          "Explained pivot selection strategies including Median-of-Three to mitigate worst-case scenarios.",
        ],
        whatWasMissing: [
          "Did not mention auxiliary space complexity required by recursion stack.",
        ],
        conceptualErrors: [],
        improvedAnswerExample:
          "In QuickSort, the algorithm partitions the array around a pivot element...",
        followUpRecommendation: "Ask about in-place partitioning vs auxiliary arrays.",
      });

      const evaluation = MockInterviewService.parseEvaluationResponse(mockRawLLMResponse);

      // Verify all 6 dimensions are present, bounded between 0 and 100
      expect(evaluation.relevanceScore).toBe(88);
      expect(evaluation.technicalScore).toBe(82);
      expect(evaluation.depthScore).toBe(75);
      expect(evaluation.structureScore).toBe(90);
      expect(evaluation.practicalReasoningScore).toBe(80);
      expect(evaluation.communicationScore).toBe(85);

      // Overall score must be calculated as a composite score within bounds
      expect(evaluation.overallScore).toBeGreaterThanOrEqual(80);
      expect(evaluation.overallScore).toBeLessThanOrEqual(90);

      // Qualitative feedback arrays
      expect(evaluation.whatWentWell).toHaveLength(2);
      expect(evaluation.whatWasMissing).toHaveLength(1);
      expect(evaluation.conceptualErrors).toEqual([]);
      expect(evaluation.improvedAnswerExample.length).toBeGreaterThan(20);
    });

    it("robustly recovers with fallback evaluation if LLM output contains markdown fences or irregular text", () => {
      const responseWithFences = `\`\`\`json
{
  "relevanceScore": 70,
  "technicalScore": 65,
  "depthScore": 60,
  "structureScore": 75,
  "practicalReasoningScore": 68,
  "communicationScore": 72,
  "whatWentWell": ["Good effort on general explanation."],
  "whatWasMissing": ["Lacked edge case considerations."],
  "conceptualErrors": ["Confused binary search with linear scan."],
  "improvedAnswerExample": "A more precise answer involves...",
  "followUpRecommendation": "Review search algorithms."
}
\`\`\``;

      const evaluation = MockInterviewService.parseEvaluationResponse(responseWithFences);
      expect(evaluation.relevanceScore).toBe(70);
      expect(evaluation.conceptualErrors).toContain("Confused binary search with linear scan.");
      expect(evaluation.overallScore).toBeGreaterThanOrEqual(60);
    });

    it("compiles a comprehensive final session report from turn evaluations", () => {
      const turns = [
        {
          id: "turn-1",
          questionIndex: 1,
          questionText: "Explain how hash table collisions are resolved.",
          questionCategory: "Data Structures",
          isFollowUp: false,
          studentAnswer: "By chaining with linked lists or open addressing like linear probing.",
          answerSubmittedAt: new Date().toISOString(),
          evaluation: {
            overallScore: 85,
            relevanceScore: 90,
            technicalScore: 85,
            depthScore: 80,
            structureScore: 85,
            practicalReasoningScore: 80,
            communicationScore: 90,
            whatWentWell: ["Mentioned separate chaining and linear probing."],
            whatWasMissing: ["Could mention robin hood hashing or load factor threshold."],
            conceptualErrors: [],
            improvedAnswerExample: "Hash collisions occur when...",
            followUpRecommendation: "What happens when load factor exceeds 0.75?",
          },
          createdAt: new Date().toISOString(),
        },
        {
          id: "turn-2",
          questionIndex: 2,
          questionText: "What happens when load factor exceeds 0.75?",
          questionCategory: "Data Structures",
          isFollowUp: true,
          studentAnswer: "We resize the table, usually doubling it, and rehash all elements.",
          answerSubmittedAt: new Date().toISOString(),
          evaluation: {
            overallScore: 90,
            relevanceScore: 95,
            technicalScore: 90,
            depthScore: 85,
            structureScore: 90,
            practicalReasoningScore: 90,
            communicationScore: 90,
            whatWentWell: ["Accurately identified table doubling and element rehashing."],
            whatWasMissing: [],
            conceptualErrors: [],
            improvedAnswerExample: "When the load factor threshold is breached...",
            followUpRecommendation: "Ready for advanced indexing questions.",
          },
          createdAt: new Date().toISOString(),
        },
      ];

      const report = MockInterviewService.compileFinalReport(turns, "Backend Developer", "INTERMEDIATE");

      // Verify overall composite
      expect(report.overallScore).toBe(88); // Round (85 + 90) / 2
      expect(report.relevanceScore).toBe(93); // Round (90 + 95) / 2
      expect(report.technicalAccuracyScore).toBe(88);
      expect(report.depthScore).toBe(83);
      expect(report.strongAnswers.length).toBeGreaterThan(0);
      expect(report.finalFeedbackSummary).toBeTruthy();
      expect(report.suggestedNextLevel).toBe("ADVANCED");
    });
  });
});
