import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_ID_LENGTH, type ProgressState } from "@/lib/progress-state";

type ProgressResponse = Partial<ProgressState> & { message?: string; source?: string };

const originalStorageRoot = process.env.MARGA_STORAGE_ROOT;

let storageRoot = "";
let statePath = "";
let getProgress: () => Promise<Response>;
let postProgress: (request: NextRequest) => Promise<Response>;

beforeEach(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "marga-progress-route-"));
  statePath = path.join(storageRoot, "content", ".marga", "state.json");
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  process.env.MARGA_STORAGE_ROOT = storageRoot;

  // The route resolves its state path at import time, so load it after the
  // environment points at this test's temporary tree.
  vi.resetModules();
  const route = (await import("./route")) as {
    GET: () => Promise<Response>;
    POST: (request: NextRequest) => Promise<Response>;
  };
  getProgress = route.GET;
  postProgress = route.POST;
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

function actionRequest(
  action: Record<string, unknown>,
  contentType = "application/json",
): NextRequest {
  return new NextRequest("http://127.0.0.1:3000/api/progress", {
    method: "POST",
    headers: { "content-type": contentType, "sec-fetch-site": "same-origin" },
    body: JSON.stringify(action),
  });
}

async function readStateFile(): Promise<ProgressState> {
  return JSON.parse(await fs.readFile(statePath, "utf8")) as ProgressState;
}

describe("GET /api/progress", () => {
  it("test_progress_reports_a_default_state_before_anything_is_recorded", async () => {
    const response = await getProgress();
    const body = (await response.json()) as ProgressResponse;

    expect(response.status).toBe(200);
    expect(body.source).toBe("default");
    expect(body.completedLessons).toEqual([]);
    expect(body.lastVisitedLesson).toBeNull();
  });

  it("test_progress_reports_what_the_state_file_holds", async () => {
    await fs.writeFile(
      statePath,
      JSON.stringify({ version: 1, completedLessons: ["intro"], activityDays: ["2026-07-01"] }),
      "utf8",
    );

    const body = (await (await getProgress()).json()) as ProgressResponse;

    expect(body.source).toBe("file");
    expect(body.completedLessons).toEqual(["intro"]);
    expect(body.activityDays).toEqual(["2026-07-01"]);
  });
});

describe("POST /api/progress", () => {
  it("test_lesson_completion_is_mirrored_to_the_state_file", async () => {
    const response = await postProgress(
      actionRequest({
        action: "setLessonComplete",
        slug: "intro",
        completed: true,
        date: "2026-07-01",
      }),
    );
    const body = (await response.json()) as ProgressResponse;

    expect(response.status).toBe(200);
    expect(body.completedLessons).toEqual(["intro"]);
    expect((await readStateFile()).completedLessons).toEqual(["intro"]);
    expect((await readStateFile()).activityDays).toEqual(["2026-07-01"]);
  });

  it("test_lesson_completion_can_be_undone", async () => {
    await postProgress(
      actionRequest({
        action: "setLessonComplete",
        slug: "intro",
        completed: true,
        date: "2026-07-01",
      }),
    );

    const response = await postProgress(
      actionRequest({
        action: "setLessonComplete",
        slug: "intro",
        completed: false,
        date: "2026-07-02",
      }),
    );
    const body = (await response.json()) as ProgressResponse;

    expect(body.completedLessons).toEqual([]);
    // The day the lesson was un-completed is still a day the learner showed up.
    expect(body.activityDays).toEqual(["2026-07-01", "2026-07-02"]);
  });

  it("test_replace_writes_the_whole_state", async () => {
    const response = await postProgress(
      actionRequest({
        action: "replace",
        state: {
          version: 1,
          completedLessons: ["intro"],
          lastVisitedLesson: "intro",
          activityDays: ["2026-07-01"],
          evidence: [
            {
              id: "ev-1",
              date: "2026-07-01",
              kind: "Build",
              title: "Shipped the parser",
            },
          ],
          reachedMilestones: ["m-1"],
          reviewedPlans: ["p-1"],
        },
      }),
    );
    const body = (await response.json()) as ProgressResponse;

    expect(response.status).toBe(200);
    expect(body.evidence?.map((entry) => entry.id)).toEqual(["ev-1"]);
    expect((await readStateFile()).reachedMilestones).toEqual(["m-1"]);
  });

  it("test_an_over_long_lesson_id_is_refused", async () => {
    const response = await postProgress(
      actionRequest({
        action: "setLessonComplete",
        slug: "x".repeat(MAX_ID_LENGTH + 1),
        completed: true,
        date: "2026-07-01",
      }),
    );

    expect(response.status).toBe(400);
    await expect(fs.access(statePath)).rejects.toThrow();
  });

  it("test_an_impossible_activity_date_is_refused", async () => {
    const response = await postProgress(
      actionRequest({
        action: "setLessonComplete",
        slug: "intro",
        completed: true,
        date: "2026-02-31",
      }),
    );

    expect(response.status).toBe(400);
  });

  it("test_an_unsupported_action_is_refused", async () => {
    const response = await postProgress(actionRequest({ action: "dropEverything" }));

    expect(response.status).toBe(400);
  });

  it("test_a_progress_action_requires_a_json_content_type", async () => {
    const response = await postProgress(
      actionRequest(
        { action: "setLessonComplete", slug: "intro", completed: true, date: "2026-07-01" },
        "text/plain",
      ),
    );

    expect(response.status).toBe(415);
  });
});
