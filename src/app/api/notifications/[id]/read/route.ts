/**
 * Notification Read Status API Route
 * PATCH /api/notifications/[id]/read — Mark a single notification as read
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NotificationService } from "@/modules/notifications/services/notification-service";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid notification ID provided." },
        { status: 400 }
      );
    }

    const updated = await NotificationService.markAsRead({
      userId: user.id,
      notificationId: id,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Notification not found or access denied." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      notification: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message || "Failed to mark notification as read.",
      },
      { status: 500 }
    );
  }
}
