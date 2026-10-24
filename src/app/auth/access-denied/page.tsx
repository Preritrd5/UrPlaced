import Link from "next/link";
import { ShieldX, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleAuthCard } from "@/components/auth/simple-auth-card";

export default function AccessDeniedPage() {
  return (
    <SimpleAuthCard>
      <div className="space-y-4 text-center">
        <div className="h-12 w-12 rounded-full bg-[var(--color-danger-subtle)] text-status-danger flex items-center justify-center mx-auto">
          <ShieldX className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold font-heading text-text-primary">
          Access Denied (403)
        </h2>
        <p className="text-xs text-text-secondary max-w-sm mx-auto">
          You do not possess the required permissions to perform this operation or access this institutional workspace.
        </p>

        <div className="pt-2">
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard" className="inline-flex items-center gap-1.5 justify-center">
              <ArrowLeft className="h-4 w-4" /> Return to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </SimpleAuthCard>
  );
}
