import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { BankCategory, BankSharingPolicy } from "@/types/database";
import { validateSubjectName, normalizeSubjectName } from "@/modules/question-bank/services/subject-constants";

const ALLOWED_CATEGORIES: BankCategory[] = [
  "CODING",
  "APTITUDE",
  "TECHNICAL_CORE",
  "BEHAVIORAL",
  "GENERAL",
  "COMPANY_SPECIFIC",
];

const ALLOWED_SHARING_POLICIES: BankSharingPolicy[] = [
  "COLLEGE_PRIVATE",
  "EXPLICITLY_SHARED",
  "GLOBAL_SHARED",
];

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTIONS_CREATE);
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject") || undefined;
    const category = (searchParams.get("category") as BankCategory) || undefined;

    const { data: banks, error } =
      subject || category
        ? await QuestionService.listBanks(authContext.tenantId, { subject, category })
        : await QuestionService.listBanks(authContext.tenantId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(banks || []);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTIONS_CREATE);
    const body = await request.json();

    const cleanName = typeof body.name === "string" ? body.name.trim() : "";
    if (!cleanName) {
      return NextResponse.json(
        { error: "Question Bank name is required and cannot be empty." },
        { status: 400 }
      );
    }

    if (cleanName.length > 256) {
      return NextResponse.json(
        { error: "Question Bank name cannot exceed 256 characters." },
        { status: 400 }
      );
    }

    const rawSubject = typeof body.subject === "string" ? body.subject.trim() : "";
    let cleanSubject = cleanName;
    if (rawSubject) {
      const subjectCheck = validateSubjectName(rawSubject);
      if (!subjectCheck.isValid) {
        return NextResponse.json({ error: subjectCheck.error }, { status: 400 });
      }
      cleanSubject = subjectCheck.normalized || cleanName;
    } else {
      cleanSubject = normalizeSubjectName(cleanName);
    }

    if (!body.category || !ALLOWED_CATEGORIES.includes(body.category)) {
      return NextResponse.json(
        {
          error: `Invalid or missing category. Allowed: ${ALLOWED_CATEGORIES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const sharingPolicy: BankSharingPolicy =
      body.sharing_policy && ALLOWED_SHARING_POLICIES.includes(body.sharing_policy)
        ? body.sharing_policy
        : "COLLEGE_PRIVATE";

    const { data: bank, error } = await QuestionService.createBank(
      authContext.tenantId,
      authContext.userId,
      {
        name: cleanName,
        subject: cleanSubject,
        description: typeof body.description === "string" ? body.description.trim() : undefined,
        category: body.category as BankCategory,
        sharing_policy: sharingPolicy,
      }
    );

    if (error) {
      const isConflict = error.message?.includes("already exists");
      return NextResponse.json({ error: error.message }, { status: isConflict ? 409 : 500 });
    }

    return NextResponse.json(bank, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
