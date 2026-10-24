import { redirect } from "next/navigation";
import { InviteAcceptanceView } from "@/components/auth/invite-acceptance-view";

export const dynamic = "force-dynamic";

export default async function CollegeInviteAcceptPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const query = await searchParams;
  if (!query.token) {
    redirect("/auth/college/signin");
  }

  return <InviteAcceptanceView token={query.token} />;
}
