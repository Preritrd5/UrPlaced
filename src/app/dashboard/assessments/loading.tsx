import { TableSkeleton } from "@/components/ui/page-skeletons";

export default function AssessmentsLoading() {
  return (
    <TableSkeleton
      title="Assessments & Tests"
      subtitle="Create and evaluate mock tests, aptitude drills, and technical assessments"
      columns={5}
      rows={6}
    />
  );
}
