/**
 * UrPlaced — Subscription Plans, Entitlements & Versioning Types
 * SA-04 Architecture & Feature Catalogue Definitions
 */

export type PlanStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type BillingInterval = "MONTHLY" | "QUARTERLY" | "ANNUAL";

export type FeatureCategory =
  | "CORE_PLACEMENT"
  | "ASSESSMENT_TESTING"
  | "INTELLIGENCE_ANALYTICS"
  | "AI_CAPABILITIES"
  | "INSTITUTIONAL_ADMIN";

export interface PlanFeatureDefinition {
  key: string;
  name: string;
  description: string;
  category: FeatureCategory;
  defaultTiers: ("starter" | "growth" | "enterprise")[];
}

export interface PlanLimitDefinition {
  key: string;
  name: string;
  description: string;
  unit: string;
  defaultValues: {
    starter: number | null;
    growth: number | null;
    enterprise: number | null;
  };
}

/**
 * Controlled Catalogue of UrPlaced Product Modules & Entitlements
 * Strictly mapped to actual features supported in the application code.
 */
export const CONTROLLED_FEATURE_CATALOGUE: PlanFeatureDefinition[] = [
  // 1. Core Placement Management
  {
    key: "core_drives_management",
    name: "Recruitment Drives & Scheduling",
    description: "Create, schedule, and orchestrate on-campus and virtual recruitment drives.",
    category: "CORE_PLACEMENT",
    defaultTiers: ["starter", "growth", "enterprise"],
  },
  {
    key: "student_roster_directory",
    name: "Student Directory & SRN Verification",
    description: "Manage official student rosters, institutional enrollment numbers, and verification.",
    category: "CORE_PLACEMENT",
    defaultTiers: ["starter", "growth", "enterprise"],
  },
  {
    key: "company_management",
    name: "Company Relationship Hub",
    description: "Maintain hiring partner directory, tier categorization, and historical salary bands.",
    category: "CORE_PLACEMENT",
    defaultTiers: ["starter", "growth", "enterprise"],
  },

  // 2. Assessment & Testing
  {
    key: "standard_assessments",
    name: "Standard Assessment Engine",
    description: "Author and deploy timed aptitude, technical, and coding evaluations.",
    category: "ASSESSMENT_TESTING",
    defaultTiers: ["starter", "growth", "enterprise"],
  },
  {
    key: "subject_question_banks",
    name: "Subject-Wise Question Repository",
    description: "Organize reusable question repositories categorized by subjects and difficulty.",
    category: "ASSESSMENT_TESTING",
    defaultTiers: ["starter", "growth", "enterprise"],
  },
  {
    key: "custom_question_sets",
    name: "Custom & Random Question Sets",
    description: "Compose targeted question sets with multi-section timing and negative marking.",
    category: "ASSESSMENT_TESTING",
    defaultTiers: ["growth", "enterprise"],
  },

  // 3. Intelligence & Analytics
  {
    key: "drivefit_evaluator",
    name: "DriveFit Match Scoring",
    description: "Algorithmic alignment scoring between student profiles and company drive criteria.",
    category: "INTELLIGENCE_ANALYTICS",
    defaultTiers: ["growth", "enterprise"],
  },
  {
    key: "mistake_to_mastery",
    name: "Mistake Bank & Spaced Remediation",
    description: "Automated student mistake tracking with personalized AI spaced-repetition drills.",
    category: "INTELLIGENCE_ANALYTICS",
    defaultTiers: ["growth", "enterprise"],
  },
  {
    key: "placement_memory_analytics",
    name: "Placement Memory & Cohort Intelligence",
    description: "Cross-year placement analytics, offer distribution metrics, and cohort readiness index.",
    category: "INTELLIGENCE_ANALYTICS",
    defaultTiers: ["growth", "enterprise"],
  },
  {
    key: "automated_eligibility_engine",
    name: "Automated Eligibility Filtering",
    description: "Instant candidate qualification filtering based on GPA, active backlogs, and history.",
    category: "INTELLIGENCE_ANALYTICS",
    defaultTiers: ["growth", "enterprise"],
  },

  // 4. AI Capabilities
  {
    key: "ai_question_generator",
    name: "AI Question Generation (Gemini)",
    description: "Automated generation of questions, distractor options, and detailed remediation.",
    category: "AI_CAPABILITIES",
    defaultTiers: ["growth", "enterprise"],
  },
  {
    key: "ai_tutor_assistant",
    name: "Floating AI Placement Tutor",
    description: "Interactive conversational AI tutor for students and placement preparation guidance.",
    category: "AI_CAPABILITIES",
    defaultTiers: ["growth", "enterprise"],
  },
  {
    key: "ai_evaluation_pipeline",
    name: "Automated Resume & Coding Scoring",
    description: "Deep LLM analysis of coding solution complexity and student resume match.",
    category: "AI_CAPABILITIES",
    defaultTiers: ["enterprise"],
  },

  // 5. Institutional Admin
  {
    key: "department_hierarchy",
    name: "Department & Academic Structure",
    description: "Academic department management, degree branches, and batch hierarchy.",
    category: "INSTITUTIONAL_ADMIN",
    defaultTiers: ["starter", "growth", "enterprise"],
  },
  {
    key: "audit_data_export_hub",
    name: "Platform Audit & Compliance Export",
    description: "Full CSV/Excel data exports of placement drives, applications, and audit trails.",
    category: "INSTITUTIONAL_ADMIN",
    defaultTiers: ["growth", "enterprise"],
  },
  {
    key: "dedicated_sla_liaison",
    name: "Priority Support & Dedicated Liaison",
    description: "Enterprise SLA guarantee with dedicated platform account manager and training.",
    category: "INSTITUTIONAL_ADMIN",
    defaultTiers: ["enterprise"],
  },
];

/**
 * Controlled Numerical & Storage Limit Keys
 */
export const CONTROLLED_LIMIT_KEYS: PlanLimitDefinition[] = [
  {
    key: "max_students",
    name: "Maximum Enrolled Students",
    description: "Total student capacity enrolled in the college directory.",
    unit: "students",
    defaultValues: { starter: 500, growth: 2500, enterprise: 10000 },
  },
  {
    key: "max_staff",
    name: "Maximum Staff & Faculty Seats",
    description: "Total seats allocated for placement officers and faculty trainers.",
    unit: "staff",
    defaultValues: { starter: 5, growth: 20, enterprise: 100 },
  },
  {
    key: "max_drives",
    name: "Maximum Active Recruitment Drives",
    description: "Simultaneously active placement drives permitted at one time (null = unlimited).",
    unit: "drives",
    defaultValues: { starter: 10, growth: 50, enterprise: null },
  },
  {
    key: "max_storage_gb",
    name: "Repository Storage Limit",
    description: "Shared storage for test assets, student resumes, and company documentation.",
    unit: "GB",
    defaultValues: { starter: 20, growth: 100, enterprise: 500 },
  },
  {
    key: "max_assessments",
    name: "Assessments Per Academic Year",
    description: "Total authorable student test evaluations per academic calendar (null = unlimited).",
    unit: "assessments",
    defaultValues: { starter: 25, growth: 200, enterprise: null },
  },
  {
    key: "ai_tokens_monthly",
    name: "Monthly AI Token Allocation",
    description: "Allocated Gemini token budget for automated question authoring and chatbot tutor (null = unlimited).",
    unit: "tokens/mo",
    defaultValues: { starter: 50000, growth: 500000, enterprise: null },
  },
];

export interface PlanLimitsMap {
  max_students: number | null;
  max_staff: number | null;
  max_drives: number | null;
  max_storage_gb: number;
  max_assessments: number | null;
  ai_tokens_monthly: number | null;
  [key: string]: number | null;
}

export type PlanEntitlementsMap = Record<string, boolean>;

export interface EntitlementsSnapshot {
  planId: string;
  planName: string;
  planVersion: number;
  priceInr: number;
  billingCycle: string;
  limits: PlanLimitsMap;
  entitlements: PlanEntitlementsMap;
  snapshotAt: string;
  customOverrides?: {
    limits?: Partial<PlanLimitsMap>;
    entitlements?: Partial<PlanEntitlementsMap>;
    reason?: string;
    overriddenBy?: string;
    overriddenAt?: string;
  };
}

export interface DetailedSubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  displayOrder: number;
  status: PlanStatus;
  priceInr: number;
  currency: string;
  billingInterval: BillingInterval;
  billingCycle: "MONTHLY" | "ANNUAL"; // backward compat
  discountPercentage: number;
  studentLimit: number;
  staffLimit: number;
  storageLimitGb: number;
  limits: PlanLimitsMap;
  entitlements: PlanEntitlementsMap;
  features: string[]; // backward compat string array
  version: number;
  isActive: boolean;
  subscribersCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DetailedCollegeSubscription {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  planId: string;
  planName: string;
  planVersion: number;
  currentPlanVersion: number;
  isPlanVersionOutdated: boolean;
  status: "ACTIVE" | "PENDING_PAYMENT" | "TRIALING" | "PAST_DUE" | "CANCELED" | "EXPIRED";
  startDate: string;
  expiryDate: string;
  renewalDate: string;
  gracePeriodDays: number;
  studentSeatLimit: number;
  staffSeatLimit: number;
  entitlementsSnapshot: EntitlementsSnapshot | null;
  pendingPlanId?: string | null;
  pendingPlanName?: string | null;
  pendingPlanVersion?: number | null;
  planChangeScheduledAt?: string | null;
  planChangeEffectiveAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Authoritative Canonical Entitlements Extractor
 * Shared between client UI (modal forms, plan cards) and server services.
 * Invariant: department_hierarchy is strictly compulsory for all colleges and always true.
 */
export function buildCanonicalDefaultEntitlements(
  overrides?: Partial<PlanEntitlementsMap> | null,
  tierOrPlanId?: string | null
): PlanEntitlementsMap {
  const tier = tierOrPlanId
    ? tierOrPlanId.toLowerCase().includes("enterprise")
      ? "enterprise"
      : tierOrPlanId.toLowerCase().includes("growth")
      ? "growth"
      : "starter"
    : null;

  const map: PlanEntitlementsMap = {};
  for (const feat of CONTROLLED_FEATURE_CATALOGUE) {
    map[feat.key] = Boolean(tier && (feat.defaultTiers as readonly string[]).includes(tier));
  }
  if (tier) {
    map.department_hierarchy = true; // Compulsory for all valid plan tiers
  }

  if (overrides) {
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined && v !== null) {
        map[k] = Boolean(v);
      }
    }
  }

  if (tier || overrides?.department_hierarchy) {
    map.department_hierarchy = true; // Compulsory for all valid plan tiers
  }
  return map;
}

export function extractCanonicalEntitlements(plan: any): PlanEntitlementsMap {
  if (!plan) {
    return buildCanonicalDefaultEntitlements();
  }

  const planTier = plan.slug || plan.id || "";

  // 1. If explicit structured entitlements exist with actual keys
  if (plan.entitlements && typeof plan.entitlements === "object" && Object.keys(plan.entitlements).length > 0) {
    const map = buildCanonicalDefaultEntitlements(plan.entitlements, planTier);
    map.department_hierarchy = true;
    return map;
  }

  // 2. If features array exists in the database record (Supabase table subscription_plans.features)
  if (Array.isArray(plan.features) && plan.features.length > 0) {
    const map: PlanEntitlementsMap = {};
    const lowerFeatures = plan.features.map((f: any) => String(f).trim().toLowerCase());

    for (const feat of CONTROLLED_FEATURE_CATALOGUE) {
      const featNameLower = feat.name.toLowerCase();
      const featKeyLower = feat.key.toLowerCase();
      const isMatched = lowerFeatures.some((f: string) => {
        if (f === featNameLower || f === featKeyLower) return true;
        if (f.includes(featNameLower) || featNameLower.includes(f)) return true;
        switch (feat.key) {
          case "core_drives_management":
            return f.includes("recruitment drive") || f.includes("drives & scheduling") || f.includes("recruitment drives");
          case "student_roster_directory":
            return f.includes("student directory") || f.includes("srn verification") || f.includes("student roster");
          case "company_management":
            return f.includes("company relationship") || f.includes("company directory") || f.includes("company relationship hub");
          case "standard_assessments":
            return f.includes("assessment engine") || f.includes("standard assessment");
          case "subject_question_banks":
            return f.includes("question repository") || f.includes("question bank") || f.includes("subject-wise question");
          case "custom_question_sets":
            return f.includes("custom & random") || f.includes("question sets") || f.includes("custom question");
          case "drivefit_evaluator":
            return f.includes("drivefit") || f.includes("match scoring");
          case "mistake_to_mastery":
            return f.includes("mistake bank") || f.includes("spaced remediation") || f.includes("mistake to mastery");
          case "placement_memory_analytics":
            return f.includes("placement memory") || f.includes("cohort intelligence") || f.includes("cohort readiness");
          case "automated_eligibility_engine":
            return f.includes("eligibility filtering") || f.includes("eligibility engine");
          case "ai_question_generator":
            return f.includes("ai question generation") || f.includes("question generation (gemini)") || f.includes("gemini");
          case "ai_tutor_assistant":
            return f.includes("ai placement tutor") || f.includes("floating ai") || f.includes("tutor assistant") || f.includes("ai tutor");
          case "ai_evaluation_pipeline":
            return f.includes("resume & coding scoring") || f.includes("coding scoring") || f.includes("resume scoring") || f.includes("ai evaluation");
          case "department_hierarchy":
            return f.includes("department") || f.includes("academic structure");
          case "audit_data_export_hub":
            return f.includes("platform audit") || f.includes("compliance export") || f.includes("audit data export");
          case "dedicated_sla_liaison":
            return f.includes("priority support") || f.includes("dedicated liaison") || f.includes("sla");
          default:
            return false;
        }
      });
      map[feat.key] = isMatched;
    }

    // Compulsory invariant
    map.department_hierarchy = true;
    return map;
  }

  // 3. Fallback to tier defaults
  return buildCanonicalDefaultEntitlements(null, planTier);
}

export function canonicalEntitlementsToStringArray(entitlements: PlanEntitlementsMap): string[] {
  const names: string[] = [];
  for (const feat of CONTROLLED_FEATURE_CATALOGUE) {
    if (entitlements[feat.key]) {
      names.push(feat.name);
    }
  }
  if (!names.some((n) => n.toLowerCase().includes("department"))) {
    names.push("Department & Academic Structure");
  }
  return names;
}
