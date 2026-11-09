/**
 * AI Skill Gap Analyzer Service
 * 
 * Conducts personalized skill gap analysis comparing a student's actual
 * profile, verified skills, projects, resume, and assessment records against
 * target job roles and real published college recruitment drives.
 * 
 * Enforces strict evidence classification:
 * - VERIFIED: Confirmed by authorized verification process
 * - ASSESSMENT_SUPPORTED: Supported by verified assessment attempts
 * - PROJECT_SUPPORTED: Backed by completed projects with tech stacks
 * - RESUME_SUPPORTED: Extracted from primary resume document
 * - SELF_REPORTED: Entered by student without external backing
 */

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { GeminiClient } from "@/modules/ai/gemini-client";
import { StudentCareerProfileService } from "./student-career-profile-service";
import { ResumeStorageService } from "./resume-storage-service";

export type SkillEvidenceType =
  | "VERIFIED"
  | "ASSESSMENT_SUPPORTED"
  | "PROJECT_SUPPORTED"
  | "RESUME_SUPPORTED"
  | "SELF_REPORTED";

export interface MatchedSkill {
  name: string;
  category: string;
  evidenceType: SkillEvidenceType;
  studentProficiency: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  relevanceNote: string;
  evidenceDetails?: string;
}

export interface MissingSkill {
  name: string;
  category: string;
  importance: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  isMandatory: boolean;
  whyItMatters: string;
  recommendedAction: string;
}

export interface InsufficientEvidenceSkill {
  name: string;
  currentEvidence: SkillEvidenceType;
  whyInsufficient: string;
  howToValidate: string;
}

export interface RoadmapItem {
  phase: "IMMEDIATE" | "SHORT_TERM" | "MEDIUM_TERM" | "LONG_TERM";
  skill: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
  currentEvidence: string;
  targetLevel: string;
  learningMilestones: string[];
  practicalExercises: string[];
  projectSuggestions: string[];
  completionCriteria: string;
  estimatedEffort: string;
}

export interface SkillGapAnalysisResult {
  id: string;
  studentId: string;
  tenantId: string;
  targetRole: string;
  targetDriveId: string | null;
  targetDriveTitle?: string;
  overallReadinessScore: number;
  summary: string;
  marketContext: string;
  matchedSkills: MatchedSkill[];
  missingRequiredSkills: MissingSkill[];
  missingPreferredSkills: MissingSkill[];
  skillsWithInsufficientEvidence: InsufficientEvidenceSkill[];
  learningRoadmap: RoadmapItem[];
  profileSnapshotHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillProgressItem {
  id: string;
  studentId: string;
  tenantId: string;
  skillName: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "PRACTICED" | "EVIDENCE_SUBMITTED" | "ASSESSMENT_SUPPORTED" | "VERIFIED";
  targetRole?: string | null;
  evidenceLinks: Array<{
    type: "GITHUB" | "PROJECT" | "CERTIFICATE" | "ASSIGNMENT" | "OTHER";
    title: string;
    url: string;
    description?: string;
    submittedAt: string;
  }>;
  notes?: string | null;
  verifiedAt?: string | null;
  updatedAt: string;
}

export class SkillGapAnalyzerService {
  /**
   * Performs an authoritative skill gap analysis for a student and target role / drive.
   */
  public static async analyze(params: {
    tenantId: string;
    studentId: string;
    targetRole: string;
    targetDriveId?: string | null;
    customJobDescription?: string | null;
    forceRefresh?: boolean;
    userId?: string;
  }): Promise<SkillGapAnalysisResult> {
    const admin = createAdminClient();
    const cleanRole = params.targetRole.trim();

    // 1. Fetch Student Career Profile
    const profile = await StudentCareerProfileService.getProfile(params.tenantId, params.studentId);
    if (!profile) {
      throw new Error("Student career profile not found.");
    }

    // 2. Fetch Primary Resume & Analysis Data
    const primaryResume = await ResumeStorageService.getPrimaryResume(params.tenantId, params.studentId);

    // 3. Fetch Drive Information if drive-based
    let driveInfo: any = null;
    if (params.targetDriveId) {
      const { data: drive } = await admin
        .from("recruitment_drives")
        .select(`
          id,
          title,
          job_roles,
          job_description,
          companies (
            name,
            tier
          )
        `)
        .eq("id", params.targetDriveId)
        .eq("tenant_id", params.tenantId)
        .maybeSingle();

      if (drive) {
        driveInfo = {
          id: drive.id,
          title: drive.title,
          companyName: (drive as any).companies?.name || "Target Company",
          jobRoles: drive.job_roles || [],
          description: drive.job_description || "",
        };
      }
    }

    // 4. Fetch Student's Assessment & Mistake Target History for Grounded Evaluation
    // Query actual student assessment attempts with successful scores
    const { data: attempts } = await admin
      .from("assessment_attempts")
      .select(`
        id,
        score_percentage,
        status,
        assessments (
          title,
          tags
        )
      `)
      .eq("tenant_id", params.tenantId)
      .eq("student_id", params.studentId)
      .in("status", ["SUBMITTED", "SCORED", "RESULT_RELEASED"]);

    const demonstratedSkills = new Set<string>();
    if (attempts) {
      for (const att of attempts) {
        if ((att.score_percentage || 0) >= 60 && (att as any).assessments?.tags) {
          for (const tag of (att as any).assessments.tags) {
            demonstratedSkills.add(tag.toLowerCase().trim());
          }
        }
      }
    }

    // Mistake review targets represent weakness areas / areas needing review (NOT proof of mastery)
    const { data: studentMistakes } = await admin
      .from("mistake_review_targets")
      .select(`
        primary_reason,
        occurrence_count,
        canonical_skills (
          name,
          category
        )
      `)
      .eq("tenant_id", params.tenantId)
      .eq("student_id", params.studentId)
      .limit(15);

    const weaknessSkills = new Set<string>();
    if (studentMistakes) {
      for (const m of studentMistakes as any[]) {
        if (m.canonical_skills?.name) {
          weaknessSkills.add(m.canonical_skills.name.toLowerCase().trim());
        }
      }
    }

    // 5. Classify Student Skills with Strict Multi-tier Evidence
    const classifiedStudentSkills = this.classifyStudentSkillEvidence(
      profile,
      primaryResume,
      demonstratedSkills,
      weaknessSkills
    );

    // 6. Compute State Hash for Cache Validation
    const stateInput = `${params.studentId}_${profile.updatedAt || ""}_${primaryResume?.id || "no-resume"}_${primaryResume?.updatedAt || ""}_${cleanRole}_${params.targetDriveId || "no-drive"}_${params.customJobDescription || ""}_att:${demonstratedSkills.size}_mistakes:${weaknessSkills.size}`;
    const snapshotHash = crypto.createHash("sha256").update(stateInput).digest("hex").slice(0, 32);

    // 7. Check Cache unless forceRefresh is true
    if (!params.forceRefresh) {
      const { data: cached } = await admin
        .from("student_skill_gap_analyses")
        .select("*")
        .eq("tenant_id", params.tenantId)
        .eq("student_id", params.studentId)
        .eq("target_role", cleanRole)
        .eq("profile_snapshot_hash", snapshotHash)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        return {
          id: cached.id,
          studentId: cached.student_id,
          tenantId: cached.tenant_id,
          targetRole: cached.target_role,
          targetDriveId: cached.target_drive_id,
          targetDriveTitle: driveInfo?.title,
          overallReadinessScore: cached.overall_readiness_score,
          summary: cached.summary,
          marketContext: cached.market_context || "",
          matchedSkills: (cached.matched_skills as any) || [],
          missingRequiredSkills: (cached.missing_required_skills as any) || [],
          missingPreferredSkills: (cached.missing_preferred_skills as any) || [],
          skillsWithInsufficientEvidence: (cached.skills_with_insufficient_evidence as any) || [],
          learningRoadmap: (cached.learning_roadmap as any) || [],
          profileSnapshotHash: cached.profile_snapshot_hash,
          createdAt: cached.created_at,
          updatedAt: cached.updated_at,
        };
      }
    }

    // 8. Construct Prompt with Grounded Delimited Contexts
    const prompt = this.buildAnalysisPrompt({
      targetRole: cleanRole,
      driveInfo,
      customJobDescription: params.customJobDescription,
      classifiedSkills: classifiedStudentSkills,
      profile,
      primaryResume,
    });

    const systemInstruction = `You are UrPlaced's AI Skill Gap Analyzer & Placement Readiness Engine.
Your task is to conduct an evidence-grounded, professional skill gap evaluation for an engineering collegiate student preparing for campus recruitment.

STRICT EVIDENCE & VERIFICATION RULES:
1. Do NOT treat self-reported skills as verified. If a student wrote a skill in their profile with no project, resume, or assessment backing, its evidence is strictly "SELF_REPORTED".
2. Never infer advanced mastery from keywords. If evidence is thin or lacks code repository links, classify it under "skillsWithInsufficientEvidence".
3. Distinguish mandatory technical requirements from optional/preferred requirements for the target role.
4. Output MUST be valid, well-structured JSON matching the required schema. No conversational preamble.`;

    // 9. Call Gemini AI with Strict Safety & Structured Schema
    const aiResult = await GeminiClient.generate({
      prompt,
      systemInstruction,
      temperature: 0.2,
      maxOutputTokens: 2500,
      feature: "SKILL_GAP_ANALYSIS",
      userId: params.userId,
      tenantId: params.tenantId,
    });

    // 10. Parse & Sanitize Response
    const parsedData = this.parseAIResponse(aiResult.text, cleanRole, classifiedStudentSkills);

    // 11. Persist Analysis into Database
    const { data: saved, error: saveError } = await admin
      .from("student_skill_gap_analyses")
      .insert({
        tenant_id: params.tenantId,
        student_id: params.studentId,
        target_role: cleanRole,
        target_drive_id: params.targetDriveId || null,
        custom_job_description: params.customJobDescription || null,
        overall_readiness_score: parsedData.overallReadinessScore,
        summary: parsedData.summary,
        market_context: parsedData.marketContext,
        matched_skills: parsedData.matchedSkills as any,
        missing_required_skills: parsedData.missingRequiredSkills as any,
        missing_preferred_skills: parsedData.missingPreferredSkills as any,
        skills_with_insufficient_evidence: parsedData.skillsWithInsufficientEvidence as any,
        learning_roadmap: parsedData.learningRoadmap as any,
        profile_snapshot_hash: snapshotHash,
      })
      .select("id, created_at, updated_at")
      .single();

    if (saveError) {
      console.error("[SkillGapAnalyzerService] Error saving analysis:", saveError);
    }

    // 12. Initialize Progress Tracking for Missing & Targeted Skills (if not already tracking)
    await this.syncSkillProgressItems(
      params.tenantId,
      params.studentId,
      cleanRole,
      parsedData.missingRequiredSkills,
      parsedData.learningRoadmap
    );

    return {
      id: saved?.id || "transient-analysis",
      studentId: params.studentId,
      tenantId: params.tenantId,
      targetRole: cleanRole,
      targetDriveId: params.targetDriveId || null,
      targetDriveTitle: driveInfo?.title,
      overallReadinessScore: parsedData.overallReadinessScore,
      summary: parsedData.summary,
      marketContext: parsedData.marketContext,
      matchedSkills: parsedData.matchedSkills,
      missingRequiredSkills: parsedData.missingRequiredSkills,
      missingPreferredSkills: parsedData.missingPreferredSkills,
      skillsWithInsufficientEvidence: parsedData.skillsWithInsufficientEvidence,
      learningRoadmap: parsedData.learningRoadmap,
      profileSnapshotHash: snapshotHash,
      createdAt: saved?.created_at || new Date().toISOString(),
      updatedAt: saved?.updated_at || new Date().toISOString(),
    };
  }

  /**
   * Classifies student skills based on authentic evidence sources.
   */
  public static classifyStudentSkillEvidence(
    profile: any,
    primaryResume: any,
    demonstratedSkills: Set<string> | any[],
    weaknessSkills: Set<string> = new Set()
  ): Array<{
    name: string;
    category: string;
    evidenceType: SkillEvidenceType;
    proficiency: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
    evidenceDetails: string;
  }> {
    const classified: Map<string, any> = new Map();
    const resumeText = (primaryResume?.parsed_text || "").toLowerCase();

    // 1. Projects Tech Stacks (PROJECT_SUPPORTED)
    const projectSkills = new Set<string>();
    for (const proj of profile.projects || []) {
      for (const tech of proj.technologies || []) {
        projectSkills.add(tech.toLowerCase().trim());
      }
    }

    // Convert demonstratedSkills if passed as array (backward compatibility)
    const demonstratedSet = demonstratedSkills instanceof Set
      ? demonstratedSkills
      : new Set((demonstratedSkills || []).map((s: any) => (typeof s === "string" ? s : s.skill || "").toLowerCase().trim()));

    // 3. Technical Skills in Profile
    for (const s of profile.technicalSkills || []) {
      const sNameLower = s.name.toLowerCase().trim();
      let evType: SkillEvidenceType = "SELF_REPORTED";
      let details = "Self-reported in career profile";

      if (s.isVerified) {
        evType = "VERIFIED";
        details = "Officially verified via institutional evaluation";
      } else if (demonstratedSet.has(sNameLower)) {
        evType = "ASSESSMENT_SUPPORTED";
        details = "Supported by passing scores in completed placement assessments";
      } else if (projectSkills.has(sNameLower)) {
        evType = "PROJECT_SUPPORTED";
        details = "Implemented in documented student projects with source reference";
      } else if (resumeText.includes(sNameLower)) {
        evType = "RESUME_SUPPORTED";
        details = "Detected and extracted from primary verified resume document";
      }

      if (weaknessSkills.has(sNameLower)) {
        details += " (Flagged in mistake bank for review)";
      }

      classified.set(sNameLower, {
        name: s.name,
        category: s.category || "TECHNICAL",
        evidenceType: evType,
        proficiency: s.proficiency || "INTERMEDIATE",
        evidenceDetails: details,
      });
    }

    // 4. Incorporate Soft Skills
    for (const ss of profile.softSkills || []) {
      const ssNameLower = ss.name.toLowerCase().trim();
      if (!classified.has(ssNameLower)) {
        classified.set(ssNameLower, {
          name: ss.name,
          category: "SOFT_SKILL",
          evidenceType: "SELF_REPORTED",
          proficiency: ss.proficiency || "INTERMEDIATE",
          evidenceDetails: "Self-reported soft skill in career profile",
        });
      }
    }

    return Array.from(classified.values());
  }

  /**
   * Builds the structured prompt for Gemini.
   */
  private static buildAnalysisPrompt(inputs: {
    targetRole: string;
    driveInfo: any;
    customJobDescription?: string | null;
    classifiedSkills: any[];
    profile: any;
    primaryResume: any;
  }): string {
    const studentInfo = {
      degree: inputs.profile.degree,
      department: inputs.profile.departmentName,
      cgpa: inputs.profile.cgpa,
      graduationYear: inputs.profile.graduationYear,
      skills: inputs.classifiedSkills.map((s) => ({
        name: s.name,
        category: s.category,
        evidence: s.evidenceType,
        proficiency: s.proficiency,
      })),
      projects: (inputs.profile.projects || []).map((p: any) => ({
        title: p.title,
        description: p.description?.slice(0, 180),
        technologies: p.technologies,
        hasGithub: Boolean(p.githubUrl),
      })),
      experienceCount: (inputs.profile.experience || []).length,
      certificationsCount: (inputs.profile.certifications || []).length,
      hasResume: Boolean(inputs.primaryResume),
    };

    let targetContext = `Target Job Role: ${inputs.targetRole}\n`;
    if (inputs.driveInfo) {
      targetContext += `Target Company: ${inputs.driveInfo.companyName}\n`;
      targetContext += `Campus Recruitment Drive: ${inputs.driveInfo.title}\n`;
      targetContext += `Drive Description & Requirements: ${inputs.driveInfo.description?.slice(0, 500)}\n`;
    }
    if (inputs.customJobDescription) {
      targetContext += `Specific Job Description:\n${inputs.customJobDescription.slice(0, 800)}\n`;
    }

    return `<target_career_context>
${targetContext}
</target_career_context>

<student_evidence_profile>
${JSON.stringify(studentInfo, null, 2)}
</student_evidence_profile>

Evaluate the student against the target career requirements.
Output MUST be valid JSON formatted exactly as:
{
  "overallReadinessScore": number (0-100),
  "summary": string (Concise 2-3 sentence readiness diagnostic),
  "marketContext": string (Current placement expectations for this role in collegiate hiring),
  "matchedSkills": [
    {
      "name": string,
      "category": string,
      "evidenceType": "VERIFIED" | "ASSESSMENT_SUPPORTED" | "PROJECT_SUPPORTED" | "RESUME_SUPPORTED" | "SELF_REPORTED",
      "studentProficiency": "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
      "relevanceNote": string
    }
  ],
  "missingRequiredSkills": [
    {
      "name": string,
      "category": string,
      "importance": "CRITICAL" | "HIGH",
      "isMandatory": true,
      "whyItMatters": string,
      "recommendedAction": string
    }
  ],
  "missingPreferredSkills": [
    {
      "name": string,
      "category": string,
      "importance": "MEDIUM" | "LOW",
      "isMandatory": false,
      "whyItMatters": string,
      "recommendedAction": string
    }
  ],
  "skillsWithInsufficientEvidence": [
    {
      "name": string,
      "currentEvidence": "SELF_REPORTED",
      "whyInsufficient": string,
      "howToValidate": string
    }
  ],
  "learningRoadmap": [
    {
      "phase": "IMMEDIATE" | "SHORT_TERM" | "MEDIUM_TERM" | "LONG_TERM",
      "skill": string,
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "reason": string,
      "currentEvidence": string,
      "targetLevel": string,
      "learningMilestones": [string, string],
      "practicalExercises": [string, string],
      "projectSuggestions": [string],
      "completionCriteria": string,
      "estimatedEffort": string (e.g. "1-2 weeks (Estimated)")
    }
  ]
}`;
  }

  /**
   * Robust parser for Gemini JSON response with graceful fallback.
   */
  private static parseAIResponse(
    rawText: string,
    targetRole: string,
    classifiedSkills: any[]
  ): {
    overallReadinessScore: number;
    summary: string;
    marketContext: string;
    matchedSkills: MatchedSkill[];
    missingRequiredSkills: MissingSkill[];
    missingPreferredSkills: MissingSkill[];
    skillsWithInsufficientEvidence: InsufficientEvidenceSkill[];
    learningRoadmap: RoadmapItem[];
  } {
    try {
      let cleaned = rawText.trim();
      if (cleaned.startsWith("```json")) {
        cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
      } else if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```\s*/i, "").replace(/```\s*$/i, "");
      }

      const parsed = JSON.parse(cleaned);

      return {
        overallReadinessScore: Math.min(100, Math.max(0, Number(parsed.overallReadinessScore) || 50)),
        summary: parsed.summary || `Personalized skill gap evaluation for ${targetRole}.`,
        marketContext: parsed.marketContext || `Recruitment benchmarks for ${targetRole} positions.`,
        matchedSkills: Array.isArray(parsed.matchedSkills) ? parsed.matchedSkills : [],
        missingRequiredSkills: Array.isArray(parsed.missingRequiredSkills) ? parsed.missingRequiredSkills : [],
        missingPreferredSkills: Array.isArray(parsed.missingPreferredSkills) ? parsed.missingPreferredSkills : [],
        skillsWithInsufficientEvidence: Array.isArray(parsed.skillsWithInsufficientEvidence)
          ? parsed.skillsWithInsufficientEvidence
          : [],
        learningRoadmap: Array.isArray(parsed.learningRoadmap) ? parsed.learningRoadmap : [],
      };
    } catch (err) {
      console.warn("[SkillGapAnalyzerService] JSON parse error, generating deterministic fallback:", err);
      return this.generateDeterministicFallback(targetRole, classifiedSkills);
    }
  }

  /**
   * Deterministic fallback if Gemini returns unparseable text.
   */
  private static generateDeterministicFallback(
    targetRole: string,
    classifiedSkills: any[]
  ) {
    const matched: MatchedSkill[] = classifiedSkills.slice(0, 4).map((s) => ({
      name: s.name,
      category: s.category,
      evidenceType: s.evidenceType,
      studentProficiency: s.proficiency,
      relevanceNote: `Applicable to core ${targetRole} responsibilities.`,
      evidenceDetails: s.evidenceDetails,
    }));

    return {
      overallReadinessScore: matched.length > 0 ? Math.min(85, matched.length * 20) : 40,
      summary: `Diagnostic evaluation of student profile against standard ${targetRole} benchmarks.`,
      marketContext: `${targetRole} roles require practical proficiency in system design, robust testing, and modern frameworks.`,
      matchedSkills: matched,
      missingRequiredSkills: [
        {
          name: "System Architecture & Design Patterns",
          category: "ARCHITECTURE",
          importance: "HIGH" as const,
          isMandatory: true,
          whyItMatters: "Crucial for passing technical rounds and architecting scalable solutions.",
          recommendedAction: "Build a production-grade project demonstrating microservices or clean architecture.",
        },
      ],
      missingPreferredSkills: [
        {
          name: "CI/CD & Cloud Deployment",
          category: "DEVOPS",
          importance: "MEDIUM" as const,
          isMandatory: false,
          whyItMatters: "Distinguishes high-performing candidates during placement interview debriefs.",
          recommendedAction: "Deploy student projects using Docker and automated GitHub Actions.",
        },
      ],
      skillsWithInsufficientEvidence: classifiedSkills
        .filter((s) => s.evidenceType === "SELF_REPORTED")
        .slice(0, 3)
        .map((s) => ({
          name: s.name,
          currentEvidence: "SELF_REPORTED" as const,
          whyInsufficient: "Listed only as a profile keyword without linked GitHub code or assessment verification.",
          howToValidate: `Commit a repository project utilizing ${s.name} or clear an authorized placement assessment.`,
        })),
      learningRoadmap: [
        {
          phase: "IMMEDIATE" as const,
          skill: "Core Data Structures & Algorithmic Problem Solving",
          priority: "HIGH" as const,
          reason: "Foundational requirement for coding rounds in all tier placement drives.",
          currentEvidence: "Preliminary practice",
          targetLevel: "Intermediate / LeetCode Medium",
          learningMilestones: ["Master two-pointers & sliding window", "Implement dynamic programming state transitions"],
          practicalExercises: ["Solve 15 targeted array problems", "Practice 10 graph traversal patterns"],
          projectSuggestions: ["Implement an in-memory caching engine"],
          completionCriteria: "Achieve >= 80% on mock placement assessment",
          estimatedEffort: "2-3 weeks (Estimated)",
        },
        {
          phase: "SHORT_TERM" as const,
          skill: "End-to-End Project Development",
          priority: "HIGH" as const,
          reason: "Essential for technical interview discussions.",
          currentEvidence: "Self-directed study",
          targetLevel: "Production-ready",
          learningMilestones: ["Build REST API backend", "Integrate authentication & relational persistence"],
          practicalExercises: ["Write unit test coverage", "Document README architecture diagram"],
          projectSuggestions: [`Complete a comprehensive ${targetRole} portfolio project`],
          completionCriteria: "Public GitHub repository with active commit history",
          estimatedEffort: "3-4 weeks (Estimated)",
        },
      ],
    };
  }

  /**
   * Synchronizes missing & roadmap skills to the student_skill_progress tracking table.
   */
  private static async syncSkillProgressItems(
    tenantId: string,
    studentId: string,
    targetRole: string,
    missingSkills: MissingSkill[],
    roadmap: RoadmapItem[]
  ): Promise<void> {
    const admin = createAdminClient();
    const skillsToTrack = new Set<string>();

    for (const m of missingSkills) {
      if (m.name) skillsToTrack.add(m.name.trim());
    }
    for (const r of roadmap) {
      if (r.skill) skillsToTrack.add(r.skill.trim());
    }

    for (const skillName of skillsToTrack) {
      try {
        await admin
          .from("student_skill_progress")
          .insert({
            tenant_id: tenantId,
            student_id: studentId,
            skill_name: skillName,
            status: "NOT_STARTED",
            target_role: targetRole,
            evidence_links: [],
          })
          .select("id")
          .single();
      } catch {
        // Unique constraint ignore
      }
    }
  }

  /**
   * Fetches the latest skill gap analysis for a student.
   */
  public static async getLatestAnalysis(
    tenantId: string,
    studentId: string,
    targetRole?: string
  ): Promise<SkillGapAnalysisResult | null> {
    const admin = createAdminClient();

    try {
      let query = admin
        .from("student_skill_gap_analyses")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });

      if (targetRole) {
        query = query.eq("target_role", targetRole.trim());
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error) {
        console.error("[SkillGapAnalyzerService] getLatestAnalysis query error:", error);
        return null;
      }
      if (!data) return null;

      return {
        id: data.id,
        studentId: data.student_id,
        tenantId: data.tenant_id,
        targetRole: data.target_role,
        targetDriveId: data.target_drive_id,
        overallReadinessScore: data.overall_readiness_score,
        summary: data.summary,
        marketContext: data.market_context || "",
        matchedSkills: (data.matched_skills as any) || [],
        missingRequiredSkills: (data.missing_required_skills as any) || [],
        missingPreferredSkills: (data.missing_preferred_skills as any) || [],
        skillsWithInsufficientEvidence: (data.skills_with_insufficient_evidence as any) || [],
        learningRoadmap: (data.learning_roadmap as any) || [],
        profileSnapshotHash: data.profile_snapshot_hash,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    } catch (err) {
      console.error("[SkillGapAnalyzerService] getLatestAnalysis uncaught exception:", err);
      return null;
    }
  }

  /**
   * Fetches skill progress items for a student.
   */
  public static async getSkillProgress(
    tenantId: string,
    studentId: string
  ): Promise<{
    items: SkillProgressItem[];
    summary: {
      totalTargeted: number;
      inProgress: number;
      practiced: number;
      evidenceSubmitted: number;
      verified: number;
      completionRate: number;
    };
  }> {
    const defaultSummary = {
      totalTargeted: 0,
      inProgress: 0,
      practiced: 0,
      evidenceSubmitted: 0,
      verified: 0,
      completionRate: 0,
    };

    const admin = createAdminClient();

    try {
      const { data: rows, error } = await admin
        .from("student_skill_progress")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId)
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("[SkillGapAnalyzerService] getSkillProgress query error:", error);
        return { items: [], summary: defaultSummary };
      }

      const items: SkillProgressItem[] = (rows || []).map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        tenantId: r.tenant_id,
        skillName: r.skill_name,
        status: r.status,
        targetRole: r.target_role,
        evidenceLinks: Array.isArray(r.evidence_links) ? r.evidence_links : [],
        notes: r.notes,
        verifiedAt: r.verified_at,
        updatedAt: r.updated_at,
      }));

      const total = items.length;
      const inProgress = items.filter((i) => i.status === "IN_PROGRESS").length;
      const practiced = items.filter((i) => i.status === "PRACTICED").length;
      const evidenceSubmitted = items.filter((i) => i.status === "EVIDENCE_SUBMITTED").length;
      const verified = items.filter((i) => i.status === "VERIFIED").length;
      const completed = practiced + evidenceSubmitted + verified;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        items,
        summary: {
          totalTargeted: total,
          inProgress,
          practiced,
          evidenceSubmitted,
          verified,
          completionRate,
        },
      };
    } catch (err) {
      console.error("[SkillGapAnalyzerService] getSkillProgress uncaught exception:", err);
      return { items: [], summary: defaultSummary };
    }
  }

  /**
   * Updates progress status or attaches evidence to a skill.
   */
  public static async updateSkillProgress(params: {
    tenantId: string;
    studentId: string;
    skillName: string;
    status?: "NOT_STARTED" | "IN_PROGRESS" | "PRACTICED" | "EVIDENCE_SUBMITTED";
    evidenceLink?: {
      type: "GITHUB" | "PROJECT" | "CERTIFICATE" | "ASSIGNMENT" | "OTHER";
      title: string;
      url: string;
      description?: string;
    };
    notes?: string;
  }): Promise<SkillProgressItem> {
    const admin = createAdminClient();

    // Fetch existing
    const { data: existing } = await admin
      .from("student_skill_progress")
      .select("*")
      .eq("tenant_id", params.tenantId)
      .eq("student_id", params.studentId)
      .eq("skill_name", params.skillName.trim())
      .maybeSingle();

    let evidenceLinks = existing ? (existing.evidence_links as any[]) || [] : [];
    if (params.evidenceLink) {
      evidenceLinks = [
        {
          ...params.evidenceLink,
          submittedAt: new Date().toISOString(),
        },
        ...evidenceLinks,
      ];
    }

    const newStatus =
      params.status || (params.evidenceLink ? "EVIDENCE_SUBMITTED" : existing?.status || "IN_PROGRESS");

    // Student cannot self-upgrade to VERIFIED
    const safeStatus = newStatus === "VERIFIED" ? "EVIDENCE_SUBMITTED" : newStatus;

    if (existing) {
      const { data: updated, error } = await admin
        .from("student_skill_progress")
        .update({
          status: safeStatus,
          evidence_links: evidenceLinks,
          notes: params.notes !== undefined ? params.notes : existing.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error || !updated) {
        throw new Error(error?.message || "Failed to update skill progress.");
      }

      return {
        id: updated.id,
        studentId: updated.student_id,
        tenantId: updated.tenant_id,
        skillName: updated.skill_name,
        status: updated.status as any,
        targetRole: updated.target_role,
        evidenceLinks: updated.evidence_links as any,
        notes: updated.notes,
        verifiedAt: updated.verified_at,
        updatedAt: updated.updated_at,
      };
    } else {
      const { data: inserted, error } = await admin
        .from("student_skill_progress")
        .insert({
          tenant_id: params.tenantId,
          student_id: params.studentId,
          skill_name: params.skillName.trim(),
          status: safeStatus,
          evidence_links: evidenceLinks,
          notes: params.notes || null,
        })
        .select("*")
        .single();

      if (error || !inserted) {
        throw new Error(error?.message || "Failed to create skill progress.");
      }

      return {
        id: inserted.id,
        studentId: inserted.student_id,
        tenantId: inserted.tenant_id,
        skillName: inserted.skill_name,
        status: inserted.status as any,
        targetRole: inserted.target_role,
        evidenceLinks: inserted.evidence_links as any,
        notes: inserted.notes,
        verifiedAt: inserted.verified_at,
        updatedAt: inserted.updated_at,
      };
    }
  }

  /**
   * Deterministically classifies skill evidence across the 5 authoritative tiers.
   */
  public static determineSkillEvidenceTier(params: {
    skillName: string;
    studentAssessments?: Array<{ skillName: string; score: number; isCollegeVerified?: boolean }>;
    studentProjects?: Array<{ title: string; technologies: string[] }>;
    resumeSkills?: string[];
    selfReportedSkills?: Array<{ name: string; proficiency?: string }>;
  }): SkillEvidenceType | "MISSING" {
    const sName = params.skillName.toLowerCase().trim();

    // 1. Authoritative Verified Campus Assessment
    const verifiedAssessment = (params.studentAssessments || []).find(
      (a) => a.skillName.toLowerCase().trim() === sName && a.isCollegeVerified
    );
    if (verifiedAssessment) return "VERIFIED";

    // 2. High Score in Placement Assessment (>= 70)
    const passedAssessment = (params.studentAssessments || []).find(
      (a) => a.skillName.toLowerCase().trim() === sName && a.score >= 70
    );
    if (passedAssessment) return "ASSESSMENT_SUPPORTED";

    // 3. Implemented in Documented Student Projects
    const projectMatch = (params.studentProjects || []).find((p) =>
      p.technologies.some((t) => t.toLowerCase().trim() === sName)
    );
    if (projectMatch) return "PROJECT_SUPPORTED";

    // 4. Detected in Resume Document
    const resumeMatch = (params.resumeSkills || []).some(
      (r) => r.toLowerCase().trim() === sName
    );
    if (resumeMatch) return "RESUME_SUPPORTED";

    // 5. Self-Reported in Career Profile
    const selfReportedMatch = (params.selfReportedSkills || []).some(
      (s) => s.name.toLowerCase().trim() === sName
    );
    if (selfReportedMatch) return "SELF_REPORTED";

    return "MISSING";
  }

  /**
   * Builds structured 4-phase learning milestones with effort estimates.
   */
  public static buildPhasedRoadmap(
    missingSkills: Array<{
      skillName: string;
      category?: string;
      importance?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
      prerequisites?: string[];
    }>,
    targetRole: string
  ): Array<{
    phase: "IMMEDIATE" | "SHORT_TERM" | "MEDIUM_TERM" | "LONG_TERM";
    timeframeWeeks: string;
    milestones: Array<{
      skillName: string;
      learningObjective: string;
      estimatedEffortHours: number;
      recommendedPractice: string;
    }>;
  }> {
    const critical = missingSkills.filter((s) => s.importance === "CRITICAL");
    const high = missingSkills.filter((s) => s.importance === "HIGH");
    const medium = missingSkills.filter((s) => s.importance === "MEDIUM" || !s.importance);
    const low = missingSkills.filter((s) => s.importance === "LOW");

    return [
      {
        phase: "IMMEDIATE",
        timeframeWeeks: "Weeks 1–2",
        milestones: (critical.length > 0 ? critical : high.slice(0, 2)).map((s) => ({
          skillName: s.skillName,
          learningObjective: `Master core prerequisites and syntax patterns for ${s.skillName}.`,
          estimatedEffortHours: 14,
          recommendedPractice: `Complete foundational exercises in ${s.skillName} and implement hello-world workflows.`,
        })),
      },
      {
        phase: "SHORT_TERM",
        timeframeWeeks: "Weeks 3–4",
        milestones: (high.length > 0 ? high : medium.slice(0, 2)).map((s) => ({
          skillName: s.skillName,
          learningObjective: `Build standard application patterns and integrate ${s.skillName} into a mini-project.`,
          estimatedEffortHours: 20,
          recommendedPractice: `Build a tested CRUD service demonstrating idiomatic usage of ${s.skillName}.`,
        })),
      },
      {
        phase: "MEDIUM_TERM",
        timeframeWeeks: "Weeks 5–8",
        milestones: (medium.length > 0 ? medium : low).map((s) => ({
          skillName: s.skillName,
          learningObjective: `Develop production-grade engineering mastery in ${s.skillName} aligned with ${targetRole}.`,
          estimatedEffortHours: 25,
          recommendedPractice: `Implement complex state handling, error boundaries, and telemetry for ${s.skillName}.`,
        })),
      },
      {
        phase: "LONG_TERM",
        timeframeWeeks: "Weeks 9–12",
        milestones: [
          {
            skillName: `End-to-End ${targetRole} Capstone`,
            learningObjective: `Integrate full technology stack into a portfolio capstone system with live deployment.`,
            estimatedEffortHours: 35,
            recommendedPractice: `Architect, deploy, and benchmark a complete distributed microservice matching campus hiring cutoffs.`,
          },
        ],
      },
    ];
  }

  /**
   * Calculates overall readiness score (0-100) based on matched, missing, and verified skills.
   */
  public static calculateReadinessScore(params: {
    totalRequiredSkills: number;
    matchedSkillsCount: number;
    missingCriticalCount: number;
    missingHighCount: number;
    verifiedSkillsCount: number;
  }): number {
    const total = Math.max(1, params.totalRequiredSkills);
    const baseMatchRatio = params.matchedSkillsCount / total;
    let score = baseMatchRatio * 80;

    // Add bonus for verified institutional assessments (up to +20)
    const verifiedBonus = Math.min(20, (params.verifiedSkillsCount / total) * 20);
    score += verifiedBonus;

    // Deductions for missing critical and high importance competencies
    const criticalPenalty = params.missingCriticalCount * 15;
    const highPenalty = params.missingHighCount * 8;
    score -= criticalPenalty + highPenalty;

    return Math.round(Math.min(100, Math.max(5, score)));
  }
}
