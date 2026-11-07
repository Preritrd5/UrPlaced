import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformAuthService } from "./platform-auth-service";

export interface PlatformSettingItem {
  key: string;
  value: any;
  category: string;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

export class PlatformConfigService {
  private static maintenanceCache: {
    data: { enabled: boolean; message: string; scheduledEnd: string | null };
    cachedAt: number;
  } | null = null;

  private static readonly CACHE_TTL_MS = 5000;

  /**
   * Clears the in-memory maintenance status cache.
   */
  static invalidateMaintenanceCache(): void {
    PlatformConfigService.maintenanceCache = null;
  }
  /**
   * Retrieves all platform settings.
   */
  static async getAllSettings(admin = createAdminClient()): Promise<Record<string, PlatformSettingItem>> {
    const { data, error } = await admin
      .from("platform_settings")
      .select("*")
      .order("category", { ascending: true });

    if (error) {
      throw new Error(`Failed to load platform settings: ${error.message}`);
    }

    const settings: Record<string, PlatformSettingItem> = {};
    for (const s of data || []) {
      settings[s.key] = {
        key: s.key,
        value: s.value,
        category: s.category,
        description: s.description,
        updatedBy: s.updated_by,
        updatedAt: s.updated_at,
      };
    }
    return settings;
  }

  /**
   * Updates a platform configuration setting with validation and audit logging.
   */
  static async updateSetting(params: {
    key: string;
    value: any;
    adminId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<PlatformSettingItem> {
    const { key, value, adminId, admin = createAdminClient() } = params;

    const updatedAt = new Date().toISOString();
    const { data, error } = await admin
      .from("platform_settings")
      .update({
        value,
        updated_by: adminId,
        updated_at: updatedAt,
      })
      .eq("key", key)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update setting '${key}': ${error?.message || "Key not found"}`);
    }

    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_CONFIG_UPDATE",
      resourceType: "PLATFORM_SETTING",
      resourceId: key,
      metadata: { key, updatedValue: value },
      adminClient: admin,
    });

    if (key === "maintenance_mode") {
      PlatformConfigService.maintenanceCache = {
        data: {
          enabled: Boolean(value?.enabled),
          message: value?.message || "UrPlaced is performing scheduled maintenance. Services will resume shortly.",
          scheduledEnd: value?.scheduledEnd || null,
        },
        cachedAt: Date.now(),
      };
    }

    return {
      key: data.key,
      value: data.value,
      category: data.category,
      description: data.description,
      updatedBy: data.updated_by,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Retrieves current maintenance status.
   * Leverages an in-memory 5-second cache to avoid redundant database round-trips
   * while ensuring changes propagate immediately upon Super Admin save.
   */
  static async getMaintenanceStatus(
    admin = createAdminClient(),
    forceFresh = false
  ): Promise<{
    enabled: boolean;
    message: string;
    scheduledEnd: string | null;
  }> {
    const now = Date.now();
    if (!forceFresh && PlatformConfigService.maintenanceCache) {
      if (now - PlatformConfigService.maintenanceCache.cachedAt < PlatformConfigService.CACHE_TTL_MS) {
        return PlatformConfigService.maintenanceCache.data;
      }
    }

    try {
      const { data } = await admin
        .from("platform_settings")
        .select("value")
        .eq("key", "maintenance_mode")
        .maybeSingle();

      if (data?.value && typeof data.value === "object") {
        const result = {
          enabled: Boolean(data.value.enabled),
          message: data.value.message || "UrPlaced is performing scheduled maintenance. Services will resume shortly.",
          scheduledEnd: data.value.scheduledEnd || null,
        };
        PlatformConfigService.maintenanceCache = {
          data: result,
          cachedAt: now,
        };
        return result;
      }
    } catch {
      // Fallback
    }
    const fallback = { enabled: false, message: "", scheduledEnd: null };
    PlatformConfigService.maintenanceCache = {
      data: fallback,
      cachedAt: now,
    };
    return fallback;
  }
}
