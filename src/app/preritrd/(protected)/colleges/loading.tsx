import React from "react";
import { TableSkeleton } from "@/components/ui/page-skeletons";

export default function PlatformCollegesLoading() {
  return (
    <TableSkeleton
      title="College Directory"
      subtitle="Registered institutions and tenant subscription status"
      columns={6}
      rows={8}
    />
  );
}
