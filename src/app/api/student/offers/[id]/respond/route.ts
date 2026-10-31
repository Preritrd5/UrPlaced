/**
 * Student Offer Decision API
 * POST /api/student/offers/[id]/respond
 * 
 * Allows a student to officially ACCEPT or DECLINE a placement offer.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { OutcomeService } from "@/modules/placement/services/outcome-service";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { NotificationService } from "@/modules/notifications/services/notification-service";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: offerId } = await params;
    const ctx = await requireAuthContext(Permissions.OUTCOMES_READ_OWN);

    const student = await StudentService.getByUserId(ctx.tenantId, ctx.userId);
    if (!student) {
      return NextResponse.json({ error: "Student roster record not found." }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.action || !["ACCEPT", "DECLINE"].includes(body.action)) {
      return NextResponse.json(
        { error: "action must be either 'ACCEPT' or 'DECLINE'." },
        { status: 400 }
      );
    }

    // Verify offer ownership
    const supabase = createAdminClient();
    const { data: offer, error: offerErr } = await supabase
      .from("placement_offers")
      .select("id, student_id, status, drive:recruitment_drives(role_title, company:companies(name))")
      .eq("tenant_id", ctx.tenantId)
      .eq("id", offerId)
      .single();

    if (offerErr || !offer) {
      return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    }

    if (offer.student_id !== student.id) {
      return NextResponse.json({ error: "Unauthorized access to offer." }, { status: 403 });
    }

    if (offer.status === "ACCEPTED" || offer.status === "DECLINED") {
      return NextResponse.json(
        { error: `This offer has already been ${offer.status.toLowerCase()}.` },
        { status: 400 }
      );
    }

    const targetStatus = body.action === "ACCEPT" ? "ACCEPTED" : "DECLINED";

    const updatedOffer = await OutcomeService.updateStatus(ctx.tenantId, offerId, targetStatus as any);

    const roleTitle = (offer.drive as any)?.role_title || "Placement Offer";
    const companyName = (offer.drive as any)?.company?.name || "Corporate Partner";

    // Audit log
    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: targetStatus === "ACCEPTED" ? "OFFER_ACCEPTED" : "OFFER_DECLINED",
      resourceType: "placement_offer",
      resourceId: offerId,
      afterState: {
        studentId: student.id,
        enrollmentNumber: student.enrollment_number,
        status: targetStatus,
      },
    }).catch(() => null);

    // Confirmation notification
    await NotificationService.createNotification({
      recipientUserId: ctx.userId,
      collegeId: ctx.tenantId,
      actorUserId: ctx.userId,
      type: "SYSTEM_ALERT",
      title: targetStatus === "ACCEPTED" ? "Placement Offer Accepted!" : "Offer Declined",
      body:
        targetStatus === "ACCEPTED"
          ? `Congratulations! You have accepted the offer for ${roleTitle} at ${companyName}. Your placement status is officially confirmed.`
          : `You have declined the offer for ${roleTitle} at ${companyName}.`,
      actionUrl: "/dashboard/student/offers",
    }).catch(() => null);

    return NextResponse.json(updatedOffer);
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
