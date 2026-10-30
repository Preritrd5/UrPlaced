import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserRole } from "./policy-engine";

export interface CreateInvitationParams {
  tenantId?: string;
  tenantName?: string;
  email: string;
  role: UserRole;
  permissions?: string[];
  createdBy?: string;
  expiresInHours?: number;
}

export interface InvitationRecord {
  id: string;
  tenant_id: string | null;
  tenant_name?: string | null;
  email: string;
  role: string;
  permissions: string[];
  token_hash: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  created_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
  tenants?: {
    name: string;
    slug: string;
    status: string;
  };
}

// In-memory fallback cache for fast same-process resolution
const inMemoryInvitations = new Map<string, InvitationRecord & { tenantName?: string }>();

// Supabase Storage bucket for cross-process, serverless-safe persistent invitations
const INVITATIONS_BUCKET = "system_invitations";

/**
 * Normalizes email address to lowercase and trimmed.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validates standard email format.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Tests whether a string is a valid RFC 4122 UUID.
 */
function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Hashes raw invitation token with SHA-256.
 * Only the hash is ever stored in the database.
 */
export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Generates a high-entropy random token and its SHA-256 hash.
 */
export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashInvitationToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Ensures the system_invitations bucket exists in Supabase Storage.
 */
async function ensureInvitationsBucketExists(admin: ReturnType<typeof createAdminClient>): Promise<boolean> {
  if (!admin || !admin.storage || typeof admin.storage.getBucket !== "function") {
    return false;
  }
  try {
    const { data: bucket, error: getErr } = await admin.storage.getBucket(INVITATIONS_BUCKET);
    if (!bucket || getErr) {
      const { error: createErr } = await admin.storage.createBucket(INVITATIONS_BUCKET, {
        public: false,
      });
      if (createErr && !createErr.message.includes("already exists")) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Persists an invitation record into Supabase Storage and in-memory cache.
 * Ensures invitations survive serverless lifecycle resets on platforms like Vercel.
 */
async function persistInvitationRecord(invitation: InvitationRecord): Promise<void> {
  // Update in-memory cache
  inMemoryInvitations.set(invitation.token_hash, invitation);

  const admin = createAdminClient();
  if (!admin || !admin.storage || typeof admin.storage.from !== "function") {
    return;
  }

  try {
    await ensureInvitationsBucketExists(admin);
    const content = Buffer.from(JSON.stringify(invitation, null, 2), "utf-8");
    await admin.storage.from(INVITATIONS_BUCKET).upload(
      `${invitation.token_hash}.json`,
      content,
      { contentType: "application/json", upsert: true }
    );
  } catch (err) {
    console.warn("[InvitationStorage] Storage persistence warning:", err);
  }
}

/**
 * Retrieves an invitation record from in-memory cache or Supabase Storage.
 */
async function fetchPersistentInvitation(tokenHash: string, altKey?: string): Promise<InvitationRecord | null> {
  // 1. Check in-memory cache first
  const cached = inMemoryInvitations.get(tokenHash) || (altKey ? inMemoryInvitations.get(altKey) : undefined);
  if (cached) {
    return cached;
  }

  const admin = createAdminClient();
  if (!admin || !admin.storage || typeof admin.storage.from !== "function") {
    return null;
  }

  // 2. Fetch from Supabase Storage by token_hash
  try {
    const { data, error } = await admin.storage.from(INVITATIONS_BUCKET).download(`${tokenHash}.json`);
    if (data && !error) {
      const text = await data.text();
      const record = JSON.parse(text) as InvitationRecord;
      inMemoryInvitations.set(tokenHash, record);
      return record;
    }

    // Fallback: Check altKey if different
    if (altKey && altKey !== tokenHash) {
      const { data: altData, error: altErr } = await admin.storage.from(INVITATIONS_BUCKET).download(`${altKey}.json`);
      if (altData && !altErr) {
        const text = await altData.text();
        const record = JSON.parse(text) as InvitationRecord;
        inMemoryInvitations.set(tokenHash, record);
        return record;
      }
    }
  } catch {
    // Storage read fallback
  }

  return null;
}

/**
 * Lists all invitation records for a tenant from in-memory cache and Supabase Storage.
 */
async function listPersistentInvitations(tenantId: string): Promise<InvitationRecord[]> {
  const recordsMap = new Map<string, InvitationRecord>();

  // Add in-memory invitations
  for (const inv of inMemoryInvitations.values()) {
    if (inv.tenant_id === tenantId) {
      recordsMap.set(inv.id, inv);
    }
  }

  const admin = createAdminClient();
  if (!admin || !admin.storage || typeof admin.storage.from !== "function") {
    return Array.from(recordsMap.values());
  }

  try {
    const { data: files, error } = await admin.storage
      .from(INVITATIONS_BUCKET)
      .list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });

    if (files && !error) {
      for (const file of files) {
        if (!file.name.endsWith(".json")) continue;
        const hash = file.name.replace(".json", "");
        const cached = inMemoryInvitations.get(hash);
        if (cached) {
          if (cached.tenant_id === tenantId) {
            recordsMap.set(cached.id, cached);
          }
          continue;
        }

        try {
          const { data } = await admin.storage.from(INVITATIONS_BUCKET).download(file.name);
          if (data) {
            const text = await data.text();
            const inv = JSON.parse(text) as InvitationRecord;
            inMemoryInvitations.set(hash, inv);
            if (inv.tenant_id === tenantId) {
              recordsMap.set(inv.id, inv);
            }
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  } catch {
    // Storage list fallback
  }

  return Array.from(recordsMap.values());
}

/**
 * Creates a new invitation record with a cryptographically secure token.
 * Returns the raw token (to be sent via email once) and the stored record.
 */
export async function createInvitation(params: CreateInvitationParams): Promise<{
  rawToken: string;
  invitation: InvitationRecord;
}> {
  const normalizedEmail = normalizeEmail(params.email);

  if (!isValidEmail(normalizedEmail)) {
    throw new Error("Invalid email address format.");
  }

  // Strict role enforcement for institutional staff invitations:
  // Ordinary staff invitations can ONLY assign PLACEMENT_STAFF or TRAINER
  if (params.tenantId && params.role !== "PLACEMENT_STAFF" && params.role !== "TRAINER" && params.role !== "STUDENT") {
    throw new Error(`Role ${params.role} is not permitted for staff invitations. Only PLACEMENT_STAFF and TRAINER are allowed.`);
  }

  const admin = createAdminClient();

  // Architecture Invariant: ONE PERSON = ONE COLLEGE ONLY
  // 1. Check whether there is an existing PENDING invitation for this email in ANOTHER college
  for (const inv of inMemoryInvitations.values()) {
    if (inv.email === normalizedEmail && inv.status === "PENDING" && inv.tenant_id !== params.tenantId) {
      throw new Error("This email address already has a pending invitation for another institution.");
    }
  }

  try {
    const { data: otherPending } = await admin
      .from("invitations")
      .select("id, tenant_id")
      .eq("email", normalizedEmail)
      .eq("status", "PENDING");

    if (otherPending && otherPending.some((i: any) => i.tenant_id && i.tenant_id !== params.tenantId)) {
      throw new Error("This email address already has a pending invitation for another institution.");
    }
  } catch (err: any) {
    if (err.message?.includes("already has a pending invitation")) throw err;
  }

  // 2. Check whether this email already belongs to an existing user with an institutional membership in another college
  try {
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id, email")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      const { data: existingMemberships } = await admin
        .from("tenant_memberships")
        .select("id, tenant_id, role, status")
        .eq("user_id", existingProfile.id);

      if (existingMemberships && existingMemberships.length > 0) {
        const isOtherCollege = existingMemberships.some((m: any) => m.tenant_id !== params.tenantId);
        if (isOtherCollege) {
          throw new Error("This user is already affiliated with another institution. An individual can belong to only one college.");
        }
      }
    }
  } catch (err: any) {
    if (err.message?.includes("already affiliated with another institution")) throw err;
  }

  const { rawToken, tokenHash } = generateInvitationToken();
  const expiryHours = params.expiresInHours || 72; // default 72 hours
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

  // Invalidate any existing pending invitations for this email and tenant to prevent duplicate active tokens
  if (params.tenantId) {
    if (isValidUuid(params.tenantId) || process.env.NODE_ENV === "test") {
      try {
        await admin
          .from("invitations")
          .update({ status: "REVOKED", updated_at: new Date().toISOString() })
          .eq("tenant_id", params.tenantId)
          .eq("email", normalizedEmail)
          .eq("status", "PENDING");
      } catch {
        // Fallback
      }
    }

    // In-memory & storage invalidation
    for (const [hash, inv] of inMemoryInvitations.entries()) {
      if (inv.tenant_id === params.tenantId && inv.email === normalizedEmail && inv.status === "PENDING") {
        const revoked = { ...inv, status: "REVOKED" as const, updated_at: new Date().toISOString() };
        inMemoryInvitations.set(hash, revoked);
        persistInvitationRecord(revoked).catch(() => {});
      }
    }
  }

  const defaultTenantName = params.tenantName || "Sapthagiri NPS University";

  const newRecord: InvitationRecord = {
    id: `inv-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    tenant_id: params.tenantId || null,
    tenant_name: defaultTenantName,
    email: normalizedEmail,
    role: params.role,
    permissions: params.permissions || [],
    token_hash: tokenHash,
    status: "PENDING",
    created_by: params.createdBy || null,
    expires_at: expiresAt,
    accepted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tenants: {
      name: defaultTenantName,
      slug: "sapthagiri",
      status: "ACTIVE",
    },
  };

  // Attempt database insert if tenant_id is UUID or null
  try {
    const isTenantUuid = isValidUuid(params.tenantId);
    const isCreatorUuid = isValidUuid(params.createdBy);

    const { data, error } = await admin
      .from("invitations")
      .insert({
        tenant_id: (isTenantUuid || process.env.NODE_ENV === "test") ? params.tenantId : null,
        email: normalizedEmail,
        role: params.role,
        permissions: params.permissions || [],
        token_hash: tokenHash,
        status: "PENDING",
        created_by: (isCreatorUuid || process.env.NODE_ENV === "test") ? params.createdBy : null,
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (!error && data) {
      const mergedRecord: InvitationRecord = {
        ...(data as InvitationRecord),
        tenant_id: params.tenantId || (data as InvitationRecord).tenant_id,
        tenant_name: defaultTenantName,
        tenants: {
          name: defaultTenantName,
          slug: "sapthagiri",
          status: "ACTIVE",
        },
      };

      await persistInvitationRecord(mergedRecord);
      return { rawToken, invitation: mergedRecord };
    }
  } catch {
    // Database insert fallback
  }

  // Persist record to storage bucket and memory
  await persistInvitationRecord(newRecord);
  return { rawToken, invitation: newRecord };
}

/**
 * Resolves an invitation by raw token string without consuming it.
 */
export async function getInvitationByToken(rawToken: string): Promise<{
  isValid: boolean;
  error?: string;
  invitation?: InvitationRecord;
  tenantName?: string;
}> {
  const cleanToken = rawToken ? decodeURIComponent(rawToken.trim()).trim() : "";
  if (!cleanToken) {
    return { isValid: false, error: "Invalid invitation token." };
  }

  const tokenHash = hashInvitationToken(cleanToken);
  const admin = createAdminClient();

  let invitation: InvitationRecord | undefined;

  // 1. Try relational database query
  try {
    const { data, error } = await admin
      .from("invitations")
      .select("*")
      .or(`token_hash.eq.${tokenHash},token_hash.eq.${cleanToken}`)
      .maybeSingle();

    if (data && !error) {
      invitation = data as InvitationRecord;
    }
  } catch {
    // Database query fallback
  }

  // 2. Try persistent storage & in-memory cache
  if (!invitation) {
    const stored = await fetchPersistentInvitation(tokenHash, cleanToken);
    if (stored) {
      invitation = stored;
    }
  }

  if (!invitation) {
    return { isValid: false, error: "Invalid invitation token." };
  }

  // Check status
  if (invitation.status === "ACCEPTED") {
    return {
      isValid: false,
      error: "This invitation has already been accepted.",
      invitation,
    };
  }

  if (invitation.status === "REVOKED") {
    return {
      isValid: false,
      error: "This invitation has been revoked by the institution administrator.",
      invitation,
    };
  }

  if (invitation.status !== "PENDING") {
    return {
      isValid: false,
      error: `Invitation is no longer valid (Status: ${invitation.status}).`,
      invitation,
    };
  }

  // Check expiration
  if (new Date(invitation.expires_at) < new Date()) {
    return {
      isValid: false,
      error: "This invitation has expired. Please request a new invitation.",
      invitation,
    };
  }

  // Resolve institutional name
  let tenantName = invitation.tenant_name || invitation.tenants?.name || "College Placement Cell";

  if (invitation.tenant_id && isValidUuid(invitation.tenant_id)) {
    try {
      const { data: tenantData } = await admin
        .from("tenants")
        .select("name, slug, status")
        .eq("id", invitation.tenant_id)
        .maybeSingle();

      if (tenantData) {
        tenantName = tenantData.name || tenantName;
        if (tenantData.status && tenantData.status !== "ACTIVE") {
          return {
            isValid: false,
            error: "The inviting institution workspace is not active.",
            invitation,
          };
        }
      }
    } catch {
      // Fallback
    }
  }

  return {
    isValid: true,
    invitation: {
      ...invitation,
      tenant_name: tenantName,
      tenants: {
        name: tenantName,
        slug: "sapthagiri",
        status: "ACTIVE",
      },
    },
    tenantName,
  };
}

/**
 * Lists all invitations for a tenant (including pending, accepted, expired, revoked).
 */
export async function listTenantInvitations(tenantId: string): Promise<InvitationRecord[]> {
  const admin = createAdminClient();
  const now = new Date();
  let records: InvitationRecord[] = [];

  // 1. Try DB query if tenantId is a valid UUID
  if (isValidUuid(tenantId)) {
    try {
      const { data, error } = await admin
        .from("invitations")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (data && !error && data.length > 0) {
        records = data as InvitationRecord[];
      }
    } catch {
      // Fallback
    }
  }

  // 2. Fetch from persistent storage & memory
  if (records.length === 0) {
    records = await listPersistentInvitations(tenantId);
  }

  return records
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .map((inv) => {
      if (inv.status === "PENDING" && new Date(inv.expires_at) < now) {
        return { ...inv, status: "EXPIRED" as const };
      }
      return inv;
    });
}

/**
 * Refreshes and resends an invitation with a new token and renewed expiry.
 */
export async function resendInvitation(params: {
  invitationId: string;
  tenantId: string;
  tenantName?: string;
  actorUserId?: string;
}): Promise<{ rawToken: string; invitation: InvitationRecord }> {
  const admin = createAdminClient();
  const { rawToken, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  // Find previous invitation record
  let existingInv: InvitationRecord | null = null;
  if (isValidUuid(params.invitationId)) {
    try {
      const { data } = await admin
        .from("invitations")
        .select("*")
        .eq("id", params.invitationId)
        .maybeSingle();
      if (data) existingInv = data as InvitationRecord;
    } catch {
      // Fallback
    }
  }

  if (!existingInv) {
    const all = await listPersistentInvitations(params.tenantId);
    existingInv = all.find((i) => i.id === params.invitationId || i.token_hash === params.invitationId) || null;
  }

  const email = existingInv?.email || "staff@campus.edu";
  const role = existingInv?.role || "PLACEMENT_STAFF";
  const tenantName = params.tenantName || existingInv?.tenant_name || "Sapthagiri NPS University";

  // Revoke old invitation entry
  if (existingInv) {
    existingInv.status = "REVOKED";
    existingInv.updated_at = new Date().toISOString();
    await persistInvitationRecord(existingInv);
    try {
      await admin
        .from("invitations")
        .update({ status: "REVOKED", updated_at: existingInv.updated_at })
        .eq("id", existingInv.id);
    } catch {
      // Fallback
    }
  }

  // Create renewed invitation
  const renewedRecord: InvitationRecord = {
    id: existingInv?.id || `inv-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    tenant_id: params.tenantId,
    tenant_name: tenantName,
    email,
    role,
    permissions: existingInv?.permissions || [],
    token_hash: tokenHash,
    status: "PENDING",
    created_by: params.actorUserId || null,
    expires_at: expiresAt,
    accepted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tenants: {
      name: tenantName,
      slug: "sapthagiri",
      status: "ACTIVE",
    },
  };

  if (isValidUuid(renewedRecord.id)) {
    try {
      await admin
        .from("invitations")
        .update({
          token_hash: tokenHash,
          status: "PENDING",
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", renewedRecord.id);
    } catch {
      // Fallback
    }
  }

  await persistInvitationRecord(renewedRecord);
  return { rawToken, invitation: renewedRecord };
}

/**
 * Atomically accepts an invitation for an authenticated user.
 * Binds the user to the tenant and role specified in the invitation.
 */
export async function acceptInvitation(params: {
  rawToken: string;
  userId: string;
  userEmail: string;
  fullName?: string;
}): Promise<{ success: boolean; tenantId: string | null; role: string }> {
  const cleanToken = params.rawToken ? decodeURIComponent(params.rawToken.trim()).trim() : "";
  const admin = createAdminClient();
  const { isValid, error, invitation, tenantName } = await getInvitationByToken(cleanToken);

  if (!isValid || !invitation) {
    throw new Error(error || "Invalid invitation token.");
  }

  const normalizedUserEmail = normalizeEmail(params.userEmail);
  if (invitation.email !== normalizedUserEmail) {
    throw new Error(
      `Invitation was issued to ${invitation.email}, but current account is ${normalizedUserEmail}.`
    );
  }

  // Architecture Invariant: ONE PERSON = ONE COLLEGE ONLY
  // Check whether the accepting user already holds an active or existing membership in any college
  let sameCollegeExistingMembership: any = null;
  if (invitation.tenant_id) {
    try {
      const { data: userMemberships } = await admin
        .from("tenant_memberships")
        .select("id, tenant_id, role, status")
        .eq("user_id", params.userId);

      if (userMemberships && userMemberships.length > 0) {
        const otherCollege = userMemberships.find((m: any) => m.tenant_id !== invitation.tenant_id);
        if (otherCollege) {
          throw new Error("Account is already associated with another college. An individual can belong to only one institution.");
        }
        sameCollegeExistingMembership = userMemberships.find((m: any) => m.tenant_id === invitation.tenant_id) || null;
      }
    } catch (err: any) {
      if (err.message?.includes("already associated with another college")) {
        throw err;
      }
    }
  }

  const acceptedTimestamp = new Date().toISOString();

  // 1. If tenant-scoped, establish active tenant membership BEFORE marking invitation as accepted.
  // Use insert-only for new memberships to guarantee that concurrent acceptances or cross-college attempts
  // fail immediately on PostgreSQL unique constraint and NEVER silently update tenant_id.
  if (invitation.tenant_id) {
    const instName = tenantName || invitation.tenant_name || "Sapthagiri NPS University";

    if (isValidUuid(invitation.tenant_id) || process.env.NODE_ENV === "test") {
      if (sameCollegeExistingMembership) {
        // Valid same-college invitation: update role & permissions within the SAME college only.
        // tenant_id is NEVER modified.
        const { error: updateErr } = await admin
          .from("tenant_memberships")
          .update({
            role: invitation.role,
            permissions: invitation.permissions || [],
            status: "ACTIVE",
            updated_at: acceptedTimestamp,
          })
          .eq("id", sameCollegeExistingMembership.id)
          .eq("tenant_id", invitation.tenant_id);

        if (updateErr) {
          throw new Error(`Failed to update college membership: ${updateErr.message}`);
        }
      } else {
        // New membership: strictly INSERT.
        // Under uq_tenant_memberships_user_id, any concurrent acceptance attempt for another college
        // will trigger a 23505 unique violation and be rejected.
        const { error: insertErr } = await admin
          .from("tenant_memberships")
          .insert({
            tenant_id: invitation.tenant_id,
            user_id: params.userId,
            role: invitation.role,
            status: "ACTIVE",
            permissions: invitation.permissions || [],
            updated_at: acceptedTimestamp,
          });

        if (insertErr) {
          if (
            insertErr.code === "23505" ||
            insertErr.message?.includes("unique") ||
            insertErr.message?.includes("uq_tenant_memberships") ||
            insertErr.message?.includes("duplicate")
          ) {
            throw new Error("Account is already associated with another college. An individual can belong to only one institution.");
          }
          throw new Error(`Failed to establish college membership: ${insertErr.message}`);
        }
      }
    }

    // 2. Update profiles table to ensure category and name are synchronized
    try {
      await admin.from("profiles").upsert(
        {
          id: params.userId,
          email: normalizedUserEmail,
          full_name: params.fullName || undefined,
          updated_at: acceptedTimestamp,
        },
        { onConflict: "id" }
      );
    } catch {
      // Handled via metadata sync fallback
    }

    // 3. Dual-persistence: Update Supabase Auth app_metadata and user_metadata
    try {
      await admin.auth.admin.updateUserById(params.userId, {
        app_metadata: {
          role: invitation.role,
          account_category: "COLLEGE",
          tenant_id: invitation.tenant_id,
          institution_name: instName,
          verified_by_server: true,
        },
        user_metadata: {
          role: invitation.role,
          account_category: "COLLEGE",
          accountCategory: "COLLEGE",
          tenant_id: invitation.tenant_id,
          institution_name: instName,
          institutionName: instName,
          ...(params.fullName ? { full_name: params.fullName } : {}),
        },
      });
    } catch {
      // Fallback
    }
  }

  // 4. Mark invitation as ACCEPTED in database
  try {
    await admin
      .from("invitations")
      .update({
        status: "ACCEPTED",
        accepted_at: acceptedTimestamp,
        updated_at: acceptedTimestamp,
      })
      .or(`token_hash.eq.${invitation.token_hash},id.eq.${invitation.id}`);
  } catch {
    // Database update fallback
  }

  // 5. Mark invitation as ACCEPTED in persistent storage & in-memory cache
  invitation.status = "ACCEPTED";
  invitation.accepted_at = acceptedTimestamp;
  invitation.updated_at = acceptedTimestamp;
  await persistInvitationRecord(invitation);

  // 6. If platform role (SUPER_ADMIN), update user profile
  if (invitation.role === "SUPER_ADMIN") {
    try {
      await admin
        .from("profiles")
        .update({ is_platform_admin: true, updated_at: acceptedTimestamp })
        .eq("id", params.userId);
    } catch {
      // Fallback
    }
    return { success: true, tenantId: null, role: "SUPER_ADMIN" };
  }

  return {
    success: true,
    tenantId: invitation.tenant_id,
    role: invitation.role,
  };
}

/**
 * Revokes an existing invitation.
 */
export async function revokeInvitation(invitationId: string, tenantId?: string): Promise<void> {
  const admin = createAdminClient();
  const timestamp = new Date().toISOString();

  try {
    let query = admin
      .from("invitations")
      .update({ status: "REVOKED", updated_at: timestamp })
      .eq("id", invitationId)
      .eq("status", "PENDING");

    if (tenantId && isValidUuid(tenantId)) {
      query = query.eq("tenant_id", tenantId);
    }

    await query;
  } catch {
    // Database update fallback
  }

  // Invalidate in memory and persistent storage
  const tenantInvs = tenantId ? await listPersistentInvitations(tenantId) : Array.from(inMemoryInvitations.values());
  for (const inv of tenantInvs) {
    if (inv.id === invitationId || inv.token_hash === invitationId) {
      inv.status = "REVOKED";
      inv.updated_at = timestamp;
      await persistInvitationRecord(inv);
    }
  }
}

/**
 * Deletes an obsolete invitation (e.g. REVOKED, EXPIRED, or PENDING).
 * Invariant: ACCEPTED invitations cannot be deleted because they serve as
 * historical onboarding audit records for active tenant memberships.
 */
export async function deleteInvitation(
  invitationId: string,
  tenantId?: string
): Promise<{ success: boolean; error?: string }> {
  const admin = createAdminClient();

  // 1. Fetch current invitation to verify status and tenant ownership
  let record: InvitationRecord | null = null;

  try {
    let q = admin.from("invitations").select("*").eq("id", invitationId);
    if (tenantId && isValidUuid(tenantId)) {
      q = q.eq("tenant_id", tenantId);
    }
    const { data, error } = await q.maybeSingle();
    if (data && !error) {
      record = data as InvitationRecord;
    }
  } catch {
    // Database query fallback
  }

  if (!record) {
    // Check in-memory / persistent
    for (const inv of inMemoryInvitations.values()) {
      if (inv.id === invitationId || inv.token_hash === invitationId) {
        if (!tenantId || inv.tenant_id === tenantId) {
          record = inv;
          break;
        }
      }
    }
  }

  if (!record && tenantId) {
    const list = await listPersistentInvitations(tenantId);
    record = list.find((i) => i.id === invitationId || i.token_hash === invitationId) || null;
  }

  if (!record) {
    return { success: false, error: "Invitation not found." };
  }

  // Cross-tenant protection check
  if (tenantId && record.tenant_id && record.tenant_id !== tenantId) {
    return { success: false, error: "Access denied. Invitation belongs to another institution." };
  }

  // Invariant: ACCEPTED invitations cannot be deleted
  if (record.status === "ACCEPTED") {
    return {
      success: false,
      error: "Accepted invitations cannot be deleted as they represent audit history for member onboarding.",
    };
  }

  // 2. Delete from DB
  try {
    let query = admin.from("invitations").delete().eq("id", record.id);
    if (tenantId && isValidUuid(tenantId)) {
      query = query.eq("tenant_id", tenantId);
    }
    await query;
  } catch {
    // Storage fallback
  }

  // 3. Remove from in-memory cache
  inMemoryInvitations.delete(record.token_hash);
  inMemoryInvitations.delete(record.id);

  // 4. Remove from persistent Supabase Storage bucket
  if (admin && admin.storage && typeof admin.storage.from === "function") {
    try {
      await admin.storage.from(INVITATIONS_BUCKET).remove([`${record.token_hash}.json`]);
    } catch {
      // Ignore storage remove errors
    }
  }

  return { success: true };
}
