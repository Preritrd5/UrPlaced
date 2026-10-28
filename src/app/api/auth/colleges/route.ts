import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createAdminClient();
    const { data: colleges, error } = await admin
      .from("tenants")
      .select("id, name, slug")
      .eq("status", "ACTIVE")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch active colleges", colleges: [] },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      colleges: colleges || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Internal server error", colleges: [] },
      { status: 500 }
    );
  }
}
