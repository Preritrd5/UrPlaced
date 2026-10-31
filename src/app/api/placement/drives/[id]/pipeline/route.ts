/**
 * Drive Candidate Pipeline API
 * GET /api/placement/drives/[id]/pipeline
 * 
 * Returns full recruitment pipeline data: drive metadata, configured stages,
 * registered candidates grouped by stage, and candidate evaluation records.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { DriveService } from "@/modules/recruitment-drives/services/drive-service";
import { StageService } from "@/modules/recruitment-drives/services/stage-service";
import { CandidateService } from "@/modules/placement/services/candidate-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: driveId } = await params;
    const ctx = await requireAuthContext(Permissions.DRIVES_MANAGE);

    const drive = await DriveService.getById(ctx.tenantId, driveId);
    if (!drive) {
      return NextResponse.json({ error: "Recruitment drive not found." }, { status: 404 });
    }

    const [stages, candidates] = await Promise.all([
      StageService.listByDrive(ctx.tenantId, driveId),
      CandidateService.listByDrive(ctx.tenantId, driveId),
    ]);

    return NextResponse.json({
      drive: {
        id: drive.id,
        title: drive.title,
        roleTitle: drive.role_title,
        company: drive.company,
        status: drive.status,
      },
      stages,
      candidates,
      totalCandidates: candidates.length,
    });
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
