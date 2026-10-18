/**
 * Placement Outcome & Offer Service
 * Manages job offers, student acceptance lifecycles, compensation records, and placement verifications.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, OfferStatus, RecruitmentType } from "@/types/database";

export type PlacementOfferRow = Database["public"]["Tables"]["placement_offers"]["Row"];

export class OutcomeService {
  /**
   * Record a placement offer for a candidate
   */
  static async recordOffer(params: {
    tenantId: string;
    studentId: string;
    driveId: string;
    applicationId: string;
    offerType?: RecruitmentType;
    compensationAmount?: number | null;
    compensationDetails?: string | null;
    status?: OfferStatus;
    joiningDate?: string | null;
    internalNotes?: string | null;
    recordedBy?: string | null;
  }): Promise<PlacementOfferRow> {
    const supabase = createAdminClient();

    const { data: offer, error } = await supabase
      .from("placement_offers")
      .insert({
        tenant_id: params.tenantId,
        student_id: params.studentId,
        drive_id: params.driveId,
        application_id: params.applicationId,
        offer_type: params.offerType || "FULL_TIME",
        compensation_amount: params.compensationAmount ?? null,
        compensation_details: params.compensationDetails || null,
        status: params.status || "OFFERED",
        joining_date: params.joiningDate || null,
        internal_notes: params.internalNotes || null,
        recorded_by: params.recordedBy || null,
        is_verified: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error("An offer has already been recorded for this application.");
      }
      throw new Error(`Failed to record placement offer: ${error.message}`);
    }

    // Update application status to OFFER_EXTENDED
    await supabase
      .from("drive_applications")
      .update({ status: "OFFER_EXTENDED", updated_at: new Date().toISOString() })
      .eq("id", params.applicationId);

    return offer;
  }

  /**
   * Update offer status (e.g. Student ACCEPTED or DECLINED)
   */
  static async updateStatus(
    tenantId: string,
    offerId: string,
    status: OfferStatus
  ): Promise<PlacementOfferRow> {
    const supabase = createAdminClient();

    const { data: offer, error } = await supabase
      .from("placement_offers")
      .update({
        status,
        decision_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", offerId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update offer status: ${error.message}`);
    }

    // Sync status back to drive_application
    const appStatus =
      status === "ACCEPTED"
        ? "OFFER_ACCEPTED"
        : status === "DECLINED"
        ? "OFFER_DECLINED"
        : "OFFER_EXTENDED";

    await supabase
      .from("drive_applications")
      .update({ status: appStatus, updated_at: new Date().toISOString() })
      .eq("id", offer.application_id);

    return offer;
  }

  /**
   * List offers by drive
   */
  static async listByDrive(tenantId: string, driveId: string): Promise<any[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("placement_offers")
      .select("*, student:students(*, department:departments(name, code))")
      .eq("tenant_id", tenantId)
      .eq("drive_id", driveId)
      .order("offered_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to list drive placement offers: ${error.message}`);
    }

    return data || [];
  }

  /**
   * List offers by student
   */
  static async listByStudent(tenantId: string, studentId: string): Promise<any[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("placement_offers")
      .select("*, drive:recruitment_drives(title, role_title, company:companies(name))")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .order("offered_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to list student offers: ${error.message}`);
    }

    // Strip internal notes for student-facing response
    return (data || []).map((o: any) => ({
      ...o,
      internal_notes: undefined,
    }));
  }
}
