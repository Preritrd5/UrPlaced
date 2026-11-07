/**
 * Notifications Collection API Route
 * GET /api/notifications — Retrieve paginated notifications and unread count for authenticated user
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NotificationService } from "@/modules/notifications/services/notification-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    let token: string | undefined;
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    const supabase = await createClient(token);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: Active authenticated session required." },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const collegeId = searchParams.get("collegeId") || user.app_metadata?.tenant_id || undefined;

    const result = await NotificationService.listNotifications({
      userId: user.id,
      collegeId: collegeId || undefined,
      limit: isNaN(limit) ? 30 : limit,
      offset: isNaN(offset) ? 0 : offset,
      unreadOnly,
    });

    return NextResponse.json({
      success: true,
      notifications: result.notifications,
      unreadCount: result.unreadCount,
      total: result.total,
    });
  } catch (error: any) {
    console.error("[Notifications API Error]", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to retrieve notifications.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    let token: string | undefined;
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    const supabase = await createClient(token);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized: Active authenticated session required." },
        { status: 401 }
      );
    }

    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("recipient_user_id", user.id);

    if (error) {
      throw new Error(`Failed to clear notifications: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      message: "All notifications cleared successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to clear notifications." },
      { status: 500 }
    );
  }
}
