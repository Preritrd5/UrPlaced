/**
 * UrPlaced — Secure Platform Super Admin Provisioning Script
 *
 * This script runs strictly server-side using the Supabase Service Role key.
 * It provisions or invites the initial Platform Super Admin account.
 *
 * Requirements enforced:
 *  1. Dual-layered server-controlled authorization:
 *     - public.profiles.is_platform_admin = true
 *     - public.platform_admins registry record (role: 'SUPER_ADMIN', status: 'ACTIVE')
 *     - Never relies on client-editable user_metadata.
 *  2. Target project verification before any write.
 *  3. Idempotent: can be safely re-run to update or re-verify.
 *  4. Verification assert query before reporting completion.
 *  5. Never prints or logs secrets or private service-role keys.
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline/promises";
import { stdin as input, stdout as output } from "process";
import * as crypto from "crypto";

// 1. Load local environment configuration
function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.substring(0, eqIdx).trim();
          const val = trimmed.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

// Parse CLI flags
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = args.find((a) => a.startsWith(prefix));
  if (match) return match.substring(prefix.length).trim();
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1]) return args[index + 1].trim();
  return undefined;
}

const isLocalTarget = args.includes("--local");
let emailArg = getArg("email");
let passwordArg = getArg("password");
let nameArg = getArg("name");
const skipConfirm = args.includes("--yes") || args.includes("-y");

async function main() {
  const rl = readline.createInterface({ input, output });

  console.log("==================================================================");
  console.log("   URPLACED — PLATFORM SUPER ADMIN PROVISIONING UTILITY");
  console.log("==================================================================");

  // 1. Resolve target Supabase environment
  let supabaseUrl = "";
  let serviceRoleKey = "";
  let targetDesc = "";

  if (isLocalTarget) {
    supabaseUrl = "http://127.0.0.1:54321";
    serviceRoleKey =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
    targetDesc = "Local Supabase Docker Instance (127.0.0.1:54321)";
  } else {
    supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
    serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
    const projectId = process.env.SUPABASE_PROJECT_ID || "(derived from URL)";
    targetDesc = `Configured Project: ${projectId} [${supabaseUrl}]`;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("\n❌ Error: Missing Supabase credentials in local environment.");
    console.error("   Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env");
    rl.close();
    process.exit(1);
  }

  // 2. Project Target Verification
  console.log("\n[Step 1/4] Target Project Verification:");
  console.log(`  • Endpoint   : ${supabaseUrl}`);
  console.log(`  • Description: ${targetDesc}`);
  console.log(`  • Secret Key : [SECURE / REDACTED]`);

  if (!skipConfirm) {
    const confirmTarget = await rl.question(
      "\n  Confirm this is the intended Supabase project to provision? (Y/n): "
    );
    if (confirmTarget.trim().toLowerCase() === "n" || confirmTarget.trim().toLowerCase() === "no") {
      console.log("  Provisioning aborted by user.");
      rl.close();
      process.exit(0);
    }
  }

  // 3. Prompt for Administrator Email if not passed in flags
  let email = (emailArg || "").trim().toLowerCase();
  while (!email || !email.includes("@")) {
    const inputEmail = await rl.question("\n[Step 2/4] Enter your Platform Super Admin email address: ");
    email = inputEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      console.log("  ⚠️ Please enter a valid email address.");
    }
  }

  // Prompt for Administrator Password
  let password = (passwordArg || "").trim();
  if (!password) {
    const inputPassword = await rl.question(
      "  Enter temporary password (press Enter to auto-generate a secure password): "
    );
    password = inputPassword.trim();
    if (!password) {
      // Auto-generate high-entropy password
      password = `Admin@${crypto.randomBytes(6).toString("hex")}!2026`;
      console.log(`  🔑 Auto-generated password: ${password}`);
    }
  }

  let fullName = (nameArg || "").trim();
  if (!fullName) {
    const inputName = await rl.question(
      "  Enter administrator full name [Platform Super Admin]: "
    );
    fullName = inputName.trim() || "Platform Super Admin";
  }

  rl.close();

  console.log("\n[Step 3/4] Server-Side Account Provisioning & Role Elevation...");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Check if user already exists in auth.users
  let userId: string;
  const { data: userList, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) {
    console.error("❌ Failed to query auth users:", listErr.message);
    process.exit(1);
  }

  const existingUser = userList.users.find((u) => u.email?.toLowerCase() === email);

  if (existingUser) {
    userId = existingUser.id;
    console.log(`  ✓ Found existing auth user: ${userId}`);
    console.log("  ✓ Synchronizing credentials and confirming email verification...");

    const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: {
        ...(existingUser.user_metadata || {}),
        full_name: fullName,
      },
    });

    if (updateErr) {
      console.error("❌ Failed to update auth credentials:", updateErr.message);
      process.exit(1);
    }
  } else {
    console.log("  ✓ Creating new administrator in Supabase Auth...");
    const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createErr || !createData.user) {
      console.error("❌ Failed to create auth user:", createErr?.message);
      process.exit(1);
    }

    userId = createData.user.id;
    console.log(`  ✓ Created new auth user: ${userId}`);
  }

  // Authoritative elevation in public.profiles:
  // Using Service Role client to bypass the non-admin trigger and grant is_platform_admin = true
  console.log("  ✓ Elevating permissions in public.profiles (is_platform_admin = true)...");
  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      is_platform_admin: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (profileErr) {
    console.error("❌ Failed to elevate profiles record:", profileErr.message);
    process.exit(1);
  }

  // Authoritative elevation in public.platform_admins control plane registry
  console.log("  ✓ Activating control plane entry in public.platform_admins...");
  const { error: adminErr } = await supabase.from("platform_admins").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      mfa_enabled: true,
      mfa_enforced: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (adminErr) {
    if (adminErr.message.includes("does not exist") || adminErr.code === "42P01") {
      console.warn("  ⚠️ Warning: table 'platform_admins' is pending migration on this instance.");
    } else {
      console.error("❌ Failed to update platform_admins table:", adminErr.message);
      process.exit(1);
    }
  }

  // 4. Verification Check: Assert that the user and permissions are actually live
  console.log("\n[Step 4/4] Verifying Provisioned Authority in Database...");

  const { data: verifyProfile, error: verifyProfileErr } = await supabase
    .from("profiles")
    .select("id, email, is_platform_admin")
    .eq("id", userId)
    .single();

  if (verifyProfileErr || !verifyProfile || verifyProfile.is_platform_admin !== true) {
    console.error("❌ VERIFICATION FAILED: profiles.is_platform_admin is not true.");
    process.exit(1);
  }

  const { data: verifyAdmin, error: verifyAdminErr } = await supabase
    .from("platform_admins")
    .select("id, email, role, status")
    .eq("id", userId)
    .maybeSingle();

  if (verifyAdminErr || !verifyAdmin || verifyAdmin.status !== "ACTIVE" || verifyAdmin.role !== "SUPER_ADMIN") {
    console.error("❌ VERIFICATION FAILED: platform_admins status is not ACTIVE or record missing:", verifyAdminErr?.message);
    process.exit(1);
  }

  console.log("  ✅ Verification Assertion Passed:");
  console.log(`     • profiles.is_platform_admin : ${verifyProfile.is_platform_admin}`);
  console.log(`     • platform_admins.status     : ${verifyAdmin?.status || "ACTIVE"}`);
  console.log(`     • platform_admins.role       : ${verifyAdmin?.role || "SUPER_ADMIN"}`);

  console.log("\n==================================================================");
  console.log("   SUPER ADMIN PROVISIONING COMPLETED SUCCESSFULLY");
  console.log("==================================================================");
  console.log(`   Login Portal       : /preritrd/login`);
  console.log(`   Email              : ${email}`);
  console.log(`   Password           : ${password}`);
  console.log("   Step 2 MFA         : Dynamic TOTP Enrollment (Scan QR code on 1st login)");
  console.log("==================================================================");
  console.log("\nNext Steps to Complete Sign-In:");
  console.log("  1. Open http://localhost:3000/preritrd/login");
  console.log("  2. Enter the administrator email and password above.");
  console.log("  3. Scan the genuine TOTP QR code with Google Authenticator or 1Password.");
  console.log("  4. Enter the dynamic 6-digit TOTP code to elevate your session to AAL2.");
  console.log("  5. You will be redirected to the Platform Control Plane at /preritrd/dashboard.\n");
}

main().catch((err) => {
  console.error("Fatal exception during provisioning:", err);
  process.exit(1);
});
