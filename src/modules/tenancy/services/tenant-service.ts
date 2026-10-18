import { createAdminClient } from "@/lib/supabase/admin";
import { createInvitation } from "@/modules/identity-access/services/invitation-service";
import { logAuditEvent } from "@/modules/identity-access/services/audit-service";

export interface CreateTenantInput {
  name: string;
  slug: string;
  primaryDomain?: string;
  studentSeatLimit?: number;
  initialAdminEmail: string;
  actorUserId?: string;
}

export interface TenantRecord {
  id: string;
  name: string;
  slug: string;
  primary_domain: string | null;
  status: "PENDING_SETUP" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  student_seat_limit: number;
  created_at: string;
  updated_at: string;
}

/**
 * Normalizes a URL slug (e.g. "Apex Institute of Tech" -> "apex-institute-of-tech").
 */
export function normalizeSlug(rawSlug: string): string {
  return rawSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Creates a new college tenant and generates an invitation for its initial Placement Head.
 * Only callable by Platform Super Admins.
 */
export async function createTenant(input: CreateTenantInput): Promise<{
  tenant: TenantRecord;
  inviteToken: string;
}> {
  const admin = createAdminClient();
  const slug = normalizeSlug(input.slug);

  // 1. Verify slug uniqueness
  const { data: existing } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    throw new Error(`Tenant slug '${slug}' is already taken. Please choose another.`);
  }

  // 2. Insert Tenant record
  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({
      name: input.name.trim(),
      slug,
      primary_domain: input.primaryDomain?.trim().toLowerCase() || null,
      student_seat_limit: input.studentSeatLimit || 1000,
      status: "ACTIVE",
    })
    .select("*")
    .single();

  if (tenantError || !tenant) {
    throw new Error(`Failed to create tenant: ${tenantError?.message || "Unknown error"}`);
  }

  // 3. Create initial Placement Head invitation
  const { rawToken } = await createInvitation({
    tenantId: tenant.id,
    email: input.initialAdminEmail,
    role: "PLACEMENT_HEAD",
    createdBy: input.actorUserId,
  });

  // 4. Log Audit Event
  await logAuditEvent({
    tenantId: tenant.id,
    actorId: input.actorUserId,
    action: "tenant.create",
    resourceType: "Tenant",
    resourceId: tenant.id,
    afterState: { name: tenant.name, slug: tenant.slug, seatLimit: tenant.student_seat_limit },
  });

  return {
    tenant: tenant as TenantRecord,
    inviteToken: rawToken,
  };
}

/**
 * Lists tenants visible to the platform admin.
 */
export async function listTenants(): Promise<TenantRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenants")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list tenants: ${error.message}`);
  }

  return (data || []) as TenantRecord[];
}

/**
 * Retrieves a tenant by ID.
 */
export async function getTenantById(tenantId: string): Promise<TenantRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as TenantRecord;
}

/**
 * Retrieves a tenant by unique slug.
 */
export async function getTenantBySlug(slug: string): Promise<TenantRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenants")
    .select("*")
    .eq("slug", normalizeSlug(slug))
    .single();

  if (error || !data) {
    return null;
  }

  return data as TenantRecord;
}

/**
 * Updates a tenant's lifecycle status (e.g. SUSPENDED, ACTIVE, ARCHIVED).
 * Immediate effect on access control.
 */
export async function updateTenantStatus(params: {
  tenantId: string;
  newStatus: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  actorUserId?: string;
  reason?: string;
}): Promise<TenantRecord> {
  const admin = createAdminClient();

  const current = await getTenantById(params.tenantId);
  if (!current) {
    throw new Error("Tenant not found.");
  }

  const { data, error } = await admin
    .from("tenants")
    .update({
      status: params.newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.tenantId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to update tenant status: ${error?.message || "Unknown error"}`);
  }

  await logAuditEvent({
    tenantId: params.tenantId,
    actorId: params.actorUserId,
    action: `tenant.${params.newStatus.toLowerCase()}`,
    resourceType: "Tenant",
    resourceId: params.tenantId,
    beforeState: { status: current.status },
    afterState: { status: params.newStatus, reason: params.reason },
  });

  return data as TenantRecord;
}

export const TenantService = {
  getById: getTenantById,
  getBySlug: getTenantBySlug,
  create: createTenant,
  list: listTenants,
  updateStatus: updateTenantStatus,
};

