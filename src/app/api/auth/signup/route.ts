import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { StudentService } from "@/modules/students/services/student-service";
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

    // 3. SRN Pre-Validation & Roster Association for Student Accounts
    // SECURITY INVARIANTS:
    // - Client-supplied college IDs or names are NEVER trusted for student accounts.
    // - Institutional affiliation (tenant_id) is derived 100% from the verified roster record.
    // - Unclaimed check, ambiguous match rejection, and status verification occur before account creation.
    let studentRosterRecord: any = null;
    let derivedStudentTenantId: string | null = null;
    let cleanSrn = "";

    if (!isCollegeAccount) {
      cleanSrn = StudentService.normalizeSrn(body.srn);
      if (!cleanSrn) {
        return NextResponse.json(
          { success: false, error: "Student Registration Number (SRN) is required." },
          { status: 400 }
        );
      }

      const eligibleCheck = await StudentService.findEligibleRosterBySrn(cleanSrn);

      if (eligibleCheck.status === "INVALID_SRN") {
        return NextResponse.json(
          { success: false, error: "Please enter a valid Student Registration Number (SRN)." },
          { status: 400 }
        );
      }

      if (eligibleCheck.status === "ALREADY_CLAIMED") {
        return NextResponse.json(
          {
            success: false,
            error:
              "This Student Registration Number (SRN) has already been claimed by a registered account. Please sign in or contact your campus placement cell.",
          },
          { status: 409 }
        );
      }

      if (eligibleCheck.status === "NOT_FOUND") {
        return NextResponse.json(
          {
            success: false,
            error:
              "Your Student Registration Number (SRN) could not be matched to an active college roster record. Please contact your campus placement cell to be added to the official student list.",
          },
          { status: 404 }
        );
      }

      if (eligibleCheck.status === "AMBIGUOUS") {
        return NextResponse.json(
          {
            success: false,
            error:
              "This SRN matches multiple institutional rosters. Registration cannot proceed automatically. Please contact your college placement cell.",
          },
          { status: 409 }
        );
      }

      if (eligibleCheck.status !== "FOUND" || !eligibleCheck.roster) {
        return NextResponse.json(
          { success: false, error: "Unable to verify student roster eligibility." },
          { status: 400 }
        );
      }

      studentRosterRecord = eligibleCheck.roster;
      derivedStudentTenantId = studentRosterRecord.tenant_id;
    }

    // 4. Provision isolated tenant for College accounts (or use derived tenant for Students)
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
    } else {
      // For student accounts, the tenant is strictly derived from the verified roster
      provisionedTenantId = derivedStudentTenantId;
    }

    // 5. Create user in Supabase Auth via Admin API
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

    // 6. Roster Claiming for Student Accounts
    // Atomically binds the authenticated account to the existing roster record,
    // synchronizes full_name and email on the roster record from validated signup input,
    // establishes tenant_memberships, updates app_metadata, and writes audit trail.
    if (!isCollegeAccount) {
      const claimResult = await StudentService.claimStudentRosterRecord({
        srn: cleanSrn,
        userId,
        fullName: cleanName,
        email: cleanEmail,
      });

      if (!claimResult.success) {
        // Rollback created auth user so an unlinked or orphan account is not left behind
        await admin.auth.admin.deleteUser(userId).catch(() => null);

        const isConflict =
          claimResult.code === "ALREADY_CLAIMED" ||
          claimResult.code === "AMBIGUOUS_SRN" ||
          claimResult.code === "USER_ALREADY_HAS_ROSTER" ||
          claimResult.code === "CONCURRENT_CLAIM_CONFLICT" ||
          claimResult.code === "ROLE_CONFLICT" ||
          claimResult.code === "MEMBERSHIP_SUSPENDED" ||
          claimResult.code === "TENANT_MISMATCH";

        return NextResponse.json(
          {
            success: false,
            error: claimResult.message || "Failed to link student account with campus roster.",
          },
          { status: isConflict ? 409 : 400 }
        );
      }
    }

    // 7. Upsert user profile
    await admin.from("profiles").upsert({
      id: userId,
      email: cleanEmail,
      full_name: cleanName,
      is_platform_admin: false,
    });

    // 8. Establish database membership for College accounts in their isolated tenant
    // (Student memberships were already established atomically during claimStudentRosterRecord)
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

    // 9. Invalidate student directory cache to guarantee immediate directory freshness
    try {
      revalidatePath("/dashboard/students");
    } catch {}

    // 10. Success response with target destination
    const nextUrl = isCollegeAccount ? "/dashboard" : "/dashboard/student";

    return NextResponse.json({
      success: true,
      message: isCollegeAccount
        ? "Account created successfully."
        : "Student account created and linked to official campus roster successfully.",
      user: {
        id: userId,
        email: cleanEmail,
        fullName: cleanName,
      },
      tenantId: provisionedTenantId,
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
