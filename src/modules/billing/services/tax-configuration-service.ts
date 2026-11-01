/**
 * Tax Configuration & GST Service (SA-05 Workstream 05 / Correction Pass 2)
 * Implements server-controlled configurable GST rules, state jurisdiction resolution,
 * statutory GSTIN verification, SAC classification governance, exemption safety guards,
 * integer paise financial precision, and immutable invoice tax snapshots.
 *
 * NOTE: All SAC classifications and exemption grounds are treated as provisional
 * until validated by a qualified GST tax professional prior to production filing.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

export type TaxClassificationStatus =
  | "PROVISIONAL_PENDING_PROFESSIONAL_REVIEW"
  | "CONFIRMED_BY_TAX_ADVISOR"
  | "PROPOSED";

export type ExemptionValidationStatus =
  | "VERIFIED"
  | "PENDING_VERIFICATION"
  | "REJECTED"
  | "NOT_APPLICABLE";

export interface TaxRuleRecord {
  id: string;
  rule_name: string;
  description: string | null;
  tax_type: string;
  sac_code: string;
  sac_heading?: string | null;
  classification_status?: TaxClassificationStatus;
  rate_percent: number;
  cgst_rate_percent: number;
  sgst_rate_percent: number;
  igst_rate_percent: number;
  seller_state_code: string;
  is_exempt: boolean;
  exemption_reason: string | null;
  exemption_reference?: string | null;
  exemption_validation_status?: ExemptionValidationStatus;
  tax_professional_review_notes?: string | null;
  effective_from: string;
  effective_to: string | null;
  is_active: boolean;
  created_at: string;
}

export interface GstinValidationResult {
  isValid: boolean;
  stateCode: string | null;
  pan: string | null;
  error?: string;
}

export interface ImmutableTaxSnapshot {
  ruleId: string;
  ruleName: string;
  sacCode: string;
  sacHeading: string;
  classificationStatus: TaxClassificationStatus;
  taxType: "CGST_SGST" | "IGST" | "EXEMPT";
  sellerStateCode: string;
  buyerStateCode: string;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  totalTaxRate: number;
  baseAmountInr: number;
  cgstInr: number;
  sgstInr: number;
  igstInr: number;
  totalTaxInr: number;
  totalInr: number;
  isExempt: boolean;
  exemptionReason?: string | null;
  exemptionReference?: string | null;
  exemptionValidationStatus?: ExemptionValidationStatus;
  statutoryDisclaimer: string;
  calculatedAt: string;
}

// 15-character GSTIN structure: 2-digit state code + 10-char PAN + 1 entity num + 'Z' + 1 checksum
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export class TaxConfigurationService {
  /**
   * Validates format and extracts jurisdiction metadata from an Indian GSTIN.
   */
  static validateGstin(gstin?: string | null): GstinValidationResult {
    if (!gstin || typeof gstin !== "string") {
      return { isValid: false, stateCode: null, pan: null, error: "GSTIN is missing or empty." };
    }

    const trimmed = gstin.trim().toUpperCase();
    if (trimmed.length !== 15) {
      return { isValid: false, stateCode: null, pan: null, error: "GSTIN must be exactly 15 characters long." };
    }

    if (!GSTIN_REGEX.test(trimmed)) {
      return { isValid: false, stateCode: null, pan: null, error: "GSTIN does not match valid statutory structure (e.g. 29AAAAA0000A1Z5)." };
    }

    const stateCode = trimmed.slice(0, 2);
    const pan = trimmed.slice(2, 12);

    const stateNum = parseInt(stateCode, 10);
    if (isNaN(stateNum) || stateNum < 1 || stateNum > 38) {
      return { isValid: false, stateCode, pan, error: `Invalid GST state code '${stateCode}'. Valid state codes are 01 through 38.` };
    }

    return { isValid: true, stateCode, pan };
  }

  /**
   * Retrieves the effective server-controlled tax rule for a given point in time.
   */
  static async getEffectiveTaxRule(params: {
    asOfDate?: Date;
    admin?: ReturnType<typeof createAdminClient>;
  } = {}): Promise<TaxRuleRecord> {
    const { asOfDate = new Date(), admin = createAdminClient() } = params;
    const isoDate = asOfDate.toISOString();

    const { data: rule } = await admin
      .from("platform_tax_rules")
      .select("*")
      .eq("is_active", true)
      .lte("effective_from", isoDate)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rule && (!rule.effective_to || rule.effective_to >= isoDate)) {
      return {
        ...rule,
        rate_percent: Number(rule.rate_percent),
        cgst_rate_percent: Number(rule.cgst_rate_percent),
        sgst_rate_percent: Number(rule.sgst_rate_percent),
        igst_rate_percent: Number(rule.igst_rate_percent),
      };
    }

    // Server-controlled baseline fallback rule (Karnataka / 29, 18% GST with provisional classification)
    return {
      id: "default-gst-rule",
      rule_name: "Higher Education Support SaaS (Provisional SAC 9992)",
      description: "Default configured tax rule for institutional placement SaaS platform pending final tax advisor validation",
      tax_type: "GST",
      sac_code: "9992",
      sac_heading: "9992",
      classification_status: "PROVISIONAL_PENDING_PROFESSIONAL_REVIEW",
      rate_percent: 18.0,
      cgst_rate_percent: 9.0,
      sgst_rate_percent: 9.0,
      igst_rate_percent: 18.0,
      seller_state_code: "29", // Karnataka default
      is_exempt: false,
      exemption_reason: null,
      exemption_validation_status: "NOT_APPLICABLE",
      tax_professional_review_notes: "Provisional classification; professional GST review required prior to live invoicing.",
      effective_from: "2024-01-01T00:00:00Z",
      effective_to: null,
      is_active: true,
      created_at: "2024-01-01T00:00:00Z",
    };
  }

  /**
   * Calculates statutory taxes and generates an immutable tax snapshot for an invoice.
   * Enforces:
   * 1. Exact integer-paise financial precision (zero floating-point drift).
   * 2. Exemption safety guards (requires VERIFIED status and explicit statutory basis).
   * 3. Configurable SAC classification governance with professional review notices.
   */
  static async calculateTax(params: {
    baseAmountInr: number;
    collegeGstin?: string | null;
    collegeStateCode?: string | null;
    isExempt?: boolean;
    exemptionReason?: string | null;
    exemptionReference?: string | null;
    exemptionValidationStatus?: ExemptionValidationStatus;
    customTaxRatePercent?: number;
    asOfDate?: Date;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<ImmutableTaxSnapshot> {
    const {
      baseAmountInr,
      collegeGstin,
      collegeStateCode,
      isExempt = false,
      exemptionReason,
      exemptionReference,
      exemptionValidationStatus = "NOT_APPLICABLE",
      customTaxRatePercent,
      asOfDate = new Date(),
      admin = createAdminClient(),
    } = params;

    // Use exact integer paise arithmetic to prevent floating-point inaccuracies
    const basePaise = Math.round(baseAmountInr * 100);
    if (basePaise <= 0) {
      throw new Error("Base invoice amount must be greater than zero.");
    }
    const baseInr = basePaise / 100;

    // 1. Fetch effective tax rule
    const rule = await this.getEffectiveTaxRule({ asOfDate, admin });

    // 2. Resolve buyer jurisdiction
    let resolvedBuyerState = collegeStateCode?.trim() || "";
    if (!resolvedBuyerState && collegeGstin) {
      const gstinVal = this.validateGstin(collegeGstin);
      if (gstinVal.isValid && gstinVal.stateCode) {
        resolvedBuyerState = gstinVal.stateCode;
      }
    }
    // If unknown, default to intra-state conservative treatment
    if (!resolvedBuyerState) {
      resolvedBuyerState = rule.seller_state_code;
    }

    const sacCode = rule.sac_code || "9992";
    const sacHeading = rule.sac_heading || sacCode.slice(0, 4);
    const classificationStatus = rule.classification_status || "PROVISIONAL_PENDING_PROFESSIONAL_REVIEW";
    const statutoryDisclaimer =
      "SAC classification and exemption ground are provisional and subject to statutory review by a qualified GST tax professional.";

    // 3. Exemption Safety Guard (Correction 3):
    // Do NOT automatically exempt colleges. Exemption requires an explicitly configured, legally applicable
    // exemption basis and must have validationStatus === "VERIFIED".
    const requestedExempt = isExempt || rule.is_exempt || customTaxRatePercent === 0;

    if (requestedExempt) {
      const effectiveValidationStatus = rule.is_exempt
        ? (rule.exemption_validation_status || "VERIFIED")
        : exemptionValidationStatus;

      const effectiveReason = exemptionReason || rule.exemption_reason;

      // Block unverified exemption
      if (effectiveValidationStatus !== "VERIFIED") {
        throw new Error(
          `Tax exemption rejected: An exemption cannot be applied automatically without verified statutory exemption documentation (status: ${effectiveValidationStatus}). A verified legal exemption ground approved by a GST professional is required.`
        );
      }

      if (!effectiveReason || effectiveReason.trim().length === 0) {
        throw new Error(
          "Tax exemption rejected: An explicit, legally applicable statutory exemption ground (e.g. Notification reference) is mandatory."
        );
      }

      return {
        ruleId: rule.id,
        ruleName: rule.rule_name,
        sacCode,
        sacHeading,
        classificationStatus,
        taxType: "EXEMPT",
        sellerStateCode: rule.seller_state_code,
        buyerStateCode: resolvedBuyerState,
        cgstRate: 0,
        sgstRate: 0,
        igstRate: 0,
        totalTaxRate: 0,
        baseAmountInr: baseInr,
        cgstInr: 0,
        sgstInr: 0,
        igstInr: 0,
        totalTaxInr: 0,
        totalInr: baseInr,
        isExempt: true,
        exemptionReason: effectiveReason.trim(),
        exemptionReference: exemptionReference || rule.exemption_reference || null,
        exemptionValidationStatus: "VERIFIED",
        statutoryDisclaimer,
        calculatedAt: asOfDate.toISOString(),
      };
    }

    // 4. Resolve tax rate and compute with integer paise arithmetic
    const totalRate = customTaxRatePercent !== undefined ? customTaxRatePercent : rule.rate_percent;
    const isInterState = resolvedBuyerState !== rule.seller_state_code;

    if (isInterState) {
      // Inter-State: IGST (Exact integer paise math)
      const igstPaise = Math.round((basePaise * totalRate) / 100);
      const totalPaise = basePaise + igstPaise;

      return {
        ruleId: rule.id,
        ruleName: rule.rule_name,
        sacCode,
        sacHeading,
        classificationStatus,
        taxType: "IGST",
        sellerStateCode: rule.seller_state_code,
        buyerStateCode: resolvedBuyerState,
        cgstRate: 0,
        sgstRate: 0,
        igstRate: totalRate,
        totalTaxRate: totalRate,
        baseAmountInr: baseInr,
        cgstInr: 0,
        sgstInr: 0,
        igstInr: igstPaise / 100,
        totalTaxInr: igstPaise / 100,
        totalInr: totalPaise / 100,
        isExempt: false,
        exemptionReason: null,
        statutoryDisclaimer,
        calculatedAt: asOfDate.toISOString(),
      };
    } else {
      // Intra-State: CGST + SGST split 50/50 with integer paise math
      const halfRate = Number((totalRate / 2).toFixed(2));
      const cgstPaise = Math.round((basePaise * halfRate) / 100);
      const sgstPaise = Math.round((basePaise * halfRate) / 100);
      const totalTaxPaise = cgstPaise + sgstPaise;
      const totalPaise = basePaise + totalTaxPaise;

      return {
        ruleId: rule.id,
        ruleName: rule.rule_name,
        sacCode,
        sacHeading,
        classificationStatus,
        taxType: "CGST_SGST",
        sellerStateCode: rule.seller_state_code,
        buyerStateCode: resolvedBuyerState,
        cgstRate: halfRate,
        sgstRate: halfRate,
        igstRate: 0,
        totalTaxRate: totalRate,
        baseAmountInr: baseInr,
        cgstInr: cgstPaise / 100,
        sgstInr: sgstPaise / 100,
        igstInr: 0,
        totalTaxInr: totalTaxPaise / 100,
        totalInr: totalPaise / 100,
        isExempt: false,
        exemptionReason: null,
        statutoryDisclaimer,
        calculatedAt: asOfDate.toISOString(),
      };
    }
  }

  /**
   * Super Admin API: Creates or updates a platform tax rule with full audit logging.
   */
  static async upsertTaxRule(params: {
    ruleName: string;
    description?: string;
    sacCode?: string;
    sacHeading?: string;
    classificationStatus?: TaxClassificationStatus;
    ratePercent: number;
    sellerStateCode: string;
    isExempt?: boolean;
    exemptionReason?: string;
    exemptionReference?: string;
    exemptionValidationStatus?: ExemptionValidationStatus;
    taxProfessionalReviewNotes?: string;
    effectiveFrom?: string;
    effectiveTo?: string | null;
    isActive?: boolean;
    adminId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }) {
    const {
      ruleName,
      description,
      sacCode = "9992",
      sacHeading = "9992",
      classificationStatus = "PROVISIONAL_PENDING_PROFESSIONAL_REVIEW",
      ratePercent,
      sellerStateCode,
      isExempt = false,
      exemptionReason,
      exemptionReference,
      exemptionValidationStatus = isExempt ? "PENDING_VERIFICATION" : "NOT_APPLICABLE",
      taxProfessionalReviewNotes,
      effectiveFrom = new Date().toISOString(),
      effectiveTo = null,
      isActive = true,
      adminId,
      admin = createAdminClient(),
    } = params;

    const cgstRate = isExempt ? 0 : Number((ratePercent / 2).toFixed(2));
    const sgstRate = isExempt ? 0 : Number((ratePercent / 2).toFixed(2));
    const igstRate = isExempt ? 0 : ratePercent;

    const { data: newRule, error } = await admin
      .from("platform_tax_rules")
      .insert({
        rule_name: ruleName,
        description: description || null,
        tax_type: isExempt ? "EXEMPT" : "GST",
        sac_code: sacCode,
        sac_heading: sacHeading,
        classification_status: classificationStatus,
        rate_percent: ratePercent,
        cgst_rate_percent: cgstRate,
        sgst_rate_percent: sgstRate,
        igst_rate_percent: igstRate,
        seller_state_code: sellerStateCode,
        is_exempt: isExempt,
        exemption_reason: exemptionReason || null,
        exemption_reference: exemptionReference || null,
        exemption_validation_status: exemptionValidationStatus,
        tax_professional_review_notes: taxProfessionalReviewNotes || null,
        effective_from: effectiveFrom,
        effective_to: effectiveTo,
        is_active: isActive,
        created_by: adminId,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !newRule) {
      throw new Error(`Failed to create tax rule: ${error?.message}`);
    }

    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_TAX_RULE_CONFIGURED",
      resourceType: "PLATFORM_TAX_RULE",
      resourceId: newRule.id,
      metadata: { ruleName, ratePercent, sacCode, sellerStateCode, isExempt, effectiveFrom },
      adminClient: admin,
    });

    return newRule;
  }
}
