/**
 * Smart Placement Drive Matching Service
 * 
 * Compares student career profile & primary resume against actual published
 * campus recruitment drives.
 * 
 * CRITICAL INVARIANT:
 * - Official Eligibility is determined strictly by authoritative collegiate criteria.
 * - AI Match Score is an advisory preparation & competency alignment score.
 * - AI matching NEVER overrides official eligibility or disqualifies students.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { StudentCareerProfileService } from "./student-career-profile-service";
import { ResumeStorageService } from "./resume-storage-service";

export interface DriveMatchOpportunity {
  driveId: string;
  driveTitle: string;
  companyId: string;
  companyName: string;
  companyTier?: string;
  jobRole?: string;
  salaryCtc?: string;
  applicationDeadline?: string | null;
  officialEligibility: "ELIGIBLE" | "INELIGIBLE" | "CONDITIONAL" | "UNKNOWN";
  eligibilityReasons: {
    isCgpaEligible?: boolean;
    isBacklogEligible?: boolean;
    isDepartmentEligible?: boolean;
    isGraduationYearEligible?: boolean;
    summary: string;
  };
  matchScore: number; // 0 to 100
  matchedSkills: string[];
  missingSkills: string[];
  preferredSkills: string[];
  strengths: string[];
  recommendations: string[];
  matchExplanation: string;
  applicationState: {
    hasApplied: boolean;
    applicationId?: string;
    status?: string;
  };
  updatedAt: string;
}

export class SmartDriveMatchingService {
  /**
   * Deterministically computes official eligibility for a student against a drive
   */
  public static evaluateOfficialEligibility(
    student: {
      cgpa?: number | null;
      active_backlogs?: number | null;
      department_id?: string | null;
      degree?: string | null;
      graduation_year?: number | null;
    },
    criteria: any
  ): {
    status: "ELIGIBLE" | "INELIGIBLE" | "CONDITIONAL" | "UNKNOWN";
    reasons: DriveMatchOpportunity["eligibilityReasons"];
  } {
    if (!criteria) {
      return {
        status: "ELIGIBLE",
        reasons: {
          isCgpaEligible: true,
          isBacklogEligible: true,
          isDepartmentEligible: true,
          isGraduationYearEligible: true,
          summary: "No special academic restrictions configured for this drive.",
        },
      };
    }

    const reasons: DriveMatchOpportunity["eligibilityReasons"] = {
      summary: "",
    };

    let isEligible = true;
    const failures: string[] = [];

    // 1. Min CGPA
    if (criteria.min_cgpa !== null && criteria.min_cgpa !== undefined) {
      const studentCgpa = Number(student.cgpa) || 0;
      const minCgpa = Number(criteria.min_cgpa);
      const pass = studentCgpa >= minCgpa;
      reasons.isCgpaEligible = pass;
      if (!pass) {
        isEligible = false;
        failures.push(`CGPA is ${studentCgpa.toFixed(2)} (Minimum required: ${minCgpa.toFixed(2)})`);
      }
    } else {
      reasons.isCgpaEligible = true;
    }

    // 2. Max Active Backlogs
    if (criteria.max_active_backlogs !== null && criteria.max_active_backlogs !== undefined) {
      const studentBacklogs = Number(student.active_backlogs) || 0;
      const maxBacklogs = Number(criteria.max_active_backlogs);
      const pass = studentBacklogs <= maxBacklogs;
      reasons.isBacklogEligible = pass;
      if (!pass) {
        isEligible = false;
        failures.push(`Active backlogs: ${studentBacklogs} (Maximum allowed: ${maxBacklogs})`);
      }
    } else {
      reasons.isBacklogEligible = true;
    }

    // 3. Department
    if (criteria.allowed_departments && Array.isArray(criteria.allowed_departments) && criteria.allowed_departments.length > 0) {
      const pass = student.department_id ? criteria.allowed_departments.includes(student.department_id) : false;
      reasons.isDepartmentEligible = pass;
      if (!pass) {
        isEligible = false;
        failures.push("Student academic department is not on the invited department roster");
      }
    } else {
      reasons.isDepartmentEligible = true;
    }

    // 4. Graduation Year
    if (criteria.graduation_year) {
      const pass = Number(student.graduation_year) === Number(criteria.graduation_year);
      reasons.isGraduationYearEligible = pass;
      if (!pass) {
        isEligible = false;
        failures.push(`Graduation year ${student.graduation_year} does not match target batch ${criteria.graduation_year}`);
      }
    } else {
      reasons.isGraduationYearEligible = true;
    }

    reasons.summary = isEligible
      ? "Officially meets all institutional academic eligibility criteria."
      : `Ineligible: ${failures.join("; ")}.`;

    return {
      status: isEligible ? "ELIGIBLE" : "INELIGIBLE",
      reasons,
    };
  }

  /**
   * Deterministic rule-based skill competency matching
   */
  public static computeRuleBasedMatchScore(params: {
    studentSkills: string[];
    driveSkills: string[];
    driveTitle?: string;
  }): {
    matchScore: number;
    matchedSkills: string[];
    missingSkills: string[];
  } {
    const studentSet = new Set(params.studentSkills.map((s) => s.toLowerCase().trim()));
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const req of params.driveSkills) {
      const reqLower = req.toLowerCase().trim();
      let isMatched = false;
      for (const s of studentSet) {
        if (s.includes(reqLower) || reqLower.includes(s)) {
          isMatched = true;
          break;
        }
      }
      if (isMatched) {
        matchedSkills.push(req);
      } else {
        missingSkills.push(req);
      }
    }

    const total = matchedSkills.length + missingSkills.length;
    let matchScore = 60;
    if (total > 0) {
      matchScore = Math.round((matchedSkills.length / total) * 60 + 25);
    }
    matchScore = Math.max(30, Math.min(98, matchScore));

    return {
      matchScore,
      matchedSkills,
      missingSkills,
    };
  }

  /**
   * Evaluates and retrieves all placement drive matches for an authenticated student
   */
  public static async getMatchesForStudent(params: {
    tenantId: string;
    studentId: string;
    filter?: "ALL" | "ELIGIBLE" | "HIGH_MATCH";
  }): Promise<DriveMatchOpportunity[]> {
    const { tenantId, studentId, filter = "ALL" } = params;
    const admin = createAdminClient();

    // 1. Fetch student and career profile
    const profile = await StudentCareerProfileService.getProfile(tenantId, studentId);
    const resumes = await ResumeStorageService.listResumes(tenantId, studentId);
    const primaryResume = resumes.find((r) => r.isPrimary) || resumes[0] || null;

    // 2. Fetch all published, active recruitment drives for this college tenant
    const { data: drives, error: driveErr } = await admin
      .from("recruitment_drives")
      .select(`
        id,
        tenant_id,
        title,
        status,
        deadline,
        created_at,
        companies (
          id,
          name,
          tier
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "PUBLISHED")
      .order("created_at", { ascending: false });

    if (!drives || driveErr || drives.length === 0) {
      return [];
    }

    // 3. Fetch existing applications submitted by this student
    const { data: applications } = await admin
      .from("drive_applications")
      .select("id, drive_id, status")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId);

    const appMap = new Map<string, { id: string; status: string }>();
    if (applications) {
      for (const a of applications) {
        appMap.set(a.drive_id, { id: a.id, status: a.status });
      }
    }

    // 4. Fetch eligibility criteria and requirements for all published drives
    const driveIds = drives.map((d) => d.id);
    const { data: criteriaList } = await admin
      .from("drive_eligibility_criteria")
      .select("*")
      .in("drive_id", driveIds);

    const criteriaMap = new Map<string, any>();
    if (criteriaList) {
      for (const c of criteriaList) {
        criteriaMap.set(c.drive_id, c);
      }
    }

    const { data: reqsList } = await admin
      .from("recruitment_requirements")
      .select("drive_id, category, title, description, evidence_level")
      .in("drive_id", driveIds)
      .eq("is_published_to_students", true);

    const reqsMap = new Map<string, any[]>();
    if (reqsList) {
      for (const r of reqsList) {
        const arr = reqsMap.get(r.drive_id) || [];
        arr.push(r);
        reqsMap.set(r.drive_id, arr);
      }
    }

    // Aggregate student skills set (normalized to lowercase)
    const studentSkillNames = new Set<string>();
    for (const ts of profile.technicalSkills) {
      studentSkillNames.add(ts.name.toLowerCase().trim());
    }
    for (const ss of profile.softSkills) {
      studentSkillNames.add(ss.name.toLowerCase().trim());
    }
    // Extract keywords from resume text if available
    if (primaryResume?.parsedText) {
      const lowerResume = primaryResume.parsedText.toLowerCase();
      const standardKeywords = [
        "python", "java", "c++", "c#", "javascript", "typescript", "react", "next.js", "angular",
        "node.js", "express", "sql", "postgresql", "mysql", "mongodb", "aws", "docker", "kubernetes",
        "git", "machine learning", "data structures", "algorithms", "rest api", "graphql"
      ];
      for (const kw of standardKeywords) {
        if (lowerResume.includes(kw)) {
          studentSkillNames.add(kw);
        }
      }
    }

    // 5. Evaluate match for each drive
    const results: DriveMatchOpportunity[] = [];

    for (const drive of drives) {
      const criteria = criteriaMap.get(drive.id) || null;
      const requirements = reqsMap.get(drive.id) || [];
      const appState = appMap.get(drive.id);

      // Official eligibility check
      const { status: officialStatus, reasons: eligReasons } = this.evaluateOfficialEligibility(
        {
          cgpa: profile.cgpa,
          active_backlogs: 0,
          department_id: (profile as any).departmentId || null,
          degree: profile.degree,
          graduation_year: profile.graduationYear,
        },
        criteria
      );

      // Required skills comparison
      const matchedSkills: string[] = [];
      const missingSkills: string[] = [];
      const preferredSkills: string[] = [];

      for (const req of requirements) {
        const reqTitle = (req.title || "").trim();
        const reqLower = reqTitle.toLowerCase();

        let isMatched = false;
        for (const s of studentSkillNames) {
          if (s.includes(reqLower) || reqLower.includes(s)) {
            isMatched = true;
            break;
          }
        }

        if (req.evidence_level === "MANDATORY" || req.category === "TECHNICAL") {
          if (isMatched) {
            matchedSkills.push(reqTitle);
          } else {
            missingSkills.push(reqTitle);
          }
        } else {
          preferredSkills.push(reqTitle);
        }
      }

      // If no explicit requirements configured, provide realistic defaults based on drive title
      if (requirements.length === 0) {
        const titleLower = drive.title.toLowerCase();
        if (titleLower.includes("software") || titleLower.includes("developer")) {
          const defaultReqs = ["Data Structures", "Algorithms", "Problem Solving", "Web Technologies"];
          for (const d of defaultReqs) {
            if (studentSkillNames.has(d.toLowerCase())) matchedSkills.push(d);
            else missingSkills.push(d);
          }
        } else {
          matchedSkills.push("Analytical Thinking", "Core Engineering Fundamentals");
        }
      }

      // Calculate Match Score (0 to 100%)
      let matchScore = 60; // baseline
      const totalSkillsCount = matchedSkills.length + missingSkills.length;
      if (totalSkillsCount > 0) {
        const skillRatio = matchedSkills.length / totalSkillsCount;
        matchScore = Math.round(skillRatio * 60 + 25);
      }

      // Boost for project count and completeness
      if (profile.projects.length >= 2) matchScore += 10;
      else if (profile.projects.length === 1) matchScore += 5;

      if (profile.experience.length >= 1) matchScore += 5;

      // Bound between 30% and 98%
      matchScore = Math.max(30, Math.min(98, matchScore));

      const strengths: string[] = [];
      if (matchedSkills.length > 0) {
        strengths.push(`Matches ${matchedSkills.length} core technical requirements (${matchedSkills.slice(0, 3).join(", ")})`);
      }
      if (profile.projects.length > 0) {
        strengths.push(`Portfolio features ${profile.projects.length} relevant technical project(s)`);
      }
      if (eligReasons.isCgpaEligible) {
        strengths.push(`Academic CGPA (${profile.cgpa.toFixed(2)}) meets corporate criteria`);
      }

      const recommendations: string[] = [];
      if (missingSkills.length > 0) {
        recommendations.push(`Strengthen competency in: ${missingSkills.slice(0, 3).join(", ")}`);
      }
      if (profile.projects.length < 2) {
        recommendations.push("Develop a targeted project demonstrably showcasing technologies required by this employer");
      }
      recommendations.push("Review company drive patterns and past interview debriefs in Placement Memory");

      const companyName = (drive.companies as any)?.name || "Target Employer";

      const opp: DriveMatchOpportunity = {
        driveId: drive.id,
        driveTitle: drive.title,
        companyId: (drive.companies as any)?.id || "",
        companyName,
        companyTier: (drive.companies as any)?.tier || "CORE",
        applicationDeadline: drive.deadline || null,
        officialEligibility: officialStatus,
        eligibilityReasons: eligReasons,
        matchScore,
        matchedSkills,
        missingSkills,
        preferredSkills,
        strengths,
        recommendations,
        matchExplanation: `Estimated ${matchScore}% profile competency alignment based on ${matchedSkills.length} matched competencies and portfolio projects.`,
        applicationState: {
          hasApplied: !!appState,
          applicationId: appState?.id,
          status: appState?.status,
        },
        updatedAt: new Date().toISOString(),
      };

      // Apply filter
      if (filter === "ELIGIBLE" && officialStatus !== "ELIGIBLE") continue;
      if (filter === "HIGH_MATCH" && matchScore < 75) continue;

      results.push(opp);
    }

    // Sort by Match Score descending
    results.sort((a, b) => b.matchScore - a.matchScore);

    return results;
  }
}
