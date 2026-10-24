import { InviteAcceptanceView } from "@/components/auth/invite-acceptance-view";

export const dynamic = "force-dynamic";

export default async function CollegeInviteTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InviteAcceptanceView token={token} />;
}
