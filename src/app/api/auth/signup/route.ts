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
    const isCollegeAccount = assignedRole === "PLACEMENT_HEAD" || assignedRole === "COLLEGE";
    const canonicalRole = isCollegeAccount ? "PLACEMENT_HEAD" : "STUDENT";

    const admin = createAdminClient();

    // 3. Create user in Supabase Auth via Admin API
    const { data: userData, error: createError } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        role: canonicalRole,
        institution_name: institutionName?.trim() || null,
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

    // 4. Upsert user profile
    await admin.from("profiles").upsert({
      id: userId,
      email: cleanEmail,
      full_name: cleanName,
      is_platform_admin: false,
    });

    // 5. Resolve or create tenant for college/student
    let tenantId: string | null = null;
    const { data: existingTenants } = await admin
      .from("tenants")
      .select("id, name")
      .eq("status", "ACTIVE")
      .limit(1);

    if (existingTenants && existingTenants.length > 0) {
      tenantId = existingTenants[0].id;
    } else {
      const slug = (institutionName || "campus")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/^-+|-+$/g, "") + "-" + Date.now().toString(36);

      const { data: newTenant } = await admin
        .from("tenants")
        .insert({
          name: institutionName?.trim() || "Institutional Placement Cell",
          slug,
          status: "ACTIVE",
          student_seat_limit: 1000,
        })
        .select()
        .single();

      if (newTenant) {
        tenantId = newTenant.id;
      }
    }

    // 6. Assign tenant membership
    if (tenantId) {
      const tenantRole: TenantRole = isCollegeAccount ? "PLACEMENT_HEAD" : "STUDENT";

      await admin.from("tenant_memberships").upsert({
        tenant_id: tenantId,
        user_id: userId,
        role: tenantRole,
        status: "ACTIVE",
        permissions: {},
      });

      // 7. If student, initialize student record if department exists
      if (tenantRole === "STUDENT") {
        const { data: depts } = await admin
          .from("departments")
          .select("id")
          .eq("tenant_id", tenantId)
          .limit(1);

        if (depts && depts.length > 0) {
          const enrollmentNum = "ENR-" + Math.floor(100000 + Math.random() * 900000);
          await admin.from("students").upsert({
            tenant_id: tenantId,
            user_id: userId,
            enrollment_number: enrollmentNum,
            full_name: cleanName,
            email: cleanEmail,
            department_id: depts[0].id,
            graduation_year: new Date().getFullYear() + 1,
            degree: "B.Tech",
            cgpa: 8.0,
            active_backlogs: 0,
            total_backlogs: 0,
            academic_status: "ACTIVE",
            skills: ["Quantitative Aptitude", "Logical Reasoning", "Data Structures"],
            is_archived: false,
          });
        }
      }
    }

    // 8. Success response with target destination
    const nextUrl = isCollegeAccount ? "/dashboard" : "/dashboard/student/assessments";

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
    console.error("[SignUp API Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "An unexpected error occurred while creating your account.",
      },
      { status: 500 }
    );
  }
}
