/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Placement Memory: Current vs Historical Drive Comparison Service (Phase 09)
 * ==============================================================================
 * Compares current DriveFit recruitment drives against historical records.
 * Identifies shared patterns, differing attributes, unknown fields, and conflicts
 * with an evidence-based limitations disclaimer.
 */

import {
  HistoricalDriveComparisonRow,
  DriveMatchingBasis,
  DriveComparabilityStatus,
  Json,
} from "@/types/database";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const MANDATORY_LIMITATIONS_DISCLAIMER =
  "Historical drive patterns represent past hiring rounds and may not predict changes in current drive requirements. Differences in hiring volume, role level, or test vendor should be accounted for.";

export interface DriveComparisonResult {
  currentDriveId: string;
  historicalRecordId: string;
  matchingBasis: DriveMatchingBasis;
  comparabilityStatus: DriveComparabilityStatus;
  sharedAttributes: Record<string, unknown>;
  differingAttributes: Record<string, unknown>;
  unknownFields: string[];
  conflicts: string[];
  limitationsDisclaimer: string;
}

export class DriveComparisonService {
  /**
   * Compares an active drive against a historical record and persists the comparison analysis.
   */
  public static async compareAndPersist(
    tenantId: string,
    currentDriveId: string,
    historicalRecordId: string,
    generatedBy?: string
  ): Promise<{ success: boolean; comparison?: HistoricalDriveComparisonRow; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // 1. Fetch current drive
    const { data: drive, error: driveErr } = await supabase
      .from("recruitment_drives")
      .select("*, companies(name)")
      .eq("id", currentDriveId)
      .eq("tenant_id", tenantId)
      .single();

    if (driveErr || !drive) {
      return { success: false, error: driveErr?.message || "Current drive not found." };
    }

    // 2. Fetch historical record
    const { data: record, error: recordErr } = await supabase
      .from("historical_recruitment_records")
      .select("*, companies(name)")
      .eq("id", historicalRecordId)
      .single();

    if (recordErr || !record) {
      return { success: false, error: recordErr?.message || "Historical recruitment record not found." };
    }

    // 3. Compute matching basis
    let matchingBasis: DriveMatchingBasis = "ROLE_FAMILY_MATCH";
    if (drive.company_id === record.company_id) {
      const driveRole = (drive.role_title || "").trim().toLowerCase();
      const histRole = (record.role_title || "").trim().toLowerCase();
      if (driveRole === histRole || driveRole.includes(histRole) || histRole.includes(driveRole)) {
        matchingBasis = "SAME_COMPANY_AND_ROLE";
      } else {
        matchingBasis = "SAME_COMPANY_DIFFERENT_ROLE";
      }
    }

    // 4. Analyze Shared vs Differing Attributes & Unknowns
    const shared: Record<string, unknown> = {};
    const differing: Record<string, unknown> = {};
    const unknowns: string[] = [];
    const conflicts: string[] = [];

    // Company match
    if (drive.company_id === record.company_id) {
      shared.company = drive.companies?.name || "Matched Company";
    } else {
      differing.company = {
        current: drive.companies?.name,
        historical: record.companies?.name,
      };
    }

    // Role Match
    if (drive.role_title.toLowerCase() === record.role_title.toLowerCase()) {
      shared.role_title = drive.role_title;
    } else {
      differing.role_title = {
        current: drive.role_title,
        historical: record.role_title,
      };
    }

    // Eligibility snapshot comparison
    const histElig = (record.eligibility_criteria_snapshot || {}) as Record<string, unknown>;
    if (drive.min_cgpa !== null && drive.min_cgpa !== undefined) {
      if (histElig.min_cgpa !== undefined) {
        if (Number(drive.min_cgpa) === Number(histElig.min_cgpa)) {
          shared.min_cgpa = drive.min_cgpa;
        } else {
          differing.min_cgpa = {
            current: drive.min_cgpa,
            historical: histElig.min_cgpa,
          };
        }
      } else {
        unknowns.push("historical_min_cgpa_unspecified");
      }
    } else {
      unknowns.push("current_min_cgpa_unspecified");
    }

    // Rounds comparison
    const confirmedRounds = Array.isArray(record.confirmed_rounds) ? record.confirmed_rounds : [];
    const reportedRounds = Array.isArray(record.reported_rounds) ? record.reported_rounds : [];
    const allHistRounds = [...confirmedRounds, ...reportedRounds];

    if (allHistRounds.length === 0) {
      unknowns.push("historical_rounds_structure_unknown");
    } else {
      shared.historical_rounds_count = allHistRounds.length;
    }

    // Package / CTC Comparison
    if (drive.compensation_details) {
      shared.current_compensation = drive.compensation_details;
    } else {
      unknowns.push("current_compensation_details_not_disclosed");
    }

    // Determine comparability status
    let comparabilityStatus: DriveComparabilityStatus = "HIGHLY_COMPARABLE";
    if (matchingBasis === "ROLE_FAMILY_MATCH") {
      comparabilityStatus = "PARTIALLY_COMPARABLE";
    } else if (unknowns.length >= 3) {
      comparabilityStatus = "LIMITED_EVIDENCE";
    } else if (Object.keys(differing).length > 2) {
      comparabilityStatus = "PARTIALLY_COMPARABLE";
    }

    // 5. Persist comparison record
    const insertPayload = {
      tenant_id: tenantId,
      current_drive_id: currentDriveId,
      historical_record_id: historicalRecordId,
      matching_basis: matchingBasis,
      shared_attributes: shared as Json,
      differing_attributes: differing as Json,
      unknown_fields: unknowns as unknown as Json,
      conflicts: conflicts as unknown as Json,
      comparability_status: comparabilityStatus,
      limitations_disclaimer: MANDATORY_LIMITATIONS_DISCLAIMER,
      generated_by: generatedBy || null,
      generated_at: new Date().toISOString(),
    };

    const { data: comparison, error: saveErr } = await supabase
      .from("historical_drive_comparisons")
      .insert(insertPayload)
      .select()
      .single();

    if (saveErr || !comparison) {
      return { success: false, error: saveErr?.message || "Failed to persist drive comparison." };
    }

    return { success: true, comparison };
  }

  /**
   * Retrieves all saved drive comparisons for a specific active drive.
   */
  public static async getComparisonsForDrive(
    tenantId: string,
    currentDriveId: string
  ): Promise<{ success: boolean; comparisons: HistoricalDriveComparisonRow[]; error?: string }> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("historical_drive_comparisons")
      .select("*, historical_recruitment_records(*, companies(name))")
      .eq("tenant_id", tenantId)
      .eq("current_drive_id", currentDriveId)
      .order("generated_at", { ascending: false });

    if (error) {
      return { success: false, comparisons: [], error: error.message };
    }

    return { success: true, comparisons: data || [] };
  }
}
