import Link from "next/link";
import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleAuthCard } from "@/components/auth/simple-auth-card";

export default function MembershipSuspendedPage() {
  return (
    <SimpleAuthCard>
      <div className="space-y-4 text-center">
        <div className="h-12 w-12 rounded-full bg-[var(--color-danger-subtle)] text-status-danger flex items-center justify-center mx-auto">
          <UserX className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold font-heading text-text-primary">
          Membership Suspended
        </h2>
        <p className="text-xs text-text-secondary max-w-sm mx-auto leading-relaxed">
          Your membership in this college workspace has been suspended or revoked by the placement cell head.
          You cannot access drives or take assessments under this institution.
        </p>

        <div className="pt-2">
          <Button asChild variant="outline" className="w-full">
            <Link href="/auth/signin">Return to Sign In</Link>
          </Button>
        </div>
      </div>
    </SimpleAuthCard>
  );
}
