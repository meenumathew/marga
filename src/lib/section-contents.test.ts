import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SECTION_CONFIG_FILE } from "./learn-content";
import { findSectionContents } from "./section-contents";

let sectionDir = "";

beforeEach(async () => {
  sectionDir = await fs.mkdtemp(path.join(os.tmpdir(), "marga-section-contents-"));
});

afterEach(async () => {
  await fs.rm(sectionDir, { recursive: true, force: true });
});

async function writeFile(relativePath: string, body = "x"): Promise<void> {
  const target = path.join(sectionDir, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, body, "utf8");
}

describe("findSectionContents", () => {
  it("test_empty_folder_reports_nothing", async () => {
    expect(await findSectionContents(sectionDir)).toEqual([]);
  });

  it("test_section_config_alone_reports_nothing", async () => {
    await writeFile(SECTION_CONFIG_FILE, '{"title":"Python"}');

    expect(await findSectionContents(sectionDir)).toEqual([]);
  });

  it("test_editor_and_os_scratch_files_report_nothing", async () => {
    await writeFile(".DS_Store");
    await writeFile("Thumbs.db");
    await writeFile(".gitkeep");

    expect(await findSectionContents(sectionDir)).toEqual([]);
  });

  it("test_markdown_note_is_reported", async () => {
    await writeFile("tdd-notes.md");

    expect(await findSectionContents(sectionDir)).toEqual(["tdd-notes.md"]);
  });

  it("test_non_markdown_file_is_reported", async () => {
    await writeFile("diagram.png");
    await writeFile("handout.pdf");

    expect(await findSectionContents(sectionDir)).toEqual(["diagram.png", "handout.pdf"]);
  });

  it("test_hidden_user_file_is_reported", async () => {
    await writeFile(".obsidian/workspace.json");

    expect(await findSectionContents(sectionDir)).toEqual([".obsidian/workspace.json"]);
  });

  it("test_nested_file_is_reported_with_its_folder", async () => {
    await writeFile("assets/screenshots/step-one.png");

    expect(await findSectionContents(sectionDir)).toEqual(["assets/screenshots/step-one.png"]);
  });

  it("test_empty_nested_folders_report_nothing", async () => {
    await fs.mkdir(path.join(sectionDir, "assets", "unused"), { recursive: true });
    await writeFile(path.join("assets", ".DS_Store"));

    expect(await findSectionContents(sectionDir)).toEqual([]);
  });

  it("test_report_is_capped_but_still_reports_something", async () => {
    for (let index = 0; index < 40; index += 1) {
      await writeFile(`note-${index}.md`);
    }

    const contents = await findSectionContents(sectionDir);

    expect(contents.length).toBeGreaterThan(0);
    expect(contents.length).toBeLessThanOrEqual(10);
  });
});
