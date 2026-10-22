import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { AvatarStorageService } from "@/modules/identity-access/services/avatar-storage-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";
    let fileBuffer: Buffer | Uint8Array;
    let mimeType = "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      if (!body.image || typeof body.image !== "string") {
        return NextResponse.json({ error: "Invalid image payload." }, { status: 400 });
      }

      // Check data URL format: data:<mimeType>;base64,<content>
      const match = body.image.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      if (!match) {
        return NextResponse.json(
          { error: "Invalid image format. Must be a valid image data URL." },
          { status: 400 }
        );
      }

      mimeType = match[1].toLowerCase();
      if (!AvatarStorageService.ALLOWED_MIME_TYPES.includes(mimeType)) {
        return NextResponse.json(
          { error: `Invalid image format (${mimeType}). Allowed formats: PNG, JPEG, WebP, GIF.` },
          { status: 400 }
        );
      }

      const base64Content = body.image.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
      fileBuffer = Buffer.from(base64Content, "base64");

      if (fileBuffer.byteLength > AvatarStorageService.MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Image file exceeds 2MB limit. Please upload a smaller image." },
          { status: 400 }
        );
      }
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "No file provided in form data." }, { status: 400 });
      }

      mimeType = file.type.toLowerCase();
      if (!AvatarStorageService.ALLOWED_MIME_TYPES.includes(mimeType)) {
        return NextResponse.json(
          { error: `Invalid file type (${mimeType}). Allowed formats: PNG, JPEG, WebP, GIF.` },
          { status: 400 }
        );
      }

      if (file.size > AvatarStorageService.MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "Image file exceeds 2MB limit." },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } else {
      return NextResponse.json({ error: "Unsupported Content-Type header." }, { status: 400 });
    }

    // Perform durable upload to Supabase Storage and persist reference to database profile
    const result = await AvatarStorageService.uploadAvatar({
      userId: profile.id,
      fileBuffer,
      mimeType,
    });

    return NextResponse.json({
      success: true,
      avatarUrl: result.avatarUrl,
      storagePath: result.storagePath,
      message: "Profile avatar successfully uploaded and persisted to durable storage.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to upload avatar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    await AvatarStorageService.deleteAvatar({
      userId: profile.id,
    });

    return NextResponse.json({
      success: true,
      avatarUrl: null,
      message: "Avatar removed. Reverted to initials fallback.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to remove avatar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
