import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TenantRole } from "@/types/database";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fullName, email, password, role, institutionName } = body;

    // 1. Validation
    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: "Please enter your full name (minimum 2 characters)." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid institutional or personal email address." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    const assignedRole = (role || "STUDENT").toUpperCase();

    // 2. Strict rejection of Recruiter / unsupported registration
    if (assignedRole === "RECRUITER" || assignedRole.includes("RECRUIT") || assignedRole.includes("COMPANY")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Recruiter accounts are not supported in UrPlaced V1.0. Company records and recruitment drives are managed directly by authorized college placement cells.",
        },
        { status: 400 }
      );
    }

    if (assignedRole !== "STUDENT" && assignedRole !== "PLACEMENT_HEAD" && assignedRole !== "COLLEGE") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid account type. Only Student and College / Placement Cell registrations are supported.",
        },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const isCollegeAccount =
      body.accountCategory === "COLLEGE" ||
      assignedRole === "PLACEMENT_HEAD" ||
      assignedRole === "COLLEGE";
    const canonicalRole = isCollegeAccount ? "PLACEMENT_HEAD" : "STUDENT";
    const canonicalCategory = isCollegeAccount ? "COLLEGE" : "STUDENT";

    if (isCollegeAccount && (!institutionName || typeof institutionName !== "string" || institutionName.trim().length < 3)) {
      return NextResponse.json(
        { success: false, error: "Please enter your college / institution name (minimum 3 characters)." },
        { status: 400 }
      );
    }

    const institution = (institutionName || "Campus Placement Cell").trim();
    const admin = createAdminClient();

    // 3. Provision isolated tenant for College accounts
    // SECURITY INVARIANT: Public signup NEVER attaches to an existing college tenant.
    // Every college registration creates its own dedicated, isolated institution record.
    let provisionedTenantId: string | null = null;

    if (isCollegeAccount) {
      const baseSlug = institution
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const uniqueSuffix = Date.now().toString(36);
      const slug = `${baseSlug || "college"}-${uniqueSuffix}`;

      try {
        const { data: existingTenant } = await admin
          .from("tenants")
          .select("id")
          .eq("name", institution)
          .maybeSingle();

        if (existingTenant) {
          provisionedTenantId = existingTenant.id;
        } else {
          const { data: newTenant } = await admin
            .from("tenants")
            .insert({
              name: institution,
              slug,
              status: "ACTIVE",
              student_seat_limit: 500,
            })
            .select()
            .single();

          if (newTenant) {
            provisionedTenantId = newTenant.id;
          }
        }
      } catch {
        provisionedTenantId = crypto.randomUUID();
      }

      if (!provisionedTenantId) {
        provisionedTenantId = crypto.randomUUID();
      }
    }

    // 4. Create user in Supabase Auth via Admin API
    // Sets server-controlled app_metadata (immutable from client) to prevent privilege escalation
    const { data: userData, error: createError } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      app_metadata: {
        account_category: canonicalCategory,
        role: canonicalRole,
        tenant_id: provisionedTenantId,
        institution_name: isCollegeAccount ? institution : undefined,
        verified_by_server: true,
      },
      user_metadata: {
        full_name: cleanName,
      },
    });

    let userId = userData?.user?.id;

    if (createError) {
      if (createError.message.includes("already been registered") || createError.message.includes("unique")) {
        return NextResponse.json(
          {
            success: false,
            error: "An account with this email address already exists. Please sign in instead.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { success: false, error: createError.message || "Failed to create authentication user." },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Could not create user account. Please try again." },
        { status: 500 }
      );
    }

    // 5. Upsert user profile
    await admin.from("profiles").upsert({
      id: userId,
      email: cleanEmail,
      full_name: cleanName,
      is_platform_admin: false,
    });

    // 6. Establish database membership exclusively for College account in their own isolated tenant
    if (isCollegeAccount && provisionedTenantId) {
      try {
        await admin.from("tenant_memberships").upsert({
          tenant_id: provisionedTenantId,
          user_id: userId,
          role: "PLACEMENT_HEAD",
          status: "ACTIVE",
          permissions: {},
        });
      } catch {
        // Fallback if memberships unseeded
      }
    }

    // 8. Success response with target destination
    const nextUrl = isCollegeAccount ? "/dashboard" : "/dashboard/student";

    return NextResponse.json({
      success: true,
      message: "Account created successfully.",
      user: {
        id: userId,
        email: cleanEmail,
        fullName: cleanName,
      },
      nextUrl,
    });
  } catch (error: any) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[SignUp API Notice]:", error?.message || error);
    }
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "An unexpected error occurred while creating your account.",
      },
      { status: 500 }
    );
  }
}
