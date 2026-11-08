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

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No resume file provided in upload" }, { status: 400 });
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
      fileName = body.fileName;
      mimeType = body.mimeType || (fileName.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf");
      fileBuffer = Buffer.from(body.fileBase64, "base64");
      isPrimary = body.isPrimary;
    }

    // Extract text immediately during upload
    const fileType = fileName.toLowerCase().endsWith(".docx") ? "docx" : "pdf";
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
