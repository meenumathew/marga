import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalStorageRoot = process.env.MARGA_STORAGE_ROOT;

/** A plan note with no `milestones` key at all. */
const PLAIN_NOTE = [
  "---",
  'title: "Plan 2026"',
  'description: "The year plan."',
  'mode: "Plan"',
  "---",
  "",
  "# Plan 2026",
  "",
  "One bet for the year.",
  "",
].join("\n");

/** The same note carrying exactly one milestone. */
const NOTE_WITH_ONE_MILESTONE = [
  "---",
  'title: "Plan 2026"',
  'description: "The year plan."',
  'mode: "Plan"',
  "milestones:",
  '  - id: "2026-03-31-q1-review"',
  '    title: "Q1 review"',
  '    date: "2026-03-31"',
  '    type: "Review"',
  "---",
  "",
  "# Plan 2026",
  "",
  "One bet for the year.",
  "",
].join("\n");

/** The same note carrying two milestones, the first with a link. */
const NOTE_WITH_MILESTONES = [
  "---",
  'title: "Plan 2026"',
  'description: "The year plan."',
  'mode: "Plan"',
  "milestones:",
  '  - id: "2026-03-31-q1-review"',
  '    title: "Q1 review"',
  '    date: "2026-03-31"',
  '    type: "Review"',
  '    link: "/plans"',
  '  - id: "2026-06-30-q2-review"',
  '    title: "Q2 review"',
  '    date: "2026-06-30"',
  '    type: "Review"',
  "---",
  "",
  "# Plan 2026",
  "",
  "One bet for the year.",
  "",
].join("\n");

type RouteHandler = (request: NextRequest) => Promise<Response>;

let storageRoot = "";
let contentRoot = "";
let route: { POST: RouteHandler; PUT: RouteHandler; DELETE: RouteHandler };

beforeEach(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "marga-milestones-route-"));
  contentRoot = path.join(storageRoot, "content", "learn");
  await fs.mkdir(contentRoot, { recursive: true });
  process.env.MARGA_STORAGE_ROOT = storageRoot;

  // The route resolves its storage root at import time, so load it after the
  // environment points at this test's temporary tree.
  vi.resetModules();
  route = (await import("./route")) as typeof route;
});

afterEach(async () => {
  if (originalStorageRoot === undefined) {
    delete process.env.MARGA_STORAGE_ROOT;
  } else {
    process.env.MARGA_STORAGE_ROOT = originalStorageRoot;
  }

  await fs.rm(storageRoot, { recursive: true, force: true });
  vi.restoreAllMocks();
});

function milestoneRequest(
  method: "POST" | "PUT" | "DELETE",
  payload: Record<string, unknown>,
  contentType = "application/json",
): NextRequest {
  return new NextRequest("http://127.0.0.1:3000/api/milestones", {
    method,
    headers: { "content-type": contentType, "sec-fetch-site": "same-origin" },
    body: JSON.stringify(payload),
  });
}

async function writeNote(content: string, fileName = "plan-2026.md"): Promise<void> {
  await fs.writeFile(path.join(contentRoot, fileName), content, "utf8");
}

async function readNote(fileName = "plan-2026.md"): Promise<string> {
  return fs.readFile(path.join(contentRoot, fileName), "utf8");
}

/** How many times the frontmatter opens a `milestones` key. */
function milestonesKeyCount(raw: string): number {
  return raw.split("\n").filter((line) => /^milestones:/.test(line)).length;
}

describe("POST /api/milestones", () => {
  it("test_post_adds_a_milestones_block_to_a_note_that_has_none", async () => {
    await writeNote(PLAIN_NOTE);

    const response = await route.POST(
      milestoneRequest("POST", {
        slug: "plan-2026",
        title: "Q1 review",
        date: "2026-03-31",
        type: "Review",
        note: "Check the thesis.",
      }),
    );
    const written = await readNote();

    expect(response.status).toBe(200);
    expect(milestonesKeyCount(written)).toBe(1);
    expect(written).toContain('  - id: "2026-03-31-q1-review"');
    expect(written).toContain('    title: "Q1 review"');
    expect(written).toContain('    date: "2026-03-31"');
    expect(written).toContain('    note: "Check the thesis."');
    expect(written).toContain("One bet for the year.");
  });

  it("test_post_replaces_an_inline_empty_milestones_list", async () => {
    await writeNote(PLAIN_NOTE.replace('mode: "Plan"', 'mode: "Plan"\nmilestones: []'));

    const response = await route.POST(
      milestoneRequest("POST", { slug: "plan-2026", title: "Q1 review", date: "2026-03-31" }),
    );
    const written = await readNote();

    expect(response.status).toBe(200);
    expect(milestonesKeyCount(written)).toBe(1);
    expect(written).not.toContain("milestones: []");
    expect(written).toContain('  - id: "2026-03-31-q1-review"');
  });

  it("test_post_gives_a_repeated_title_and_date_a_distinct_id", async () => {
    await writeNote(NOTE_WITH_MILESTONES);

    await route.POST(
      milestoneRequest("POST", { slug: "plan-2026", title: "Q1 review", date: "2026-03-31" }),
    );
    const written = await readNote();

    expect(written).toContain('  - id: "2026-03-31-q1-review"');
    expect(written).toContain('  - id: "2026-03-31-q1-review-2"');
  });

  it("test_post_requires_a_note_and_a_title", async () => {
    await writeNote(PLAIN_NOTE);

    const response = await route.POST(
      milestoneRequest("POST", { slug: "plan-2026", date: "2026-03-31" }),
    );

    expect(response.status).toBe(400);
    expect(await readNote()).toBe(PLAIN_NOTE);
  });

  it("test_post_rejects_a_day_that_is_not_on_the_calendar", async () => {
    await writeNote(PLAIN_NOTE);

    const response = await route.POST(
      milestoneRequest("POST", { slug: "plan-2026", title: "Q1 review", date: "2026-02-30" }),
    );
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toContain("YYYY-MM-DD");
    expect(await readNote()).toBe(PLAIN_NOTE);
  });

  it("test_post_reports_an_unknown_note", async () => {
    const response = await route.POST(
      milestoneRequest("POST", { slug: "nothing-here", title: "Q1 review", date: "2026-03-31" }),
    );

    expect(response.status).toBe(404);
  });

  it("test_post_requires_a_json_content_type", async () => {
    await writeNote(PLAIN_NOTE);

    const response = await route.POST(
      milestoneRequest(
        "POST",
        { slug: "plan-2026", title: "Q1 review", date: "2026-03-31" },
        "text/plain",
      ),
    );

    expect(response.status).toBe(415);
    expect(await readNote()).toBe(PLAIN_NOTE);
  });
});

describe("PUT /api/milestones", () => {
  it("test_put_rewrites_the_milestone_it_was_given_and_keeps_its_link", async () => {
    await writeNote(NOTE_WITH_MILESTONES);

    const response = await route.PUT(
      milestoneRequest("PUT", {
        slug: "plan-2026",
        id: "2026-03-31-q1-review",
        originalTitle: "Q1 review",
        originalDate: "2026-03-31",
        title: "Q1 retrospective",
        date: "2026-03-30",
        type: "Retro",
      }),
    );
    const written = await readNote();

    expect(response.status).toBe(200);
    expect(written).toContain('    title: "Q1 retrospective"');
    expect(written).toContain('    date: "2026-03-30"');
    expect(written).toContain('    type: "Retro"');
    // The edit form does not expose the link, so it must survive the rewrite.
    expect(written).toContain('    link: "/plans"');
    // The untouched milestone is still there.
    expect(written).toContain('    title: "Q2 review"');
    expect(written).not.toContain('    title: "Q1 review"');
  });

  it("test_put_keeps_the_milestone_id_stable_across_an_edit", async () => {
    await writeNote(NOTE_WITH_MILESTONES);

    await route.PUT(
      milestoneRequest("PUT", {
        slug: "plan-2026",
        id: "2026-03-31-q1-review",
        originalTitle: "Q1 review",
        originalDate: "2026-03-31",
        title: "Q1 retrospective",
        date: "2026-03-30",
      }),
    );

    expect(await readNote()).toContain('  - id: "2026-03-31-q1-review"');
  });

  it("test_put_reports_a_milestone_the_note_does_not_hold", async () => {
    await writeNote(NOTE_WITH_MILESTONES);

    const response = await route.PUT(
      milestoneRequest("PUT", {
        slug: "plan-2026",
        id: "no-such-milestone",
        originalTitle: "Q4 review",
        originalDate: "2026-12-31",
        title: "Q4 retrospective",
        date: "2026-12-31",
      }),
    );

    expect(response.status).toBe(404);
    expect(await readNote()).toBe(NOTE_WITH_MILESTONES);
  });

  it("test_put_rejects_a_bad_date", async () => {
    await writeNote(NOTE_WITH_MILESTONES);

    const response = await route.PUT(
      milestoneRequest("PUT", {
        slug: "plan-2026",
        id: "2026-03-31-q1-review",
        originalTitle: "Q1 review",
        originalDate: "2026-03-31",
        title: "Q1 review",
        date: "31-03-2026",
      }),
    );

    expect(response.status).toBe(400);
    expect(await readNote()).toBe(NOTE_WITH_MILESTONES);
  });
});

describe("DELETE /api/milestones", () => {
  it("test_delete_removes_only_the_named_milestone", async () => {
    await writeNote(NOTE_WITH_MILESTONES);

    const response = await route.DELETE(
      milestoneRequest("DELETE", {
        slug: "plan-2026",
        id: "2026-03-31-q1-review",
        title: "Q1 review",
        date: "2026-03-31",
      }),
    );
    const written = await readNote();

    expect(response.status).toBe(200);
    expect(written).not.toContain('    title: "Q1 review"');
    expect(written).toContain('    title: "Q2 review"');
    expect(written).toContain("One bet for the year.");
  });

  it("test_delete_drops_the_milestones_key_with_the_last_milestone", async () => {
    await writeNote(NOTE_WITH_ONE_MILESTONE);

    const response = await route.DELETE(
      milestoneRequest("DELETE", {
        slug: "plan-2026",
        id: "2026-03-31-q1-review",
        title: "Q1 review",
        date: "2026-03-31",
      }),
    );
    const written = await readNote();

    expect(response.status).toBe(200);
    expect(milestonesKeyCount(written)).toBe(0);
    expect(written).toContain('title: "Plan 2026"');
    expect(written).toContain("One bet for the year.");
  });

  it("test_delete_reports_a_milestone_the_note_does_not_hold", async () => {
    await writeNote(NOTE_WITH_MILESTONES);

    const response = await route.DELETE(
      milestoneRequest("DELETE", {
        slug: "plan-2026",
        title: "Q4 review",
        date: "2026-12-31",
      }),
    );

    expect(response.status).toBe(404);
    expect(await readNote()).toBe(NOTE_WITH_MILESTONES);
  });

  it("test_delete_requires_a_title_and_a_date", async () => {
    await writeNote(NOTE_WITH_MILESTONES);

    const response = await route.DELETE(
      milestoneRequest("DELETE", { slug: "plan-2026", title: "Q1 review" }),
    );

    expect(response.status).toBe(400);
    expect(await readNote()).toBe(NOTE_WITH_MILESTONES);
  });
});
