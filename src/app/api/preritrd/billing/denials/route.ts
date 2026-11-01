/**
 * Super Admin Access Denial Diagnostic API
 * GET /api/preritrd/billing/denials
 * 
 * Surfaces security-relevant payment-gated access denial events for Super Admin review.
 */

import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin();
    const admin = createAdminClient();

    const searchParams = req.nextUrl.searchParams;
    const tenantId = searchParams.get("tenantId") || undefined;
    const decision = searchParams.get("decision") || undefined;
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

    let query = admin
      .from("subscription_access_denials")
      .select(`
        id,
        tenant_id,
        subscription_id,
        user_id,
        user_role,
        feature_key,
        route_category,
        decision,
        reason_code,
        message,
        created_at,
        tenants (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    if (decision) {
      query = query.eq("decision", decision);
    }

    const { data: denials, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      denials: denials || [],
      count: (denials || []).length,
    });
  } catch (error: any) {
    if (error.message?.includes("UNAUTHORIZED") || error.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: "Super Admin privileges required." }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Failed to fetch access denials." }, { status: 500 });
  }
}
