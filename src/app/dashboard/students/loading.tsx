import { TableSkeleton } from "@/components/ui/page-skeletons";

export default function StudentsLoading() {
  return (
    <TableSkeleton
      title="Student Directory"
      subtitle="View and manage enrolled student profiles, batches, and placement eligibility"
      columns={6}
      rows={8}
    />
  );
}
