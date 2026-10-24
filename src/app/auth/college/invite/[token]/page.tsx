import { InviteAcceptanceView } from "@/components/auth/invite-acceptance-view";
import { SimpleAuthCard } from "@/components/auth/simple-auth-card";

export const dynamic = "force-dynamic";

export default async function CollegeInviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolved = await params;
  const token = decodeURIComponent(resolved?.token || "").trim();
  return (
    <SimpleAuthCard>
      <InviteAcceptanceView token={token} />
    </SimpleAuthCard>
  );
}
