import { localDateStamp } from "./calendar-date";
import { getAllMilestones } from "./learn-content";
import { getPlanReviews } from "./plans";

export type LearningEvent = {
  id: string;
  date: string;
  type: string;
  title: string;
  time: string;
  description: string;
  /** Route of the note that declared this milestone. */
  href: string;
  /** Slug of the note that declared this milestone (used by the edit/delete API). */
  slug: string;
  /** Index within the source note's milestones array; identifies it for edit/delete. */
  sourceIndex: number;
  /** Optional short context from the milestone entry. */
  note: string;
  /**
   * "milestone" — a user-declared, editable milestone.
   * "plan-review" — an auto-generated plan quarter review (not editable/deletable).
   */
  kind: "milestone" | "plan-review";
  /**
   * Stable id used to mark this event reached/reviewed. Matches the id the
   * achievements system keys off, so confirming here lights up the badge there:
   * a milestone's `slug#index`, or a plan review's `year-Qn`.
   */
  confirmId: string;
};

/**
 * Events are real milestones declared in note frontmatter:
 *
 *   milestones:
 *     - title: "Book AWS SAA exam"
 *       date: "2026-09-15"
 *       type: exam
 *
 * plus the automatic quarter-end plan reviews, so the timeline is complete.
 * The dashboard preview and the milestones page read the same data.
 */
export function getUpcomingEvents(limit?: number): LearningEvent[] {
  const today = localDateStamp(new Date());

  const events = allEvents()
    .filter((event) => event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  return typeof limit === "number" ? events.slice(0, limit) : events;
}

/**
 * Past events, most recent first, so the milestones page can show a record of
 * what has already happened instead of dropping events the moment they pass.
 */
export function getPastEvents(limit?: number): LearningEvent[] {
  const today = localDateStamp(new Date());

  const events = allEvents()
    .filter((event) => event.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  return typeof limit === "number" ? events.slice(0, limit) : events;
}

/** All timeline events: user milestones plus auto plan reviews. */
function allEvents(): LearningEvent[] {
  return [...getAllMilestones().map(toLearningEvent), ...getPlanReviews().map(toPlanReviewEvent)];
}

function toPlanReviewEvent(review: {
  id: string;
  year: number;
  quarter: number;
  label: string;
  date: string;
}): LearningEvent {
  return {
    id: `plan-review-${review.id}`,
    date: review.date,
    type: "Plan review",
    title: `Q${review.quarter} ${review.year} review`,
    time: daysUntilLabel(review.date),
    description: `Quarter-end review of your ${review.year} plan`,
    href: "/plans",
    slug: "",
    sourceIndex: -1,
    note: "",
    kind: "plan-review",
    confirmId: review.id,
  };
}

function toLearningEvent(milestone: {
  id: string;
  date: string;
  type: string;
  title: string;
  note: string;
  link: string;
  sourceTitle: string;
  sourceHref: string;
  sourceSlug: string;
  sourceIndex: number;
}): LearningEvent {
  const confirmId = `${milestone.sourceSlug}#${milestone.id}`;

  return {
    id: confirmId,
    date: milestone.date,
    type: milestone.type,
    title: milestone.title,
    time: daysUntilLabel(milestone.date),
    description: milestone.note
      ? `${milestone.note} — From: ${milestone.sourceTitle}`
      : `From: ${milestone.sourceTitle}`,
    // A milestone's own link wins (e.g. a section view); else open its source note.
    href: milestone.link || milestone.sourceHref,
    slug: milestone.sourceSlug,
    sourceIndex: milestone.sourceIndex,
    note: milestone.note,
    kind: "milestone",
    confirmId,
  };
}

/** Group events by "Month Year" (e.g. "September 2026"), preserving input order. */
export function groupEventsByMonth(
  events: LearningEvent[],
): { label: string; events: LearningEvent[] }[] {
  const groups: { label: string; events: LearningEvent[] }[] = [];

  for (const event of events) {
    const label = getEventMonthLabel(event.date);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.label === label) {
      lastGroup.events.push(event);
    } else {
      groups.push({ label, events: [event] });
    }
  }

  return groups;
}

export function getEventDateParts(date: string): { month: string; day: string } {
  const eventDate = new Date(`${date}T00:00:00Z`);

  return {
    month: new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(eventDate),
    day: new Intl.DateTimeFormat("en", { day: "2-digit", timeZone: "UTC" }).format(eventDate),
  };
}

export function getEventMonthLabel(date: string): string {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

export function daysUntilLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const target = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((target.getTime() - todayMidnight.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return "Passed";
  }

  if (diffDays === 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Tomorrow";
  }

  return `In ${diffDays} days`;
}
