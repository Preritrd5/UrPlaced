import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SelectTenantPage() {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/auth/signin");
  }

  const activeMemberships = profile.memberships.filter((m) => m.status === "ACTIVE");

  return (
    <div className="space-y-6 max-w-xl mx-auto py-8">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold font-heading text-text-primary">
          Select College Workspace
        </h1>
        <p className="text-xs text-text-secondary">
          You hold active memberships in multiple college placement cells. Select the workspace you wish to enter.
        </p>
      </div>

      <div className="space-y-3">
        {activeMemberships.map((m) => (
          <Card key={m.id} className="hover:border-primary/50 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-text-primary font-heading">
                    {m.tenants?.name || "College Workspace"}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs text-text-muted">/{m.tenants?.slug}</span>
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">{m.role}</Badge>
                  </div>
                </div>
              </div>

              <Button asChild variant="primary" size="sm">
                <Link href={`/dashboard?tenantId=${m.tenant_id}`} className="inline-flex items-center gap-1">
                  Enter <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
