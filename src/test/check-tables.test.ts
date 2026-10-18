import { describe, it } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";

describe("Check Supabase Tables", () => {
  it("queries existing tables in public schema", async () => {
    const admin = createAdminClient();
    const { data: tenants, error: tenantsError } = await admin
      .from("tenants")
      .select("*")
      .limit(1);

    console.log("tenants query result:", { tenants, tenantsError });

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("*")
      .limit(1);

    console.log("profiles query result:", { profiles, profilesError });
  });
});
