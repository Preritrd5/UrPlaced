import { TableSkeleton } from "@/components/ui/page-skeletons";

export default function DrivesLoading() {
  return (
    <TableSkeleton
      title="Recruitment Drives"
      subtitle="Monitor on-campus and virtual hiring pipelines, eligibility criteria, and application stages"
      columns={5}
      rows={6}
    />
  );
}
