import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AnalyticsMetricService } from "@/modules/analytics/services/analytics-metric-service";

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.ANALYTICS_READ_COHORT);
    const searchParams = request.nextUrl.searchParams;
    const academicYearId = searchParams.get("academicYearId") || undefined;

    const [placementMetrics, prepMetrics, masteryMetrics, heatmapResult] = await Promise.all([
      AnalyticsMetricService.getCohortPlacementMetrics(authContext.tenantId, academicYearId),
      AnalyticsMetricService.getAssessmentPreparationMetrics(authContext.tenantId),
      AnalyticsMetricService.getMasteryProgressionMetrics(authContext.tenantId),
      AnalyticsMetricService.getTopicWeaknessHeatmap(authContext.tenantId),
    ]);

    return NextResponse.json({
      placement: placementMetrics,
      preparation: prepMetrics,
      mastery: masteryMetrics,
      topicHeatmap: heatmapResult.heatmap,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
