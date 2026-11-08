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

    // 2. Education & Academic Details (Weight: 20%)
    let eduScore = 0;
    if (s.degree && s.degree.trim()) eduScore += 10;
    if (s.cgpa && s.cgpa > 0) eduScore += 10;

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

    // 3. Technical Skills (Weight: 20%)
    const techSkills = p.technical_skills || [];
    let techScore = 0;
    if (techSkills.length >= 1) techScore += 10;
    if (techSkills.length >= 3) techScore += 10;

    const techComplete = techScore === 20;
    breakdown.technicalSkills = {
      score: techScore,
      maxScore: 20,
      percentage: Math.round((techScore / 20) * 100),
      isComplete: techComplete,
      details: `${techSkills.length} technical skills listed`,
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

    // 4. Projects (Weight: 20%)
    const projects = p.projects || [];
    let projScore = 0;
    if (projects.length >= 1) projScore += 10;
    if (projects.length >= 2) projScore += 10;

    const projComplete = projScore === 20;
    breakdown.projects = {
      score: projScore,
      maxScore: 20,
      percentage: Math.round((projScore / 20) * 100),
      isComplete: projComplete,
      details: `${projects.length} portfolio projects documented`,
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

    // 5. Internships & Experience (Weight: 10%)
    const experience = p.experience || [];
    const expScore = experience.length >= 1 ? 10 : 0;
    const expComplete = expScore === 10;
    breakdown.experience = {
      score: expScore,
      maxScore: 10,
      percentage: Math.round((expScore / 10) * 100),
      isComplete: expComplete,
      details: experience.length >= 1 ? `${experience.length} work experience entries` : "No experience listed",
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

    // 6. Certifications & Achievements (Weight: 10%)
    const certs = p.certifications || [];
    const certScore = certs.length >= 1 ? 10 : 0;
    const certComplete = certScore === 10;
    breakdown.certifications = {
      score: certScore,
      maxScore: 10,
      percentage: Math.round((certScore / 10) * 100),
      isComplete: certComplete,
      details: certs.length >= 1 ? `${certs.length} certifications added` : "No certifications listed",
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

    // 7. Professional Links (Weight: 5%)
    let linkScore = 0;
    if (
      (p.linkedin_url && p.linkedin_url.trim()) ||
      (p.github_url && p.github_url.trim()) ||
      (p.portfolio_url && p.portfolio_url.trim())
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

    // Calculate completeness
    const completeness = this.calculateCompleteness(student, {
      headline: input.headline,
      bio: input.bio,
      location: input.location,
      linkedin_url: input.linkedinUrl,
      github_url: input.githubUrl,
      portfolio_url: input.portfolioUrl,
      technical_skills: input.technicalSkills,
      soft_skills: input.softSkills,
      projects: input.projects,
      experience: input.experience,
      certifications: input.certifications,
    });

    // Update phone in students table if provided
    if (input.phone !== undefined && input.phone !== student.phone) {
      await admin
        .from("students")
        .update({ phone: input.phone?.trim() || null })
        .eq("tenant_id", tenantId)
        .eq("id", studentId);
    }

    // Sync skills string array to students table for legacy search/matching compatibility
    if (input.technicalSkills) {
      const allSkillNames = input.technicalSkills.map((s) => s.name.trim()).filter(Boolean);
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
      technical_skills: (input.technicalSkills || []) as any,
      soft_skills: (input.softSkills || []) as any,
      projects: (input.projects || []) as any,
      experience: (input.experience || []) as any,
      certifications: (input.certifications || []) as any,
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
