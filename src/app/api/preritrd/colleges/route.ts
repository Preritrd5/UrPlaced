import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformCollegeService } from "@/modules/platform-admin/services/platform-college-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const planId = searchParams.get("planId") || undefined;

    const data = await PlatformCollegeService.listColleges({
      search,
      status,
      planId,
    });

    return NextResponse.json({
      success: true,
      colleges: data.colleges,
      total: data.total,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load colleges";
    const status = msg.includes("UNAUTHORIZED")
      ? 401
      : msg.includes("FORBIDDEN")
      ? 403
      : msg.includes("MFA_REQUIRED")
      ? 403
      : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);

    const body = await request.json();
    const {
      name,
      slug,
      officialEmail,
      contactName,
      contactPhone,
      primaryDomain,
      initialPlanId,
      studentSeatLimit,
    } = body;

    if (!name || !slug || !officialEmail || !contactName) {
      return NextResponse.json(
        { error: "Name, unique slug, official institutional email, and primary contact name are required." },
        { status: 400 }
      );
    }

    const result = await PlatformCollegeService.registerCollege({
      name,
      slug,
      officialEmail,
      contactName,
      contactPhone,
      primaryDomain,
      initialPlanId: initialPlanId || "growth",
      studentSeatLimit: studentSeatLimit || 1000,
      adminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      message: "College platform account registered successfully.",
      college: result.college,
      onboardingToken: result.onboardingToken,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to register college";
    const status = msg.includes("already taken") ? 409 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
