import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus, Users, CheckCircle2, ShieldAlert, Mail, RotateCw, XCircle, Clock } from "lucide-react";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { listTenantMembers, updateMemberStatus } from "@/modules/tenancy/services/membership-service";
import {
  createInvitation,
  listTenantInvitations,
  resendInvitation,
  revokeInvitation,
  normalizeEmail,
  isValidEmail,
} from "@/modules/identity-access/services/invitation-service";
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
  searchParams: Promise<{
    sentSuccess?: string;
    sentEmail?: string;
    assignedRole?: string;
    deliveryMethod?: string;
    messageId?: string;
    resent?: string;
    revoked?: string;
    error?: string;
  }>;
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

  // Fetch issued invitations for this tenant
  let invitations: any[] = [];
  try {
    invitations = await listTenantInvitations(tenantId);
  } catch {
    invitations = [];
  }

  const query = await searchParams;

  async function handleInviteMember(formData: FormData) {
    "use server";
    const sessionProfile = await getCurrentUserProfile();
    if (
      !sessionProfile ||
      !sessionProfile.isVerifiedMembership ||
      sessionProfile.activeMembership?.role !== "PLACEMENT_HEAD"
    ) {
      redirect("/auth/access-denied");
    }

    const actionTenantId = sessionProfile.activeMembership.tenant_id;
    const actionTenantName = sessionProfile.activeMembership.tenants?.name || "College Placement Cell";

    const rawEmail = formData.get("email") as string;
    const role = formData.get("role") as UserRole;
    const email = normalizeEmail(rawEmail || "");

    // 1. Validation
    if (!isValidEmail(email)) {
      redirect(`/dashboard/members?error=${encodeURIComponent("Please enter a valid institutional email address.")}`);
    }

    // 2. Strict Role Guard: Only PLACEMENT_STAFF and TRAINER permitted
    if (role !== "PLACEMENT_STAFF" && role !== "TRAINER") {
      redirect(
        `/dashboard/members?error=${encodeURIComponent(
          "Invalid role. Ordinary staff invitations can only assign Placement Officer (PLACEMENT_STAFF) or Faculty / Training Specialist (TRAINER)."
        )}`
      );
    }

    // 3. Prevent duplicate active membership in this tenant
    const existingMembers = await listTenantMembers(actionTenantId);
    const isAlreadyMember = existingMembers.some(
      (m) => m.profiles?.email?.toLowerCase() === email && m.status === "ACTIVE"
    );
    if (isAlreadyMember) {
      redirect(
        `/dashboard/members?error=${encodeURIComponent(
          "This email is already an active member of this college placement cell."
        )}`
      );
    }

    let redirectUrl = "";
    try {
      const result = await createInvitation({
        tenantId: actionTenantId,
        tenantName: actionTenantName,
        email,
        role,
        createdBy: sessionProfile.id,
      });

      // Dispatch invitation email via configured canonical APP_BASE_URL
      const appOrigin = EmailAdapter.getAppOrigin();
      const inviteUrl = `${appOrigin}/auth/college/invite/${result.rawToken}`;
      const deliveryResult = await EmailAdapter.sendInvitation({
        toEmail: email,
        tenantName: actionTenantName,
        role,
        inviteUrl,
      });

      if (!deliveryResult.success) {
        redirectUrl = `/dashboard/members?error=${encodeURIComponent(
          deliveryResult.error || "Email delivery failed via Resend."
        )}`;
      } else {
        revalidatePath("/dashboard/members");
        redirectUrl = `/dashboard/members?sentSuccess=true&sentEmail=${encodeURIComponent(
          email
        )}&assignedRole=${encodeURIComponent(role)}&deliveryMethod=${encodeURIComponent(
          deliveryResult.deliveryMethod
        )}&messageId=${encodeURIComponent(deliveryResult.messageId || "")}`;
      }
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.message === "NEXT_REDIRECT" || (err as any).digest?.startsWith?.("NEXT_REDIRECT"))
      ) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : "Failed to create invitation.";
      redirectUrl = `/dashboard/members?error=${encodeURIComponent(msg)}`;
    }

    if (redirectUrl) {
      redirect(redirectUrl);
    }
  }

  async function handleResendInvitation(formData: FormData) {
    "use server";
    const sessionProfile = await getCurrentUserProfile();
    if (
      !sessionProfile ||
      !sessionProfile.isVerifiedMembership ||
      sessionProfile.activeMembership?.role !== "PLACEMENT_HEAD"
    ) {
      redirect("/auth/access-denied");
    }

    const actionTenantId = sessionProfile.activeMembership.tenant_id;
    const actionTenantName = sessionProfile.activeMembership.tenants?.name || "College Placement Cell";
    const invitationId = formData.get("invitationId") as string;

    let redirectUrl = "";
    try {
      const result = await resendInvitation({
        invitationId,
        tenantId: actionTenantId,
        tenantName: actionTenantName,
        actorUserId: sessionProfile.id,
      });

      const appOrigin = EmailAdapter.getAppOrigin();
      const inviteUrl = `${appOrigin}/auth/college/invite/${result.rawToken}`;
      const deliveryResult = await EmailAdapter.sendInvitation({
        toEmail: result.invitation.email,
        tenantName: actionTenantName,
        role: result.invitation.role,
        inviteUrl,
      });

      if (!deliveryResult.success) {
        redirectUrl = `/dashboard/members?error=${encodeURIComponent(
          deliveryResult.error || "Email resend delivery failed via Resend."
        )}`;
      } else {
        revalidatePath("/dashboard/members");
        redirectUrl = `/dashboard/members?sentSuccess=true&resent=true&sentEmail=${encodeURIComponent(
          result.invitation.email
        )}&assignedRole=${encodeURIComponent(
          result.invitation.role
        )}&deliveryMethod=${encodeURIComponent(
          deliveryResult.deliveryMethod
        )}&messageId=${encodeURIComponent(deliveryResult.messageId || "")}`;
      }
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.message === "NEXT_REDIRECT" || (err as any).digest?.startsWith?.("NEXT_REDIRECT"))
      ) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : "Failed to resend invitation.";
      redirectUrl = `/dashboard/members?error=${encodeURIComponent(msg)}`;
    }

    if (redirectUrl) {
      redirect(redirectUrl);
    }
  }

  async function handleRevokeInvitation(formData: FormData) {
    "use server";
    const sessionProfile = await getCurrentUserProfile();
    if (
      !sessionProfile ||
      !sessionProfile.isVerifiedMembership ||
      sessionProfile.activeMembership?.role !== "PLACEMENT_HEAD"
    ) {
      redirect("/auth/access-denied");
    }

    const actionTenantId = sessionProfile.activeMembership.tenant_id;
    const invitationId = formData.get("invitationId") as string;

    let redirectUrl = "";
    try {
      await revokeInvitation(invitationId, actionTenantId);
      revalidatePath("/dashboard/members");
      redirectUrl = `/dashboard/members?revoked=true`;
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err.message === "NEXT_REDIRECT" || (err as any).digest?.startsWith?.("NEXT_REDIRECT"))
      ) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : "Failed to revoke invitation.";
      redirectUrl = `/dashboard/members?error=${encodeURIComponent(msg)}`;
    }

    if (redirectUrl) {
      redirect(redirectUrl);
    }
  }

  async function handleToggleMemberStatus(formData: FormData) {
    "use server";
    const sessionProfile = await getCurrentUserProfile();
    if (
      !sessionProfile ||
      !sessionProfile.isVerifiedMembership ||
      sessionProfile.activeMembership?.role !== "PLACEMENT_HEAD"
    ) {
      redirect("/auth/access-denied");
    }

    const actionTenantId = sessionProfile.activeMembership.tenant_id;
    const memberId = formData.get("memberId") as string;
    const currentStatus = formData.get("currentStatus") as string;
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

    await updateMemberStatus({
      membershipId: memberId,
      tenantId: actionTenantId,
      newStatus,
      actorUserId: sessionProfile.id,
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
          Invite placement officers, coordinators, and trainers into your college placement cell.
        </p>
      </div>

      {/* Dispatched Invitation Feedback */}
      {query.sentSuccess === "true" && (
        <Card className="border-secondary/40 bg-[rgba(46,143,134,0.06)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-secondary flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />{" "}
              {query.resent === "true"
                ? "Invitation Email Resent Successfully"
                : "Invitation Email Queued Successfully"}
            </CardTitle>
            <CardDescription className="text-xs text-text-secondary">
              The transactional invitation email was accepted by Resend and queued for delivery.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3.5 bg-card border border-border rounded-lg text-xs">
              <div>
                <span className="text-text-muted block text-[11px] uppercase font-mono tracking-wider">
                  Recipient Email
                </span>
                <span className="font-mono font-semibold text-text-primary text-sm">{query.sentEmail}</span>
              </div>
              <div>
                <span className="text-text-muted block text-[11px] uppercase font-mono tracking-wider">
                  Assigned Role
                </span>
                <Badge variant="secondary" className="mt-0.5">
                  {query.assignedRole === "TRAINER" ? "Faculty / Training Specialist" : "Placement Officer"}
                </Badge>
              </div>
              <div>
                <span className="text-text-muted block text-[11px] uppercase font-mono tracking-wider">
                  Institution
                </span>
                <span className="font-semibold text-text-primary">
                  {activeMembership.tenants?.name || "College Workspace"}
                </span>
              </div>
              {query.messageId && (
                <div>
                  <span className="text-text-muted block text-[11px] uppercase font-mono tracking-wider">
                    Provider Message ID
                  </span>
                  <span className="font-mono text-[11px] text-text-secondary">{query.messageId}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-text-muted">
              The recipient will receive an email containing a secure single-use activation link to set their password and activate their account.
            </p>
          </CardContent>
        </Card>
      )}

      {query.revoked === "true" && (
        <Card className="border-secondary/40 bg-[rgba(46,143,134,0.06)]">
          <CardContent className="p-4 text-xs text-secondary flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Invitation has been successfully revoked. The single-use link can no longer be accepted.</span>
          </CardContent>
        </Card>
      )}

      {query.error && (
        <Card className="border-status-danger/40 bg-[rgba(179,58,58,0.06)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-status-danger flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" /> Invitation Delivery Notice
            </CardTitle>
            <CardDescription className="text-xs text-status-danger/90">
              {query.error}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-text-muted">
            The invitation record has been preserved in the system. You can verify your Resend credentials in <code className="font-mono text-[11px]">.env</code> and use the Resend action below to retry.
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
              <Label htmlFor="email" required>
                Staff Institutional Email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="colleague@institution.edu"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="role" required>
                Assigned Role
              </Label>
              <Select name="role" defaultValue="PLACEMENT_STAFF">
                <SelectTrigger id="role" suppressHydrationWarning>
                  <SelectValue placeholder="Select Staff Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLACEMENT_STAFF">Placement Officer</SelectItem>
                  <SelectItem value="TRAINER">Faculty / Training Specialist</SelectItem>
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

      {/* Active Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Active Members ({members.length})
          </CardTitle>
          <CardDescription>
            All currently enrolled personnel under this college workspace.
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
                        <Badge variant="outline">
                          {m.role === "TRAINER"
                            ? "Faculty / Trainer"
                            : m.role === "PLACEMENT_HEAD"
                            ? "Placement Head"
                            : "Placement Officer"}
                        </Badge>
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
                              className={
                                m.status === "ACTIVE"
                                  ? "text-status-danger hover:bg-[var(--color-danger-subtle)]"
                                  : ""
                              }
                            >
                              {m.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                            </Button>
                          </form>
                        )}
                        {m.role === "PLACEMENT_HEAD" && (
                          <span className="text-xs text-text-muted font-mono">Institutional Admin</span>
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

      {/* Issued Invitations Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="h-4 w-4 text-secondary" /> Issued Invitations ({invitations.length})
          </CardTitle>
          <CardDescription>
            Track pending, accepted, expired, and revoked staff onboarding invitations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient Email</TableHead>
                  <TableHead>Assigned Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued / Expiry</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-text-muted text-xs">
                      No invitations issued yet. Use the form above to invite institutional staff.
                    </TableCell>
                  </TableRow>
                ) : (
                  invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs font-semibold text-text-primary">
                        {inv.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {inv.role === "TRAINER" ? "Faculty / Trainer" : "Placement Officer"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            inv.status === "ACCEPTED"
                              ? "success"
                              : inv.status === "PENDING"
                              ? "warning"
                              : "outline"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-text-muted">
                        <div className="flex flex-col gap-0.5">
                          <span>Issued: {new Date(inv.created_at).toLocaleDateString()}</span>
                          <span className="text-[11px] font-mono flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Expires: {new Date(inv.expires_at).toLocaleDateString()}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {inv.status === "PENDING" && (
                          <div className="flex items-center justify-end gap-2">
                            <form action={handleResendInvitation} className="inline-block">
                              <input type="hidden" name="invitationId" value={inv.id} />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                className="text-xs text-primary hover:text-primary-hover h-8"
                              >
                                <RotateCw className="h-3 w-3 mr-1" /> Resend
                              </Button>
                            </form>
                            <form action={handleRevokeInvitation} className="inline-block">
                              <input type="hidden" name="invitationId" value={inv.id} />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                className="text-xs text-status-danger hover:bg-[var(--color-danger-subtle)] h-8"
                              >
                                <XCircle className="h-3 w-3 mr-1" /> Revoke
                              </Button>
                            </form>
                          </div>
                        )}
                        {inv.status !== "PENDING" && (
                          <span className="text-xs text-text-muted font-mono">—</span>
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
