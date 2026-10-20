import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { DriveComparisonService } from "@/modules/placement-memory/services/drive-comparison-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ driveId: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.PLACEMENT_MEMORY_READ);
    const { driveId } = await params;

    const result = await DriveComparisonService.getComparisonsForDrive(
      authContext.tenantId,
      driveId
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ comparisons: result.comparisons });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ driveId: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.PLACEMENT_MEMORY_MANAGE);
    const { driveId } = await params;
    const body = await request.json();

    if (!body.historicalRecordId) {
      return NextResponse.json({ error: "Missing historicalRecordId parameter" }, { status: 400 });
    }

    const result = await DriveComparisonService.compareAndPersist(
      authContext.tenantId,
      driveId,
      body.historicalRecordId,
      authContext.userId
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ comparison: result.comparison }, { status: 201 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
