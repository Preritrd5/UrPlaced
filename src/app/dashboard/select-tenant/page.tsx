"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ArrowRight } from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function SelectTenantPage() {
  const auth = useAuthContext();
  const router = useRouter();

  React.useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.push("/auth/college/signin");
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  if (auth.isLoading) {
    return (
      <div className="space-y-6 max-w-xl mx-auto py-8 animate-pulse">
        <div className="h-8 bg-card/60 rounded-xl w-1/2 mx-auto" />
        <div className="h-20 bg-card rounded-xl border border-border" />
      </div>
    );
  }

  const activeTenants = auth.availableTenants || [];

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
        {activeTenants.map((m) => (
          <Card key={m.id} className="hover:border-primary/50 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-text-primary font-heading">
                    {m.name || "College Workspace"}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5">{m.role}</Badge>
                  </div>
                </div>
              </div>

              <Button asChild variant="primary" size="sm">
                <Link href={`/dashboard?tenantId=${m.id}`} className="inline-flex items-center gap-1">
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
