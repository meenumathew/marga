"use client";

import { CheckCircle2, RefreshCw } from "lucide-react";
import { ReachedToggle } from "@/components/reached-toggle";
import { useReviewedPlans } from "@/lib/progress";

type PlanReviewRowProps = {
  /** The review id, e.g. "2026-Q3", shared with the achievement badge. */
  reviewId: string;
  label: string;
  date: string;
  month: string;
  day: string;
};

/** One quarter's review row. Done state comes from a confirmed review, not the date. */
export function PlanReviewRow({ reviewId, label, date, month, day }: PlanReviewRowProps) {
  const reviewedPlans = useReviewedPlans();
  const reviewed = reviewedPlans.has(reviewId);

  return (
    <li className={reviewed ? "plan-review done" : "plan-review"}>
      {reviewed ? (
        <CheckCircle2 size={14} aria-hidden="true" />
      ) : (
        <RefreshCw size={14} aria-hidden="true" />
      )}
      <time dateTime={date}>
        {month} {day}
      </time>
      <span>{label}</span>
      <ReachedToggle id={reviewId} kind="plan" />
    </li>
  );
}
