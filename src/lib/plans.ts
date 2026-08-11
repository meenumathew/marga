import {
  getAllLearnContent,
  type LearnContentMeta,
  type MilestoneWithSource,
} from "./learn-content";

/** An automatic quarter-end review checkpoint for a plan year. Computed, not stored. */
export type PlanReview = {
  /** Stable id, e.g. "2026-Q1". */
  id: string;
  year: number;
  /** 1..4 */
  quarter: number;
  label: string;
  /** Quarter-end ISO date the review falls on. */
  date: string;
};

export type PlanQuarter = {
  /** "Q1".."Q4" */
  label: string;
  /** Auto quarter-end review checkpoint for this quarter. */
  review: PlanReview;
  /** Milestones declared in this year's plan notes that fall in this quarter. */
  milestones: MilestoneWithSource[];
};

export type PlanYear = {
  year: number;
  /** Plan notes tagged with this year, best (lowest order) first. */
  plans: LearnContentMeta[];
  quarters: PlanQuarter[];
  milestoneCount: number;
};

/** Which quarter a 1-based month falls in. */
function quarterOfMonth(month: number): number {
  return Math.floor((month - 1) / 3) + 1;
}

/** Last day of each quarter (month is 1-based): Q1→Mar 31, Q2→Jun 30, Q3→Sep 30, Q4→Dec 31. */
const QUARTER_END: Record<number, { month: string; day: string }> = {
  1: { month: "03", day: "31" },
  2: { month: "06", day: "30" },
  3: { month: "09", day: "30" },
  4: { month: "12", day: "31" },
};

function reviewFor(year: number, quarter: number): PlanReview {
  const end = QUARTER_END[quarter];
  return {
    id: `${year}-Q${quarter}`,
    year,
    quarter,
    label: `Q${quarter} review`,
    date: `${year}-${end?.month ?? "12"}-${end?.day ?? "31"}`,
  };
}

/** Plan-mode notes that declare a year; every plan view starts from these. */
function planNotes(): LearnContentMeta[] {
  return getAllLearnContent().filter((note) => note.mode === "Plan" && note.year > 0);
}

/** The distinct plan years present, newest first. */
function planYearsPresent(plans: LearnContentMeta[]): number[] {
  return [...new Set(plans.map((plan) => plan.year))].sort((left, right) => right - left);
}

/**
 * Every plan year's four auto quarter-end reviews, flattened. Shared by the
 * achievements system so a passed review can become an earned badge — this is
 * the single source of truth for plan review checkpoints.
 */
export function getPlanReviews(): PlanReview[] {
  return planYearsPresent(planNotes()).flatMap((year) =>
    [1, 2, 3, 4].map((quarter) => reviewFor(year, quarter)),
  );
}

/**
 * Assemble the /plans data model: every Plan-mode note that declares a `year`,
 * grouped by year (newest first). Each year's quarters show only the milestones
 * declared in that year's plan notes — a plan owns its own checkpoints, so
 * milestones from unrelated notes never leak into it — plus an automatic
 * quarter-end review checkpoint.
 */
export function getPlanYears(): PlanYear[] {
  // One content scan, reused for the years and their notes: each call to
  // getAllLearnContent re-reads and re-parses every note on disk.
  const plans = planNotes();

  if (plans.length === 0) {
    return [];
  }

  return planYearsPresent(plans).map((year) => {
    const yearPlans = plans.filter((plan) => plan.year === year);

    // Milestones come from the plan notes themselves, tagged with their source.
    const planMilestones: MilestoneWithSource[] = yearPlans
      .flatMap((plan) =>
        plan.milestones.map((milestone, sourceIndex) => ({
          ...milestone,
          sourceTitle: plan.title,
          sourceHref: plan.href,
          sourceSlug: plan.slug,
          sourceIndex,
        })),
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    const quarters: PlanQuarter[] = [1, 2, 3, 4].map((quarter) => ({
      label: `Q${quarter}`,
      review: reviewFor(year, quarter),
      milestones: planMilestones.filter((milestone) => {
        const month = Number(milestone.date.slice(5, 7));
        return quarterOfMonth(month) === quarter;
      }),
    }));

    return {
      year,
      plans: yearPlans,
      quarters,
      milestoneCount: planMilestones.length,
    };
  });
}
