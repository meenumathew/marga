import { describe, expect, it } from "vitest";
import { deriveAchievements, type Achievement } from "@/lib/achievements";
import type { EvidenceEntry, EvidenceKind } from "@/lib/evidence";

type Lesson = { slug: string; section: string; sectionSlug: string };

function lesson(slug: string, sectionSlug: string, section = sectionSlug): Lesson {
  return { slug, sectionSlug, section };
}

function evidence(partial: Partial<EvidenceEntry> & { kind?: EvidenceKind }): EvidenceEntry {
  return {
    id: partial.id ?? `ev-${Math.random()}`,
    date: partial.date ?? "2026-07-03",
    kind: partial.kind ?? "Build",
    title: partial.title ?? "Did a thing",
    sectionSlug: partial.sectionSlug ?? "",
    section: partial.section ?? "",
    source: partial.source ?? "",
    link: partial.link ?? "",
    note: partial.note ?? "",
  };
}

/** Run deriveAchievements with sensible empty defaults, overriding only what a test cares about. */
function derive(input: Partial<Parameters<typeof deriveAchievements>[0]> = {}): Achievement[] {
  return deriveAchievements({
    lessons: [],
    completed: new Set<string>(),
    streak: 0,
    evidence: [],
    milestones: [],
    reachedMilestones: new Set<string>(),
    planReviews: [],
    reviewedPlans: new Set<string>(),
    ...input,
  });
}

function badge(list: Achievement[], id: string): Achievement {
  const found = list.find((achievement) => achievement.id === id);

  if (!found) {
    throw new Error(`No achievement with id "${id}". Have: ${list.map((a) => a.id).join(", ")}`);
  }

  return found;
}

describe("reading badges", () => {
  it("locks the first note until one is read, then unlocks", () => {
    const lessons = [lesson("a", "practice")];
    expect(badge(derive({ lessons }), "first-lesson").achieved).toBe(false);
    expect(badge(derive({ lessons, completed: new Set(["a"]) }), "first-lesson").achieved).toBe(
      true,
    );
  });

  it("unlocks a lesson tier at its threshold", () => {
    const lessons = Array.from({ length: 5 }, (_, i) => lesson(`l${i}`, "practice"));
    const completed = new Set(lessons.slice(0, 5).map((l) => l.slug));
    expect(badge(derive({ lessons, completed }), "lessons-5").achieved).toBe(true);
    expect(badge(derive({ lessons, completed: new Set(["l0"]) }), "lessons-5").achieved).toBe(
      false,
    );
  });
});

describe("evidence badges", () => {
  it("unlocks once the first piece of evidence is logged", () => {
    expect(badge(derive(), "first-evidence").achieved).toBe(false);
    expect(badge(derive({ evidence: [evidence({})] }), "first-evidence").achieved).toBe(true);
  });

  it("counts only Feedback-kind evidence toward feedback badges", () => {
    const builds = [evidence({ kind: "Build" }), evidence({ kind: "Refactor" })];
    expect(badge(derive({ evidence: builds }), "first-feedback").achieved).toBe(false);

    const withFeedback = [...builds, evidence({ kind: "Feedback", source: "Mentor" })];
    expect(badge(derive({ evidence: withFeedback }), "first-feedback").achieved).toBe(true);
  });
});

describe("section read-all vs mastery", () => {
  const lessons = [lesson("a", "practice", "Practice"), lesson("b", "practice", "Practice")];
  const readAll = new Set(["a", "b"]);

  it("marks read-all when every note in the section is complete", () => {
    expect(badge(derive({ lessons, completed: readAll }), "section-read-practice").achieved).toBe(
      true,
    );
    expect(
      badge(derive({ lessons, completed: new Set(["a"]) }), "section-read-practice").achieved,
    ).toBe(false);
  });

  it("does NOT master a section from reading alone — evidence is required", () => {
    expect(
      badge(derive({ lessons, completed: readAll }), "section-mastery-practice").achieved,
    ).toBe(false);
  });

  it("masters a section only when read-all AND evidence in that section", () => {
    const result = derive({
      lessons,
      completed: readAll,
      evidence: [evidence({ sectionSlug: "practice", section: "Practice" })],
    });
    expect(badge(result, "section-mastery-practice").achieved).toBe(true);
  });

  it("does not master when evidence belongs to a different section", () => {
    const result = derive({
      lessons,
      completed: readAll,
      evidence: [evidence({ sectionSlug: "career", section: "Career" })],
    });
    expect(badge(result, "section-mastery-practice").achieved).toBe(false);
  });

  it("stays locked if evidence exists but the section is not fully read", () => {
    const result = derive({
      lessons,
      completed: new Set(["a"]),
      evidence: [evidence({ sectionSlug: "practice" })],
    });
    expect(badge(result, "section-mastery-practice").achieved).toBe(false);
  });
});

describe("section matching is slug-stable (the rename fix)", () => {
  const lessons = [lesson("a", "practice", "Practice"), lesson("b", "practice", "Practice")];
  const readAll = new Set(["a", "b"]);

  it("counts evidence by slug even when its stored title is stale", () => {
    // Section was renamed after this evidence was logged: slug still "practice",
    // but the title captured at log time is the old one.
    const staleTitleEvidence = [
      evidence({ sectionSlug: "practice", section: "Old Practice Name" }),
    ];
    expect(
      badge(
        derive({ lessons, completed: readAll, evidence: staleTitleEvidence }),
        "section-mastery-practice",
      ).achieved,
    ).toBe(true);
  });

  it("migrates legacy evidence that has only a title by mapping it to the slug", () => {
    // Pre-fix evidence had no sectionSlug, only the title.
    const legacyEvidence = [evidence({ sectionSlug: "", section: "Practice" })];
    expect(
      badge(
        derive({ lessons, completed: readAll, evidence: legacyEvidence }),
        "section-mastery-practice",
      ).achieved,
    ).toBe(true);
  });
});

describe("milestones unlock by confirmation, not by the calendar", () => {
  const milestones = [
    { id: "book-exam", title: "Book the exam", date: "2020-01-01", type: "Exam" },
  ];

  it("stays locked even when the date is long past, until marked reached", () => {
    const result = derive({ milestones });
    expect(badge(result, "milestone-book-exam").achieved).toBe(false);
    expect(badge(result, "milestone-book-exam").title).toBe("Book the exam");
  });

  it("unlocks once the milestone id is in reachedMilestones", () => {
    const result = derive({ milestones, reachedMilestones: new Set(["book-exam"]) });
    expect(badge(result, "milestone-book-exam").achieved).toBe(true);
    expect(badge(result, "milestone-book-exam").title).toBe("Reached: Book the exam");
  });
});

describe("plan reviews unlock by confirmation", () => {
  const planReviews = [{ id: "2026-Q1", year: 2026, quarter: 1, date: "2026-03-31" }];

  it("is locked until the review is confirmed", () => {
    expect(badge(derive({ planReviews }), "plan-review-2026-Q1").achieved).toBe(false);
  });

  it("unlocks when the review id is in reviewedPlans", () => {
    const result = derive({ planReviews, reviewedPlans: new Set(["2026-Q1"]) });
    expect(badge(result, "plan-review-2026-Q1").achieved).toBe(true);
  });
});
