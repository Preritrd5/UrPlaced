"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QuestionForm } from "@/components/questions/question-form";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { ProfileSkeleton } from "@/components/ui/page-skeletons";

export default function NewQuestionPage() {
  const router = useRouter();
  const { role, isPlatformAdmin, isLoading: isLoadingAuth } = useAuthContext();

  const canManageQuestions = isPlatformAdmin || (role && ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"].includes(role));

  useEffect(() => {
    if (!isLoadingAuth) {
      if (role === "STUDENT") {
        router.replace("/dashboard/student");
      } else if (!canManageQuestions) {
        router.replace("/auth/access-denied");
      }
    }
  }, [role, canManageQuestions, isLoadingAuth, router]);

  if (isLoadingAuth) {
    return <ProfileSkeleton />;
  }

  if (!canManageQuestions) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/questions"
          className="p-2 rounded-md hover:bg-card text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight font-display flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            Author New Question
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Create structured question content, verify answer keys, and ensure no duplicates.
          </p>
        </div>
      </div>

      <QuestionForm />
    </div>
  );
}
