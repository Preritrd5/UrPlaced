/**
 * Private Student Resume Storage Service
 * 
 * Enforces strict security, file validation, student ownership,
 * and signed URLs for private resume document storage in 'student-resumes'.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export interface ResumeRecord {
  id: string;
  tenantId: string;
  studentId: string;
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  fileType: "pdf" | "docx";
  isPrimary: boolean;
  parsedText: string | null;
  parsingStatus: "PENDING" | "PARSED" | "PARTIALLY_PARSED" | "FAILED";
  parsingError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadResumeResult {
  resume: ResumeRecord;
  signedUrl: string;
}

export class ResumeStorageService {
  public static BUCKET_NAME = "student-resumes";
  public static MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Validates document magic numbers and extension
   */
  public static validateFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): { fileType: "pdf" | "docx" } {
    if (fileBuffer.length > this.MAX_FILE_SIZE) {
      throw new Error(`File exceeds maximum allowed size of 10MB (${(fileBuffer.length / (1024 * 1024)).toFixed(2)}MB).`);
    }

    if (fileBuffer.length < 50) {
      throw new Error("File is empty or corrupted.");
    }

    const lowerName = fileName.toLowerCase().trim();
    const isPdfExt = lowerName.endsWith(".pdf");
    const isDocxExt = lowerName.endsWith(".docx");

    if (!isPdfExt && !isDocxExt) {
      throw new Error("Unsupported document format. Only PDF (.pdf) and Microsoft Word (.docx) files are supported.");
    }

    // Magic number checks
    const header = fileBuffer.subarray(0, 4);
    if (isPdfExt) {
      // PDF header: %PDF
      const isPdfHeader = fileBuffer.subarray(0, 5).toString("latin1").startsWith("%PDF");
      if (!isPdfHeader) {
        throw new Error("File has a .pdf extension but its binary signature is invalid or corrupted.");
      }
      return { fileType: "pdf" };
    }

    if (isDocxExt) {
      // DOCX is a zip archive: PK\x03\x04
      const isZipHeader = header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04;
      if (!isZipHeader) {
        throw new Error("File has a .docx extension but its binary signature is not a valid OpenXML document.");
      }
      return { fileType: "docx" };
    }

    throw new Error("Unsupported document format.");
  }

  /**
   * Saves resume document to private storage and metadata table
   */
  public static async uploadResume(params: {
    tenantId: string;
    studentId: string;
    fileName: string;
    fileBuffer: Buffer;
    mimeType: string;
    isPrimary?: boolean;
    parsedText?: string;
    parsingStatus?: "PENDING" | "PARSED" | "PARTIALLY_PARSED" | "FAILED";
  }): Promise<UploadResumeResult> {
    const { tenantId, studentId, fileName, fileBuffer, mimeType } = params;
    const { fileType } = this.validateFile(fileBuffer, fileName, mimeType);

    const admin = createAdminClient();

    // Check existing resumes count for this student
    const { data: existing } = await admin
      .from("student_resumes")
      .select("id, is_primary")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId);

    const hasResumes = existing && existing.length > 0;
    // First resume defaults to primary unless specified
    const shouldBePrimary = params.isPrimary !== undefined ? params.isPrimary : !hasResumes;

    const resumeId = crypto.randomUUID();
    const storagePath = `${tenantId}/${studentId}/${resumeId}.${fileType}`;

    // Upload to private Supabase Storage
    const { error: uploadErr } = await admin.storage
      .from(this.BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: fileType === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadErr) {
      console.error("[ResumeStorageService] Storage upload failed:", uploadErr);
      throw new Error(`Failed to store resume document: ${uploadErr.message}`);
    }

    // If setting as primary, unset any previous primary
    if (shouldBePrimary && hasResumes) {
      await admin
        .from("student_resumes")
        .update({ is_primary: false })
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId);
    }

    // Insert metadata record
    const { data: record, error: recordErr } = await admin
      .from("student_resumes")
      .insert({
        id: resumeId,
        tenant_id: tenantId,
        student_id: studentId,
        file_name: fileName.trim(),
        file_path: storagePath,
        file_size_bytes: fileBuffer.length,
        file_type: fileType,
        is_primary: shouldBePrimary,
        parsed_text: params.parsedText || null,
        parsing_status: params.parsingStatus || "PENDING",
      })
      .select("*")
      .maybeSingle();

    if (recordErr || !record) {
      // Clean up storage object on metadata failure
      await admin.storage.from(this.BUCKET_NAME).remove([storagePath]);
      throw new Error(`Failed to record resume metadata: ${recordErr?.message}`);
    }

    // Generate short-lived signed URL for download preview (5 mins)
    const { data: signed } = await admin.storage
      .from(this.BUCKET_NAME)
      .createSignedUrl(storagePath, 300);

    const resume: ResumeRecord = {
      id: record.id,
      tenantId: record.tenant_id,
      studentId: record.student_id,
      fileName: record.file_name,
      filePath: record.file_path,
      fileSizeBytes: record.file_size_bytes,
      fileType: record.file_type as any,
      isPrimary: record.is_primary,
      parsedText: record.parsed_text,
      parsingStatus: record.parsing_status as any,
      parsingError: record.parsing_error,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };

    return {
      resume,
      signedUrl: signed?.signedUrl || "",
    };
  }

  /**
   * Retrieves list of all resumes for a student
   */
  public static async listResumes(
    tenantId: string,
    studentId: string
  ): Promise<ResumeRecord[]> {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("student_resumes")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[ResumeStorageService] listResumes error:", error.message);
      return [];
    }

    return (data || []).map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      studentId: r.student_id,
      fileName: r.file_name,
      filePath: r.file_path,
      fileSizeBytes: r.file_size_bytes,
      fileType: r.file_type as any,
      isPrimary: r.is_primary,
      parsedText: r.parsed_text,
      parsingStatus: r.parsing_status as any,
      parsingError: r.parsing_error,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /**
   * Marks a specific resume as primary
   */
  public static async setPrimary(
    tenantId: string,
    studentId: string,
    resumeId: string
  ): Promise<ResumeRecord> {
    const admin = createAdminClient();

    // Verify ownership
    const { data: target } = await admin
      .from("student_resumes")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("id", resumeId)
      .maybeSingle();

    if (!target) {
      throw new Error("Resume not found or inaccessible.");
    }

    // Unset all other primary resumes
    await admin
      .from("student_resumes")
      .update({ is_primary: false })
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId);

    // Set target as primary
    const { data: updated, error } = await admin
      .from("student_resumes")
      .update({ is_primary: true })
      .eq("tenant_id", tenantId)
      .eq("id", resumeId)
      .select("*")
      .maybeSingle();

    if (error || !updated) {
      throw new Error(`Failed to update primary resume: ${error?.message}`);
    }

    return {
      id: updated.id,
      tenantId: updated.tenant_id,
      studentId: updated.student_id,
      fileName: updated.file_name,
      filePath: updated.file_path,
      fileSizeBytes: updated.file_size_bytes,
      fileType: updated.file_type as any,
      isPrimary: updated.is_primary,
      parsedText: updated.parsed_text,
      parsingStatus: updated.parsing_status as any,
      parsingError: updated.parsing_error,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  }

  /**
   * Generates a short-lived download URL for student resume
   */
  public static async getSignedDownloadUrl(
    tenantId: string,
    studentId: string,
    resumeId: string
  ): Promise<{ signedUrl: string; fileName: string }> {
    const admin = createAdminClient();
    const { data: record } = await admin
      .from("student_resumes")
      .select("file_path, file_name")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("id", resumeId)
      .maybeSingle();

    if (!record) {
      throw new Error("Resume not found or inaccessible.");
    }

    const { data, error } = await admin.storage
      .from(this.BUCKET_NAME)
      .createSignedUrl(record.file_path, 300, {
        download: record.file_name,
      });

    if (error || !data?.signedUrl) {
      throw new Error(`Failed to generate secure download link: ${error?.message}`);
    }

    return {
      signedUrl: data.signedUrl,
      fileName: record.file_name,
    };
  }

  /**
   * Permanently deletes resume file, metadata, and derived scans
   */
  public static async deleteResume(
    tenantId: string,
    studentId: string,
    resumeId: string
  ): Promise<boolean> {
    const admin = createAdminClient();

    // Verify ownership
    const { data: record } = await admin
      .from("student_resumes")
      .select("file_path, is_primary")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("id", resumeId)
      .maybeSingle();

    if (!record) {
      throw new Error("Resume not found or inaccessible.");
    }

    // 1. Remove from storage
    await admin.storage.from(this.BUCKET_NAME).remove([record.file_path]);

    // 2. Delete derived scans
    await admin
      .from("resume_scans")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("resume_id", resumeId);

    // 3. Delete metadata record
    const { error: delErr } = await admin
      .from("student_resumes")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", resumeId);

    if (delErr) {
      throw new Error(`Failed to delete resume record: ${delErr.message}`);
    }

    // If was primary, promote most recent remaining resume
    if (record.is_primary) {
      const { data: remaining } = await admin
        .from("student_resumes")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (remaining && remaining.length > 0) {
        await admin
          .from("student_resumes")
          .update({ is_primary: true })
          .eq("id", remaining[0].id);
      }
    }

    return true;
  }
}
