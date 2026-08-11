"use client";

import { useSyncExternalStore } from "react";
import { site } from "@/config/site";
import { isCalendarDate, localDateStamp } from "@/lib/calendar-date";
import { type EvidenceEntry, type EvidenceKind, normalizeEvidenceEntry } from "@/lib/evidence";
import {
  addActivityDay,
  addEvidenceEntry,
  mergeProgressState,
  normalizeProgressState,
  type ProgressState,
  progressStatesEqual,
} from "@/lib/progress-state";

type ProgressAction =
  | { action: "setLessonComplete"; slug: string; completed: boolean; date: string }
  | { action: "recordLessonVisit"; slug: string; date: string }
  | { action: "addEvidence"; entry: EvidenceEntry; date: string }
  | { action: "updateEvidence"; entry: EvidenceEntry }
  | { action: "deleteEvidence"; id: string }
  | { action: "setMilestoneReached"; id: string; reached: boolean; date: string }
  | { action: "setPlanReviewed"; id: string; reviewed: boolean; date: string }
  | { action: "replace"; state: ProgressState };

const completedKey = `${site.storagePrefix}-completed-lessons`;
const lastVisitedKey = `${site.storagePrefix}-last-visited-lesson`;
const activityKey = `${site.storagePrefix}-activity-days`;
const evidenceKey = `${site.storagePrefix}-evidence`;
const reachedMilestonesKey = `${site.storagePrefix}-reached-milestones`;
const reviewedPlansKey = `${site.storagePrefix}-reviewed-plans`;
const progressEvent = `${site.storagePrefix}-progress-change`;

const EMPTY_COMPLETED: ReadonlySet<string> = new Set();
const EMPTY_DAYS: readonly string[] = [];
const EMPTY_EVIDENCE: readonly EvidenceEntry[] = [];
const EMPTY_SET: ReadonlySet<string> = new Set();

let hasRequestedServerProgress = false;
let localMutationVersion = 0;
let progressActionQueue: Promise<void> = Promise.resolve();

/**
 * Set when the mirror refuses or never answers an action. localStorage still
 * holds the change, so nothing is lost; the next action that does get through
 * pushes the whole state up to repair the file.
 */
let hasUnmirroredChanges = false;

let cachedCompletedRaw: string | null = null;
let cachedCompleted: ReadonlySet<string> = EMPTY_COMPLETED;

function readCompleted(): ReadonlySet<string> {
  const raw = window.localStorage.getItem(completedKey);

  if (raw !== cachedCompletedRaw) {
    cachedCompletedRaw = raw;
    let slugs: string[] = [];

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;

        if (Array.isArray(parsed)) {
          slugs = parsed.filter((value): value is string => typeof value === "string");
        }
      } catch {
        window.localStorage.removeItem(completedKey);
      }
    }

    cachedCompleted = new Set(slugs);
  }

  return cachedCompleted;
}

function readLastVisited(): string | null {
  const lastVisited = window.localStorage.getItem(lastVisitedKey)?.trim() ?? "";
  return lastVisited || null;
}

let cachedDaysRaw: string | null = null;
let cachedDays: readonly string[] = EMPTY_DAYS;

function readActivityDays(): readonly string[] {
  const raw = window.localStorage.getItem(activityKey);

  if (raw !== cachedDaysRaw) {
    cachedDaysRaw = raw;
    let days: string[] = [];

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;

        if (Array.isArray(parsed)) {
          days = parsed
            .filter((value): value is string => typeof value === "string")
            .filter(isCalendarDate);
        }
      } catch {
        window.localStorage.removeItem(activityKey);
      }
    }

    cachedDays = days;
  }

  return cachedDays;
}

let cachedEvidenceRaw: string | null = null;
let cachedEvidence: readonly EvidenceEntry[] = EMPTY_EVIDENCE;

function readEvidence(): readonly EvidenceEntry[] {
  const raw = window.localStorage.getItem(evidenceKey);

  if (raw !== cachedEvidenceRaw) {
    cachedEvidenceRaw = raw;
    let entries: EvidenceEntry[] = [];

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;

        if (Array.isArray(parsed)) {
          entries = parsed
            .map((value) => normalizeEvidenceEntry(value))
            .filter((entry): entry is EvidenceEntry => entry !== null);
        }
      } catch {
        window.localStorage.removeItem(evidenceKey);
      }
    }

    // Newest first, so the log and dashboard show recent work at the top.
    cachedEvidence = entries.sort((a, b) => b.date.localeCompare(a.date));
  }

  return cachedEvidence;
}

let cachedReachedRaw: string | null = null;
let cachedReached: ReadonlySet<string> = EMPTY_SET;

function readReachedMilestones(): ReadonlySet<string> {
  const raw = window.localStorage.getItem(reachedMilestonesKey);

  if (raw !== cachedReachedRaw) {
    cachedReachedRaw = raw;
    cachedReached = parseStringSet(raw, reachedMilestonesKey);
  }

  return cachedReached;
}

let cachedReviewedRaw: string | null = null;
let cachedReviewed: ReadonlySet<string> = EMPTY_SET;

function readReviewedPlans(): ReadonlySet<string> {
  const raw = window.localStorage.getItem(reviewedPlansKey);

  if (raw !== cachedReviewedRaw) {
    cachedReviewedRaw = raw;
    cachedReviewed = parseStringSet(raw, reviewedPlansKey);
  }

  return cachedReviewed;
}

function parseStringSet(raw: string | null, keyToClearOnError: string): ReadonlySet<string> {
  if (!raw) {
    return EMPTY_SET;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((value): value is string => typeof value === "string"));
    }
  } catch {
    window.localStorage.removeItem(keyToClearOnError);
  }

  return EMPTY_SET;
}

function recordActivityToday(): string {
  const today = localDateStamp(new Date());
  const days = readActivityDays();

  if (!days.includes(today)) {
    window.localStorage.setItem(activityKey, JSON.stringify(addActivityDay([...days], today)));
  }

  return today;
}

/** Consecutive-day streak ending today (or yesterday, so a streak survives until midnight). */
export function computeStreak(days: readonly string[]): number {
  const known = new Set(days);
  const cursor = new Date();
  let streak = 0;

  if (!known.has(localDateStamp(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (known.has(localDateStamp(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function subscribe(onChange: () => void): () => void {
  ensureServerProgressLoaded();
  window.addEventListener("storage", onChange);
  window.addEventListener(progressEvent, onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(progressEvent, onChange);
  };
}

function notifyChange(): void {
  window.dispatchEvent(new Event(progressEvent));
}

/**
 * Everything this browser holds, in the same shape and order the mirror uses, so
 * the two can be merged and compared without one side's ordering counting as a
 * difference.
 */
function readLocalProgressState(): ProgressState {
  return normalizeProgressState({
    version: 1,
    completedLessons: [...readCompleted()],
    lastVisitedLesson: readLastVisited(),
    activityDays: [...readActivityDays()],
    evidence: [...readEvidence()],
    reachedMilestones: [...readReachedMilestones()],
    reviewedPlans: [...readReviewedPlans()],
  });
}

function applyProgressState(value: unknown): void {
  const state = normalizeProgressState(value);

  window.localStorage.setItem(completedKey, JSON.stringify(state.completedLessons));

  if (state.lastVisitedLesson) {
    window.localStorage.setItem(lastVisitedKey, state.lastVisitedLesson);
  } else {
    window.localStorage.removeItem(lastVisitedKey);
  }

  window.localStorage.setItem(activityKey, JSON.stringify(state.activityDays));
  window.localStorage.setItem(evidenceKey, JSON.stringify(state.evidence));
  window.localStorage.setItem(reachedMilestonesKey, JSON.stringify(state.reachedMilestones));
  window.localStorage.setItem(reviewedPlansKey, JSON.stringify(state.reviewedPlans));
  notifyChange();
}

/**
 * Reconcile this browser with the mirror file once per page load.
 *
 * Both sides can hold records the other has never seen: the file carries what
 * another browser (or an earlier profile) recorded, and localStorage carries
 * anything logged while the mirror was unreachable. So the two are merged and
 * whichever side is now behind is brought up to the result.
 */
function ensureServerProgressLoaded(): void {
  if (hasRequestedServerProgress) {
    return;
  }

  hasRequestedServerProgress = true;
  const localState = readLocalProgressState();
  const requestMutationVersion = localMutationVersion;

  fetch("/api/progress")
    .then(async (response) => {
      if (!response.ok) {
        console.warn(`marga: could not read mirrored progress (${response.status})`);
        return;
      }

      const serverState = normalizeProgressState(await response.json());

      // A local change landed while this request was in flight, so the snapshot
      // above is stale. The next action's response reconciles instead.
      if (requestMutationVersion !== localMutationVersion) {
        return;
      }

      const merged = mergeProgressState(localState, serverState);

      if (!progressStatesEqual(merged, localState)) {
        applyProgressState(merged);
      }

      if (!progressStatesEqual(merged, serverState)) {
        queueProgressAction({ action: "replace", state: merged });
      }
    })
    .catch((error: unknown) => {
      console.warn("marga: progress mirror unreachable on load", error);
    });
}

function queueProgressAction(action: ProgressAction): void {
  progressActionQueue = progressActionQueue
    .then(() => sendProgressAction(action))
    .catch((error: unknown) => {
      hasUnmirroredChanges = true;
      console.warn(`marga: progress ${action.action} was not mirrored`, error);
    });
}

/**
 * Mirror one action to the state file and fold the result back in.
 *
 * The response is merged rather than applied: it reflects the file, which is
 * missing anything an earlier failed action never got to write. Applying it
 * outright would delete those records from this browser too — the one copy left.
 */
async function sendProgressAction(action: ProgressAction): Promise<void> {
  let response: Response;

  try {
    response = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action),
    });
  } catch (error) {
    hasUnmirroredChanges = true;
    console.warn(`marga: progress mirror unreachable, keeping ${action.action} locally`, error);
    return;
  }

  if (!response.ok) {
    hasUnmirroredChanges = true;
    console.warn(`marga: progress ${action.action} was refused (${response.status})`);
    return;
  }

  const localState = readLocalProgressState();
  const merged = mergeProgressState(localState, normalizeProgressState(await response.json()));

  if (!progressStatesEqual(merged, localState)) {
    applyProgressState(merged);
  }

  if (action.action === "replace") {
    hasUnmirroredChanges = false;
  } else if (hasUnmirroredChanges) {
    // The mirror answers again: push the full state so the records the failed
    // action never wrote stop living only in this browser.
    hasUnmirroredChanges = false;
    queueProgressAction({ action: "replace", state: merged });
  }
}

/** Slugs of lessons the learner marked complete, live-updated across components. */
export function useCompletedLessons(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, readCompleted, () => EMPTY_COMPLETED);
}

/** Slug of the most recently opened lesson, or null before the first visit. */
export function useLastVisitedLesson(): string | null {
  return useSyncExternalStore(subscribe, readLastVisited, () => null);
}

/** Local dates (YYYY-MM-DD) on which the learner opened or completed a lesson. */
export function useActivityDays(): readonly string[] {
  return useSyncExternalStore(subscribe, readActivityDays, () => EMPTY_DAYS);
}

/** Outputs and feedback the learner has logged, newest first. */
export function useEvidence(): readonly EvidenceEntry[] {
  return useSyncExternalStore(subscribe, readEvidence, () => EMPTY_EVIDENCE);
}

/** Milestone ids the learner has confirmed reached. */
export function useReachedMilestones(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, readReachedMilestones, () => EMPTY_SET);
}

/** Plan-review ids the learner has confirmed reviewed. */
export function useReviewedPlans(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, readReviewedPlans, () => EMPTY_SET);
}

export function toggleLessonComplete(slug: string): void {
  const next = new Set(readCompleted());
  let completed = false;

  if (next.has(slug)) {
    next.delete(slug);
  } else {
    next.add(slug);
    completed = true;
  }

  localMutationVersion += 1;
  window.localStorage.setItem(completedKey, JSON.stringify([...next].sort()));
  const activityDay = recordActivityToday();
  notifyChange();
  queueProgressAction({ action: "setLessonComplete", slug, completed, date: activityDay });
}

export function recordLessonVisit(slug: string): void {
  localMutationVersion += 1;
  window.localStorage.setItem(lastVisitedKey, slug);
  const activityDay = recordActivityToday();
  notifyChange();
  queueProgressAction({ action: "recordLessonVisit", slug, date: activityDay });
}

/** Draft an evidence entry (id and date are stamped here) and record it. */
export type EvidenceDraft = {
  kind: EvidenceKind;
  title: string;
  sectionSlug?: string;
  section?: string;
  source?: string;
  link?: string;
  note?: string;
};

/**
 * A stable unique id. Prefers crypto.randomUUID, but that throws outside a
 * secure context (plain http on a LAN ip), so fall back to a timestamp+random id.
 */
function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // Not a secure context — use the fallback below.
    }
  }

  return `ev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function addEvidence(draft: EvidenceDraft): EvidenceEntry | null {
  const today = localDateStamp(new Date());
  const entry = normalizeEvidenceEntry({
    id: generateId(),
    date: today,
    kind: draft.kind,
    title: draft.title,
    sectionSlug: draft.sectionSlug ?? "",
    section: draft.section ?? "",
    source: draft.source ?? "",
    link: draft.link ?? "",
    note: draft.note ?? "",
  });

  if (!entry) {
    return null;
  }

  localMutationVersion += 1;
  const next = addEvidenceEntry([...readEvidence()], entry);
  window.localStorage.setItem(evidenceKey, JSON.stringify(next));
  const activityDay = recordActivityToday();
  notifyChange();
  queueProgressAction({ action: "addEvidence", entry, date: activityDay });
  return entry;
}

/** Edit an existing entry. Keeps its id and original log date; only the fields change. */
export function updateEvidence(id: string, draft: EvidenceDraft): EvidenceEntry | null {
  const existing = readEvidence().find((entry) => entry.id === id);

  if (!existing) {
    return null;
  }

  const entry = normalizeEvidenceEntry({
    id,
    date: existing.date,
    kind: draft.kind,
    title: draft.title,
    sectionSlug: draft.sectionSlug ?? "",
    section: draft.section ?? "",
    source: draft.source ?? "",
    link: draft.link ?? "",
    note: draft.note ?? "",
  });

  if (!entry) {
    return null;
  }

  localMutationVersion += 1;
  // Upsert by id, so an edit replaces the entry rather than adding a second one.
  const next = addEvidenceEntry([...readEvidence()], entry);
  window.localStorage.setItem(evidenceKey, JSON.stringify(next));
  notifyChange();
  queueProgressAction({ action: "updateEvidence", entry });
  return entry;
}

export function deleteEvidence(id: string): void {
  localMutationVersion += 1;
  const next = readEvidence().filter((entry) => entry.id !== id);
  window.localStorage.setItem(evidenceKey, JSON.stringify(next));
  notifyChange();
  queueProgressAction({ action: "deleteEvidence", id });
}

export function toggleMilestoneReached(id: string): void {
  const next = new Set(readReachedMilestones());
  const reached = !next.has(id);

  if (reached) {
    next.add(id);
  } else {
    next.delete(id);
  }

  localMutationVersion += 1;
  window.localStorage.setItem(reachedMilestonesKey, JSON.stringify([...next].sort()));
  const activityDay = recordActivityToday();
  notifyChange();
  queueProgressAction({ action: "setMilestoneReached", id, reached, date: activityDay });
}

export function togglePlanReviewed(id: string): void {
  const next = new Set(readReviewedPlans());
  const reviewed = !next.has(id);

  if (reviewed) {
    next.add(id);
  } else {
    next.delete(id);
  }

  localMutationVersion += 1;
  window.localStorage.setItem(reviewedPlansKey, JSON.stringify([...next].sort()));
  const activityDay = recordActivityToday();
  notifyChange();
  queueProgressAction({ action: "setPlanReviewed", id, reviewed, date: activityDay });
}
