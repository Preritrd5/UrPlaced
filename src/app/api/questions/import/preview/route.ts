import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { ImportService } from "@/modules/question-bank/services/import-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTIONS_IMPORT);

    let csvContent = "";
    let fileName = "upload.csv";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
      }
      fileName = file.name;
      csvContent = await file.text();
    } else {
      const body = await request.json();
      csvContent = body.csvContent || "";
      fileName = body.fileName || fileName;
    }

    if (!csvContent || csvContent.trim().length === 0) {
      return NextResponse.json({ error: "Empty file or content." }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: existingVersions } = await supabase
      .from("question_versions")
      .select("question_id, id, prompt, fingerprint")
      .eq("tenant_id", authContext.tenantId)
      .limit(300);

    const existingItems = (existingVersions || []).map((v: any) => ({
      questionId: v.question_id,
      versionId: v.id,
      prompt: v.prompt,
      fingerprint: v.fingerprint,
    }));

    const preview = await ImportService.previewImport(
      authContext.tenantId,
      fileName,
      csvContent,
      existingItems
    );

    return NextResponse.json(preview);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
