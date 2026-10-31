import { describe, it, expect, vi, beforeEach } from "vitest";
import { AvatarStorageService } from "@/modules/identity-access/services/avatar-storage-service";

describe("Avatar Storage Persistence & Cross-Session Lifecycle", () => {
  let mockStorageStore: Record<string, { buffer: Buffer; contentType: string }> = {};
  let mockProfilesDb: Record<string, any> = {};
  let mockUserMetadata: Record<string, any> = {};

  const createMockAdmin = () => ({
    storage: {
      getBucket: vi.fn(async (name: string) => {
        if (name === "avatars") return { data: { id: "avatars", public: false }, error: null };
        return { data: null, error: { message: "Not found" } };
      }),
      createBucket: vi.fn(async (name: string) => {
        return { data: { id: name }, error: null };
      }),
      from: vi.fn((bucket: string) => ({
        upload: vi.fn(async (path: string, buffer: Buffer, options: any) => {
          mockStorageStore[`${bucket}/${path}`] = { buffer, contentType: options.contentType };
          return { data: { path }, error: null };
        }),
        getPublicUrl: vi.fn((path: string) => ({
          data: {
            publicUrl: `https://test-project.supabase.co/storage/v1/object/public/${bucket}/${path}`,
          },
        })),
        createSignedUrl: vi.fn(async (path: string) => ({
          data: {
            signedUrl: `https://test-project.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=mock-token`,
          },
          error: null,
        })),
        list: vi.fn(async (folder: string) => {
          const prefix = `${bucket}/${folder}/`;
          const matches = Object.keys(mockStorageStore)
            .filter((k) => k.startsWith(prefix))
            .map((k) => ({ name: k.replace(prefix, "") }));
          return { data: matches, error: null };
        }),
        remove: vi.fn(async (paths: string[]) => {
          for (const p of paths) {
            delete mockStorageStore[`${bucket}/${p}`];
          }
          return { data: paths, error: null };
        }),
      })),
    },
    from: vi.fn((table: string) => ({
      upsert: vi.fn(async (record: any) => {
        mockProfilesDb[record.id] = { ...mockProfilesDb[record.id], ...record };
        return { data: null, error: null };
      }),
      update: vi.fn((updates: any) => ({
        eq: vi.fn(async (field: string, val: string) => {
          if (mockProfilesDb[val]) {
            mockProfilesDb[val] = { ...mockProfilesDb[val], ...updates };
          }
          return { data: null, error: null };
        }),
      })),
      select: vi.fn(() => ({
        eq: vi.fn((field: string, val: string) => ({
          maybeSingle: vi.fn(async () => ({
            data: mockProfilesDb[val] || null,
            error: null,
          })),
        })),
      })),
    })),
    auth: {
      admin: {
        updateUserById: vi.fn(async (id: string, payload: any) => {
          mockUserMetadata[id] = {
            ...mockUserMetadata[id],
            ...payload.user_metadata,
          };
          return { data: { user: { id } }, error: null };
        }),
      },
    },
  });

  beforeEach(() => {
    mockStorageStore = {};
    mockProfilesDb = {};
    mockUserMetadata = {};
  });

  describe("Test A: Upload and Refresh", () => {
    it("uploads avatar to Supabase Storage, sets durable reference in database, and reconstructs on reload", async () => {
      const mockAdmin = createMockAdmin();
      const userId = "user-alice-1";
      const samplePng = Buffer.from("fake-png-binary-stream");

      // 1. Upload
      const result = await AvatarStorageService.uploadAvatar({
        userId,
        fileBuffer: samplePng,
        mimeType: "image/png",
        admin: mockAdmin as any,
      });

      expect(result.success).toBe(true);
      expect(result.storagePath).toMatch(/^user-alice-1\/avatar-\d+\.png$/);
      expect(result.avatarUrl).toContain("https://test-project.supabase.co/storage/v1/object/sign/avatars/user-alice-1/avatar-");
      expect(result.avatarUrl).toContain("token=mock-token");

      // 2. Storage object exists
      expect(mockStorageStore[`avatars/${result.storagePath}`]).toBeDefined();
      expect(mockStorageStore[`avatars/${result.storagePath}`].contentType).toBe("image/png");

      // 3. Database profile contains the durable canonical storage path reference
      expect(mockProfilesDb[userId]).toBeDefined();
      expect(mockProfilesDb[userId].avatar_url).toBe(result.storagePath);

      // 4. Session / profile refresh simulation
      const resolved = await AvatarStorageService.resolveAvatarUrl(mockProfilesDb[userId].avatar_url, mockAdmin as any);
      expect(resolved).toBe(result.avatarUrl);
    });
  });

  describe("Test B: Logout and Login Simulation", () => {
    it("reconstructs avatar from persisted backend data when re-authenticating", async () => {
      const mockAdmin = createMockAdmin();
      const userId = "user-bob-2";
      const sampleJpg = Buffer.from("fake-jpg-binary-stream");

      await AvatarStorageService.uploadAvatar({
        userId,
        fileBuffer: sampleJpg,
        mimeType: "image/jpeg",
        admin: mockAdmin as any,
      });

      const initialPath = mockProfilesDb[userId].avatar_url;
      expect(initialPath).toBeDefined();

      // Simulate sign out (clearing client state)
      let clientSessionState: any = null;
      expect(clientSessionState).toBeNull();

      // Simulate sign in and session restoration from database profile
      const userProfileFromDb = mockProfilesDb[userId];
      clientSessionState = {
        userId: userProfileFromDb.id,
        avatarUrl: await AvatarStorageService.resolveAvatarUrl(userProfileFromDb.avatar_url, mockAdmin as any),
      };

      expect(clientSessionState.avatarUrl).toContain("user-bob-2/avatar-");
      expect(clientSessionState.avatarUrl).toContain("token=mock-token");
    });
  });

  describe("Test C: Cross-Device Context Simulation", () => {
    it("retrieves durable avatar on an independent second client without access to first device local state", async () => {
      const mockAdmin = createMockAdmin();
      const userId = "user-carol-3";

      // Device 1 uploads photo
      const uploadRes = await AvatarStorageService.uploadAvatar({
        userId,
        fileBuffer: Buffer.from("carol-photo-binary"),
        mimeType: "image/webp",
        admin: mockAdmin as any,
      });

      // Device 2 initiates fresh session with isolated empty storage
      const device2IsolatedState: Record<string, string> = {};
      expect(device2IsolatedState["avatar"]).toBeUndefined();

      // Device 2 authenticates and calls backend profile resolution
      const backendProfile = mockProfilesDb[userId];
      const device2ResolvedAvatar = await AvatarStorageService.resolveAvatarUrl(
        backendProfile.avatar_url,
        mockAdmin as any
      );

      expect(device2ResolvedAvatar).toBe(uploadRes.avatarUrl);
      expect(device2ResolvedAvatar).toContain("user-carol-3/avatar-");
    });
  });

  describe("Test D: Avatar Replacement and Orphan File Cleanup", () => {
    it("replaces existing picture with new image and removes previous storage file", async () => {
      const mockAdmin = createMockAdmin();
      const userId = "user-david-4";

      // First upload
      const firstUpload = await AvatarStorageService.uploadAvatar({
        userId,
        fileBuffer: Buffer.from("first-image"),
        mimeType: "image/png",
        admin: mockAdmin as any,
      });

      expect(mockStorageStore[`avatars/${firstUpload.storagePath}`]).toBeDefined();

      // Wait 2ms to ensure unique timestamp
      await new Promise((r) => setTimeout(r, 5));

      // Second upload (Replacement)
      const secondUpload = await AvatarStorageService.uploadAvatar({
        userId,
        fileBuffer: Buffer.from("second-image-replacement"),
        mimeType: "image/jpeg",
        admin: mockAdmin as any,
      });

      // Database points to canonical storage path of new replacement
      expect(mockProfilesDb[userId].avatar_url).toBe(secondUpload.storagePath);
      expect(secondUpload.storagePath).not.toBe(firstUpload.storagePath);

      // Old image file in storage was cleaned up
      expect(mockStorageStore[`avatars/${firstUpload.storagePath}`]).toBeUndefined();
      // New image file exists
      expect(mockStorageStore[`avatars/${secondUpload.storagePath}`]).toBeDefined();
    });
  });

  describe("Test E: Failure Recovery and Rollback Protection", () => {
    it("rolls back newly uploaded storage file if database update fails", async () => {
      const mockAdmin = createMockAdmin();
      const userId = "user-fail-5";

      // Mock database error
      mockAdmin.from = vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Database connection terminated unexpectedly" },
        }),
      })) as any;

      await expect(
        AvatarStorageService.uploadAvatar({
          userId,
          fileBuffer: Buffer.from("orphan-prevention-test"),
          mimeType: "image/png",
          admin: mockAdmin as any,
        })
      ).rejects.toThrow("Database profile update failed");

      // Verify no orphaned files remain in storage after rollback
      const storageKeys = Object.keys(mockStorageStore);
      expect(storageKeys.filter((k) => k.includes(userId)).length).toBe(0);
    });

    it("gracefully falls back to user_metadata and does NOT rollback when public.profiles is missing from schema cache (PGRST205)", async () => {
      const mockAdmin = createMockAdmin();
      const userId = "user-schema-cache-miss";

      // Mock PGRST205 schema cache miss error
      mockAdmin.from = vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: "PGRST205",
            message: "Could not find the table 'public.profiles' in the schema cache",
          },
        }),
      })) as any;

      const result = await AvatarStorageService.uploadAvatar({
        userId,
        fileBuffer: Buffer.from("valid-avatar-binary"),
        mimeType: "image/png",
        admin: mockAdmin as any,
      });

      expect(result.success).toBe(true);
      expect(result.avatarUrl).toContain("user-schema-cache-miss/avatar-");
      // Verify storage file was preserved, NOT rolled back!
      expect(mockStorageStore[`avatars/${result.storagePath}`]).toBeDefined();
      // Verify user_metadata contains the canonical storage path
      expect(mockUserMetadata[userId].avatar_url).toBe(result.storagePath);
    });

    it("rejects files exceeding 2MB with explicit validation error", async () => {
      const mockAdmin = createMockAdmin();
      const oversizedBuffer = Buffer.alloc(2.5 * 1024 * 1024); // 2.5MB

      await expect(
        AvatarStorageService.uploadAvatar({
          userId: "user-oversized",
          fileBuffer: oversizedBuffer,
          mimeType: "image/png",
          admin: mockAdmin as any,
        })
      ).rejects.toThrow("Image file exceeds the 2MB size limit");
    });

    it("rejects unsupported MIME types (e.g. application/pdf, text/javascript)", async () => {
      const mockAdmin = createMockAdmin();
      const samplePdf = Buffer.from("%PDF-1.4");

      await expect(
        AvatarStorageService.uploadAvatar({
          userId: "user-bad-mime",
          fileBuffer: samplePdf,
          mimeType: "application/pdf",
          admin: mockAdmin as any,
        })
      ).rejects.toThrow("Invalid image format (application/pdf)");
    });
  });

  describe("Test F: Deletion and Initials Fallback", () => {
    it("removes all avatar files from storage and clears database profile reference", async () => {
      const mockAdmin = createMockAdmin();
      const userId = "user-del-6";

      // Upload avatar
      await AvatarStorageService.uploadAvatar({
        userId,
        fileBuffer: Buffer.from("delete-me"),
        mimeType: "image/png",
        admin: mockAdmin as any,
      });

      expect(mockProfilesDb[userId].avatar_url).not.toBeNull();

      // Delete avatar
      const delResult = await AvatarStorageService.deleteAvatar({
        userId,
        admin: mockAdmin as any,
      });

      expect(delResult.success).toBe(true);
      expect(mockProfilesDb[userId].avatar_url).toBeNull();
      expect(mockUserMetadata[userId].avatar_url).toBeNull();

      // Resolved avatar URL returns null (triggering initials fallback)
      expect(await AvatarStorageService.resolveAvatarUrl(mockProfilesDb[userId].avatar_url, mockAdmin as any)).toBeNull();
    });
  });

  describe("Test G: Canonical Path Extraction & Legacy URL Resolution", () => {
    it("extracts canonical storage path across all URL formats and prefixes", () => {
      // 1. Raw canonical path
      expect(AvatarStorageService.extractStoragePath("user-123/avatar-999.png")).toBe("user-123/avatar-999.png");

      // 2. Prefixed with bucket
      expect(AvatarStorageService.extractStoragePath("avatars/user-123/avatar-999.png")).toBe("user-123/avatar-999.png");

      // 3. Supabase public URL (like in the reported failure!)
      expect(
        AvatarStorageService.extractStoragePath(
          "https://xyz.supabase.co/storage/v1/object/public/avatars/ab8e00dd-45e2-497e-a8c/avatar-1793387683201.png"
        )
      ).toBe("ab8e00dd-45e2-497e-a8c/avatar-1793387683201.png");

      // 4. Supabase signed URL with token parameters
      expect(
        AvatarStorageService.extractStoragePath(
          "https://xyz.supabase.co/storage/v1/object/sign/avatars/user-123/avatar-999.png?token=expiring-jwt-123"
        )
      ).toBe("user-123/avatar-999.png");

      // 5. Custom domain path
      expect(
        AvatarStorageService.extractStoragePath("https://urplaced.storage/avatars/user-123/avatar-999.png")
      ).toBe("user-123/avatar-999.png");

      // 6. External non-storage OAuth URL returns null (not a Supabase storage path)
      expect(AvatarStorageService.extractStoragePath("https://lh3.googleusercontent.com/a/ACg8ocI...=s96-c")).toBeNull();

      // 7. Empty or null returns null
      expect(AvatarStorageService.extractStoragePath(null)).toBeNull();
      expect(AvatarStorageService.extractStoragePath("")).toBeNull();
    });

    it("resolves a fresh signed URL for legacy public storage URLs", async () => {
      const mockAdmin = createMockAdmin();
      const legacyPublicUrl =
        "https://xyz.supabase.co/storage/v1/object/public/avatars/ab8e00dd-45e2-497e-a8c/avatar-1793387683201.png";

      const signedUrl = await AvatarStorageService.resolveAvatarUrl(legacyPublicUrl, mockAdmin as any);
      expect(signedUrl).toBeDefined();
      expect(signedUrl).toContain("object/sign/avatars/ab8e00dd-45e2-497e-a8c/avatar-1793387683201.png");
      expect(signedUrl).toContain("token=mock-token");
    });

    it("passes through external non-storage URLs (OAuth Google/GitHub avatars)", async () => {
      const mockAdmin = createMockAdmin();
      const externalGoogleUrl = "https://lh3.googleusercontent.com/a/ACg8ocI=s96-c";

      const resolved = await AvatarStorageService.resolveAvatarUrl(externalGoogleUrl, mockAdmin as any);
      expect(resolved).toBe(externalGoogleUrl);
    });
  });
});
