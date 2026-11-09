/**
 * Student Career Passport Service
 * 
 * Manages student-controlled professional digital portfolios, section visibility,
 * cryptographically secure revocable share links (SHA-256 token hashing),
 * sanitized public profiles with strict data minimization, and professional PDF exports.
 */

import crypto from "crypto";
import PDFDocument from "pdfkit";
import { createAdminClient } from "@/lib/supabase/admin";
import { StudentCareerProfileService } from "./student-career-profile-service";
import { StudentService } from "./student-service";

export interface IncludedSectionsConfig {
  show_cgpa: boolean;
  show_phone: boolean;
  show_email: boolean;
  show_education: boolean;
  show_skills: boolean;
  show_projects: boolean;
  show_experience: boolean;
  show_certifications: boolean;
  show_achievements: boolean;
}

export interface CareerPassportData {
  id: string;
  tenantId: string;
  studentId: string;
  visibility: "PRIVATE" | "COLLEGE_VISIBLE" | "SHAREABLE";
  headline: string;
  summary: string;
  careerInterests: string[];
  preferredRoles: string[];
  includedSections: IncludedSectionsConfig;
  customSkills: any[];
  customProjects: any[];
  customExperience: any[];
  customCertifications: any[];
  publishedAt: string | null;
  version: number;
  updatedAt: string;
  // Dynamic profile data
  studentName: string;
  email: string;
  phone: string | null;
  degree: string;
  departmentName: string;
  institutionName: string;
  graduationYear: number;
  cgpa: number;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  technicalSkills: any[];
  softSkills: any[];
  projects: any[];
  experience: any[];
  certifications: any[];
  activeShareCount: number;
  isStale: boolean;
}

export interface ShareLinkResult {
  id: string;
  label: string;
  shareUrl: string;
  rawToken?: string;
  isActive: boolean;
  expiresAt: string | null;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
}

export class CareerPassportService {
  private static defaultSections: IncludedSectionsConfig = {
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

  /**
   * Fetches the student's career passport settings and aggregated data.
   */
  public static async getPassport(
    tenantId: string,
    studentId: string
  ): Promise<CareerPassportData> {
    const admin = createAdminClient();

    // 1. Fetch Student Record & Institution
    const student = await StudentService.getById(tenantId, studentId);
    if (!student) {
      throw new Error("Student not found.");
    }

    const { data: tenant } = await admin
      .from("tenants")
      .select("name")
      .eq("id", tenantId)
      .single();

    // 2. Fetch Career Profile
    const profile = await StudentCareerProfileService.getProfile(tenantId, studentId);

    // 3. Fetch Existing Passport Record
    const { data: passport } = await admin
      .from("student_career_passports")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .maybeSingle();

    // 4. Fetch Active Share Count
    const { count: shareCount } = await admin
      .from("career_passport_shares")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("is_active", true);

    const includedSections: IncludedSectionsConfig = {
      ...this.defaultSections,
      ...(passport?.included_sections as any || {}),
    };

    const isStale = Boolean(
      passport?.published_at &&
      profile?.updatedAt &&
      new Date(profile.updatedAt).getTime() > new Date(passport.published_at).getTime()
    );

    return {
      id: passport?.id || "draft",
      tenantId,
      studentId,
      visibility: (passport?.visibility as any) || "PRIVATE",
      headline: passport?.headline || profile?.headline || "",
      summary: passport?.summary || profile?.bio || "",
      careerInterests: passport?.career_interests || [],
      preferredRoles: passport?.preferred_roles || [],
      includedSections,
      customSkills: (passport?.custom_skills as any) || [],
      customProjects: (passport?.custom_projects as any) || [],
      customExperience: (passport?.custom_experience as any) || [],
      customCertifications: (passport?.custom_certifications as any) || [],
      publishedAt: passport?.published_at || null,
      version: passport?.version || 1,
      updatedAt: passport?.updated_at || new Date().toISOString(),
      studentName: student.full_name,
      email: student.email,
      phone: student.phone,
      degree: student.degree || profile?.degree || "Engineering",
      departmentName: student.department_id ? "Engineering Department" : "General",
      institutionName: tenant?.name || "UrPlaced Collegiate Campus",
      graduationYear: student.graduation_year || profile?.graduationYear || new Date().getFullYear(),
      cgpa: Number(student.cgpa) || profile?.cgpa || 0,
      linkedinUrl: profile?.linkedinUrl || null,
      githubUrl: profile?.githubUrl || null,
      portfolioUrl: profile?.portfolioUrl || null,
      technicalSkills: profile?.technicalSkills || [],
      softSkills: profile?.softSkills || [],
      projects: profile?.projects || [],
      experience: profile?.experience || [],
      certifications: profile?.certifications || [],
      activeShareCount: shareCount || 0,
      isStale,
    };
  }

  /**
   * Updates passport settings, visibility, and included sections.
   */
  public static async updatePassport(
    tenantId: string,
    studentId: string,
    updates: {
      visibility?: "PRIVATE" | "COLLEGE_VISIBLE" | "SHAREABLE";
      headline?: string;
      summary?: string;
      careerInterests?: string[];
      preferredRoles?: string[];
      includedSections?: Partial<IncludedSectionsConfig>;
    }
  ): Promise<CareerPassportData> {
    const admin = createAdminClient();

    const current = await this.getPassport(tenantId, studentId);
    const newIncludedSections = {
      ...current.includedSections,
      ...(updates.includedSections || {}),
    };

    const newVisibility = updates.visibility || current.visibility;

    const { data: saved, error } = await admin
      .from("student_career_passports")
      .upsert(
        {
          tenant_id: tenantId,
          student_id: studentId,
          visibility: newVisibility,
          headline: updates.headline !== undefined ? updates.headline.trim() : current.headline,
          summary: updates.summary !== undefined ? updates.summary.trim() : current.summary,
          career_interests: updates.careerInterests || current.careerInterests,
          preferred_roles: updates.preferredRoles || current.preferredRoles,
          included_sections: newIncludedSections as any,
          version: (current.version || 1) + 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,student_id" }
      )
      .select("*")
      .single();

    if (error || !saved) {
      throw new Error(error?.message || "Failed to update career passport settings.");
    }

    return this.getPassport(tenantId, studentId);
  }

  /**
   * Publishes a sanitized snapshot of the passport.
   */
  public static async publishSnapshot(
    tenantId: string,
    studentId: string
  ): Promise<CareerPassportData> {
    const admin = createAdminClient();
    const passportData = await this.getPassport(tenantId, studentId);

    // Create sanitized snapshot based on student-enabled sections
    const snapshot = this.buildSanitizedPassportView(passportData);

    const { error } = await admin
      .from("student_career_passports")
      .update({
        published_snapshot: snapshot as any,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId);

    if (error) {
      throw new Error(error.message || "Failed to publish passport snapshot.");
    }

    return this.getPassport(tenantId, studentId);
  }

  /**
   * Generates a cryptographically strong, revocable share link.
   * Stores SHA-256 hash in database to prevent token enumeration.
   */
  public static async createShareLink(params: {
    tenantId: string;
    studentId: string;
    label?: string;
    expiresInDays?: number | null;
  }): Promise<ShareLinkResult> {
    const admin = createAdminClient();

    // 1. Ensure Passport Exists
    const passport = await this.getPassport(params.tenantId, params.studentId);
    let passportId = passport.id;

    if (passportId === "draft") {
      const updated = await this.updatePassport(params.tenantId, params.studentId, {
        visibility: "SHAREABLE",
      });
      passportId = updated.id;
    }

    // 2. Automatically enable SHAREABLE visibility if currently private
    if (passport.visibility === "PRIVATE") {
      await admin
        .from("student_career_passports")
        .update({ visibility: "SHAREABLE", updated_at: new Date().toISOString() })
        .eq("id", passportId);
    }

    // 3. Generate 32-byte cryptographically secure random token
    const rawToken = crypto.randomBytes(32).toString("hex");

    // 4. Compute SHA-256 hash for storage
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Safe expiry validation: default to 30 days if unspecified, validate range 1-365 days
    let expiryDays = 30;
    if (params.expiresInDays !== undefined && params.expiresInDays !== null) {
      const days = Number(params.expiresInDays);
      if (isNaN(days) || days < 1 || days > 365) {
        throw new Error("Invalid expiry duration: expiresInDays must be a valid number between 1 and 365 days.");
      }
      expiryDays = Math.round(days);
    }

    const expDate = new Date();
    expDate.setDate(expDate.getDate() + expiryDays);
    const expiresAt = expDate.toISOString();

    const { data: share, error } = await admin
      .from("career_passport_shares")
      .insert({
        tenant_id: params.tenantId,
        student_id: params.studentId,
        passport_id: passportId,
        token_hash: tokenHash,
        label: params.label?.trim() || "Public Recruiter Link",
        is_active: true,
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (error || !share) {
      throw new Error(error?.message || "Failed to generate passport share link.");
    }

    return {
      id: share.id,
      label: share.label,
      shareUrl: `/passport/${rawToken}`,
      rawToken,
      isActive: share.is_active,
      expiresAt: share.expires_at,
      accessCount: share.access_count,
      lastAccessedAt: share.last_accessed_at,
      createdAt: share.created_at,
    };
  }

  /**
   * Lists all share links for a student.
   */
  public static async listShareLinks(
    tenantId: string,
    studentId: string
  ): Promise<ShareLinkResult[]> {
    const admin = createAdminClient();

    const { data: shares } = await admin
      .from("career_passport_shares")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    return (shares || []).map((s: any) => ({
      id: s.id,
      label: s.label,
      shareUrl: `/passport/[active-link]`,
      isActive: s.is_active && (!s.expires_at || new Date(s.expires_at) > new Date()),
      expiresAt: s.expires_at,
      accessCount: s.access_count,
      lastAccessedAt: s.last_accessed_at,
      createdAt: s.created_at,
    }));
  }

  /**
   * Revokes an active share link.
   */
  public static async revokeShareLink(
    tenantId: string,
    studentId: string,
    shareId: string
  ): Promise<void> {
    const admin = createAdminClient();

    const { error } = await admin
      .from("career_passport_shares")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shareId)
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId);

    if (error) {
      throw new Error(error.message || "Failed to revoke share link.");
    }
  }

  /**
   * Authoritative public resolver for external recruiters by token.
   * Hashes token parameter, verifies active state & expiry, and returns MINIMAL student-approved fields.
   */
  public static async resolvePublicPassport(rawToken: string): Promise<any | null> {
    if (!rawToken || typeof rawToken !== "string" || rawToken.length < 32) {
      return null;
    }

    const admin = createAdminClient();

    // 1. Hash incoming raw token with SHA-256
    const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");

    // 2. Find share record
    const { data: share } = await admin
      .from("career_passport_shares")
      .select(`
        id,
        tenant_id,
        student_id,
        passport_id,
        is_active,
        expires_at,
        access_count
      `)
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!share || !share.is_active) {
      return null;
    }

    // 3. Verify expiry
    if (share.expires_at && new Date(share.expires_at) <= new Date()) {
      return null;
    }

    // 4. Increment access count asynchronously
    await admin
      .from("career_passport_shares")
      .update({
        access_count: (share.access_count || 0) + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq("id", share.id);

    // 5. Fetch Passport Record directly to verify visibility and published snapshot
    const { data: passportRecord } = await admin
      .from("student_career_passports")
      .select("*")
      .eq("tenant_id", share.tenant_id)
      .eq("student_id", share.student_id)
      .maybeSingle();

    if (!passportRecord || passportRecord.visibility === "PRIVATE") {
      // If student revoked shareable status or set to PRIVATE, deny public access immediately
      return null;
    }

    // Return the approved frozen published snapshot if available
    if (passportRecord.published_snapshot) {
      return passportRecord.published_snapshot;
    }

    // Fallback: build sanitized view from current passport
    const passportData = await this.getPassport(share.tenant_id, share.student_id);
    return this.buildSanitizedPassportView(passportData);
  }

  /**
   * Builds the sanitized view adhering to student section privacy toggles.
   * Strips all internal database IDs, tenant IDs, and unapproved private details.
   */
  public static buildSanitizedPassportView(data: CareerPassportData): any {
    const sec = data.includedSections || (data as any).included_sections || {
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

    return {
      studentName: data.studentName,
      headline: data.headline,
      summary: data.summary,
      institution: sec.show_education ? data.institutionName : null,
      degree: sec.show_education ? data.degree : null,
      department: sec.show_education ? data.departmentName : null,
      graduationYear: sec.show_education ? data.graduationYear : null,
      cgpa: sec.show_cgpa ? data.cgpa : null,
      email: sec.show_email ? data.email : null,
      phone: sec.show_phone ? data.phone : null,
      linkedinUrl: data.linkedinUrl || null,
      githubUrl: data.githubUrl || null,
      portfolioUrl: data.portfolioUrl || null,
      careerInterests: data.careerInterests || [],
      preferredRoles: data.preferredRoles || [],
      skills: sec.show_skills
        ? {
            technical: data.technicalSkills.map((s) => ({
              name: s.name,
              category: s.category,
              proficiency: s.proficiency,
              isVerified: Boolean(s.isVerified),
            })),
            soft: data.softSkills.map((s) => ({
              name: s.name,
              proficiency: s.proficiency,
            })),
          }
        : null,
      projects: sec.show_projects
        ? data.projects.map((p) => ({
            title: p.title,
            description: p.description,
            technologies: p.technologies || [],
            githubUrl: p.githubUrl || null,
            liveUrl: p.liveUrl || null,
            role: p.role || null,
          }))
        : [],
      experience: sec.show_experience
        ? data.experience.map((e) => ({
            organization: e.organization,
            designation: e.designation,
            employmentType: e.employmentType,
            startDate: e.startDate,
            endDate: e.endDate || null,
            isCurrent: Boolean(e.isCurrent),
            responsibilities: e.responsibilities || [],
            achievements: e.achievements || [],
          }))
        : [],
      certifications: sec.show_certifications
        ? data.certifications.map((c) => ({
            name: c.name,
            issuingOrganization: c.issuingOrganization,
            issueDate: c.issueDate || null,
            credentialUrl: c.credentialUrl || null,
            isVerified: Boolean(c.isVerified),
          }))
        : [],
      achievements: sec.show_achievements ? ((data as any).customAchievements || []) : [],
      version: data.version,
      updatedAt: data.updatedAt,
    };
  }

  /**
   * Generates a professional, branded PDF buffer using PDFKit.
   */
  public static async generatePDF(
    tenantId: string,
    studentId: string
  ): Promise<Buffer> {
    const data = await this.getPassport(tenantId, studentId);
    const sanitized = this.buildSanitizedPassportView(data);

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margin: 40,
          info: {
            Title: `${sanitized.studentName} — Career Passport`,
            Author: "UrPlaced Collegiate Career Platform",
          },
        });

        const buffers: Buffer[] = [];
        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", (err) => reject(err));

        // Colors
        const primaryColor = "#5052C9";
        const textColor = "#24283A";
        const secondaryColor = "#2E8F86";
        const mutedColor = "#747683";

        // Header: Name & Headline
        doc
          .font("Helvetica-Bold")
          .fontSize(22)
          .fillColor(primaryColor)
          .text(sanitized.studentName, { lineGap: 3 });

        if (sanitized.headline) {
          doc
            .font("Helvetica-Bold")
            .fontSize(12)
            .fillColor(textColor)
            .text(sanitized.headline, { lineGap: 4 });
        }

        // Subtitle / Contact Line
        const contactDetails: string[] = [];
        if (sanitized.degree) contactDetails.push(sanitized.degree);
        if (sanitized.institution) contactDetails.push(sanitized.institution);
        if (sanitized.email) contactDetails.push(sanitized.email);
        if (sanitized.phone) contactDetails.push(sanitized.phone);
        if (sanitized.cgpa) contactDetails.push(`CGPA: ${sanitized.cgpa}`);

        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(mutedColor)
          .text(contactDetails.join("  |  "), { lineGap: 6 });

        // Divider
        doc.moveDown(0.5);
        doc
          .strokeColor("#DDDCD5")
          .lineWidth(0.75)
          .moveTo(40, doc.y)
          .lineTo(555, doc.y)
          .stroke();
        doc.moveDown(0.7);

        // Section: Professional Summary
        if (sanitized.summary) {
          doc
            .font("Helvetica-Bold")
            .fontSize(11)
            .fillColor(primaryColor)
            .text("PROFESSIONAL SUMMARY");
          doc.moveDown(0.3);
          doc
            .font("Helvetica")
            .fontSize(9.5)
            .fillColor(textColor)
            .text(sanitized.summary, { lineGap: 2.5 });
          doc.moveDown(0.8);
        }

        // Section: Technical Skills
        if (sanitized.skills && sanitized.skills.technical.length > 0) {
          doc
            .font("Helvetica-Bold")
            .fontSize(11)
            .fillColor(primaryColor)
            .text("TECHNICAL PROFICIENCIES");
          doc.moveDown(0.3);

          const skillNames = sanitized.skills.technical
            .map((s: any) => `${s.name}${s.isVerified ? " [Verified]" : ""}`)
            .join("  •  ");

          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(textColor)
            .text(skillNames, { lineGap: 2 });
          doc.moveDown(0.8);
        }

        // Section: Projects
        if (sanitized.projects && sanitized.projects.length > 0) {
          doc
            .font("Helvetica-Bold")
            .fontSize(11)
            .fillColor(primaryColor)
            .text("PORTFOLIO PROJECTS");
          doc.moveDown(0.3);

          for (const proj of sanitized.projects.slice(0, 4)) {
            doc
              .font("Helvetica-Bold")
              .fontSize(10)
              .fillColor(textColor)
              .text(proj.title, { continued: true });

            if (proj.technologies && proj.technologies.length > 0) {
              doc
                .font("Helvetica-Oblique")
                .fontSize(8.5)
                .fillColor(secondaryColor)
                .text(`  (${proj.technologies.join(", ")})`);
            } else {
              doc.text("");
            }

            if (proj.description) {
              doc
                .font("Helvetica")
                .fontSize(9)
                .fillColor(mutedColor)
                .text(proj.description, { lineGap: 2 });
            }
            doc.moveDown(0.4);
          }
          doc.moveDown(0.5);
        }

        // Section: Experience & Internships
        if (sanitized.experience && sanitized.experience.length > 0) {
          doc
            .font("Helvetica-Bold")
            .fontSize(11)
            .fillColor(primaryColor)
            .text("INTERNSHIPS & PROFESSIONAL EXPERIENCE");
          doc.moveDown(0.3);

          for (const exp of sanitized.experience.slice(0, 3)) {
            doc
              .font("Helvetica-Bold")
              .fontSize(10)
              .fillColor(textColor)
              .text(`${exp.designation} — ${exp.organization}`, { lineGap: 1.5 });

            const dates = exp.isCurrent
              ? `${exp.startDate} - Present`
              : `${exp.startDate} - ${exp.endDate || ""}`;

            doc
              .font("Helvetica")
              .fontSize(8.5)
              .fillColor(mutedColor)
              .text(dates, { lineGap: 2 });

            if (exp.responsibilities && exp.responsibilities.length > 0) {
              for (const resp of exp.responsibilities.slice(0, 3)) {
                doc
                  .font("Helvetica")
                  .fontSize(8.5)
                  .fillColor(textColor)
                  .text(`• ${resp}`, { indent: 10, lineGap: 1.5 });
              }
            }
            doc.moveDown(0.4);
          }
          doc.moveDown(0.5);
        }

        // Section: Certifications
        if (sanitized.certifications && sanitized.certifications.length > 0) {
          doc
            .font("Helvetica-Bold")
            .fontSize(11)
            .fillColor(primaryColor)
            .text("CERTIFICATIONS & CREDENTIALS");
          doc.moveDown(0.3);

          for (const cert of sanitized.certifications.slice(0, 4)) {
            doc
              .font("Helvetica")
              .fontSize(9)
              .fillColor(textColor)
              .text(`• ${cert.name} — ${cert.issuingOrganization}${cert.issueDate ? ` (${cert.issueDate})` : ""}`, {
                indent: 8,
                lineGap: 2,
              });
          }
        }

        // Footer
        doc
          .font("Helvetica")
          .fontSize(8)
          .fillColor(mutedColor)
          .text(
            `Generated via UrPlaced Collegiate Platform | Verified Career Passport`,
            40,
            785,
            { align: "center", width: 515 }
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates a cryptographically secure 64-char hex token.
   */
  public static generateSecureToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Computes SHA-256 hash of raw token for tamper-proof storage and verification.
   */
  public static hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  /**
   * Minimises student data for public recruiter views based on student's privacy flags.
   */
  public static filterPublicPassportData(
    rawStudentData: any,
    config: IncludedSectionsConfig,
    institutionName = "Institutional Campus"
  ): {
    fullName: string;
    email?: string;
    phone?: string;
    institutionName: string;
    degree?: string;
    cgpa?: number;
    headline?: string;
    summary?: string;
    skills: Array<{ name: string; proficiency: string; isVerified: boolean }>;
    projects: any[];
    experience: any[];
    certifications: any[];
  } {
    const skills = (rawStudentData.technical_skills || []).map((s: any) => ({
      name: s.name,
      proficiency: s.proficiency || "INTERMEDIATE",
      isVerified: Boolean(s.isVerified),
    }));

    return {
      fullName: `${rawStudentData.first_name || ""} ${rawStudentData.last_name || ""}`.trim(),
      email: config.show_email ? rawStudentData.email : undefined,
      phone: config.show_phone ? rawStudentData.phone : undefined,
      institutionName,
      degree: config.show_education ? rawStudentData.degree : undefined,
      cgpa: config.show_cgpa ? rawStudentData.cgpa : undefined,
      headline: rawStudentData.headline || undefined,
      summary: rawStudentData.summary || rawStudentData.bio || undefined,
      skills: config.show_skills ? skills : [],
      projects: config.show_projects ? (rawStudentData.projects || []) : [],
      experience: config.show_experience ? (rawStudentData.experience || []) : [],
      certifications: config.show_certifications ? (rawStudentData.certifications || []) : [],
    };
  }
}
