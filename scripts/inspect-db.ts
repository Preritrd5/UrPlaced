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

async function check() {
  const env = loadEnv();
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await admin.from("tenants").select("*").limit(1);
  if (data && data[0]) {
    console.log("Tenants columns:", Object.keys(data[0]));
    console.log("Sample tenant:", data[0]);
  } else {
    console.log("No data or error:", error);
  }
}
check();
