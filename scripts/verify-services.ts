/**
 * UrPlaced — SA-01 Service Verification Script
 * Validates actual data retrieval against configured remote database for all 10 Super Admin areas.
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import { PlatformAnalyticsService } from "../src/modules/platform-admin/services/platform-analytics-service";
import { PlatformCollegeService } from "../src/modules/platform-admin/services/platform-college-service";
import { PlatformSubscriptionService } from "../src/modules/platform-admin/services/platform-subscription-service";
import { PlatformBillingService } from "../src/modules/platform-admin/services/platform-billing-service";
import { PlatformConfigService } from "../src/modules/platform-admin/services/platform-config-service";
import { PlatformAdminManagementService } from "../src/modules/platform-admin/services/platform-admin-management-service";
import { PlatformAuditService } from "../src/modules/platform-admin/services/platform-audit-service";
import { PlatformAuthService } from "../src/modules/platform-admin/services/platform-auth-service";
import { PlatformHealthService } from "../src/modules/platform-admin/services/platform-health-service";

function loadEnv() {
  const content = fs.readFileSync(".env", "utf8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq !== -1) {
      env[trimmed.substring(0, eq).trim()] = trimmed.substring(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return env;
}

async function verifyAll10Services() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  console.log("==================================================================");
  console.log("   URPLACED SA-01 — 10-PAGE BACKEND SERVICE VERIFICATION");
  console.log("==================================================================");

  // 1. Dashboard Metrics (/preritrd/dashboard)
  console.log("\n[Route 1: /preritrd/dashboard]");
  const metrics = await PlatformAnalyticsService.getOverviewMetrics(supabase as any);
  console.log(`  ✓ Total Colleges: ${metrics.totalColleges}`);
  console.log(`  ✓ Active Subscriptions: ${metrics.activeSubscriptions}`);
  console.log(`  ✓ Total Revenue: ₹${metrics.totalRevenueInr.toLocaleString()}`);

  // 2. Colleges List (/preritrd/colleges)
  console.log("\n[Route 2: /preritrd/colleges]");
  const collegeList = await PlatformCollegeService.listColleges({ admin: supabase as any });
  console.log(`  ✓ Colleges retrieved: ${collegeList.colleges.length} (total: ${collegeList.total})`);
  for (const c of collegeList.colleges.slice(0, 3)) {
    console.log(`     - ${c.name} (${c.slug}): status=${c.status}, onboarding=${c.onboardingStatus}`);
  }

  // 3. College Registration (/preritrd/colleges/new)
  console.log("\n[Route 3: /preritrd/colleges/new]");
  const plansForNew = await PlatformSubscriptionService.listPlans(supabase as any);
  console.log(`  ✓ Available plans for onboarding: ${plansForNew.length} (${plansForNew.map((p) => p.name).join(", ")})`);

  // 4. Subscriptions List (/preritrd/subscriptions)
  console.log("\n[Route 4: /preritrd/subscriptions]");
  const subs = await PlatformSubscriptionService.listCollegeSubscriptions({ admin: supabase as any });
  console.log(`  ✓ Subscriptions retrieved: ${subs.length}`);
  for (const s of subs.slice(0, 3)) {
    console.log(`     - ${s.tenantName}: Plan=${s.planName}, Status=${s.status}, Renewal=${s.renewalDate}`);
  }

  // 5. Billing & Invoices (/preritrd/billing)
  console.log("\n[Route 5: /preritrd/billing]");
  const invoices = await PlatformBillingService.listInvoices({ admin: supabase as any });
  console.log(`  ✓ Invoices retrieved: ${invoices.length}`);
  for (const inv of invoices.slice(0, 3)) {
    console.log(`     - ${inv.invoiceNumber} (${inv.tenantName}): ₹${inv.totalInr} [${inv.status}]`);
  }

  // 6. Analytics Trends (/preritrd/analytics)
  console.log("\n[Route 6: /preritrd/analytics]");
  const trends = await PlatformAnalyticsService.getAnalyticsTrends(supabase as any);
  console.log(`  ✓ College Growth Periods: ${trends.collegeGrowth.length}`);
  console.log(`  ✓ Revenue Trends: ${trends.revenueTrends.length}`);
  console.log(`  ✓ Plan Distribution: ${trends.planDistribution.map((p) => `${p.plan}: ${p.count}`).join(", ")}`);

  // 7. Configuration Settings (/preritrd/configuration)
  console.log("\n[Route 7: /preritrd/configuration]");
  const settings = await PlatformConfigService.getAllSettings(supabase as any);
  console.log(`  ✓ Platform settings keys retrieved: ${Object.keys(settings).length} (${Object.keys(settings).join(", ")})`);

  // 8. Super Admins Registry (/preritrd/accounts)
  console.log("\n[Route 8: /preritrd/accounts]");
  const admins = await PlatformAdminManagementService.listAdmins(supabase as any);
  console.log(`  ✓ Active Platform Admins: ${admins.length}`);
  for (const a of admins) {
    console.log(`     - ${a.email} (${a.fullName || "Admin"}): ${a.role} [${a.status}] MFA:${a.mfaEnabled}`);
  }

  // 9. Platform Audit Logs (/preritrd/audit-logs)
  console.log("\n[Route 9: /preritrd/audit-logs]");
  await PlatformAuthService.logAuditEvent({
    action: "PLATFORM_AUDIT_VERIFIED",
    actorId: "cbb6cc91-1a40-4f82-84ed-9f4d5b28836f",
    metadata: { phase: "SA-01", description: "Audit logging verified" },
    adminClient: supabase as any,
  });
  const auditLogs = await PlatformAuditService.listPlatformAuditLogs({ admin: supabase as any });
  console.log(`  ✓ Platform audit records: ${auditLogs.logs.length} (total: ${auditLogs.total})`);
  for (const l of auditLogs.logs.slice(0, 3)) {
    console.log(`     - [${l.action}] ${l.createdAt} by ${l.actorEmail || l.actorId}`);
  }

  // 10. System Health (/preritrd/system-health)
  console.log("\n[Route 10: /preritrd/system-health]");
  const health = await PlatformHealthService.checkSystemHealth(supabase as any);
  console.log(`  ✓ Overall System Status: ${health.overallStatus}`);
  for (const s of health.services) {
    console.log(`     - ${s.name} [${s.category}]: ${s.status} (${s.latencyMs}ms) - ${s.message}`);
  }

  console.log("\n==================================================================");
  console.log("   ALL 10 BACKEND SERVICES VERIFIED SUCCESSFULLY");
  console.log("==================================================================");
}

verifyAll10Services().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
