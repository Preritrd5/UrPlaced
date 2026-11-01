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
    name: "Department & Faculty Scoping",
    description: "Multi-department scoping with granular trainer and placement staff permissions.",
    category: "INSTITUTIONAL_ADMIN",
    defaultTiers: ["enterprise"],
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
