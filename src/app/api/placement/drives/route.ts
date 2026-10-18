/**
 * Recruitment Drives API Route
 * GET /api/placement/drives — List recruitment drives
 * POST /api/placement/drives — Create draft recruitment drive
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { DriveService } from "@/modules/recruitment-drives/services/drive-service";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.DRIVES_MANAGE);

    const searchParams = request.nextUrl.searchParams;
    const status = (searchParams.get("status") as any) || undefined;
    const companyId = searchParams.get("companyId") || undefined;
    const academicYearId = searchParams.get("academicYearId") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
    const pageSize = searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!, 10) : 10;

    const result = await DriveService.list({
      tenantId: ctx.tenantId,
      status,
      companyId,
      academicYearId,
      search,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.DRIVES_MANAGE);
    const body = await request.json();

    if (!body.companyId || !body.academicYearId || !body.title || !body.roleTitle) {
      return NextResponse.json(
        { error: "Missing required fields: companyId, academicYearId, title, roleTitle" },
        { status: 400 }
      );
    }

    const drive = await DriveService.create({
      tenantId: ctx.tenantId,
      companyId: body.companyId,
      academicYearId: body.academicYearId,
      title: body.title,
      roleTitle: body.roleTitle,
      recruitmentType: body.recruitmentType,
      jobDescription: body.jobDescription,
      location: body.location,
      compensationRange: body.compensationRange,
      registrationStart: body.registrationStart,
      registrationDeadline: body.registrationDeadline,
      internalNotes: body.internalNotes,
      createdBy: ctx.userId,
    });

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "DRIVE_CREATED",
      resourceType: "recruitment_drive",
      resourceId: drive.id,
      afterState: { title: drive.title, roleTitle: drive.role_title, status: drive.status },
    });

    return NextResponse.json(drive, { status: 201 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
