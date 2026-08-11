/**
 * Evidence is what turns this from a reading tracker into a mastery tracker:
 * a record the learner creates when they *produce* something (a build, a
 * refactor, a write-up, a talk) or *receive feedback* from someone else. The
 * scorecard rewards this — not just notes read — so "evidence only" is real.
 *
 * This module is shared by the client progress store and the server progress
 * API, so both validate evidence the same way. It is pure (no window/fs) and
 * safe to import from either side.
 */

import { isSameSitePath } from "./content-utils";
import { isCalendarDate } from "./calendar-date";

export const EVIDENCE_KINDS = [
  "Build",
  "Refactor",
  "Writeup",
  "Explainer",
  "Talk",
  "Feedback",
  "Other",
] as const;

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export type EvidenceEntry = {
  /** Stable client-generated id. */
  id: string;
  /** ISO date the evidence was logged (YYYY-MM-DD). */
  date: string;
  kind: EvidenceKind;
  /** What you made or were told, in a few words. */
  title: string;
  /** Stable section slug this evidence supports, or "" when unattached. */
  sectionSlug: string;
  /** Section title shown in the evidence log. Kept for display and migration. */
  section: string;
  /** For Feedback: who gave it (mentor, reviewer, teammate). "" otherwise. */
  source: string;
  /** Optional link: a site-relative path or an http(s) URL (e.g. a PR). */
  link: string;
  /** Optional short detail. */
  note: string;
};

function readTrimmed(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/**
 * Only same-site paths ("/...") and http(s) URLs are allowed, so a logged link
 * can never become a `javascript:` or other active-content href on the page.
 *
 * `isSameSitePath` does the path check, so "//host", "/\host", and control
 * characters are all refused; each of those resolves off-site in a browser
 * despite starting with a single slash.
 */
export function sanitizeEvidenceLink(value: unknown): string {
  const link = typeof value === "string" ? value.trim() : "";

  if (!link) {
    return "";
  }

  if (isSameSitePath(link)) {
    return link.slice(0, 500);
  }

  if (/^https?:\/\//i.test(link)) {
    return link.slice(0, 500);
  }

  return "";
}

/** Validate an unknown value into an EvidenceEntry, or null if it cannot be trusted. */
export function normalizeEvidenceEntry(value: unknown): EvidenceEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const id = readTrimmed(candidate.id, 120);
  const title = readTrimmed(candidate.title, 200);
  const date = readTrimmed(candidate.date, 10);

  if (!id || !title || !isCalendarDate(date)) {
    return null;
  }

  const rawKind = readTrimmed(candidate.kind, 40);
  const kind = (EVIDENCE_KINDS as readonly string[]).includes(rawKind)
    ? (rawKind as EvidenceKind)
    : "Other";

  return {
    id,
    date,
    kind,
    title,
    sectionSlug: readTrimmed(candidate.sectionSlug, 120),
    section: readTrimmed(candidate.section, 120),
    source: readTrimmed(candidate.source, 120),
    link: sanitizeEvidenceLink(candidate.link),
    note: readTrimmed(candidate.note, 400),
  };
}

/** Feedback received from another person — the mentorship signal. */
export function isFeedbackEvidence(entry: EvidenceEntry): boolean {
  return entry.kind === "Feedback";
}
