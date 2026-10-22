import { createAdminClient } from "@/lib/supabase/admin";

export class AvatarStorageService {
  public static readonly BUCKET_NAME = "avatars";
  public static readonly MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
  public static readonly ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  public static readonly MIME_TO_EXTENSION: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };

  /**
   * Ensures the avatars storage bucket exists and is configured for public read access.
   */
  static async ensureBucketExists(admin = createAdminClient()): Promise<boolean> {
    try {
      const { data: bucket, error: getErr } = await admin.storage.getBucket(this.BUCKET_NAME);
      if (!bucket || getErr) {
        const { error: createErr } = await admin.storage.createBucket(this.BUCKET_NAME, {
          public: true,
          fileSizeLimit: this.MAX_FILE_SIZE,
          allowedMimeTypes: this.ALLOWED_MIME_TYPES,
        });

        if (createErr && !createErr.message.includes("already exists")) {
          console.warn("[AvatarStorageService] Notice on bucket creation:", createErr.message);
          return false;
        }
      }
      return true;
    } catch (err: unknown) {
      console.warn("[AvatarStorageService] Storage bucket probe error:", err);
      return false;
    }
  }

  /**
   * Validates MIME type and size, uploads image to Supabase Storage,
   * updates the user's database profile record with the canonical URL reference,
   * and rolls back storage on database failure.
   */
  static async uploadAvatar(params: {
    userId: string;
    fileBuffer: Buffer | Uint8Array;
    mimeType: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{ success: boolean; avatarUrl: string; storagePath: string }> {
    const { userId, fileBuffer, mimeType, admin = createAdminClient() } = params;

    // 1. Validate MIME type
    if (!this.ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error(
        `Invalid image format (${mimeType}). Permitted formats: PNG, JPEG, WebP, GIF.`
      );
    }

    // 2. Validate file byte size
    const byteLength = fileBuffer.byteLength || (fileBuffer as Buffer).length;
    if (byteLength > this.MAX_FILE_SIZE) {
      throw new Error("Image file exceeds the 2MB size limit.");
    }

    // 3. Ensure bucket exists
    await this.ensureBucketExists(admin);

    // 4. Determine extension and storage path
    const extension = this.MIME_TO_EXTENSION[mimeType] || "png";
    const timestamp = Date.now();
    const fileName = `avatar-${timestamp}.${extension}`;
    const storagePath = `${userId}/${fileName}`;

    // 5. Upload image to Supabase Storage
    const { data: uploadData, error: uploadError } = await admin.storage
      .from(this.BUCKET_NAME)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
        cacheControl: "3600",
      });

    if (uploadError || !uploadData) {
      throw new Error(`Failed to upload image to storage: ${uploadError?.message || "Unknown error"}`);
    }

    // 6. Obtain canonical persistent public URL
    const { data: urlData } = admin.storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    if (!publicUrl) {
      // Rollback uploaded object if URL resolution failed
      await admin.storage.from(this.BUCKET_NAME).remove([storagePath]);
      throw new Error("Failed to derive canonical storage URL for uploaded avatar.");
    }

    // 7. Persist canonical reference to Supabase Auth user_metadata and database profiles
    // Primary guaranteed store: Supabase Auth user_metadata (always present across all Supabase tiers)
    try {
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
          avatar_url: publicUrl,
        },
      });
    } catch (authMetaErr: unknown) {
      console.warn("[AvatarStorageService] Notice on user_metadata update:", authMetaErr);
    }

    // Secondary relational store: public.profiles table (if migrated and present in schema cache)
    try {
      const { error: dbError } = await admin
        .from("profiles")
        .upsert({
          id: userId,
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        });

      if (dbError) {
        const isMissingTable =
          dbError.code === "PGRST205" ||
          dbError.code === "42P01" ||
          dbError.message?.toLowerCase().includes("schema cache") ||
          dbError.message?.toLowerCase().includes("does not exist");

        if (!isMissingTable) {
          // Hard SQL constraint or connection failure: rollback
          await admin.storage.from(this.BUCKET_NAME).remove([storagePath]);
          throw new Error(`Database profile update failed: ${dbError.message}. Upload rolled back.`);
        } else {
          // Table not yet migrated or schema cache miss: safely rely on user_metadata store
          if (process.env.NODE_ENV === "development") {
            console.warn(
              "[AvatarStorageService] Table 'public.profiles' not in schema cache. Preserved canonical avatar in user_metadata."
            );
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Upload rolled back")) {
        throw err;
      }
      // Graceful fallback: user_metadata already holds the canonical Supabase Storage URL
    }

    // 8. Clean up any previous avatar files in the user's storage directory to prevent orphans
    try {
      const { data: existingFiles } = await admin.storage
        .from(this.BUCKET_NAME)
        .list(userId);

      if (existingFiles && existingFiles.length > 0) {
        const oldFiles = existingFiles
          .filter((file) => file.name !== fileName)
          .map((file) => `${userId}/${file.name}`);

        if (oldFiles.length > 0) {
          await admin.storage.from(this.BUCKET_NAME).remove(oldFiles);
        }
      }
    } catch {
      // Non-fatal: cleanup of old files should not fail the active upload
    }

    return {
      success: true,
      avatarUrl: publicUrl,
      storagePath,
    };
  }

  /**
   * Deletes a user's avatar from Supabase Storage and sets the database profile reference to null.
   */
  static async deleteAvatar(params: {
    userId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{ success: boolean }> {
    const { userId, admin = createAdminClient() } = params;

    // 1. Remove all avatar files in the user's storage directory
    try {
      const { data: existingFiles } = await admin.storage
        .from(this.BUCKET_NAME)
        .list(userId);

      if (existingFiles && existingFiles.length > 0) {
        const filesToRemove = existingFiles.map((file) => `${userId}/${file.name}`);
        await admin.storage.from(this.BUCKET_NAME).remove(filesToRemove);
      }
    } catch (err: unknown) {
      console.warn("[AvatarStorageService] Storage file deletion warning:", err);
    }

    // 2. Clear from user_metadata
    try {
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
          avatar_url: null,
        },
      });
    } catch (authMetaErr: unknown) {
      console.warn("[AvatarStorageService] Notice on user_metadata clear:", authMetaErr);
    }

    // 3. Set database profile reference to null (if table exists)
    try {
      await admin
        .from("profiles")
        .update({
          avatar_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    } catch {
      // Safe fallback if table is not in schema cache
    }

    return { success: true };
  }

  /**
   * Resolves a durable display URL from an avatar reference.
   * If the reference is a relative storage path (e.g. "userId/avatar.png"),
   * derives the canonical public URL.
   */
  static resolveAvatarUrl(
    avatarRef: string | null | undefined,
    admin = createAdminClient()
  ): string | null {
    if (!avatarRef || typeof avatarRef !== "string" || avatarRef.trim() === "") {
      return null;
    }

    const ref = avatarRef.trim();

    // If already a full HTTP(S) URL, return it directly
    if (ref.startsWith("http://") || ref.startsWith("https://")) {
      return ref;
    }

    // If a storage path (e.g. "avatars/userId/avatar.png" or "userId/avatar.png")
    let cleanPath = ref;
    if (cleanPath.startsWith("avatars/")) {
      cleanPath = cleanPath.substring("avatars/".length);
    }

    try {
      const { data } = admin.storage.from(this.BUCKET_NAME).getPublicUrl(cleanPath);
      return data?.publicUrl || null;
    } catch {
      return null;
    }
  }
}
