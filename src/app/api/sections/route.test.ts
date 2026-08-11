import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalStorageRoot = process.env.MARGA_STORAGE_ROOT;

let storageRoot = "";
let contentRoot = "";
let deleteSection: (request: NextRequest) => Promise<Response>;

beforeEach(async () => {
  storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "marga-sections-route-"));
  contentRoot = path.join(storageRoot, "content", "learn");
  await fs.mkdir(contentRoot, { recursive: true });
  process.env.MARGA_STORAGE_ROOT = storageRoot;

  // The route resolves its storage root at import time, so load it after the
  // environment points at this test's temporary tree.
  vi.resetModules();
  const route = (await import("./route")) as {
    DELETE: (request: NextRequest) => Promise<Response>;
  };
  deleteSection = route.DELETE;
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

function deleteRequest(slug: string, contentType = "application/json"): NextRequest {
  return new NextRequest("http://127.0.0.1:3000/api/sections", {
    method: "DELETE",
    headers: { "content-type": contentType, "sec-fetch-site": "same-origin" },
    body: JSON.stringify({ slug }),
  });
}

async function writeSectionFile(relativePath: string): Promise<void> {
  const target = path.join(contentRoot, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, "x", "utf8");
}

async function sectionExists(slug: string): Promise<boolean> {
  return fs
    .stat(path.join(contentRoot, slug))
    .then(() => true)
    .catch(() => false);
}

describe("DELETE /api/sections", () => {
  it("test_section_delete_keeps_a_folder_holding_a_non_markdown_file", async () => {
    await writeSectionFile(path.join("python", "_section.json"));
    await writeSectionFile(path.join("python", "diagram.png"));

    const response = await deleteSection(deleteRequest("python"));
    const body = (await response.json()) as { message: string; contents?: string[] };

    expect(response.status).toBe(409);
    expect(body.contents).toEqual(["diagram.png"]);
    expect(body.message).toContain("diagram.png");
    expect(await sectionExists("python")).toBe(true);
  });

  it("test_section_delete_keeps_a_folder_holding_a_nested_attachment", async () => {
    await writeSectionFile(path.join("python", "assets", "handout.pdf"));

    const response = await deleteSection(deleteRequest("python"));

    expect(response.status).toBe(409);
    expect(await sectionExists("python")).toBe(true);
  });

  it("test_section_delete_keeps_a_folder_holding_a_note", async () => {
    await writeSectionFile(path.join("python", "tdd-notes.md"));

    const response = await deleteSection(deleteRequest("python"));

    expect(response.status).toBe(409);
    expect(await sectionExists("python")).toBe(true);
  });

  it("test_section_delete_removes_a_folder_holding_only_its_config", async () => {
    await writeSectionFile(path.join("python", "_section.json"));

    const response = await deleteSection(deleteRequest("python"));

    expect(response.status).toBe(200);
    expect(await sectionExists("python")).toBe(false);
  });

  it("test_section_delete_requires_a_json_content_type", async () => {
    await writeSectionFile(path.join("python", "_section.json"));

    const response = await deleteSection(deleteRequest("python", "text/plain"));

    expect(response.status).toBe(415);
    expect(await sectionExists("python")).toBe(true);
  });

  it("test_section_delete_reports_a_missing_section", async () => {
    const response = await deleteSection(deleteRequest("nothing-here"));

    expect(response.status).toBe(404);
  });
});
