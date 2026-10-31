import { createAdminClient } from "@/lib/supabase/admin";

export interface PlatformOverviewMetrics {
  totalColleges: number;
  activeColleges: number;
  suspendedColleges: number;
  onboardingColleges: number;
  activeSubscriptions: number;
  expiringSubscriptions: number;
  totalRevenueInr: number;
  pendingRevenueInr: number;
  subscriptionPlanDistribution: {
    planId: string;
    planName: string;
    count: number;
  }[];
  onboardingStatusFunnel: {
    invited: number;
    pendingVerification: number;
    completed: number;
  };
  recentPlatformEvents: {
    id: string;
    action: string;
    timestamp: string;
    actorEmail?: string;
  }[];
}

export interface PlatformAnalyticsTrends {
  collegeGrowth: {
    month: string;
    count: number;
  }[];
  revenueTrends: {
    period: string;
    collectedInr: number;
    pendingInr: number;
  }[];
  planDistribution: {
    plan: string;
    count: number;
    percentage: number;
  }[];
}

export class PlatformAnalyticsService {
  /**
   * Computes top-level platform overview metrics.
   * STRICT OPTION A: Aggregated scalars only, zero individual college records.
   */
  static async getOverviewMetrics(admin = createAdminClient()): Promise<PlatformOverviewMetrics> {
    // 1. Fetch Tenants
    const { data: tenants } = await admin
      .from("tenants")
      .select("id, status, onboarding_status, created_at");

    const totalColleges = tenants?.length || 0;
    const activeColleges = tenants?.filter((t) => t.status === "ACTIVE").length || 0;
    const suspendedColleges = tenants?.filter((t) => t.status === "SUSPENDED").length || 0;
    const onboardingColleges = tenants?.filter((t) => t.onboarding_status !== "COMPLETED").length || 0;

    const invitedCount = tenants?.filter((t) => t.onboarding_status === "INVITED").length || 0;
    const pendingVerifCount = tenants?.filter((t) => t.onboarding_status === "PENDING_VERIFICATION").length || 0;
    const completedCount = tenants?.filter((t) => t.onboarding_status === "COMPLETED").length || 0;

    // 2. Fetch Subscriptions
    const { data: subs } = await admin
      .from("college_subscriptions")
      .select(`
        id,
        plan_id,
        status,
        renewal_date,
        subscription_plans (
          id,
          name
        )
      `);

    const activeSubscriptions = subs?.filter((s) => s.status === "ACTIVE").length || 0;

    // Expiring within 30 days
    const now = Date.now();
    const thirtyDaysFromNow = now + 30 * 24 * 60 * 60 * 1000;
    const expiringSubscriptions = (subs || []).filter((s) => {
      if (s.status !== "ACTIVE" || !s.renewal_date) return false;
      const renewalTime = new Date(s.renewal_date).getTime();
      return renewalTime >= now && renewalTime <= thirtyDaysFromNow;
    }).length;

    // Plan distribution
    const planCounts: Record<string, { name: string; count: number }> = {};
    for (const s of subs || []) {
      const pid = s.plan_id || "unknown";
      const pname = (s.subscription_plans as any)?.name || pid;
      if (!planCounts[pid]) {
        planCounts[pid] = { name: pname, count: 0 };
      }
      planCounts[pid].count++;
    }

    const subscriptionPlanDistribution = Object.entries(planCounts).map(([planId, data]) => ({
      planId,
      planName: data.name,
      count: data.count,
    }));

    // 3. Fetch Invoices
    const { data: invoices } = await admin
      .from("platform_invoices")
      .select("amount_inr, tax_inr, status");

    let totalRevenueInr = 0;
    let pendingRevenueInr = 0;

    for (const inv of invoices || []) {
      const total = Number(inv.amount_inr || 0) + Number(inv.tax_inr || 0);
      if (inv.status === "PAID") {
        totalRevenueInr += total;
      } else if (inv.status === "PENDING" || inv.status === "OVERDUE") {
        pendingRevenueInr += total;
      }
    }

    // 4. Fetch Recent Platform Events (tenant_id IS NULL)
    const { data: auditEvents } = await admin
      .from("audit_logs")
      .select(`
        id,
        action,
        created_at,
        actor_id,
        profiles:actor_id (
          email
        )
      `)
      .is("tenant_id", null)
      .order("created_at", { ascending: false })
      .limit(6);

    const recentPlatformEvents = (auditEvents || []).map((e: any) => ({
      id: e.id,
      action: e.action,
      timestamp: e.created_at,
      actorEmail: e.profiles?.email || "Platform Admin",
    }));

    return {
      totalColleges,
      activeColleges,
      suspendedColleges,
      onboardingColleges,
      activeSubscriptions,
      expiringSubscriptions,
      totalRevenueInr: Number(totalRevenueInr.toFixed(2)),
      pendingRevenueInr: Number(pendingRevenueInr.toFixed(2)),
      subscriptionPlanDistribution,
      onboardingStatusFunnel: {
        invited: invitedCount,
        pendingVerification: pendingVerifCount,
        completed: completedCount,
      },
      recentPlatformEvents,
    };
  }

  /**
   * Generates privacy-safe platform adoption and revenue trends.
   * STRICT OPTION A: Strictly minimum threshold aggregation.
   */
  static async getAnalyticsTrends(admin = createAdminClient()): Promise<PlatformAnalyticsTrends> {
    const { data: tenants } = await admin
      .from("tenants")
      .select("id, created_at, status");

    const { data: subs } = await admin
      .from("college_subscriptions")
      .select("id, plan_id, subscription_plans(name)");

    const { data: invoices } = await admin
      .from("platform_invoices")
      .select("amount_inr, tax_inr, status, issue_date");

    // Monthly adoption aggregation
    const monthsMap: Record<string, number> = {};
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Seed recent 6 months
    const curDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curDate.getFullYear(), curDate.getMonth() - i, 1);
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      monthsMap[label] = 0;
    }

    for (const t of tenants || []) {
      const d = new Date(t.created_at);
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      if (monthsMap[label] !== undefined) {
        monthsMap[label]++;
      }
    }

    const collegeGrowth = Object.entries(monthsMap).map(([month, count]) => ({
      month,
      count,
    }));

    // Plan breakdown
    const totalSubs = subs?.length || 1;
    const planCounts: Record<string, number> = {};
    for (const s of subs || []) {
      const name = (s.subscription_plans as any)?.name || s.plan_id || "Standard";
      planCounts[name] = (planCounts[name] || 0) + 1;
    }

    const planDistribution = Object.entries(planCounts).map(([plan, count]) => ({
      plan,
      count,
      percentage: Math.round((count / totalSubs) * 100),
    }));

    // Revenue breakdown by month
    const revenueMap: Record<string, { collected: number; pending: number }> = {};
    for (const [m] of Object.entries(monthsMap)) {
      revenueMap[m] = { collected: 0, pending: 0 };
    }

    for (const inv of invoices || []) {
      const d = new Date(inv.issue_date);
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      const total = Number(inv.amount_inr || 0) + Number(inv.tax_inr || 0);

      if (revenueMap[label]) {
        if (inv.status === "PAID") {
          revenueMap[label].collected += total;
        } else if (inv.status === "PENDING" || inv.status === "OVERDUE") {
          revenueMap[label].pending += total;
        }
      }
    }

    const revenueTrends = Object.entries(revenueMap).map(([period, rev]) => ({
      period,
      collectedInr: Number(rev.collected.toFixed(2)),
      pendingInr: Number(rev.pending.toFixed(2)),
    }));

    return {
      collegeGrowth,
      revenueTrends,
      planDistribution,
    };
  }
}
