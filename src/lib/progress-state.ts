/**
 * The progress state shape, and the rules for validating, merging, and comparing
 * it.
 *
 * Progress lives in two places: the browser's localStorage (the store in
 * progress.ts) and a mirror file the progress route writes. Both sides need the
 * same answers to "is this value trustworthy?" and "how much of it do we keep?",
 * and two near-identical copies of those rules had already drifted — only the
 * browser side capped id length, so the file could hold ids it would refuse to
 * write itself. The rules live here once, with the caps as named constants.
 *
 * Pure: no window, no fs. Safe to import from a client component or a route.
 */

import { isCalendarDate } from "./calendar-date";
import { type EvidenceEntry, normalizeEvidenceEntry } from "./evidence";

export type ProgressState = {
  version: 1;
  completedLessons: string[];
  lastVisitedLesson: string | null;
  activityDays: string[];
  /** Real outputs and feedback the learner logged. */
  evidence: EvidenceEntry[];
  /** Milestone ids the learner has confirmed reached (not merely past-dated). */
  reachedMilestones: string[];
  /** Plan-review ids the learner has confirmed reviewed. */
  reviewedPlans: string[];
};

/**
 * Longest lesson slug, milestone id, or plan id worth storing. Real ones are far
 * shorter; anything longer is a corrupted file or a probe, not progress.
 */
export const MAX_ID_LENGTH = 240;

/** Roughly a year of daily activity — more than the heatmap or streak ever read. */
export const MAX_ACTIVITY_DAYS = 400;

/** Ceiling on each id list, so a malformed file cannot grow the state unboundedly. */
export const MAX_ID_ENTRIES = 5_000;

/** Ceiling on the evidence log; the newest entries win. */
export const MAX_EVIDENCE_ENTRIES = 2_000;

export function createEmptyProgressState(): ProgressState {
  return {
    version: 1,
    completedLessons: [],
    lastVisitedLesson: null,
    activityDays: [],
    evidence: [],
    reachedMilestones: [],
    reviewedPlans: [],
  };
}

/**
 * Validate an unknown value — a parsed state file, an API response, whatever
 * localStorage held — into a state safe to store and render.
 */
export function normalizeProgressState(value: unknown): ProgressState {
  if (!value || typeof value !== "object") {
    return createEmptyProgressState();
  }

  const candidate = value as Record<string, unknown>;

  return {
    version: 1,
    completedLessons: readIdList(candidate.completedLessons),
    lastVisitedLesson: readProgressId(candidate.lastVisitedLesson) || null,
    activityDays: readActivityDayList(candidate.activityDays),
    evidence: normalizeEvidenceList(candidate.evidence),
    reachedMilestones: readIdList(candidate.reachedMilestones),
    reviewedPlans: readIdList(candidate.reviewedPlans),
  };
}

/** Whether this state records anything at all, so an empty one can be recognised. */
export function hasProgress(state: ProgressState): boolean {
  return (
    state.completedLessons.length > 0 ||
    state.lastVisitedLesson !== null ||
    state.activityDays.length > 0 ||
    state.evidence.length > 0 ||
    state.reachedMilestones.length > 0 ||
    state.reviewedPlans.length > 0
  );
}

/**
 * Combine what the browser holds with what the mirror file holds, keeping every
 * record either side knows about.
 *
 * Additive by design. The old rule replaced local progress with the file's
 * whenever the file was not empty, which meant one failed write — the app closed
 * mid-request, the disk full, a second tab racing — was enough for the next load
 * to overwrite everything logged since. Losing a learner's evidence log is not a
 * recoverable error, so the merge never drops a record.
 *
 * The cost is that a record deleted on one side while the other side was offline
 * can come back once, which is a re-deletion rather than a loss. `local` wins
 * field-level conflicts (an edited evidence entry, the lesson just opened),
 * because it is the side the learner is looking at.
 */
export function mergeProgressState(local: ProgressState, server: ProgressState): ProgressState {
  return normalizeProgressState({
    version: 1,
    completedLessons: [...local.completedLessons, ...server.completedLessons],
    lastVisitedLesson: local.lastVisitedLesson ?? server.lastVisitedLesson,
    activityDays: [...local.activityDays, ...server.activityDays],
    // Local first: normalizeEvidenceList keeps the first entry it sees for an id,
    // so a local edit survives a stale copy of the same entry on disk.
    evidence: [...local.evidence, ...server.evidence],
    reachedMilestones: [...local.reachedMilestones, ...server.reachedMilestones],
    reviewedPlans: [...local.reviewedPlans, ...server.reviewedPlans],
  });
}

/**
 * Whether two normalized states hold the same records, so a sync can skip
 * writing and re-rendering when nothing actually changed.
 */
export function progressStatesEqual(left: ProgressState, right: ProgressState): boolean {
  return (
    left.lastVisitedLesson === right.lastVisitedLesson &&
    sameStrings(left.completedLessons, right.completedLessons) &&
    sameStrings(left.activityDays, right.activityDays) &&
    sameStrings(left.reachedMilestones, right.reachedMilestones) &&
    sameStrings(left.reviewedPlans, right.reviewedPlans) &&
    sameEvidence(left.evidence, right.evidence)
  );
}

/** Validate a list of evidence entries: drop what cannot be trusted, newest first. */
export function normalizeEvidenceList(value: unknown): EvidenceEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const entries: EvidenceEntry[] = [];

  for (const item of value) {
    const entry = normalizeEvidenceEntry(item);

    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id);
      entries.push(entry);
    }
  }

  return sortNewestFirst(entries).slice(0, MAX_EVIDENCE_ENTRIES);
}

/** Add an entry, or replace the existing one with the same id (an edit). */
export function addEvidenceEntry(evidence: EvidenceEntry[], entry: EvidenceEntry): EvidenceEntry[] {
  const withoutDuplicate = evidence.filter((existing) => existing.id !== entry.id);
  return sortNewestFirst([entry, ...withoutDuplicate]).slice(0, MAX_EVIDENCE_ENTRIES);
}

/** Add or remove one id from a sorted, duplicate-free list. */
export function setMembership(values: string[], value: string, include: boolean): string[] {
  const next = new Set(values);

  if (include) {
    next.add(value);
  } else {
    next.delete(value);
  }

  return [...next].sort().slice(0, MAX_ID_ENTRIES);
}

/** Record one day of activity, keeping the list sorted and bounded. */
export function addActivityDay(days: string[], day: string): string[] {
  return [...new Set([...days, day])].sort().slice(-MAX_ACTIVITY_DAYS);
}

/** Read a lesson slug, milestone id, or plan id, or "" when it cannot be trusted. */
export function readProgressId(value: unknown): string {
  const id = typeof value === "string" ? value.trim() : "";
  return id.length <= MAX_ID_LENGTH ? id : "";
}

/** Read a YYYY-MM-DD calendar date, or "" when the value is not one. */
export function readProgressDate(value: unknown): string {
  const date = typeof value === "string" ? value.trim() : "";
  return isCalendarDate(date) ? date : "";
}

function readIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const ids = value.map((item) => readProgressId(item)).filter(Boolean);
  return [...new Set(ids)].sort().slice(0, MAX_ID_ENTRIES);
}

function readActivityDayList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const days = value.map((item) => readProgressDate(item)).filter(Boolean);
  return [...new Set(days)].sort().slice(-MAX_ACTIVITY_DAYS);
}

function sortNewestFirst(entries: EvidenceEntry[]): EvidenceEntry[] {
  return [...entries].sort((left, right) => right.date.localeCompare(left.date));
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Compare entries field by field. Every entry on both sides came out of
 * `normalizeEvidenceEntry`, which builds its object in one fixed key order, so
 * serializing is a faithful comparison here — and unlike a hand-written field
 * list it cannot silently ignore a field added to EvidenceEntry later.
 */
function sameEvidence(left: readonly EvidenceEntry[], right: readonly EvidenceEntry[]): boolean {
  return (
    left.length === right.length &&
    left.every((entry, index) => JSON.stringify(entry) === JSON.stringify(right[index]))
  );
}
