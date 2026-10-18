/**
 * Placement Metrics API Route
 * GET /api/placement/metrics — Real-time aggregate operational metrics
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { PlacementMetricsService } from "@/modules/placement/services/placement-metrics-service";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.DASHBOARD_READ);
    const academicYearId = request.nextUrl.searchParams.get("academicYearId") || undefined;

    const metrics = await PlacementMetricsService.getDashboardMetrics(ctx.tenantId, academicYearId);
    return NextResponse.json(metrics);
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
