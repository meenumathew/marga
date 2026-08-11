import { describe, expect, it } from "vitest";

import type { EvidenceEntry } from "./evidence";
import {
  addActivityDay,
  addEvidenceEntry,
  createEmptyProgressState,
  hasProgress,
  MAX_ACTIVITY_DAYS,
  MAX_EVIDENCE_ENTRIES,
  MAX_ID_ENTRIES,
  MAX_ID_LENGTH,
  mergeProgressState,
  normalizeProgressState,
  type ProgressState,
  progressStatesEqual,
  readProgressDate,
  readProgressId,
  setMembership,
} from "./progress-state";

function makeEvidence(overrides: Partial<EvidenceEntry> = {}): EvidenceEntry {
  return {
    id: "ev-1",
    date: "2026-07-01",
    kind: "Build",
    title: "Shipped the parser",
    sectionSlug: "",
    section: "",
    source: "",
    link: "",
    note: "",
    ...overrides,
  };
}

function stateWith(overrides: Partial<ProgressState> = {}): ProgressState {
  return { ...createEmptyProgressState(), ...overrides };
}

/** Consecutive calendar days from 2024-01-01, so cap tests use real dates. */
function calendarDays(count: number): string[] {
  const start = Date.UTC(2024, 0, 1);
  return Array.from({ length: count }, (_, offset) =>
    new Date(start + offset * 86_400_000).toISOString().slice(0, 10),
  );
}

describe("normalizeProgressState", () => {
  it("test_non_object_state_becomes_an_empty_state", () => {
    expect(normalizeProgressState(null)).toEqual(createEmptyProgressState());
    expect(normalizeProgressState("progress")).toEqual(createEmptyProgressState());
  });

  it("test_duplicate_ids_are_deduped_and_sorted", () => {
    const state = normalizeProgressState({ completedLessons: ["b", "a", "b"] });

    expect(state.completedLessons).toEqual(["a", "b"]);
  });

  it("test_over_long_id_is_dropped_from_every_id_list", () => {
    const tooLong = "x".repeat(MAX_ID_LENGTH + 1);

    const state = normalizeProgressState({
      completedLessons: ["kept", tooLong],
      reachedMilestones: [tooLong],
      reviewedPlans: [tooLong],
      lastVisitedLesson: tooLong,
    });

    expect(state.completedLessons).toEqual(["kept"]);
    expect(state.reachedMilestones).toEqual([]);
    expect(state.reviewedPlans).toEqual([]);
    expect(state.lastVisitedLesson).toBeNull();
  });

  it("test_id_at_the_length_limit_is_kept", () => {
    const atLimit = "x".repeat(MAX_ID_LENGTH);

    expect(normalizeProgressState({ completedLessons: [atLimit] }).completedLessons).toEqual([
      atLimit,
    ]);
  });

  it("test_id_lists_are_capped", () => {
    const ids = Array.from({ length: MAX_ID_ENTRIES + 5 }, (_, index) => `lesson-${index}`);

    expect(normalizeProgressState({ completedLessons: ids }).completedLessons).toHaveLength(
      MAX_ID_ENTRIES,
    );
  });

  it("test_impossible_activity_day_is_dropped", () => {
    const state = normalizeProgressState({
      activityDays: ["2026-07-01", "2026-02-31", "yesterday", ""],
    });

    expect(state.activityDays).toEqual(["2026-07-01"]);
  });

  it("test_activity_days_are_capped_to_the_most_recent", () => {
    const days = calendarDays(MAX_ACTIVITY_DAYS + 10);

    const state = normalizeProgressState({ activityDays: days });

    expect(state.activityDays).toHaveLength(MAX_ACTIVITY_DAYS);
    expect(state.activityDays.at(-1)).toBe(days.at(-1));
    expect(state.activityDays).not.toContain(days[0]);
  });

  it("test_evidence_is_deduped_by_id_newest_first", () => {
    const state = normalizeProgressState({
      evidence: [
        makeEvidence({ id: "ev-1", date: "2026-06-01", title: "First write" }),
        makeEvidence({ id: "ev-2", date: "2026-07-01" }),
        makeEvidence({ id: "ev-1", date: "2026-06-01", title: "Duplicate ignored" }),
        { id: "ev-3", title: "No date" },
      ],
    });

    expect(state.evidence.map((entry) => entry.id)).toEqual(["ev-2", "ev-1"]);
    expect(state.evidence[1]?.title).toBe("First write");
  });

  it("test_evidence_is_capped_to_the_most_recent", () => {
    const days = calendarDays(MAX_EVIDENCE_ENTRIES + 5);
    const evidence = days.map((date, index) => makeEvidence({ id: `ev-${index}`, date }));

    const state = normalizeProgressState({ evidence });

    expect(state.evidence).toHaveLength(MAX_EVIDENCE_ENTRIES);
    expect(state.evidence[0]?.date).toBe(days.at(-1));
  });

  it("test_blank_last_visited_lesson_becomes_null", () => {
    expect(normalizeProgressState({ lastVisitedLesson: "   " }).lastVisitedLesson).toBeNull();
    expect(normalizeProgressState({ lastVisitedLesson: " intro " }).lastVisitedLesson).toBe(
      "intro",
    );
  });
});

describe("hasProgress", () => {
  it("test_empty_state_holds_no_progress", () => {
    expect(hasProgress(createEmptyProgressState())).toBe(false);
  });

  it("test_a_single_activity_day_counts_as_progress", () => {
    expect(hasProgress(stateWith({ activityDays: ["2026-07-01"] }))).toBe(true);
  });

  it("test_a_last_visited_lesson_counts_as_progress", () => {
    expect(hasProgress(stateWith({ lastVisitedLesson: "intro" }))).toBe(true);
  });
});

describe("mergeProgressState", () => {
  it("test_merge_unions_completed_lessons", () => {
    const local = stateWith({ completedLessons: ["a"] });
    const server = stateWith({ completedLessons: ["b"] });

    expect(mergeProgressState(local, server).completedLessons).toEqual(["a", "b"]);
  });

  it("test_merge_unions_activity_days_milestones_and_plans", () => {
    const local = stateWith({
      activityDays: ["2026-07-01"],
      reachedMilestones: ["m-local"],
      reviewedPlans: ["p-local"],
    });
    const server = stateWith({
      activityDays: ["2026-06-30"],
      reachedMilestones: ["m-server"],
      reviewedPlans: ["p-server"],
    });

    const merged = mergeProgressState(local, server);

    expect(merged.activityDays).toEqual(["2026-06-30", "2026-07-01"]);
    expect(merged.reachedMilestones).toEqual(["m-local", "m-server"]);
    expect(merged.reviewedPlans).toEqual(["p-local", "p-server"]);
  });

  it("test_merge_keeps_the_local_edit_of_a_shared_evidence_entry", () => {
    const local = stateWith({ evidence: [makeEvidence({ title: "Edited locally" })] });
    const server = stateWith({ evidence: [makeEvidence({ title: "Stale on disk" })] });

    const merged = mergeProgressState(local, server);

    expect(merged.evidence).toHaveLength(1);
    expect(merged.evidence[0]?.title).toBe("Edited locally");
  });

  it("test_merge_keeps_evidence_only_the_server_has", () => {
    const local = stateWith({ evidence: [makeEvidence({ id: "ev-local" })] });
    const server = stateWith({ evidence: [makeEvidence({ id: "ev-server" })] });

    expect(
      mergeProgressState(local, server)
        .evidence.map((entry) => entry.id)
        .sort(),
    ).toEqual(["ev-local", "ev-server"]);
  });

  it("test_merge_prefers_the_local_last_visited_lesson", () => {
    const local = stateWith({ lastVisitedLesson: "just-opened" });
    const server = stateWith({ lastVisitedLesson: "opened-last-week" });

    expect(mergeProgressState(local, server).lastVisitedLesson).toBe("just-opened");
  });

  it("test_merge_falls_back_to_the_server_last_visited_lesson", () => {
    const server = stateWith({ lastVisitedLesson: "opened-last-week" });

    expect(mergeProgressState(createEmptyProgressState(), server).lastVisitedLesson).toBe(
      "opened-last-week",
    );
  });

  it("test_merge_of_an_empty_local_state_returns_the_server_state", () => {
    const server = stateWith({
      completedLessons: ["a"],
      activityDays: ["2026-07-01"],
      evidence: [makeEvidence()],
    });

    expect(mergeProgressState(createEmptyProgressState(), server)).toEqual(server);
  });

  it("test_merge_of_an_empty_server_state_keeps_local_progress", () => {
    const local = stateWith({ completedLessons: ["a"], activityDays: ["2026-07-01"] });

    expect(mergeProgressState(local, createEmptyProgressState())).toEqual(local);
  });
});

describe("progressStatesEqual", () => {
  it("test_states_with_the_same_contents_are_equal", () => {
    const evidence = [makeEvidence()];

    expect(
      progressStatesEqual(
        stateWith({ completedLessons: ["a"], evidence }),
        stateWith({ completedLessons: ["a"], evidence: [makeEvidence()] }),
      ),
    ).toBe(true);
  });

  it("test_states_differ_when_one_holds_an_extra_lesson", () => {
    expect(progressStatesEqual(stateWith({ completedLessons: ["a"] }), stateWith({}))).toBe(false);
  });

  it("test_states_differ_when_an_evidence_field_changed", () => {
    expect(
      progressStatesEqual(
        stateWith({ evidence: [makeEvidence({ title: "Before" })] }),
        stateWith({ evidence: [makeEvidence({ title: "After" })] }),
      ),
    ).toBe(false);
  });
});

describe("addActivityDay", () => {
  it("test_activity_day_is_recorded_once", () => {
    expect(addActivityDay(["2026-07-01"], "2026-07-01")).toEqual(["2026-07-01"]);
  });

  it("test_activity_days_stay_sorted_and_capped", () => {
    const days = calendarDays(MAX_ACTIVITY_DAYS);

    const next = addActivityDay(days, "2026-07-01");

    expect(next).toHaveLength(MAX_ACTIVITY_DAYS);
    expect(next.at(-1)).toBe("2026-07-01");
    expect(next).not.toContain(days[0]);
  });
});

describe("setMembership", () => {
  it("test_membership_adds_a_value_and_sorts", () => {
    expect(setMembership(["b"], "a", true)).toEqual(["a", "b"]);
  });

  it("test_membership_removes_a_value", () => {
    expect(setMembership(["a", "b"], "a", false)).toEqual(["b"]);
  });
});

describe("addEvidenceEntry", () => {
  it("test_evidence_entry_replaces_the_same_id_in_place", () => {
    const existing = [makeEvidence({ title: "Before" })];

    const next = addEvidenceEntry(existing, makeEvidence({ title: "After" }));

    expect(next).toHaveLength(1);
    expect(next[0]?.title).toBe("After");
  });

  it("test_evidence_entries_stay_newest_first", () => {
    const existing = [makeEvidence({ id: "ev-old", date: "2026-06-01" })];

    const next = addEvidenceEntry(existing, makeEvidence({ id: "ev-new", date: "2026-07-01" }));

    expect(next.map((entry) => entry.id)).toEqual(["ev-new", "ev-old"]);
  });
});

describe("readProgressId and readProgressDate", () => {
  it("test_progress_id_is_trimmed", () => {
    expect(readProgressId("  intro  ")).toBe("intro");
  });

  it("test_over_long_progress_id_is_refused", () => {
    expect(readProgressId("x".repeat(MAX_ID_LENGTH + 1))).toBe("");
  });

  it("test_non_string_progress_id_is_refused", () => {
    expect(readProgressId(42)).toBe("");
  });

  it("test_progress_date_must_be_a_calendar_date", () => {
    expect(readProgressDate("2026-07-01")).toBe("2026-07-01");
    expect(readProgressDate("2026-02-31")).toBe("");
    expect(readProgressDate(null)).toBe("");
  });
});
