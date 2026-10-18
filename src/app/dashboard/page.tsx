import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Users,
  Shield,
  Key,
  GraduationCap,
  LogOut,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RoleDefaultPermissions } from "@/modules/identity-access/services/policy-engine";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/signin");
  }

  async function handleSignOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/auth/signin");
  }

  const isSuperAdmin = profile.isPlatformAdmin;
  const activeMembership = profile.activeMembership;
  const activeTenant = activeMembership?.tenants;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text-primary font-heading">
              Welcome, {profile.fullName || profile.email}
            </h1>
            {isSuperAdmin && (
              <Badge variant="default" className="bg-primary text-white">
                Platform Admin
              </Badge>
            )}
            {activeMembership && (
              <Badge variant="secondary">
                {activeMembership.role}
              </Badge>
            )}
          </div>
          <p className="text-xs text-text-secondary font-mono">
            {profile.email} &bull; Account Verified
          </p>
        </div>

        <div className="flex items-center gap-2">
          {profile.memberships.length > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/select-tenant">Switch Workspace</Link>
            </Button>
          )}
          <form action={handleSignOut}>
            <Button type="submit" variant="ghost" size="sm" className="text-text-secondary">
              <LogOut className="h-4 w-4 mr-1.5" /> Sign Out
            </Button>
          </form>
        </div>
      </div>

      {/* Active Workspace Banner */}
      {activeTenant ? (
        <Card className="border-secondary/30 bg-[rgba(46,143,134,0.03)]">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">{activeTenant.name}</CardTitle>
                  <CardDescription className="font-mono text-xs">
                    Workspace Slug: /{activeTenant.slug} &bull; Status: {activeTenant.status}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="success">Active Workspace</Badge>
            </div>
          </CardHeader>
        </Card>
      ) : isSuperAdmin ? (
        <Alert variant="info">
          <Shield className="h-4 w-4" />
          <AlertTitle>Platform Administration Session</AlertTitle>
          <AlertDescription>
            You are operating with Platform Super Admin credentials. You can manage tenant provisioning and platform health across institutions.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="warning">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>No Active College Membership</AlertTitle>
          <AlertDescription>
            Your account is verified, but you have not yet been assigned an active membership in any participating college workspace.
            Please accept an institutional invitation or contact your placement director.
          </AlertDescription>
        </Alert>
      )}

      {/* Management Action Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {isSuperAdmin && (
          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="h-9 w-9 rounded-lg bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center mb-1">
                <Building2 className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">College Workspaces</CardTitle>
              <CardDescription>
                Provision, suspend, or reactivate college tenants and invite placement heads.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="primary" size="sm" className="w-full">
                <Link href="/admin/tenants" className="inline-flex items-center justify-between w-full">
                  Manage Tenants <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {activeMembership && activeMembership.role === "PLACEMENT_HEAD" && (
          <Card className="hover:border-secondary/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="h-9 w-9 rounded-lg bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center mb-1">
                <Users className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">Staff &amp; Members</CardTitle>
              <CardDescription>
                Invite placement staff, coordinators, and students into your college workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary" size="sm" className="w-full">
                <Link href="/dashboard/members" className="inline-flex items-center justify-between w-full">
                  Manage Members <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center mb-1">
              <Key className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">Security &amp; Permissions</CardTitle>
            <CardDescription>
              Review your authenticated capabilities and scoped permissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-xs text-text-secondary">
              <p>Role: <strong>{activeMembership?.role || (isSuperAdmin ? "SUPER_ADMIN" : "None")}</strong></p>
              <p className="font-mono text-[11px] text-text-muted">
                {activeMembership
                  ? `${RoleDefaultPermissions[activeMembership.role].length} Active Permissions`
                  : isSuperAdmin
                  ? "Global Platform Admin"
                  : "No Assigned Role"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Permissions Transparency View */}
      {activeMembership && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Permission Scope</CardTitle>
            <CardDescription>
              Explicit permissions granted for this session under {activeTenant?.name}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {RoleDefaultPermissions[activeMembership.role].map((perm) => (
                <span
                  key={perm}
                  className="px-2.5 py-1 rounded-md bg-input border border-border text-[11px] font-mono text-text-primary"
                >
                  {perm}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
