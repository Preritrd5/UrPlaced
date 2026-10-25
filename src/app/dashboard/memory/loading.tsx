import { TableSkeleton } from "@/components/ui/page-skeletons";

export default function MemoryLoading() {
  return (
    <TableSkeleton
      title="Placement Memory & Debriefs"
      subtitle="Institutional repository of student interview experiences and company pattern archives"
      columns={4}
      rows={5}
    />
  );
}
