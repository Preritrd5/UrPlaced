/**
 * Public Career Passport Resolver API
 * GET /api/public/passport/[token] — Anonymous public access for recruiters via secure token
 */

import { NextRequest, NextResponse } from "next/server";
import { CareerPassportService } from "@/modules/students/services/career-passport-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token || token.length < 32) {
      return NextResponse.json(
        { error: "Invalid or malformed passport share link." },
        { status: 400 }
      );
    }

    const publicPassport = await CareerPassportService.resolvePublicPassport(token);

    if (!publicPassport) {
      return NextResponse.json(
        { error: "This career passport link has expired, was revoked, or does not exist." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: publicPassport,
      },
      {
        headers: {
          "X-Robots-Tag": "noindex, nofollow",
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("[Public Passport API] Error:", error);
    return NextResponse.json(
      { error: "Unable to retrieve career passport at this time." },
      { status: 500 }
    );
  }
}
