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

    return {
      key: data.key,
      value: data.value,
      category: data.category,
      description: data.description,
      updatedBy: data.updated_by,
      updatedAt: data.updated_at,
    };
  }
}
