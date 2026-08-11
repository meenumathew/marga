"use client";

import { CheckCircle2, Circle } from "lucide-react";
import {
  toggleMilestoneReached,
  togglePlanReviewed,
  useReachedMilestones,
  useReviewedPlans,
} from "@/lib/progress";

type ReachedToggleProps = {
  /** The confirmId of the event: a milestone's `slug#index` or a plan review's `year-Qn`. */
  id: string;
  kind: "milestone" | "plan";
};

/**
 * Marks a milestone reached or a plan quarter reviewed. This — not a passed date —
 * is what earns the matching achievement, so confirming is a deliberate act.
 */
export function ReachedToggle({ id, kind }: ReachedToggleProps) {
  const reachedMilestones = useReachedMilestones();
  const reviewedPlans = useReviewedPlans();
  const isDone = kind === "milestone" ? reachedMilestones.has(id) : reviewedPlans.has(id);

  const doneLabel = kind === "milestone" ? "Reached" : "Reviewed";
  const todoLabel = kind === "milestone" ? "Mark reached" : "Mark reviewed";

  return (
    <button
      className={isDone ? "reached-toggle is-done" : "reached-toggle"}
      type="button"
      onClick={() => (kind === "milestone" ? toggleMilestoneReached(id) : togglePlanReviewed(id))}
      aria-pressed={isDone}
    >
      {isDone ? (
        <CheckCircle2 size={15} aria-hidden="true" />
      ) : (
        <Circle size={15} aria-hidden="true" />
      )}
      {isDone ? doneLabel : todoLabel}
    </button>
  );
}
