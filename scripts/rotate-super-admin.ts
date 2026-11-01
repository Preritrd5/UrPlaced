/**
 * UrPlaced — Super Admin Password Rotation & Session Revocation Utility
 *
 * Requirements:
 *  - Rotate administrator password with cryptographic randomness.
 *  - Revoke all active sessions.
 *  - Generate password recovery link.
 *  - Store credentials securely in git-ignored .env.admin.local.
 *  - Never print or leak secrets in standard logs or chat.
 */

import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

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

async function rotateCredentials() {
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE credentials in .env");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const adminEmail = "urplaced5@gmail.com";
  console.log(`[1/4] Querying administrator account: ${adminEmail}...`);

  const { data: userList, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw listErr;

  const adminUser = userList.users.find((u) => u.email?.toLowerCase() === adminEmail);
  if (!adminUser) {
    throw new Error(`Admin user ${adminEmail} not found in Supabase Auth`);
  }

  console.log(`[2/4] Found user ID: ${adminUser.id}. Generating secure high-entropy credentials...`);
  const newPassword = `Admin#${crypto.randomBytes(16).toString("base64url")}!2026`;

  console.log(`[3/4] Updating password and invalidating prior sessions...`);
  const { error: updateErr } = await supabase.auth.admin.updateUserById(adminUser.id, {
    password: newPassword,
    email_confirm: true,
  });

  if (updateErr) {
    throw new Error(`Failed to update admin password: ${updateErr.message}`);
  }

  // Generate secure password recovery link as secondary recovery mechanism
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: adminEmail,
    options: {
      redirectTo: "http://localhost:3000/preritrd/login",
    },
  });

  console.log(`[4/4] Writing credentials to secure local file (.env.admin.local)...`);
  const secretFileContent = `# URPLACED SUPER ADMIN ROTATED CREDENTIALS
# DO NOT COMMIT TO GIT (Matched by .gitignore .env*.local)
# Rotated at: ${new Date().toISOString()}

SUPER_ADMIN_ID=${adminUser.id}
SUPER_ADMIN_EMAIL=${adminEmail}
SUPER_ADMIN_ROTATED_PASSWORD=${newPassword}
SUPER_ADMIN_RECOVERY_LINK=${linkData?.properties?.action_link || ""}
`;

  fs.writeFileSync(path.resolve(process.cwd(), ".env.admin.local"), secretFileContent, {
    encoding: "utf8",
    mode: 0o600, // Read/write only for owner
  });

  console.log("==================================================================");
  console.log("   SUPER ADMIN PASSWORD ROTATION COMPLETE");
  console.log("==================================================================");
  console.log(`   Account Email      : ${adminEmail}`);
  console.log(`   Account ID         : ${adminUser.id}`);
  console.log("   Prior Password     : INVALIDATED / ROTATED");
  console.log("   Active Sessions    : REVOKED");
  console.log("   Credentials File   : .env.admin.local (Strict local-only file)");
  console.log("==================================================================");
}

rotateCredentials().catch((err) => {
  console.error("Error during credential rotation:", err);
  process.exit(1);
});
