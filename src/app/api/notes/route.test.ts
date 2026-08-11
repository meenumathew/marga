import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalStorageRoot = process.env.MARGA_STORAGE_ROOT;

const NOTE = [
  "---",
  'title: "TDD Notes"',
  'description: "Notes on test-driven development."',
  'section: "General"',
  'mode: "Lesson"',
  "---",
  "",
  "# TDD Notes",
  "",
  "Red, green, refactor.",
  "",
].join("\n");

type RouteHandler = (request: NextRequest) => Promise<Response>;

let storageRoot = "";
let contentRoot = "";
let route: { GET: RouteHandler; PUT: RouteHandler; PATCH: RouteHandler; DELETE: RouteHandler };

beforeEach(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "marga-notes-route-"));
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

function getRequest(slug: string): NextRequest {
  return new NextRequest(
    `http://127.0.0.1:3000/api/notes?slug=${encodeURIComponent(slug)}`,
  ) as NextRequest;
}

function writeRequest(
  method: "PUT" | "PATCH" | "DELETE",
  payload: Record<string, unknown>,
  contentType = "application/json",
): NextRequest {
  return new NextRequest("http://127.0.0.1:3000/api/notes", {
    method,
    headers: { "content-type": contentType, "sec-fetch-site": "same-origin" },
    body: JSON.stringify(payload),
  });
}

async function writeNote(relativePath: string, content = NOTE): Promise<string> {
  const target = path.join(contentRoot, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
  return target;
}

async function readNote(relativePath: string): Promise<string> {
  return fs.readFile(path.join(contentRoot, relativePath), "utf8");
}

async function noteExists(relativePath: string): Promise<boolean> {
  return fs
    .stat(path.join(contentRoot, relativePath))
    .then(() => true)
    .catch(() => false);
}

describe("GET /api/notes", () => {
  it("test_get_returns_the_raw_file_for_a_known_note", async () => {
    await writeNote("tdd-notes.md");

    const response = await route.GET(getRequest("tdd-notes"));
    const body = (await response.json()) as { title: string; raw: string; sourcePath: string };

    expect(response.status).toBe(200);
    expect(body.title).toBe("TDD Notes");
    expect(body.raw).toBe(NOTE);
    expect(body.sourcePath).toBe("content/learn/tdd-notes.md");
  });

  it("test_get_reports_an_unknown_note", async () => {
    const response = await route.GET(getRequest("nothing-here"));

    expect(response.status).toBe(404);
  });
});

describe("PUT /api/notes", () => {
  it("test_put_saves_the_new_content_and_ends_the_file_with_a_newline", async () => {
    await writeNote("tdd-notes.md");

    const response = await route.PUT(
      writeRequest("PUT", { slug: "tdd-notes", content: `${NOTE}\nOne more line.` }),
    );

    expect(response.status).toBe(200);
    expect(await readNote("tdd-notes.md")).toBe(`${NOTE}\nOne more line.\n`);
  });

  it("test_put_keeps_the_file_when_the_frontmatter_is_not_valid_yaml", async () => {
    await writeNote("tdd-notes.md");

    const response = await route.PUT(
      writeRequest("PUT", {
        slug: "tdd-notes",
        content: '---\ntitle: "unclosed\n---\n\nbody\n',
      }),
    );
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(400);
    expect(body.message).toContain("not valid YAML");
    expect(await readNote("tdd-notes.md")).toBe(NOTE);
  });

  it("test_put_rejects_content_that_is_only_whitespace", async () => {
    await writeNote("tdd-notes.md");

    const response = await route.PUT(writeRequest("PUT", { slug: "tdd-notes", content: "   \n" }));

    expect(response.status).toBe(400);
    expect(await readNote("tdd-notes.md")).toBe(NOTE);
  });

  it("test_put_keeps_the_file_when_the_content_is_over_the_size_limit", async () => {
    await writeNote("tdd-notes.md");

    const response = await route.PUT(
      writeRequest("PUT", { slug: "tdd-notes", content: "a".repeat(200_001) }),
    );

    expect(response.status).toBe(413);
    expect(await readNote("tdd-notes.md")).toBe(NOTE);
  });

  it("test_put_reports_an_unknown_note", async () => {
    const response = await route.PUT(
      writeRequest("PUT", { slug: "nothing-here", content: "# Anything\n" }),
    );

    expect(response.status).toBe(404);
  });

  it("test_put_requires_a_json_content_type", async () => {
    await writeNote("tdd-notes.md");

    const response = await route.PUT(
      writeRequest("PUT", { slug: "tdd-notes", content: "# Replaced\n" }, "text/plain"),
    );

    expect(response.status).toBe(415);
    expect(await readNote("tdd-notes.md")).toBe(NOTE);
  });
});

describe("PATCH /api/notes", () => {
  it("test_patch_moves_a_note_into_a_section_and_updates_its_section_mirror", async () => {
    await writeNote("tdd-notes.md");

    const response = await route.PATCH(
      writeRequest("PATCH", { slug: "tdd-notes", sectionSlug: "python" }),
    );

    expect(response.status).toBe(200);
    expect(await noteExists("tdd-notes.md")).toBe(false);
    expect(await readNote(path.join("python", "tdd-notes.md"))).toContain('section: "Python"');
  });

  it("test_patch_keeps_both_notes_when_the_target_file_name_is_taken", async () => {
    await writeNote("tdd-notes.md");
    await writeNote(path.join("python", "tdd-notes.md"), "# Already here\n");

    const response = await route.PATCH(
      writeRequest("PATCH", { slug: "tdd-notes", sectionSlug: "python" }),
    );

    expect(response.status).toBe(409);
    expect(await readNote("tdd-notes.md")).toBe(NOTE);
    expect(await readNote(path.join("python", "tdd-notes.md"))).toBe("# Already here\n");
  });

  it("test_patch_reports_a_note_that_is_already_in_the_target_section", async () => {
    await writeNote(path.join("python", "tdd-notes.md"));

    const response = await route.PATCH(
      writeRequest("PATCH", { slug: "python/tdd-notes", sectionSlug: "python" }),
    );
    const body = (await response.json()) as { message: string };

    expect(response.status).toBe(200);
    expect(body.message).toContain("already in that section");
    expect(await readNote(path.join("python", "tdd-notes.md"))).toBe(NOTE);
  });

  it("test_patch_cannot_move_a_note_outside_the_content_root", async () => {
    await writeNote("tdd-notes.md");

    const response = await route.PATCH(
      writeRequest("PATCH", { slug: "tdd-notes", sectionSlug: "../escaped" }),
    );

    expect(response.status).toBe(200);
    // The traversal is slugified away, so the note lands in a normal section.
    expect(await noteExists(path.join("escaped", "tdd-notes.md"))).toBe(true);
    await expect(fs.stat(path.join(storageRoot, "content", "escaped"))).rejects.toThrow();
  });

  it("test_patch_requires_a_slug", async () => {
    const response = await route.PATCH(writeRequest("PATCH", { sectionSlug: "python" }));

    expect(response.status).toBe(400);
  });
});

describe("DELETE /api/notes", () => {
  it("test_delete_removes_the_note_file", async () => {
    await writeNote("tdd-notes.md");

    const response = await route.DELETE(writeRequest("DELETE", { slug: "tdd-notes" }));

    expect(response.status).toBe(200);
    expect(await noteExists("tdd-notes.md")).toBe(false);
  });

  it("test_delete_reports_an_unknown_note", async () => {
    const response = await route.DELETE(writeRequest("DELETE", { slug: "nothing-here" }));

    expect(response.status).toBe(404);
  });

  it("test_delete_requires_a_slug", async () => {
    await writeNote("tdd-notes.md");

    const response = await route.DELETE(writeRequest("DELETE", {}));

    expect(response.status).toBe(400);
    expect(await noteExists("tdd-notes.md")).toBe(true);
  });

  it("test_delete_requires_a_json_content_type", async () => {
    await writeNote("tdd-notes.md");

    const response = await route.DELETE(
      writeRequest("DELETE", { slug: "tdd-notes" }, "text/plain"),
    );

    expect(response.status).toBe(415);
    expect(await noteExists("tdd-notes.md")).toBe(true);
  });
});
