"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { QuestionType, QuestionDifficulty, QuestionLifecycleStatus, AnswerKeyReviewStatus } from "@/types/database";

export function QuestionTypeBadge({ type }: { type: QuestionType }) {
  switch (type) {
    case "SINGLE_CHOICE":
      return <Badge variant="outline">Single Choice</Badge>;
    case "MULTIPLE_SELECT":
      return <Badge variant="secondary">Multi-Select</Badge>;
    case "NUMERIC":
      return <Badge variant="outline">Numeric</Badge>;
    case "SHORT_ANSWER":
      return <Badge variant="outline">Short Answer</Badge>;
    case "CODING":
      return <Badge variant="default">Coding</Badge>;
    default:
      return <Badge variant="outline">{type}</Badge>;
  }
}

export function DifficultyBadge({ difficulty }: { difficulty: QuestionDifficulty }) {
  switch (difficulty) {
    case "EASY":
      return <Badge variant="secondary">Easy</Badge>;
    case "MEDIUM":
      return <Badge variant="default">Medium</Badge>;
    case "HARD":
      return <Badge variant="danger">Hard</Badge>;
    default:
      return <Badge variant="outline">{difficulty}</Badge>;
  }
}

export function LifecycleStatusBadge({ status }: { status: QuestionLifecycleStatus }) {
  switch (status) {
    case "PUBLISHED":
      return <Badge variant="secondary">Published</Badge>;
    case "APPROVED":
      return <Badge variant="default">Approved</Badge>;
    case "PENDING_REVIEW":
      return <Badge variant="warning">Pending Review</Badge>;
    case "DRAFT":
      return <Badge variant="outline">Draft</Badge>;
    case "WITHDRAWN":
      return <Badge variant="outline" className="opacity-70">Withdrawn</Badge>;
    case "ARCHIVED":
      return <Badge variant="outline" className="opacity-50">Archived</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function ReviewStatusBadge({ status }: { status: AnswerKeyReviewStatus }) {
  switch (status) {
    case "VERIFIED_CORRECT":
      return <Badge variant="secondary" className="flex items-center gap-1">✓ Verified</Badge>;
    case "NEEDS_REVISION":
      return <Badge variant="warning">Needs Revision</Badge>;
    case "REJECTED":
      return <Badge variant="danger">Rejected</Badge>;
    case "UNREVIEWED":
    default:
      return <Badge variant="outline">Unreviewed</Badge>;
  }
}
