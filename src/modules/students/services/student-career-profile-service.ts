/**
 * Student Career Profile & Completeness Engine Service
 * 
 * Manages comprehensive career profiles for students across:
 * - Professional info & headlines
 * - Technical & soft skills with categories & proficiency
 * - Projects with tech stacks, links, and descriptions
 * - Internships & professional experience
 * - Certifications & achievements
 * - Server-side authoritative 7-section completeness calculation
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export interface TechnicalSkill {
  name: string;
  category: "LANGUAGE" | "FRAMEWORK" | "DATABASE" | "TOOL" | "PLATFORM" | "OTHER";
  proficiency: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  isVerified?: boolean;
}

export interface SoftSkill {
  name: string;
  proficiency: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
}

export interface CareerProject {
  id?: string;
  title: string;
  description: string;
  technologies: string[];
  role?: string;
  githubUrl?: string;
  liveUrl?: string;
  startDate?: string;
  endDate?: string;
}

export interface CareerExperience {
  id?: string;
  organization: string;
  designation: string;
  employmentType: "INTERNSHIP" | "FULL_TIME" | "PART_TIME" | "APPRENTICESHIP";
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
  responsibilities: string[];
  achievements?: string[];
}

export interface CareerCertification {
  id?: string;
  name: string;
  issuingOrganization: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  isVerified?: boolean;
}

export interface CompletenessBreakdown {
  score: number;
  maxScore: number;
  percentage: number;
  isComplete: boolean;
  details: string;
}

export interface ProfileCompletenessResult {
  score: number;
  overallPercentage: number;
  completedSections: string[];
  missingSections: Array<{
    sectionKey: string;
    title: string;
    weight: number;
    actionPrompt: string;
  }>;
  breakdown: Record<string, CompletenessBreakdown>;
  actionableTips: string[];
  lastCalculatedAt: string;
  isReadyForDrives: boolean;
}

export interface CareerProfileData {
  id?: string;
  tenantId: string;
  studentId: string;
  // Read-only institutional fields
  fullName: string;
  enrollmentNumber: string;
  email: string;
  phone: string | null;
  degree: string;
  departmentName?: string;
  graduationYear: number;
  cgpa: number;
  academicStatus: string;
  // Career profile fields
  headline: string;
  bio: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  technicalSkills: TechnicalSkill[];
  softSkills: SoftSkill[];
  projects: CareerProject[];
  experience: CareerExperience[];
  certifications: CareerCertification[];
  completeness: ProfileCompletenessResult;
  updatedAt: string;
}

export interface CareerProfileUpdateInput {
  headline?: string;
  bio?: string;
  location?: string;
  phone?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  technicalSkills?: TechnicalSkill[];
  softSkills?: SoftSkill[];
  projects?: CareerProject[];
  experience?: CareerExperience[];
  certifications?: CareerCertification[];
  expectedUpdatedAt?: string;
}

export class StudentCareerProfileService {
  /**
   * Deterministic 7-section profile completeness calculation engine
   */
  public static calculateCompleteness(
    student: {
      cgpa?: number | null;
      degree?: string | null;
      department_id?: string | null;
      graduation_year?: number | null;
      phone?: string | null;
    } = {},
    profile: {
      headline?: string | null;
      bio?: string | null;
      location?: string | null;
      linkedin_url?: string | null;
      github_url?: string | null;
      portfolio_url?: string | null;
      technical_skills?: TechnicalSkill[];
      soft_skills?: SoftSkill[];
      projects?: CareerProject[];
      experience?: CareerExperience[];
      certifications?: CareerCertification[];
    } = {}
  ): ProfileCompletenessResult {
    const s = student || {};
    const p = profile || {};
    const breakdown: Record<string, CompletenessBreakdown> = {};
    const missingSections: ProfileCompletenessResult["missingSections"] = [];
    const completedSections: string[] = [];
    const actionableTips: string[] = [];

    // 1. Professional & Contact Info (Weight: 15%)
    let profScore = 0;
    if (p.headline && p.headline.trim().length >= 3) profScore += 5;
    if (p.location && p.location.trim().length >= 2) profScore += 5;
    if (p.bio && p.bio.trim().length >= 15) profScore += 5;

    const profComplete = profScore === 15;
    breakdown.professionalInfo = {
      score: profScore,
      maxScore: 15,
      percentage: Math.round((profScore / 15) * 100),
      isComplete: profComplete,
      details: profComplete ? "Complete" : "Add headline, location, and professional summary",
    };
    if (profComplete) completedSections.push("Professional Summary");
    else {
      missingSections.push({
        sectionKey: "professionalInfo",
        title: "Professional Information",
        weight: 15,
        actionPrompt: "Add a compelling professional headline and summary bio.",
      });
      actionableTips.push("Add a 1-sentence headline summarizing your target role (e.g. 'Aspiring Full Stack Engineer').");
    }

    // 2. Education & Academic Details (Weight: 20%) - Strictly Authoritative
    let eduScore = 0;
    if (s.degree && typeof s.degree === "string" && s.degree.trim().length >= 2) eduScore += 10;
    if (s.cgpa !== null && s.cgpa !== undefined && Number(s.cgpa) > 0) eduScore += 10;

    const eduComplete = eduScore === 20;
    breakdown.education = {
      score: eduScore,
      maxScore: 20,
      percentage: Math.round((eduScore / 20) * 100),
      isComplete: eduComplete,
      details: eduComplete ? "Verified from academic records" : "Academic records missing CGPA or degree",
    };
    if (eduComplete) completedSections.push("Academic Education");
    else {
      missingSections.push({
        sectionKey: "education",
        title: "Academic Records",
        weight: 20,
        actionPrompt: "Ensure your institutional enrollment records reflect your verified CGPA.",
      });
    }

    // 3. Technical Skills (Weight: 20%) - Must have valid non-empty names
    const rawTechSkills = p.technical_skills || [];
    const validTechSkills = rawTechSkills.filter(
      (skill) => skill && typeof skill.name === "string" && skill.name.trim().length >= 2
    );
    let techScore = 0;
    if (validTechSkills.length >= 1) techScore += 10;
    if (validTechSkills.length >= 3) techScore += 10;

    const techComplete = techScore === 20;
    breakdown.technicalSkills = {
      score: techScore,
      maxScore: 20,
      percentage: Math.round((techScore / 20) * 100),
      isComplete: techComplete,
      details: `${validTechSkills.length} valid technical skills listed`,
    };
    if (techComplete) completedSections.push("Technical Skills");
    else {
      missingSections.push({
        sectionKey: "technicalSkills",
        title: "Technical Skills",
        weight: 20,
        actionPrompt: "List at least 3 technical skills (programming languages, frameworks, or databases).",
      });
      actionableTips.push("Add your core programming languages (e.g. Python, Java, TypeScript) with proficiency levels.");
    }

    // 4. Projects (Weight: 20%) - Must have valid title and at least one technology
    const rawProjects = p.projects || [];
    const validProjects = rawProjects.filter(
      (proj) =>
        proj &&
        typeof proj.title === "string" &&
        proj.title.trim().length >= 3 &&
        Array.isArray(proj.technologies) &&
        proj.technologies.some((t) => typeof t === "string" && t.trim().length > 0)
    );
    let projScore = 0;
    if (validProjects.length >= 1) projScore += 10;
    if (validProjects.length >= 2) projScore += 10;

    const projComplete = projScore === 20;
    breakdown.projects = {
      score: projScore,
      maxScore: 20,
      percentage: Math.round((projScore / 20) * 100),
      isComplete: projComplete,
      details: `${validProjects.length} valid portfolio projects documented`,
    };
    if (projComplete) completedSections.push("Portfolio Projects");
    else {
      missingSections.push({
        sectionKey: "projects",
        title: "Projects",
        weight: 20,
        actionPrompt: "Showcase at least 2 key projects with technologies used and repository links.",
      });
      actionableTips.push("Add at least one flagship technical project with a GitHub repository link.");
    }

    // 5. Internships & Experience (Weight: 10%) - Must have non-blank organization & designation
    const rawExperience = p.experience || [];
    const validExperience = rawExperience.filter(
      (exp) =>
        exp &&
        typeof exp.organization === "string" &&
        exp.organization.trim().length >= 2 &&
        typeof exp.designation === "string" &&
        exp.designation.trim().length >= 2
    );
    const expScore = validExperience.length >= 1 ? 10 : 0;
    const expComplete = expScore === 10;
    breakdown.experience = {
      score: expScore,
      maxScore: 10,
      percentage: Math.round((expScore / 10) * 100),
      isComplete: expComplete,
      details: validExperience.length >= 1 ? `${validExperience.length} work experience entries` : "No experience listed",
    };
    if (expComplete) completedSections.push("Internships & Experience");
    else {
      missingSections.push({
        sectionKey: "experience",
        title: "Internships & Experience",
        weight: 10,
        actionPrompt: "Add any internships, research assistantships, or practical work experience.",
      });
    }

    // 6. Certifications & Achievements (Weight: 10%) - Must have name and issuing organization
    const rawCerts = p.certifications || [];
    const validCerts = rawCerts.filter(
      (c) =>
        c &&
        typeof c.name === "string" &&
        c.name.trim().length >= 2 &&
        typeof c.issuingOrganization === "string" &&
        c.issuingOrganization.trim().length >= 2
    );
    const certScore = validCerts.length >= 1 ? 10 : 0;
    const certComplete = certScore === 10;
    breakdown.certifications = {
      score: certScore,
      maxScore: 10,
      percentage: Math.round((certScore / 10) * 100),
      isComplete: certComplete,
      details: validCerts.length >= 1 ? `${validCerts.length} certifications added` : "No certifications listed",
    };
    if (certComplete) completedSections.push("Certifications & Achievements");
    else {
      missingSections.push({
        sectionKey: "certifications",
        title: "Certifications",
        weight: 10,
        actionPrompt: "Add relevant certifications (e.g., AWS, Cloud, or course credentials).",
      });
    }

    // 7. Professional Links (Weight: 5%) - Must be non-blank
    let linkScore = 0;
    if (
      (p.linkedin_url && p.linkedin_url.trim().length >= 8) ||
      (p.github_url && p.github_url.trim().length >= 8) ||
      (p.portfolio_url && p.portfolio_url.trim().length >= 8)
    ) {
      linkScore = 5;
    }

    const linkComplete = linkScore === 5;
    breakdown.professionalLinks = {
      score: linkScore,
      maxScore: 5,
      percentage: Math.round((linkScore / 5) * 100),
      isComplete: linkComplete,
      details: linkComplete ? "Profiles connected" : "Add LinkedIn, GitHub, or portfolio link",
    };
    if (linkComplete) completedSections.push("Professional Links");
    else {
      missingSections.push({
        sectionKey: "professionalLinks",
        title: "Online Presence",
        weight: 5,
        actionPrompt: "Attach your GitHub or LinkedIn profile URL to let recruiters review your work.",
      });
      actionableTips.push("Link your LinkedIn and GitHub profiles for verified presence.");
    }

    const overallPercentage = Math.min(
      100,
      profScore + eduScore + techScore + projScore + expScore + certScore + linkScore
    );

    const isReadyForDrives = overallPercentage >= 70;

    return {
      score: overallPercentage,
      overallPercentage,
      completedSections,
      missingSections,
      breakdown,
      actionableTips,
      lastCalculatedAt: new Date().toISOString(),
      isReadyForDrives,
    };
  }

  /**
   * Authoritatively retrieves student career profile merging student institutional fields
   */
  public static async getProfile(
    tenantId: string,
    studentId: string
  ): Promise<CareerProfileData> {
    const admin = createAdminClient();

    // 1. Fetch student row
    const { data: student, error: studentErr } = await admin
      .from("students")
      .select("*, department:departments(name, code)")
      .eq("tenant_id", tenantId)
      .eq("id", studentId)
      .maybeSingle();

    if (!student || studentErr) {
      throw new Error(`Student record not found or inaccessible: ${studentErr?.message}`);
    }

    // 2. Fetch or initialize student_career_profiles
    let { data: profile } = await admin
      .from("student_career_profiles")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .maybeSingle();

    if (!profile) {
      // Auto-initialize profile using initial skills from students
      const initialSkills: TechnicalSkill[] = (student.skills || []).map((name: string) => ({
        name,
        category: "LANGUAGE",
        proficiency: "INTERMEDIATE",
      }));

      const completeness = this.calculateCompleteness(student, {
        technical_skills: initialSkills,
      });

      const { data: created, error: createErr } = await admin
        .from("student_career_profiles")
        .insert({
          tenant_id: tenantId,
          student_id: studentId,
          technical_skills: initialSkills as any,
          completeness_percentage: completeness.overallPercentage,
          completeness_breakdown: completeness as any,
        })
        .select("*")
        .maybeSingle();

      if (!createErr && created) {
        profile = created;
      } else {
        // Fallback in-memory profile if insert is pending migration
        profile = {
          id: "temp",
          tenant_id: tenantId,
          student_id: studentId,
          headline: null,
          bio: null,
          location: null,
          linkedin_url: null,
          github_url: null,
          portfolio_url: null,
          technical_skills: initialSkills,
          soft_skills: [],
          projects: [],
          experience: [],
          certifications: [],
          completeness_percentage: completeness.overallPercentage,
          completeness_breakdown: completeness,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any;
      }
    }

    const techSkills: TechnicalSkill[] = (profile.technical_skills as any) || [];
    const softSkills: SoftSkill[] = (profile.soft_skills as any) || [];
    const projects: CareerProject[] = (profile.projects as any) || [];
    const experience: CareerExperience[] = (profile.experience as any) || [];
    const certs: CareerCertification[] = (profile.certifications as any) || [];

    const completeness = this.calculateCompleteness(student, {
      headline: profile.headline,
      bio: profile.bio,
      location: profile.location,
      linkedin_url: profile.linkedin_url,
      github_url: profile.github_url,
      portfolio_url: profile.portfolio_url,
      technical_skills: techSkills,
      soft_skills: softSkills,
      projects,
      experience,
      certifications: certs,
    });

    return {
      id: profile.id,
      tenantId,
      studentId,
      fullName: student.full_name,
      enrollmentNumber: student.enrollment_number,
      email: student.email,
      phone: student.phone,
      degree: student.degree || "Bachelor of Technology",
      departmentName: (student as any).department?.name || "Computer Science",
      graduationYear: student.graduation_year || new Date().getFullYear(),
      cgpa: Number(student.cgpa) || 0,
      academicStatus: student.academic_status || "ACTIVE",
      headline: profile.headline || "",
      bio: profile.bio || "",
      location: profile.location || "",
      linkedinUrl: profile.linkedin_url || "",
      githubUrl: profile.github_url || "",
      portfolioUrl: profile.portfolio_url || "",
      technicalSkills: techSkills,
      softSkills,
      projects,
      experience,
      certifications: certs,
      completeness,
      updatedAt: profile.updated_at || new Date().toISOString(),
    };
  }

  /**
   * Updates student career profile and re-evaluates completeness
   */
  public static async updateProfile(
    tenantId: string,
    studentId: string,
    input: CareerProfileUpdateInput
  ): Promise<CareerProfileData> {
    const admin = createAdminClient();

    // Verify student exists
    const { data: student, error: studentErr } = await admin
      .from("students")
      .select("*, department:departments(name, code)")
      .eq("tenant_id", tenantId)
      .eq("id", studentId)
      .maybeSingle();

    if (!student || studentErr) {
      throw new Error("Student record not found or inaccessible.");
    }

    // 1. Fetch existing profile to check stale writes and preserve legitimate verified statuses
    const { data: existingProfile } = await admin
      .from("student_career_profiles")
      .select("technical_skills, certifications, updated_at")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .maybeSingle();

    // Prevent stale writes if client sends expectedUpdatedAt
    if (input.expectedUpdatedAt && existingProfile?.updated_at) {
      const existingTime = new Date(existingProfile.updated_at).getTime();
      const expectedTime = new Date(input.expectedUpdatedAt).getTime();
      if (existingTime > expectedTime) {
        throw new Error("STALE_UPDATE: Profile has been modified in another session. Please reload.");
      }
    }

    // Build verified skills map from existing profile
    const verifiedSkillsMap = new Set<string>();
    if (existingProfile && Array.isArray(existingProfile.technical_skills)) {
      for (const s of existingProfile.technical_skills as any[]) {
        if (s.isVerified && s.name) {
          verifiedSkillsMap.add(s.name.toLowerCase().trim());
        }
      }
    }

    // Build verified certs map from existing profile
    const verifiedCertsMap = new Set<string>();
    if (existingProfile && Array.isArray(existingProfile.certifications)) {
      for (const c of existingProfile.certifications as any[]) {
        if (c.isVerified && c.name) {
          verifiedCertsMap.add(c.name.toLowerCase().trim());
        }
      }
    }

    // Sanitize technical skills: student cannot self-award isVerified
    const sanitizedTechSkills: TechnicalSkill[] = (input.technicalSkills || [])
      .map((s) => ({
        name: s.name.trim(),
        category: s.category || "OTHER",
        proficiency: s.proficiency || "BEGINNER",
        isVerified: verifiedSkillsMap.has(s.name.toLowerCase().trim()),
      }))
      .filter((s) => s.name.length >= 2);

    // Sanitize soft skills
    const sanitizedSoftSkills: SoftSkill[] = (input.softSkills || [])
      .map((s) => ({
        name: s.name.trim(),
        proficiency: s.proficiency || "BEGINNER",
      }))
      .filter((s) => s.name.length >= 2);

    // Sanitize certifications: student cannot self-award isVerified
    const sanitizedCerts: CareerCertification[] = (input.certifications || [])
      .map((c) => ({
        ...c,
        name: c.name.trim(),
        issuingOrganization: c.issuingOrganization.trim(),
        isVerified: verifiedCertsMap.has(c.name.toLowerCase().trim()),
      }))
      .filter((c) => c.name.length >= 2 && c.issuingOrganization.length >= 2);

    // Sanitize projects
    const sanitizedProjects: CareerProject[] = (input.projects || []).filter(
      (p) => p && typeof p.title === "string" && p.title.trim().length >= 3
    );

    // Sanitize experience
    const sanitizedExperience: CareerExperience[] = (input.experience || []).filter(
      (e) => e && typeof e.organization === "string" && e.organization.trim().length >= 2
    );

    // Calculate completeness deterministically from sanitized data
    const completeness = this.calculateCompleteness(student, {
      headline: input.headline,
      bio: input.bio,
      location: input.location,
      linkedin_url: input.linkedinUrl,
      github_url: input.githubUrl,
      portfolio_url: input.portfolioUrl,
      technical_skills: sanitizedTechSkills,
      soft_skills: sanitizedSoftSkills,
      projects: sanitizedProjects,
      experience: sanitizedExperience,
      certifications: sanitizedCerts,
    });

    // Update phone in students table if provided
    if (input.phone !== undefined && input.phone !== student.phone) {
      await admin
        .from("students")
        .update({ phone: input.phone?.trim() || null })
        .eq("tenant_id", tenantId)
        .eq("id", studentId);
    }

    // Sync canonical skills string array to students table for legacy search/matching compatibility
    if (input.technicalSkills) {
      const allSkillNames = Array.from(new Set(sanitizedTechSkills.map((s) => s.name).filter(Boolean)));
      await admin
        .from("students")
        .update({ skills: allSkillNames })
        .eq("tenant_id", tenantId)
        .eq("id", studentId);
    }

    // Upsert into student_career_profiles
    const updatePayload: any = {
      tenant_id: tenantId,
      student_id: studentId,
      headline: input.headline?.trim() || null,
      bio: input.bio?.trim() || null,
      location: input.location?.trim() || null,
      linkedin_url: input.linkedinUrl?.trim() || null,
      github_url: input.githubUrl?.trim() || null,
      portfolio_url: input.portfolioUrl?.trim() || null,
      technical_skills: sanitizedTechSkills as any,
      soft_skills: sanitizedSoftSkills as any,
      projects: sanitizedProjects as any,
      experience: sanitizedExperience as any,
      certifications: sanitizedCerts as any,
      completeness_percentage: completeness.overallPercentage,
      completeness_breakdown: completeness as any,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedProfile, error: upsertErr } = await admin
      .from("student_career_profiles")
      .upsert(updatePayload, { onConflict: "tenant_id, student_id" })
      .select("*")
      .maybeSingle();

    if (upsertErr) {
      console.warn("[StudentCareerProfileService] Upsert error:", upsertErr.message);
    }

    return this.getProfile(tenantId, studentId);
  }
}
