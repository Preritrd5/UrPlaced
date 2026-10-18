import { createAdminClient } from "@/lib/supabase/admin";

export interface LogAuditParams {
  tenantId?: string | null;
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
}

const REDACTED_KEYS = new Set([
  "password",
  "password_hash",
  "token",
  "token_hash",
  "raw_token",
  "secret",
  "api_key",
  "cookie",
  "access_token",
  "refresh_token",
  "service_role",
]);

/**
 * Recursively redacts sensitive keys from audit state payloads.
 */
function sanitizeAuditPayload(data: unknown): unknown {
  if (!data || typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeAuditPayload);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key.toLowerCase()) || key.toLowerCase().includes("secret") || key.toLowerCase().includes("password")) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object") {
      sanitized[key] = sanitizeAuditPayload(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Appends a tamper-resistant security audit log entry.
 * Fails silently in non-critical reporting paths so business operations don't block,
 * but logs errors internally.
 */
export async function logAuditEvent(params: LogAuditParams): Promise<void> {
  try {
    const admin = createAdminClient();

    const sanitizedBefore = params.beforeState ? sanitizeAuditPayload(params.beforeState) : null;
    const sanitizedAfter = params.afterState ? sanitizeAuditPayload(params.afterState) : null;

    await admin.from("audit_logs").insert({
      tenant_id: params.tenantId || null,
      actor_id: params.actorId || null,
      action: params.action,
      resource_type: params.resourceType,
      resource_id: params.resourceId,
      before_state: sanitizedBefore,
      after_state: sanitizedAfter,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null,
    });
  } catch (err) {
    // Fail-safe: log locally without crashing application flow
    console.error("[Audit Service Warning] Failed to persist audit log entry:", err);
  }
}
