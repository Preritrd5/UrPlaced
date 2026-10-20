import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus, Users, CheckCircle2, ShieldAlert } from "lucide-react";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { listTenantMembers, updateMemberStatus } from "@/modules/tenancy/services/membership-service";
import { createInvitation } from "@/modules/identity-access/services/invitation-service";
import { EmailAdapter } from "@/modules/identity-access/services/email-adapter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserRole } from "@/modules/identity-access/services/policy-engine";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function TenantMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ newInviteToken?: string; error?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/signin");
  }

  const activeMembership = profile.activeMembership;
  if (!profile.isVerifiedMembership || !activeMembership || activeMembership.role !== "PLACEMENT_HEAD") {
    redirect("/auth/access-denied");
  }

  const tenantId = activeMembership.tenant_id;
  let members: any[] = [];
  try {
    members = await listTenantMembers(tenantId);
  } catch {
    members = [];
  }

  // If database table is empty or unmigrated, display current Placement Head as active
  if (members.length === 0 && profile) {
    members = [
      {
        id: activeMembership.id || `membership-${profile.id}`,
        tenant_id: tenantId,
        user_id: profile.id,
        role: "PLACEMENT_HEAD",
        status: "ACTIVE",
        permissions: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        profiles: {
          id: profile.id,
          email: profile.email,
          full_name: profile.fullName || "Placement Head",
        },
      },
    ];
  }
  const query = await searchParams;

  async function handleInviteMember(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const role = formData.get("role") as UserRole;

    try {
      const result = await createInvitation({
        tenantId,
        email,
        role,
        createdBy: profile?.id,
      });

      // Dispatch invitation email via adapter
      await EmailAdapter.sendInvitation({
        toEmail: email,
        tenantName: activeMembership?.tenants?.name || "College Placement Cell",
        role,
        inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/invite/${result.rawToken}`,
      });

      revalidatePath("/dashboard/members");
      redirect(`/dashboard/members?newInviteToken=${encodeURIComponent(result.rawToken)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create invitation.";
      redirect(`/dashboard/members?error=${encodeURIComponent(msg)}`);
    }
  }

  async function handleToggleMemberStatus(formData: FormData) {
    "use server";
    const memberId = formData.get("memberId") as string;
    const currentStatus = formData.get("currentStatus") as string;
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

    await updateMemberStatus({
      membershipId: memberId,
      tenantId,
      newStatus,
      actorUserId: profile?.id,
      reason: `Staff management status change to ${newStatus}`,
    });

    revalidatePath("/dashboard/members");
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {activeMembership.tenants?.name || "College Workspace"}
          </Badge>
          <span className="text-xs text-text-muted font-mono">Staff &amp; Cohort Access</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary font-heading">
          Institutional Member Management
        </h1>
        <p className="text-sm text-text-secondary max-w-2xl">
          Invite placement coordinators, trainers, and student candidates into your college placement cell.
        </p>
      </div>

      {query.newInviteToken && (
        <Card className="border-secondary/40 bg-[rgba(46,143,134,0.06)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-secondary flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> Member Invitation Dispatched
            </CardTitle>
            <CardDescription>
              One-time activation token generated and recorded. Direct activation link:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-3 bg-card border border-border rounded-lg font-mono text-xs text-text-primary break-all select-all">
              /auth/invite/{query.newInviteToken}
            </div>
          </CardContent>
        </Card>
      )}

      {query.error && (
        <Card className="border-status-danger/40 bg-[rgba(179,58,58,0.06)]">
          <CardContent className="p-4 text-xs text-status-danger flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{query.error}</span>
          </CardContent>
        </Card>
      )}

      {/* Invite Member Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-secondary" /> Issue Member Invitation
          </CardTitle>
          <CardDescription>
            Binds the user to this institution and pre-authorizes their role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleInviteMember} className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="email" required>Candidate / Staff Institutional Email</Label>
              <Input id="email" name="email" type="email" placeholder="student@campus.edu" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role" required>Assigned Role</Label>
              <Select name="role" defaultValue="STUDENT">
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STUDENT">Student Candidate</SelectItem>
                  <SelectItem value="PLACEMENT_STAFF">Placement Coordinator</SelectItem>
                  <SelectItem value="TRAINER">Trainer / Faculty</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-3 pt-2">
              <Button type="submit" variant="secondary">
                <UserPlus className="h-4 w-4 mr-2" /> Dispatch Invitation
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Active Members ({members.length})
          </CardTitle>
          <CardDescription>
            All currently enrolled personnel and candidates under this college workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-text-muted">
                      No members enrolled yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-semibold text-text-primary">
                        {m.profiles?.full_name || "Unregistered Member"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {m.profiles?.email || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{m.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.status === "ACTIVE" ? "success" : "warning"}>
                          {m.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {m.role !== "PLACEMENT_HEAD" && (
                          <form action={handleToggleMemberStatus} className="inline-block">
                            <input type="hidden" name="memberId" value={m.id} />
                            <input type="hidden" name="currentStatus" value={m.status} />
                            <Button
                              type="submit"
                              variant={m.status === "ACTIVE" ? "ghost" : "outline"}
                              size="sm"
                              className={m.status === "ACTIVE" ? "text-status-danger hover:bg-[var(--color-danger-subtle)]" : ""}
                            >
                              {m.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                            </Button>
                          </form>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </div>
  );
}
