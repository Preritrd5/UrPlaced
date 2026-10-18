import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserMemberships, MembershipRecord } from "@/modules/tenancy/services/membership-service";

export interface UserSessionProfile {
  id: string;
  email: string;
  fullName: string;
  isPlatformAdmin: boolean;
  avatarUrl: string | null;
  memberships: MembershipRecord[];
  activeMembership?: MembershipRecord;
}

/**
 * Resolves the currently authenticated user session and application profile from the server.
 */
export async function getCurrentUserProfile(
  selectedTenantId?: string
): Promise<UserSessionProfile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const memberships = await getUserMemberships(user.id);

    let activeMembership: MembershipRecord | undefined;
    if (selectedTenantId) {
      activeMembership = memberships.find(
        (m) => m.tenant_id === selectedTenantId && m.status === "ACTIVE"
      );
    } else if (memberships.length > 0) {
      activeMembership = memberships.find((m) => m.status === "ACTIVE");
    }

    return {
      id: user.id,
      email: user.email || "",
      fullName: profile?.full_name || user.user_metadata?.full_name || "",
      isPlatformAdmin: !!profile?.is_platform_admin,
      avatarUrl: profile?.avatar_url || null,
      memberships,
      activeMembership,
    };
  } catch (err) {
    console.error("[AuthService Error] Failed to get user profile:", err);
    return null;
  }
}
