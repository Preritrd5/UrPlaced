import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudentAITutorLoading() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Skeleton */}
      <div className="bg-[#F8F7F3] border border-[#DDDCD5] p-6 rounded-xl shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Mode selection skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton className="h-8 w-36 rounded-lg" />
        <Skeleton className="h-8 w-36 rounded-lg" />
      </div>

      {/* Chat container skeleton */}
      <div className="bg-[#F8F7F3] border border-[#DDDCD5] rounded-xl shadow-sm p-6 min-h-[500px] flex flex-col justify-between space-y-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <div className="space-y-2 max-w-md w-full">
              <Skeleton className="h-16 w-full rounded-xl ml-auto" />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[#DDDCD5] space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
    </div>
  );
}
