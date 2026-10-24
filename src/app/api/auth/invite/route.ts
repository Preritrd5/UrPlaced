import { NextResponse, type NextRequest } from "next/server";
import {
  getInvitationByToken,
  acceptInvitation,
} from "@/modules/identity-access/services/invitation-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rawToken = request.nextUrl.searchParams.get("token");

  if (!rawToken || !rawToken.trim()) {
    return NextResponse.json(
      { valid: false, error: "Missing invitation token." },
      { status: 400 }
    );
  }

  const token = decodeURIComponent(rawToken.trim()).trim();
  const result = await getInvitationByToken(token);
  if (!result.isValid || !result.invitation) {
    return NextResponse.json(
      { valid: false, error: result.error || "Invalid invitation token." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  let userExists = false;
  let isStudent = false;
  let isCurrentUser = false;
  let currentUserName = "";

  // 1. Check if caller has an active authenticated session
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && user.email) {
      if (user.email.toLowerCase() === result.invitation.email.toLowerCase()) {
        isCurrentUser = true;
        currentUserName = user.user_metadata?.full_name || "";
      }
    }
  } catch {
    // Session check fallback
  }

  // 2. Check if a user with this email already exists in Auth or Profiles
  try {
    const { data: userData } = await admin.auth.admin.listUsers();
    const existing = userData?.users?.find(
      (u) => u.email?.toLowerCase() === result.invitation!.email.toLowerCase()
    );

    if (existing) {
      userExists = true;
      const appMeta = existing.app_metadata || {};
      const userMeta = existing.user_metadata || {};
      const category = appMeta.account_category || userMeta.account_category || userMeta.accountCategory;
      const role = appMeta.role || userMeta.role;

      if (category === "STUDENT" || role === "STUDENT") {
        isStudent = true;
      }
    }
  } catch {
    // Lookup fallback
  }

  return NextResponse.json({
    valid: true,
    email: result.invitation.email,
    role: result.invitation.role,
    tenantName: result.tenantName,
    userExists,
    isStudent,
    isCurrentUser,
    currentUserName,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token: rawToken, fullName, password } = body;

    if (!rawToken || typeof rawToken !== "string" || !rawToken.trim()) {
      return NextResponse.json(
        { success: false, error: "Invitation token is required." },
        { status: 400 }
      );
    }

    const token = decodeURIComponent(rawToken.trim()).trim();
    const { isValid, error, invitation } = await getInvitationByToken(token);
    if (!isValid || !invitation) {
      return NextResponse.json(
        { success: false, error: error || "Invalid invitation token." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Check if account is a Student account
    try {
      const { data: usersData } = await admin.auth.admin.listUsers();
      const existingUser = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === invitation.email.toLowerCase()
      );

      if (existingUser) {
        const appMeta = existingUser.app_metadata || {};
        const userMeta = existingUser.user_metadata || {};
        const category = appMeta.account_category || userMeta.account_category;
        const role = appMeta.role || userMeta.role;

        if (category === "STUDENT" || (role === "STUDENT" && category !== "COLLEGE")) {
          return NextResponse.json(
            {
              success: false,
              error:
                "This email is registered as a Student account. Student accounts cannot be assigned College staff roles. Please request an invitation to a dedicated institutional staff email address.",
            },
            { status: 403 }
          );
        }
      }
    } catch {
      // Check fallback
    }

    // Check if caller is already authenticated as this user
    let authenticatedUserId: string | null = null;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email?.toLowerCase() === invitation.email.toLowerCase()) {
        authenticatedUserId = user.id;
      }
    } catch {
      // Session fallback
    }

    let targetUserId = authenticatedUserId;

    if (!targetUserId) {
      // Caller is not logged in as this user
      // Check if user exists in auth.users
      const { data: usersData } = await admin.auth.admin.listUsers();
      const existingUser = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === invitation.email.toLowerCase()
      );

      if (existingUser) {
        // Case B: Existing user not currently signed in
        if (!password) {
          return NextResponse.json(
            { success: false, error: "Please enter your password to accept this invitation." },
            { status: 400 }
          );
        }

        // If the user has never signed in before, activate and update their password directly
        if (!existingUser.last_sign_in_at) {
          try {
            await admin.auth.admin.updateUserById(existingUser.id, {
              password,
              email_confirm: true,
              user_metadata: {
                ...(existingUser.user_metadata || {}),
                ...(fullName ? { full_name: fullName.trim() } : {}),
              },
            });
            targetUserId = existingUser.id;
          } catch {
            // Fall through to regular sign-in verification
          }
        }

        if (!targetUserId) {
          // Verify password using transient client
          const supabase = await createClient();
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: invitation.email,
            password,
          });

          if (signInError || !signInData.user) {
            return NextResponse.json(
              { success: false, error: "Invalid password for this account. Please verify your credentials." },
              { status: 401 }
            );
          }

          targetUserId = signInData.user.id;
        }
      } else {
        // Case A: New user
        if (!password) {
          return NextResponse.json(
            { success: false, error: "A password of at least 8 characters is required to set up your account." },
            { status: 400 }
          );
        }

        if (password.length < 8) {
          return NextResponse.json(
            { success: false, error: "Password must be at least 8 characters long." },
            { status: 400 }
          );
        }

        const institutionName = (invitation as any).tenant_name || "Sapthagiri NPS University";

        const { data: newUserData, error: createError } = await admin.auth.admin.createUser({
          email: invitation.email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName ? fullName.trim() : "",
            role: invitation.role,
            account_category: "COLLEGE",
            tenant_id: invitation.tenant_id,
            institution_name: institutionName,
            institutionName: institutionName,
          },
          app_metadata: {
            role: invitation.role,
            account_category: "COLLEGE",
            tenant_id: invitation.tenant_id,
            institution_name: institutionName,
            verified_by_server: true,
          },
        });

        if (createError || !newUserData.user) {
          return NextResponse.json(
            { success: false, error: createError?.message || "Failed to create user account." },
            { status: 400 }
          );
        }

        targetUserId = newUserData.user.id;
      }
    }

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: "Unable to resolve account identity for invitation acceptance." },
        { status: 500 }
      );
    }

    // Accept invitation atomically and bind membership
    const acceptResult = await acceptInvitation({
      rawToken: token,
      userId: targetUserId,
      userEmail: invitation.email,
      fullName: fullName ? fullName.trim() : undefined,
    });

    return NextResponse.json({
      success: true,
      role: acceptResult.role,
      tenantId: acceptResult.tenantId,
      email: invitation.email,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process invitation acceptance." },
      { status: 500 }
    );
  }
}
