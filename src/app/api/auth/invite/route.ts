import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
import {
  getInvitationByToken,
  acceptInvitation,
} from "@/modules/identity-access/services/invitation-service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { valid: false, error: "Missing invitation token." },
      { status: 400 }
    );
  }

  const result = await getInvitationByToken(token);
  if (!result.isValid || !result.invitation) {
    return NextResponse.json(
      { valid: false, error: result.error || "Invalid invitation token." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    valid: true,
    email: result.invitation.email,
    role: result.invitation.role,
    tenantName: result.tenantName,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, fullName, password } = body;

    if (!token || !password) {
      return NextResponse.json(
        { success: false, error: "Token and password are required." },
        { status: 400 }
      );
    }

    const { isValid, error, invitation } = await getInvitationByToken(token);
    if (!isValid || !invitation) {
      return NextResponse.json(
        { success: false, error: error || "Invalid invitation token." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 1. Create or resolve user in Supabase Auth via Admin API
    const { data: userData, error: createError } =
      await admin.auth.admin.createUser({
        email: invitation.email,
        password,
        email_confirm: true, // Automatically confirmed via trusted invitation
        user_metadata: {
          full_name: fullName || "",
        },
      });

    let userId = userData.user?.id;

    if (createError) {
      // If user already exists in auth.users, verify credentials or link
      if (createError.message.includes("already been registered")) {
        const { data: existingUsers } = await admin.auth.admin.listUsers();
        const existing = existingUsers.users.find(
          (u) => u.email?.toLowerCase() === invitation.email.toLowerCase()
        );
        if (existing) {
          userId = existing.id;
        } else {
          return NextResponse.json(
            { success: false, error: createError.message },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { success: false, error: createError.message },
          { status: 400 }
        );
      }
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Failed to establish user account." },
        { status: 500 }
      );
    }

    // 2. Accept the invitation atomically
    const acceptResult = await acceptInvitation({
      rawToken: token,
      userId,
      userEmail: invitation.email,
    });

    return NextResponse.json({
      success: true,
      role: acceptResult.role,
      tenantId: acceptResult.tenantId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to accept invitation.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
