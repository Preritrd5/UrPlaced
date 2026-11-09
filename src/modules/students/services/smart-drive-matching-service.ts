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
    let isUnknown = false;
    const failures: string[] = [];

    // 1. Min CGPA
    const minCgpa = criteria.min_cgpa ?? criteria.minCgpa;
    if (minCgpa !== null && minCgpa !== undefined) {
      const studentCgpa = Number(student.cgpa) || 0;
      const minVal = Number(minCgpa);
      const pass = studentCgpa >= minVal;
      reasons.isCgpaEligible = pass;
      if (!pass) {
        isEligible = false;
        failures.push(`CGPA is ${studentCgpa.toFixed(2)} (Minimum required: ${minVal.toFixed(2)})`);
      }
    } else {
      reasons.isCgpaEligible = true;
    }

    // 2. Max Active Backlogs
    const maxBacklogs = criteria.max_active_backlogs ?? criteria.max_backlogs ?? criteria.maxBacklogs;
    if (maxBacklogs !== null && maxBacklogs !== undefined) {
      if (student.active_backlogs === null || student.active_backlogs === undefined) {
        isEligible = false;
        isUnknown = true;
        reasons.isBacklogEligible = false;
        failures.push("Student backlog count is unrecorded in institutional records (Pending Verification)");
      } else {
        const studentBacklogs = Number(student.active_backlogs);
        const maxVal = Number(maxBacklogs);
        const pass = studentBacklogs <= maxVal;
        reasons.isBacklogEligible = pass;
        if (!pass) {
          isEligible = false;
          failures.push(`Active backlogs: ${studentBacklogs} (Exceeds maximum allowed: ${maxVal})`);
        }
      }
    } else {
      reasons.isBacklogEligible = true;
    }

    // 3. Department
    const allowedDepts = criteria.allowed_departments ?? criteria.allowedDepartments;
    if (allowedDepts && Array.isArray(allowedDepts) && allowedDepts.length > 0) {
      const pass = student.department_id ? allowedDepts.includes(student.department_id) : false;
      reasons.isDepartmentEligible = pass;
      if (!pass) {
        isEligible = false;
        failures.push("Student academic department is not on the invited department roster");
      }
    } else {
      reasons.isDepartmentEligible = true;
    }

    // 4. Graduation Year
    const targetGradYear = criteria.graduation_year ?? criteria.allowed_graduation_years?.[0] ?? criteria.allowedGraduationYears?.[0];
    if (targetGradYear) {
      const pass = Number(student.graduation_year) === Number(targetGradYear);
      reasons.isGraduationYearEligible = pass;
      if (!pass) {
        isEligible = false;
        failures.push(`Graduation year ${student.graduation_year} does not match target batch ${targetGradYear}`);
      }
    } else {
      reasons.isGraduationYearEligible = true;
    }

    reasons.summary = isEligible
      ? "Officially meets all institutional academic eligibility criteria."
      : `Ineligible: ${failures.join("; ")}.`;

    const status: "ELIGIBLE" | "INELIGIBLE" | "UNKNOWN" = isEligible
      ? "ELIGIBLE"
      : isUnknown && failures.length === 1
      ? "UNKNOWN"
      : "INELIGIBLE";

    return {
      status,
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
    let matchScore = 0;
    if (total > 0) {
      matchScore = Math.round((matchedSkills.length / total) * 100);
    } else {
      matchScore = 50; // Neutral baseline when drive specifies no skills
    }
    matchScore = Math.max(0, Math.min(100, matchScore));

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

    // Fetch authoritative institutional student record including actual backlogs
    const { data: studentRecord } = await admin
      .from("students")
      .select("id, cgpa, active_backlogs, tenth_percentage, twelfth_percentage, total_backlogs, department_id, graduation_year, degree, academic_status")
      .eq("tenant_id", tenantId)
      .eq("id", studentId)
      .maybeSingle();

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

      // Official eligibility check using canonical student records
      const { status: officialStatus, reasons: eligReasons } = this.evaluateOfficialEligibility(
        {
          cgpa: studentRecord?.cgpa !== undefined && studentRecord?.cgpa !== null ? Number(studentRecord.cgpa) : profile.cgpa,
          active_backlogs: studentRecord?.active_backlogs ?? null,
          department_id: studentRecord?.department_id || (profile as any).departmentId || null,
          degree: studentRecord?.degree || profile.degree,
          graduation_year: studentRecord?.graduation_year || profile.graduationYear,
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
          if (s === reqLower || s.includes(reqLower) || reqLower.includes(s)) {
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
          if (isMatched) {
            preferredSkills.push(reqTitle);
          }
        }
      }

      // Compute transparent requirement-based match score
      let matchScore = 0;
      if (requirements.length > 0) {
        const totalReqs = matchedSkills.length + missingSkills.length;
        if (totalReqs > 0) {
          const ratio = matchedSkills.length / totalReqs;
          matchScore = Math.round(ratio * 80);
          if (preferredSkills.length > 0) matchScore += 10;
          if (profile.projects.length >= 2) matchScore += 10;
          matchScore = Math.min(100, Math.max(0, matchScore));
        }
      } else {
        // No explicit published skill requirements: calculate based on general profile readiness
        matchScore = Math.min(100, Math.max(0, Math.round(profile.completeness.overallPercentage * 0.75)));
      }

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
