import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TenantSuspendedPage() {
  return (
    <div className="space-y-4 text-center">
      <div className="h-12 w-12 rounded-full bg-[var(--color-warning-subtle)] text-status-warning flex items-center justify-center mx-auto">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-xl font-bold font-heading text-text-primary">
        Workspace Suspended
      </h2>
      <p className="text-xs text-text-secondary max-w-sm mx-auto leading-relaxed">
        Your college placement workspace has been temporarily suspended by the platform administrator.
        All student assessments and operations are locked.
      </p>
      <p className="text-[11px] text-text-muted">
        Please contact your institutional placement director or UrPlaced support for assistance.
      </p>

      <div className="pt-2">
        <Button asChild variant="outline" className="w-full">
          <Link href="/auth/signin">Return to Sign In</Link>
        </Button>
      </div>
    </div>
  );
}
