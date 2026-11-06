import React from "react";
import { TableSkeleton } from "@/components/ui/page-skeletons";

export default function PlatformAccountsLoading() {
  return (
    <TableSkeleton
      title="Super Administrator Accounts"
      subtitle="Platform staff credentials, role permissions, and MFA status"
      columns={5}
      rows={6}
    />
  );
}
