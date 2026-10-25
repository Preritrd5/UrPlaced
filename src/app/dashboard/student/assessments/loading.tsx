import { TableSkeleton } from "@/components/ui/page-skeletons";

export default function StudentAssessmentsLoading() {
  return (
    <TableSkeleton
      title="Practice & Assigned Assessments"
      subtitle="Mock placement exams, timed tests, and skill benchmark assessments"
      columns={5}
      rows={5}
    />
  );
}
