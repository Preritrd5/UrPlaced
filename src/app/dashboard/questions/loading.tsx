import { TableSkeleton } from "@/components/ui/page-skeletons";

export default function QuestionsLoading() {
  return (
    <TableSkeleton
      title="Question Bank Sentinel"
      subtitle="Curate verified technical, aptitude, and verbal question items with anti-leak protection"
      columns={5}
      rows={7}
    />
  );
}
