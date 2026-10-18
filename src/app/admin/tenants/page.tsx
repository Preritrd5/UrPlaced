import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Plus, ShieldAlert, CheckCircle2 } from "lucide-react";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { listTenants, createTenant, updateTenantStatus } from "@/modules/tenancy/services/tenant-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export default async function AdminTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ newInviteToken?: string; error?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/signin");
  }

  if (!profile.isPlatformAdmin) {
    redirect("/auth/access-denied");
  }

  const tenants = await listTenants();
  const query = await searchParams;

  async function handleCreateTenant(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const slug = formData.get("slug") as string;
    const primaryDomain = formData.get("primaryDomain") as string;
    const seatLimit = parseInt(formData.get("seatLimit") as string, 10) || 1000;
    const initialAdminEmail = formData.get("initialAdminEmail") as string;

    try {
      const result = await createTenant({
        name,
        slug,
        primaryDomain,
        studentSeatLimit: seatLimit,
        initialAdminEmail,
        actorUserId: profile?.id,
      });

      revalidatePath("/admin/tenants");
      redirect(`/admin/tenants?newInviteToken=${encodeURIComponent(result.inviteToken)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create tenant.";
      redirect(`/admin/tenants?error=${encodeURIComponent(msg)}`);
    }
  }

  async function handleToggleStatus(formData: FormData) {
    "use server";
    const tenantId = formData.get("tenantId") as string;
    const currentStatus = formData.get("currentStatus") as string;
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

    await updateTenantStatus({
      tenantId,
      newStatus,
      actorUserId: profile?.id,
      reason: `Platform admin status toggle to ${newStatus}`,
    });

    revalidatePath("/admin/tenants");
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
          <Badge variant="default" className="bg-primary text-white">
            Super Admin Only
          </Badge>
          <span className="text-xs text-text-muted font-mono">Tenant Lifecycle</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary font-heading">
          College Tenant Workspaces
        </h1>
        <p className="text-sm text-text-secondary max-w-2xl">
          Provision new college workspaces, configure student seat quotas, suspend/reactivate tenants,
          and issue Placement Head onboarding invitations.
        </p>
      </div>

      {query.newInviteToken && (
        <Card className="border-secondary/40 bg-[rgba(46,143,134,0.06)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-secondary flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> Placement Head Invitation Generated
            </CardTitle>
            <CardDescription>
              A one-time cryptographic invitation token was minted. Provide this URL to the institution Placement Head:
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

      {/* Provision New College Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Provision New College Workspace
          </CardTitle>
          <CardDescription>
            Creates an isolated tenant partition and mints an onboarding invite for its placement director.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleCreateTenant} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name" required>Institution Legal Name</Label>
              <Input id="name" name="name" placeholder="e.g. Apex Institute of Technology" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug" required>URL Subdomain / Slug</Label>
              <Input id="slug" name="slug" placeholder="e.g. apex-institute" required />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="primaryDomain">Allowed Email Domain</Label>
              <Input id="primaryDomain" name="primaryDomain" placeholder="e.g. apex.edu" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="seatLimit">Student Seat Limit</Label>
              <Input id="seatLimit" name="seatLimit" type="number" defaultValue="1500" required />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="initialAdminEmail" required>Initial Placement Head Email</Label>
              <Input id="initialAdminEmail" name="initialAdminEmail" type="email" placeholder="director.placement@apex.edu" required />
            </div>

            <div className="sm:col-span-2 pt-2">
              <Button type="submit" variant="primary">
                <Building2 className="h-4 w-4 mr-2" /> Provision College Workspace
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing Tenants Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active College Workspaces ({tenants.length})</CardTitle>
          <CardDescription>
            Audit and manage institution operational states.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Institution Name</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Seat Limit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-text-muted">
                      No college tenants provisioned yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  tenants.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-semibold text-text-primary">{t.name}</TableCell>
                      <TableCell className="font-mono text-xs">/{t.slug}</TableCell>
                      <TableCell className="text-xs text-text-secondary">{t.primary_domain || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{t.student_seat_limit.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={t.status === "ACTIVE" ? "success" : "warning"}>
                          {t.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={handleToggleStatus} className="inline-block">
                          <input type="hidden" name="tenantId" value={t.id} />
                          <input type="hidden" name="currentStatus" value={t.status} />
                          <Button
                            type="submit"
                            variant={t.status === "ACTIVE" ? "outline" : "secondary"}
                            size="sm"
                          >
                            {t.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                          </Button>
                        </form>
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
