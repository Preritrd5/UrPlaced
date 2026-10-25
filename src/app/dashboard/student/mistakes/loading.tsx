import { TableSkeleton } from "@/components/ui/page-skeletons";

export default function StudentMistakesLoading() {
  return (
    <TableSkeleton
      title="Personal Mistake Bank"
      subtitle="Track recurring errors, spaced-repetition schedules, and targeted concept mastery"
      columns={4}
      rows={6}
    />
  );
}
