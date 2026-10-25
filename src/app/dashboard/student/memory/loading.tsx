import { TableSkeleton } from "@/components/ui/page-skeletons";

export default function StudentMemoryLoading() {
  return (
    <TableSkeleton
      title="Company Placement Memory"
      subtitle="Search institutional archives of interview questions, round breakdowns, and hiring tips"
      columns={4}
      rows={5}
    />
  );
}
