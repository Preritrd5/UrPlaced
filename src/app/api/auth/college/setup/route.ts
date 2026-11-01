import { NextRequest, NextResponse } from "next/server";
import { PlatformCollegeService } from "@/modules/platform-admin/services/platform-college-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password, confirmPassword } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { success: false, error: "A valid invitation token is required." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: "Passwords do not match. Please re-enter your password." },
        { status: 400 }
      );
    }

    const result = await PlatformCollegeService.completeCollegeOnboarding({
      token,
      password,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      collegeName: result.collegeName,
      email: result.email,
      nextUrl: `/auth/college/signin?setup=completed&email=${encodeURIComponent(result.email)}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to complete account setup";
    const status = msg.includes("CROSS_COLLEGE_MEMBERSHIP_CONFLICT")
      ? 409
      : msg.includes("already been used")
      ? 410
      : msg.includes("expired")
      ? 410
      : msg.includes("revoked")
      ? 403
      : msg.includes("Invalid")
      ? 400
      : 500;

    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
