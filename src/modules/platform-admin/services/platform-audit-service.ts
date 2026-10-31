import { createAdminClient } from "@/lib/supabase/admin";

export interface PlatformAuditLogItem {
  id: string;
  action: string;
  actorId: string | null;
  actorEmail: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export class PlatformAuditService {
  /**
   * Retrieves platform audit logs.
   * STRICT OPTION A: Strictly tenant_id IS NULL only.
   * College-level audit events containing student, assessment, or drive logs are NEVER returned.
   */
  static async listPlatformAuditLogs(params: {
    action?: string;
    limit?: number;
    offset?: number;
    admin?: ReturnType<typeof createAdminClient>;
  } = {}): Promise<{ logs: PlatformAuditLogItem[]; total: number }> {
    const { action, limit = 50, offset = 0, admin = createAdminClient() } = params;

    let query = admin
      .from("audit_logs")
      .select(`
        id,
        action,
        actor_id,
        resource_type,
        resource_id,
        metadata,
        created_at,
        profiles:actor_id (
          email
        )
      `, { count: "exact" })
      .is("tenant_id", null) // Strict Platform Control-Plane Isolation
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (action && action !== "ALL") {
      query = query.eq("action", action);
    }

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to query platform audit logs: ${error.message}`);
    }

    const logs: PlatformAuditLogItem[] = (data || []).map((row: any) => ({
      id: row.id,
      action: row.action,
      actorId: row.actor_id,
      actorEmail: row.profiles?.email || "Platform System",
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    }));

    return {
      logs,
      total: count || logs.length,
    };
  }
}
