import { describe, it, expect } from "vitest";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/admin";

describe("Supabase Connection & Configuration", () => {
  it("resolves the configured Supabase URL and keys from .env", () => {
    const config = getSupabaseConfig();
    expect(config.supabaseUrl).toBeDefined();
    expect(config.supabaseUrl.startsWith("https://")).toBe(true);
    expect(config.supabaseAnonKey).toBeDefined();
    expect(config.supabaseServiceRoleKey).toBeDefined();
  });

  it("initializes the Admin client successfully with service role credentials", () => {
    const admin = createAdminClient();
    expect(admin).toBeDefined();
    expect(admin.auth).toBeDefined();
  });
});
