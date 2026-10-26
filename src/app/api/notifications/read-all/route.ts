/**
 * Notifications Batch Read API Route
 * POST /api/notifications/read-all — Mark all unread notifications as read for authenticated user
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NotificationService } from "@/modules/notifications/services/notification-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
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

    const result = await NotificationService.markAllAsRead(user.id);

    return NextResponse.json({
      success: true,
      count: result.count,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Failed to mark all notifications as read.",
      },
      { status: 500 }
    );
  }
}
