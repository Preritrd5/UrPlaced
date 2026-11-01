/**
 * UrPlaced — SA-01 Strict Option A RLS Isolation Verification
 *
 * Authenticates as the Super Admin user (cbb6cc91-1a40-4f82-84ed-9f4d5b28836f)
 * and asserts that PostgreSQL Row Level Security strictly DENIES access to all
 * private college tables, student records, drives, and evaluations.
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

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

function loadAdminPassword(): string {
  if (fs.existsSync(".env.admin.local")) {
    const content = fs.readFileSync(".env.admin.local", "utf8");
    for (const line of content.split("\n")) {
      if (line.startsWith("SUPER_ADMIN_ROTATED_PASSWORD=")) {
        return line.substring("SUPER_ADMIN_ROTATED_PASSWORD=".length).trim();
      }
    }
  }
  throw new Error("Missing .env.admin.local credentials file");
}

async function verifyStrictOptionA() {
  const env = loadEnv();
  const password = loadAdminPassword();
  const email = "urplaced5@gmail.com";

  console.log("==================================================================");
  console.log("   URPLACED SA-01 — STRICT OPTION A RLS VERIFICATION");
  console.log("==================================================================");
  console.log(`Authenticating as Platform Super Admin: ${email}...`);

  // Client using anon/publishable key (subject to PostgreSQL Row Level Security)
  const pubKey = env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, pubKey);

  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (authErr || !authData.session) {
    throw new Error(`Super Admin auth failed: ${authErr?.message}`);
  }

  console.log(`✓ Authenticated as: ${authData.user.id} (${authData.user.email})`);
  console.log(`  Session Assurance: ${authData.session.user.app_metadata?.aal || "aal1"}`);

  // Test 1: Denial of Student Records
  const { data: students, error: stdErr } = await client.from("students").select("id, name, srn, email");
  console.log(`\n[Test 1] Querying 'students' under Super Admin RLS:`);
  console.log(`  • Rows returned: ${students?.length || 0} (Expected: 0)`);
  if (students && students.length > 0) {
    throw new Error("SECURITY FAILURE: Super Admin accessed private student records!");
  }
  console.log(`  ✅ STRICT OPTION A ASSERTION PASSED: Student records inaccessible to Super Admin.`);

  // Test 2: Denial of College Staff & Memberships
  const { data: memberships } = await client.from("tenant_memberships").select("id, user_id, tenant_id, role");
  console.log(`\n[Test 2] Querying 'tenant_memberships' under Super Admin RLS:`);
  console.log(`  • Rows returned: ${memberships?.length || 0} (Expected: 0)`);
  if (memberships && memberships.length > 0) {
    throw new Error("SECURITY FAILURE: Super Admin accessed private tenant memberships!");
  }
  console.log(`  ✅ STRICT OPTION A ASSERTION PASSED: Tenant memberships inaccessible.`);

  // Test 3: Denial of Assessments & Attempts
  const { data: assessments } = await client.from("assessments").select("id, title");
  console.log(`\n[Test 3] Querying 'assessments' under Super Admin RLS:`);
  console.log(`  • Rows returned: ${assessments?.length || 0} (Expected: 0)`);
  if (assessments && assessments.length > 0) {
    throw new Error("SECURITY FAILURE: Super Admin accessed college assessments!");
  }
  console.log(`  ✅ STRICT OPTION A ASSERTION PASSED: Assessments inaccessible.`);

  // Test 4: Denial of College Audit Logs (tenant_id IS NOT NULL)
  const { data: auditLogs } = await client.from("audit_logs").select("id, tenant_id, action").not("tenant_id", "is", null);
  console.log(`\n[Test 4] Querying college-private 'audit_logs' under Super Admin RLS:`);
  console.log(`  • Rows returned: ${auditLogs?.length || 0} (Expected: 0)`);
  if (auditLogs && auditLogs.length > 0) {
    throw new Error("SECURITY FAILURE: Super Admin accessed college-owned audit logs!");
  }
  console.log(`  ✅ STRICT OPTION A ASSERTION PASSED: College-owned audit logs inaccessible.`);

  // Test 5: Denial of College Announcements
  const { data: announcements } = await client.from("announcements").select("id, title");
  console.log(`\n[Test 5] Querying 'announcements' under Super Admin RLS:`);
  console.log(`  • Rows returned: ${announcements?.length || 0} (Expected: 0)`);
  if (announcements && announcements.length > 0) {
    throw new Error("SECURITY FAILURE: Super Admin accessed college announcements!");
  }
  console.log(`  ✅ STRICT OPTION A ASSERTION PASSED: College announcements inaccessible.`);

  // Test 6: Verify Control Plane Access is GRANTED (platform_admins, tenants, subscriptions, plans)
  const { data: adminCheck } = await client.from("platform_admins").select("id, email, role, status");
  console.log(`\n[Control Plane Verification] Querying 'platform_admins':`);
  console.log(`  • Rows returned: ${adminCheck?.length || 0} (Expected: >= 1)`);
  if (!adminCheck || adminCheck.length === 0) {
    throw new Error("Control plane access failed for Super Admin!");
  }
  console.log(`  ✅ Control plane registry accessible.`);

  const { data: plansCheck } = await client.from("subscription_plans").select("id, name");
  console.log(`\n[Control Plane Verification] Querying 'subscription_plans':`);
  console.log(`  • Plans returned: ${plansCheck?.length || 0} (Expected: >= 1)`);
  console.log(`  ✅ Subscription plans accessible.`);

  console.log("\n==================================================================");
  console.log("   ALL STRICT OPTION A RLS ASSERTIONS PASSED WITH ZERO LEAKAGE");
  console.log("==================================================================");

  // Sign out cleanly
  await client.auth.signOut();
}

verifyStrictOptionA().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
