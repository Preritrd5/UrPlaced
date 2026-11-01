import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { AvatarStorageService } from "@/modules/identity-access/services/avatar-storage-service";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";
    let fileBuffer: Buffer | null = null;
    let mimeType = "image/png";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      const base64Data = body.base64 || body.image;
      if (!base64Data) {
        return NextResponse.json({ error: "No image data provided" }, { status: 400 });
      }

      // Extract MIME type and base64 payload
      const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        fileBuffer = Buffer.from(matches[2], "base64");
      } else {
        fileBuffer = Buffer.from(base64Data, "base64");
        mimeType = body.mimeType || "image/png";
      }
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file uploaded in form data" }, { status: 400 });
      }
      mimeType = file.type || "image/png";
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } else {
      return NextResponse.json(
        { error: "Unsupported Content-Type. Please provide JSON base64 or multipart/form-data." },
        { status: 400 }
      );
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json({ error: "Empty image payload" }, { status: 400 });
    }

    // Reuse existing private Supabase avatar storage architecture
    const adminClient = createAdminClient();
    const result = await AvatarStorageService.uploadAvatar({
      userId: admin.id,
      fileBuffer,
      mimeType,
      email: admin.email,
      fullName: admin.fullName,
      admin: adminClient,
    });

    // Log platform audit event
    await PlatformAuthService.logAuditEvent({
      actorId: admin.id,
      action: "PLATFORM_UPLOAD_AVATAR",
      resourceType: "ADMIN_AVATAR",
      resourceId: admin.id,
      metadata: {
        storagePath: result.storagePath,
      },
    });

    return NextResponse.json({
      success: true,
      avatarUrl: result.avatarUrl,
      storagePath: result.storagePath,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message?.includes("MFA_REQUIRED")) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err.message || "Failed to upload administrator avatar photo." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // 1. Remove avatar files from private avatars storage
    await AvatarStorageService.deleteAvatar({ userId: admin.id, admin: adminClient });

    // 2. Reset profiles.avatar_url
    await adminClient
      .from("profiles")
      .update({
        avatar_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", admin.id);

    // 3. Reset user_metadata avatar references
    try {
      await adminClient.auth.admin.updateUserById(admin.id, {
        user_metadata: {
          avatar_url: null,
          avatar_storage_path: null,
        },
      });
    } catch {
      // Non-fatal
    }

    // 4. Log platform audit event
    await PlatformAuthService.logAuditEvent({
      actorId: admin.id,
      action: "PLATFORM_REMOVE_AVATAR",
      resourceType: "ADMIN_AVATAR",
      resourceId: admin.id,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message?.includes("MFA_REQUIRED")) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err.message || "Failed to remove administrator avatar photo." },
      { status: 500 }
    );
  }
}
