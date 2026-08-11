import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalStorageRoot = process.env.MARGA_STORAGE_ROOT;

/** The smallest payload the route accepts; individual tests override fields. */
const VALID_PAYLOAD = {
  title: "TDD Notes",
  description: "Notes on test-driven development.",
  section: "Python",
  body: "# TDD Notes\n\nRed, green, refactor.\n",
};

let storageRoot = "";
let contentRoot = "";
let createContent: (request: NextRequest) => Promise<Response>;

beforeEach(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "marga-content-route-"));
  contentRoot = path.join(storageRoot, "content", "learn");
  await fs.mkdir(contentRoot, { recursive: true });
  process.env.MARGA_STORAGE_ROOT = storageRoot;

  // The route resolves its storage root at import time, so load it after the
  // environment points at this test's temporary tree.
  vi.resetModules();
  const route = (await import("./route")) as {
    POST: (request: NextRequest) => Promise<Response>;
  };
  createContent = route.POST;
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

function postRequest(
  payload: Record<string, unknown>,
  contentType = "application/json",
): NextRequest {
  return new NextRequest("http://127.0.0.1:3000/api/content", {
    method: "POST",
    headers: { "content-type": contentType, "sec-fetch-site": "same-origin" },
    body: JSON.stringify(payload),
  });
}

async function readContent(relativePath: string): Promise<string> {
  return fs.readFile(path.join(contentRoot, relativePath), "utf8");
}

async function contentExists(relativePath: string): Promise<boolean> {
  return fs
    .stat(path.join(contentRoot, relativePath))
    .then(() => true)
    .catch(() => false);
}

describe("POST /api/content", () => {
  it("test_post_writes_the_note_into_its_section_folder", async () => {
    const response = await createContent(postRequest(VALID_PAYLOAD));
    const body = (await response.json()) as { href: string; path: string };

    expect(response.status).toBe(200);
    expect(body.href).toBe("/learn/python/tdd-notes");
    expect(body.path).toBe("content/learn/python/tdd-notes.md");

    const written = await readContent(path.join("python", "tdd-notes.md"));
    expect(written).toContain('title: "TDD Notes"');
    expect(written).toContain('description: "Notes on test-driven development."');
    expect(written).toContain('section: "Python"');
    expect(written).toContain('mode: "Lesson"');
    expect(written).toContain('level: "Any level"');
    expect(written).toContain('duration: "Self-paced"');
    expect(written).toMatch(/^updated: "\d{4}-\d{2}-\d{2}"$/m);
    expect(written).toContain("order: 100");
    expect(written.endsWith("Red, green, refactor.\n")).toBe(true);
  });

  it("test_post_mints_a_section_config_for_a_folder_it_created", async () => {
    await createContent(postRequest(VALID_PAYLOAD));

    const config = await readContent(path.join("python", "_section.json"));

    expect(JSON.parse(config)).toEqual({ title: "Python", order: 1 });
  });

  it("test_post_leaves_an_existing_section_config_untouched", async () => {
    const existing = '{\n  "title": "Python Deep Dive",\n  "order": 7\n}\n';
    await fs.mkdir(path.join(contentRoot, "python"), { recursive: true });
    await fs.writeFile(path.join(contentRoot, "python", "_section.json"), existing, "utf8");

    await createContent(postRequest(VALID_PAYLOAD));

    expect(await readContent(path.join("python", "_section.json"))).toBe(existing);
  });

  it("test_post_writes_an_mdx_file_when_asked", async () => {
    const response = await createContent(postRequest({ ...VALID_PAYLOAD, extension: "mdx" }));

    expect(response.status).toBe(200);
    expect(await contentExists(path.join("python", "tdd-notes.mdx"))).toBe(true);
  });

  it("test_post_strips_frontmatter_pasted_into_the_body", async () => {
    await createContent(
      postRequest({
        ...VALID_PAYLOAD,
        body: '---\ntitle: "Pasted"\norder: 3\n---\n\nReal body.\n',
      }),
    );

    const written = await readContent(path.join("python", "tdd-notes.md"));

    expect(written).not.toContain('title: "Pasted"');
    expect(written).toContain("Real body.");
  });

  it("test_post_falls_back_to_lesson_for_an_unrecognised_mode", async () => {
    await createContent(postRequest({ ...VALID_PAYLOAD, mode: "Blog post" }));

    expect(await readContent(path.join("python", "tdd-notes.md"))).toContain('mode: "Lesson"');
  });

  it("test_post_records_a_plan_year", async () => {
    await createContent(postRequest({ ...VALID_PAYLOAD, mode: "Plan", year: "2026" }));

    expect(await readContent(path.join("python", "tdd-notes.md"))).toContain("year: 2026");
  });

  it("test_post_omits_a_year_outside_the_supported_range", async () => {
    await createContent(postRequest({ ...VALID_PAYLOAD, mode: "Plan", year: "1999" }));

    expect(await readContent(path.join("python", "tdd-notes.md"))).not.toContain("year:");
  });

  it("test_post_requires_a_title_description_and_body", async () => {
    const response = await createContent(postRequest({ ...VALID_PAYLOAD, description: "  " }));

    expect(response.status).toBe(400);
    expect(await contentExists("python")).toBe(false);
  });

  it("test_post_rejects_a_body_over_the_size_limit", async () => {
    const response = await createContent(
      postRequest({ ...VALID_PAYLOAD, body: "a".repeat(120_001) }),
    );

    expect(response.status).toBe(413);
    expect(await contentExists("python")).toBe(false);
  });

  it("test_post_keeps_the_existing_file_when_the_slug_is_taken", async () => {
    await fs.mkdir(path.join(contentRoot, "python"), { recursive: true });
    await fs.writeFile(
      path.join(contentRoot, "python", "tdd-notes.md"),
      "# Already here\n",
      "utf8",
    );

    const response = await createContent(postRequest(VALID_PAYLOAD));

    expect(response.status).toBe(409);
    expect(await readContent(path.join("python", "tdd-notes.md"))).toBe("# Already here\n");
  });

  it("test_post_cannot_write_outside_the_content_root", async () => {
    const response = await createContent(
      postRequest({ ...VALID_PAYLOAD, section: "../escaped", slug: "../../escaped" }),
    );

    expect(response.status).toBe(200);
    // Both traversals are slugified away, so the note lands in a normal section.
    expect(await contentExists(path.join("escaped", "escaped.md"))).toBe(true);
    await expect(fs.stat(path.join(storageRoot, "content", "escaped"))).rejects.toThrow();
    await expect(fs.stat(path.join(storageRoot, "escaped.md"))).rejects.toThrow();
  });

  it("test_post_requires_a_json_content_type", async () => {
    const response = await createContent(postRequest(VALID_PAYLOAD, "text/plain"));

    expect(response.status).toBe(415);
    expect(await contentExists("python")).toBe(false);
  });
});
