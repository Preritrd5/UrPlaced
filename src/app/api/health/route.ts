/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Platform Health & Readiness Check Endpoint
 * ==============================================================================
 * Returns service availability and database connectivity status.
 * Never leaks internal topology, connection strings, or credentials.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();
  let dbStatus: "CONNECTED" | "UNREACHABLE" = "UNREACHABLE";

  try {
    const supabase = await createServerSupabaseClient();
    // Lightweight heartbeat query against tenants table
    const { error } = await supabase.from("tenants").select("id", { count: "exact", head: true }).limit(1);
    if (!error) {
      dbStatus = "CONNECTED";
    }
  } catch {
    dbStatus = "UNREACHABLE";
  }

  const isHealthy = dbStatus === "CONNECTED";

  return NextResponse.json(
    {
      status: isHealthy ? "HEALTHY" : "DEGRADED",
      version: "1.0.0",
      timestamp,
      checks: {
        application: "UP",
        database: dbStatus,
      },
    },
    { status: isHealthy ? 200 : 503 }
  );
}
