import { TableSkeleton } from "@/components/ui/page-skeletons";

export default function MembersLoading() {
  return (
    <TableSkeleton
      title="Institutional Staff & Faculty"
      subtitle="Manage authorized staff, assigned roles, and institutional access"
      columns={5}
      rows={6}
    />
  );
}
