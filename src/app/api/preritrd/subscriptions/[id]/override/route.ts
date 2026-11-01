/**
 * Super Admin Subscription Temporary Override API
 * POST /api/preritrd/subscriptions/[id]/override
 * 
 * Permits Platform Super Admins to grant auditable, temporary operational access
 * to an overdue or locked college tenant with mandatory justification and timestamp.
 * 
 * Strict Security Architecture:
 * - Cryptographically verified Super Admin JWT/session
 * - Genuine AAL2 / MFA verification
 * - Active platform-admin registry validation
 * - Override duration restricted to 1–168 hours (7 days maximum)
 * - Mandatory reason of at least 10 characters
 * - Audit record containing administrator ID, college ID, duration and justification
 */

import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Strict Super Admin Authentication & AAL2/MFA Verification
    const adminAuth = await PlatformAuthService.requireSuperAdmin(req, { requireAal2: true });
    const { id } = await params;
    const body = await req.json();

    const { overrideHours, overrideUntil, reason } = body;

    // 2. Mandatory reason verification: minimum 10 characters
    if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
      return NextResponse.json(
        { error: "Invalid reason: A mandatory justification of at least 10 characters is required." },
        { status: 400 }
      );
    }

    // 3. Duration verification: restricted to 1–168 hours
    const now = Date.now();
    let calculatedUntil: Date;
    let durationHours: number;

    if (overrideHours !== undefined && overrideHours !== null) {
      const hoursNum = Number(overrideHours);
      if (isNaN(hoursNum) || hoursNum < 1 || hoursNum > 168) {
        return NextResponse.json(
          { error: "Invalid duration: overrideHours must be between 1 and 168 hours (maximum 7 days)." },
          { status: 400 }
        );
      }
      durationHours = Math.round(hoursNum);
      calculatedUntil = new Date(now + durationHours * 3600 * 1000);
    } else if (overrideUntil) {
      calculatedUntil = new Date(overrideUntil);
      if (isNaN(calculatedUntil.getTime()) || calculatedUntil.getTime() <= now) {
        return NextResponse.json(
          { error: "Invalid overrideUntil: timestamp must be a valid future ISO date." },
          { status: 400 }
        );
      }
      durationHours = Math.round((calculatedUntil.getTime() - now) / (3600 * 1000));
      if (durationHours < 1 || durationHours > 168) {
        return NextResponse.json(
          { error: "Invalid duration: override duration must be between 1 and 168 hours (maximum 7 days)." },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Missing duration: either overrideHours (1-168) or a valid overrideUntil timestamp is required." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 4. Fetch current subscription
    const { data: sub, error: fetchErr } = await admin
      .from("college_subscriptions")
      .select("id, tenant_id, status, temporary_override_until")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !sub) {
      return NextResponse.json(
        { error: "Subscription record not found." },
        { status: 404 }
      );
    }

    const nowIso = new Date().toISOString();

    // 5. Update override fields
    const { error: updateErr } = await admin
      .from("college_subscriptions")
      .update({
        temporary_override_until: calculatedUntil.toISOString(),
        override_reason: reason.trim(),
        override_by: adminAuth.id,
        updated_at: nowIso,
      })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json(
        { error: `Failed to update override: ${updateErr.message}` },
        { status: 500 }
      );
    }

    // 6. Structured audit log containing administrator ID, college ID, duration and justification
    await PlatformAuthService.logAuditEvent({
      actorId: adminAuth.id,
      action: "SUBSCRIPTION_TEMPORARY_OVERRIDE_GRANTED",
      resourceType: "COLLEGE_SUBSCRIPTION",
      resourceId: id,
      metadata: {
        administratorId: adminAuth.id,
        collegeId: sub.tenant_id,
        tenantId: sub.tenant_id,
        durationHours,
        temporaryOverrideUntil: calculatedUntil.toISOString(),
        justification: reason.trim(),
        reason: reason.trim(),
      },
      adminClient: admin,
    });

    return NextResponse.json({
      success: true,
      subscriptionId: id,
      collegeId: sub.tenant_id,
      tenantId: sub.tenant_id,
      durationHours,
      temporaryOverrideUntil: calculatedUntil.toISOString(),
      reason: reason.trim(),
      overrideBy: adminAuth.id,
    });
  } catch (error: any) {
    const msg = error.message || "";
    if (msg.includes("UNAUTHORIZED")) {
      return NextResponse.json({ error: "UNAUTHORIZED: Valid Super Admin session required." }, { status: 401 });
    }
    if (msg.includes("MFA_REQUIRED") || msg.includes("SESSION_NOT_AAL2")) {
      return NextResponse.json(
        { error: "MFA_REQUIRED: Genuine AAL2 / Multi-Factor Authentication required for Super Admin operational override." },
        { status: 403 }
      );
    }
    if (msg.includes("ADMIN_INACTIVE")) {
      return NextResponse.json({ error: "FORBIDDEN: ADMIN_INACTIVE: Platform administrator account is inactive." }, { status: 403 });
    }
    if (msg.includes("ADMIN_SUSPENDED")) {
      return NextResponse.json({ error: "FORBIDDEN: ADMIN_SUSPENDED: Platform administrator account is suspended." }, { status: 403 });
    }
    if (msg.includes("NOT_PLATFORM_ADMIN") || msg.includes("FORBIDDEN")) {
      return NextResponse.json({ error: "FORBIDDEN: NOT_PLATFORM_ADMIN: Super Admin privileges required." }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
