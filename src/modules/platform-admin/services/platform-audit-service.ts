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
      .select(
        "id, action, actor_id, resource_type, resource_id, before_state, after_state, ip_address, user_agent, created_at",
        { count: "exact" }
      )
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

    // Resolve actor emails from profiles table safely without depending on invalid postgrest foreign key embeds
    const actorIds = Array.from(
      new Set((data || []).map((r: any) => r.actor_id).filter(Boolean))
    );
    const emailMap: Record<string, string> = {};

    if (actorIds.length > 0) {
      try {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, email")
          .in("id", actorIds);
        if (profiles) {
          for (const p of profiles) {
            emailMap[p.id] = p.email;
          }
        }
      } catch {
        // Fallback to default label
      }
    }

    const logs: PlatformAuditLogItem[] = (data || []).map((row: any) => ({
      id: String(row.id),
      action: row.action,
      actorId: row.actor_id,
      actorEmail: emailMap[row.actor_id] || "Platform Admin",
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      metadata: row.after_state || row.metadata || {},
      createdAt: row.created_at,
    }));

    return {
      logs,
      total: count || logs.length,
    };
  }
}
