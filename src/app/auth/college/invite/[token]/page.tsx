import { InviteAcceptanceView } from "@/components/auth/invite-acceptance-view";
import { SimpleAuthCard } from "@/components/auth/simple-auth-card";

export const dynamic = "force-dynamic";

export default async function CollegeInviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <SimpleAuthCard>
      <InviteAcceptanceView token={token} />
    </SimpleAuthCard>
  );
}
