import type { EvidenceEntry } from "@/lib/evidence";

export type Achievement = {
  id: string;
  title: string;
  detail: string;
  achieved: boolean;
  kind:
    | "lesson"
    | "section"
    | "mastery"
    | "evidence"
    | "feedback"
    | "streak"
    | "milestone"
    | "plan";
  /**
   * Progress toward a countable goal, so a locked badge can show how close it is
   * (e.g. 7/10 lessons). Omitted for all-or-nothing achievements like milestones.
   */
  progress?: { current: number; target: number };
};

type MilestoneSummary = {
  /** Stable id (source slug + milestone id) so a reached badge maps to one milestone. */
  id: string;
  title: string;
  date: string;
  type: string;
};

type PlanReviewSummary = {
  id: string;
  year: number;
  quarter: number;
  date: string;
};

type AchievementInput = {
  lessons: { slug: string; section: string; sectionSlug: string }[];
  completed: ReadonlySet<string>;
  streak: number;
  /** Real outputs and feedback the learner logged; drives the evidence-based badges. */
  evidence: readonly EvidenceEntry[];
  milestones?: MilestoneSummary[];
  /** Milestone ids the learner confirmed reached — a badge needs this, not a passed date. */
  reachedMilestones?: ReadonlySet<string>;
  planReviews?: PlanReviewSummary[];
  /** Plan-review ids the learner confirmed reviewed. */
  reviewedPlans?: ReadonlySet<string>;
};

const LESSON_TIERS = [5, 10, 25, 50];
const EVIDENCE_TIERS = [5, 15, 40];
const FEEDBACK_TIERS = [5, 15];
const STREAK_TIERS = [3, 7, 30];

/** Derive the achievement list from real activity. Pure and client-safe. */
export function deriveAchievements({
  lessons,
  completed,
  streak,
  evidence,
  milestones = [],
  reachedMilestones = new Set<string>(),
  planReviews = [],
  reviewedPlans = new Set<string>(),
}: AchievementInput): Achievement[] {
  const achievements: Achievement[] = [];
  const completedCount = lessons.filter((lesson) => completed.has(lesson.slug)).length;
  const evidenceCount = evidence.length;
  const feedbackCount = evidence.filter((entry) => entry.kind === "Feedback").length;

  // --- Reading: consumption is a start, not the goal. ---
  achievements.push({
    id: "first-lesson",
    title: "First Step",
    detail: "Read your first note",
    achieved: completedCount >= 1,
    kind: "lesson",
    progress: { current: Math.min(completedCount, 1), target: 1 },
  });

  for (const tier of LESSON_TIERS) {
    achievements.push({
      id: `lessons-${tier}`,
      title: `${tier} Notes`,
      detail: `Read ${tier} notes`,
      achieved: completedCount >= tier,
      kind: "lesson",
      progress: { current: Math.min(completedCount, tier), target: tier },
    });
  }

  // --- Evidence: the mastery signal is what you produce, not what you read. ---
  achievements.push({
    id: "first-evidence",
    title: "Made Something",
    detail: "Log your first piece of evidence — a build, refactor, write-up, or talk",
    achieved: evidenceCount >= 1,
    kind: "evidence",
    progress: { current: Math.min(evidenceCount, 1), target: 1 },
  });

  for (const tier of EVIDENCE_TIERS) {
    achievements.push({
      id: `evidence-${tier}`,
      title: `${tier} Pieces of Evidence`,
      detail: `Log ${tier} real outputs`,
      achieved: evidenceCount >= tier,
      kind: "evidence",
      progress: { current: Math.min(evidenceCount, tier), target: tier },
    });
  }

  // --- Feedback: outside input is the fastest way to fix blind spots, so it earns its own track. ---
  achievements.push({
    id: "first-feedback",
    title: "Asked For Feedback",
    detail: "Log feedback you received from someone else",
    achieved: feedbackCount >= 1,
    kind: "feedback",
    progress: { current: Math.min(feedbackCount, 1), target: 1 },
  });

  for (const tier of FEEDBACK_TIERS) {
    achievements.push({
      id: `feedback-${tier}`,
      title: `${tier} Feedback Notes`,
      detail: `Capture feedback from others ${tier} times`,
      achieved: feedbackCount >= tier,
      kind: "feedback",
      progress: { current: Math.min(feedbackCount, tier), target: tier },
    });
  }

  // --- Sections: honest "read all", plus a real "mastered" that needs produced evidence. ---
  const bySection = new Map<string, { section: string; total: number; done: number }>();
  const sectionTitleToKey = new Map<string, string>();

  for (const lesson of lessons) {
    const sectionKey = lesson.sectionSlug || lesson.section;
    const entry = bySection.get(sectionKey) ?? { section: lesson.section, total: 0, done: 0 };
    entry.total += 1;

    if (completed.has(lesson.slug)) {
      entry.done += 1;
    }

    bySection.set(sectionKey, entry);
    sectionTitleToKey.set(lesson.section, sectionKey);
  }

  const evidenceBySection = new Map<string, number>();

  for (const entry of evidence) {
    const sectionKey = entry.sectionSlug || sectionTitleToKey.get(entry.section) || entry.section;

    if (sectionKey) {
      evidenceBySection.set(sectionKey, (evidenceBySection.get(sectionKey) ?? 0) + 1);
    }
  }

  for (const [sectionKey, counts] of [...bySection.entries()].sort(([, a], [, b]) =>
    a.section.localeCompare(b.section),
  )) {
    const section = counts.section;
    const readAll = counts.total > 0 && counts.done === counts.total;
    const sectionEvidence = evidenceBySection.get(sectionKey) ?? 0;

    achievements.push({
      id: `section-read-${sectionKey}`,
      title: `Read all of ${section}`,
      detail: `Read all ${counts.total} ${counts.total === 1 ? "note" : "notes"} in ${section}`,
      achieved: readAll,
      kind: "section",
      progress: { current: counts.done, target: counts.total },
    });

    achievements.push({
      id: `section-mastery-${sectionKey}`,
      title: `Mastered ${section}`,
      detail: readAll
        ? `Read ✓ — log a piece of evidence in ${section} to prove it`
        : `Read every note in ${section} and log evidence you produced there`,
      achieved: readAll && sectionEvidence >= 1,
      kind: "mastery",
    });
  }

  // --- Consistency. ---
  for (const tier of STREAK_TIERS) {
    achievements.push({
      id: `streak-${tier}`,
      title: `${tier} Day Streak`,
      detail: `Learn ${tier} days in a row`,
      achieved: streak >= tier,
      kind: "streak",
      progress: { current: Math.min(streak, tier), target: tier },
    });
  }

  // A milestone becomes a badge only when the learner marks it reached — a passed
  // date alone is the calendar moving, not evidence of anything done.
  for (const milestone of milestones) {
    const reached = reachedMilestones.has(milestone.id);
    achievements.push({
      id: `milestone-${milestone.id}`,
      title: reached ? `Reached: ${milestone.title}` : milestone.title,
      detail: `${milestone.type} · ${milestone.date}`,
      achieved: reached,
      kind: "milestone",
    });
  }

  // A plan's quarter review counts once the learner marks it reviewed, connecting
  // Plans to Achievements as real, confirmed progress — not an auto-unlock by date.
  for (const review of planReviews) {
    const reviewed = reviewedPlans.has(review.id);
    achievements.push({
      id: `plan-review-${review.id}`,
      title: reviewed
        ? `Q${review.quarter} ${review.year} reviewed`
        : `Review Q${review.quarter} ${review.year}`,
      detail: `Plan review · ${review.date}`,
      achieved: reviewed,
      kind: "plan",
    });
  }

  return achievements;
}
