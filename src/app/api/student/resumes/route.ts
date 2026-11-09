/**
 * Student Resumes List & Upload API
 * GET /api/student/resumes
 * POST /api/student/resumes
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { ResumeStorageService } from "@/modules/students/services/resume-storage-service";
import { ResumeExtractorService } from "@/modules/students/services/resume-extractor-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    let token: string | undefined;
    const authHeader = request?.headers?.get?.("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    const authContext = await requireAuthContext(
      Permissions.ASSESSMENTS_ATTEMPT,
      undefined,
      token
    );

    const student = await StudentService.getByUserId(
      authContext.tenantId,
      authContext.userId
    );

    if (!student || student.is_archived || student.academic_status !== "ACTIVE") {
      return NextResponse.json(
        { error: "No active verified student profile linked to this account." },
        { status: 403 }
      );
    }

    const resumes = await ResumeStorageService.listResumes(
      authContext.tenantId,
      student.id
    );

    return NextResponse.json({ success: true, data: resumes });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    console.error("[Resumes API] GET Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list resumes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let token: string | undefined;
    const authHeader = request?.headers?.get?.("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    const authContext = await requireAuthContext(
      Permissions.ASSESSMENTS_ATTEMPT,
      undefined,
      token
    );

    const student = await StudentService.getByUserId(
      authContext.tenantId,
      authContext.userId
    );

    if (!student || student.is_archived || student.academic_status !== "ACTIVE") {
      return NextResponse.json(
        { error: "No active verified student profile linked to this account." },
        { status: 403 }
      );
    }

    let fileBuffer: Buffer;
    let fileName = "resume.pdf";
    let mimeType = "application/pdf";
    let isPrimary: boolean | undefined = undefined;

    const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
    const MAX_BASE64_LENGTH = 14 * 1024 * 1024; // ~10MB decoded

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No resume file provided in upload" }, { status: 400 });
      }

      // Check size before buffering
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `File size exceeds 10MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB).` },
          { status: 400 }
        );
      }

      fileName = file.name;
      mimeType = file.type;
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);

      if (formData.has("isPrimary")) {
        isPrimary = formData.get("isPrimary") === "true";
      }
    } else {
      // JSON with base64 payload
      const body = await request.json();
      if (!body.fileBase64 || !body.fileName) {
        return NextResponse.json(
          { error: "fileBase64 and fileName are required in JSON upload payload" },
          { status: 400 }
        );
      }

      // Validate base64 string length before decoding
      if (body.fileBase64.length > MAX_BASE64_LENGTH) {
        return NextResponse.json(
          { error: "Base64 payload exceeds 10MB file size limit." },
          { status: 400 }
        );
      }

      fileName = body.fileName;
      mimeType = body.mimeType || (fileName.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf");
      fileBuffer = Buffer.from(body.fileBase64, "base64");
      isPrimary = body.isPrimary;
    }

    if (fileBuffer.length > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds maximum allowed size of 10MB." },
        { status: 400 }
      );
    }

    // Validate filename extension strictly (PDF or DOCX only)
    const lowerName = fileName.toLowerCase().trim();
    const isPdf = lowerName.endsWith(".pdf");
    const isDocx = lowerName.endsWith(".docx");

    if (!isPdf && !isDocx) {
      return NextResponse.json(
        { error: "Unsupported document format. Only PDF (.pdf) and Word (.docx) files are supported." },
        { status: 400 }
      );
    }

    // Magic number checks
    if (isPdf) {
      if (!fileBuffer.subarray(0, 5).toString("latin1").startsWith("%PDF")) {
        return NextResponse.json(
          { error: "Invalid binary signature: file does not match PDF format." },
          { status: 400 }
        );
      }
      mimeType = "application/pdf";
    } else if (isDocx) {
      if (fileBuffer[0] !== 0x50 || fileBuffer[1] !== 0x4b || fileBuffer[2] !== 0x03 || fileBuffer[3] !== 0x04) {
        return NextResponse.json(
          { error: "Invalid binary signature: file is not a valid OpenXML document." },
          { status: 400 }
        );
      }
      mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    // Extract text immediately during upload
    const fileType = isDocx ? "docx" : "pdf";
    const extraction = await ResumeExtractorService.extract(fileBuffer, fileType);

    const result = await ResumeStorageService.uploadResume({
      tenantId: authContext.tenantId,
      studentId: student.id,
      fileName,
      fileBuffer,
      mimeType,
      isPrimary,
      parsedText: extraction.text,
      parsingStatus: extraction.parsingStatus,
    });

    return NextResponse.json({
      success: true,
      data: result.resume,
      signedUrl: result.signedUrl,
      extractionWarning: extraction.warning,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    console.error("[Resumes API] POST Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload resume" },
      { status: 400 }
    );
  }
}
