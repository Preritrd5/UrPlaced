/**
 * College Placement Offers API
 * GET /api/placement/offers
 * 
 * Returns all placement offers issued across all campus drives for the college tenant,
 * along with institutional placement metrics (average CTC, highest package, acceptance rates).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.OUTCOMES_MANAGE);

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") || "ALL";
    const driveId = searchParams.get("driveId") || "";

    const supabase = createAdminClient();

    let query = supabase
      .from("placement_offers")
      .select(
        "*, student:students(id, full_name, enrollment_number, cgpa, department:departments(name, code)), drive:recruitment_drives(id, title, role_title, company:companies(id, name, industry))"
      )
      .eq("tenant_id", ctx.tenantId)
      .order("offered_at", { ascending: false });

    if (status !== "ALL") {
      query = query.eq("status", status);
    }

    if (driveId) {
      query = query.eq("drive_id", driveId);
    }

    const { data: offers, error } = await query;
    if (error) {
      throw new Error(`Failed to list placement offers: ${error.message}`);
    }

    const allOffers = offers || [];

    // Compute placement metrics
    const totalOffers = allOffers.length;
    const acceptedCount = allOffers.filter((o) => o.status === "ACCEPTED").length;
    const declinedCount = allOffers.filter((o) => o.status === "DECLINED").length;
    const pendingCount = allOffers.filter((o) => o.status === "OFFERED").length;

    const amounts = allOffers
      .map((o) => (o.compensation_amount ? Number(o.compensation_amount) : 0))
      .filter((a) => a > 0);

    const highestCtc = amounts.length > 0 ? Math.max(...amounts) : 0;
    const averageCtc =
      amounts.length > 0 ? Math.round(amounts.reduce((sum, a) => sum + a, 0) / amounts.length) : 0;

    return NextResponse.json({
      offers: allOffers,
      metrics: {
        totalOffers,
        acceptedCount,
        declinedCount,
        pendingCount,
        highestCtc,
        averageCtc,
      },
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
