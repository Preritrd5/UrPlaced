import { TableSkeleton } from "@/components/ui/page-skeletons";

export default function CompaniesLoading() {
  return (
    <TableSkeleton
      title="Company Directory"
      subtitle="Track corporate recruiting partners, contact points, and hiring history"
      columns={5}
      rows={6}
    />
  );
}
