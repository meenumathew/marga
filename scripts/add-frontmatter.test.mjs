import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  findFirstHeading,
  stripMarkdown as canonicalStripMarkdown,
} from "../src/lib/markdown-text";
import {
  buildFrontmatter,
  collectMarkdownFiles,
  firstDateLike,
  firstHeading,
  hasFrontmatter,
  metadataValue,
  normalizeMode,
  stripMarkdown,
  truncate,
} from "./add-frontmatter.mjs";

const SCRIPT = fileURLToPath(new URL("./add-frontmatter.mjs", import.meta.url));

/** A note in the pre-frontmatter shape this script exists to migrate. */
const LEGACY_NOTE = [
  "# Statistical Process Control",
  "",
  "> **Goal:** Learn SPC end to end.",
  "> **Last Updated:** 2026-06-15",
  "> **Diataxis mode:** tutorial. Follow it in order.",
  "",
  "Control charts separate signal from noise.",
  "",
].join("\n");

function makeNoteDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "marga-frontmatter-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const target = path.join(dir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, "utf8");
  }

  return dir;
}

describe("hasFrontmatter", () => {
  it("test_a_real_frontmatter_block_is_detected", () => {
    expect(hasFrontmatter('---\ntitle: "A"\n---\n\nprose')).toBe(true);
  });

  it("test_a_closing_yaml_document_marker_counts_as_a_block", () => {
    expect(hasFrontmatter('---\ntitle: "A"\n...\n\nprose')).toBe(true);
  });

  it("test_a_leading_horizontal_rule_is_not_frontmatter", () => {
    // The reason this check is not just startsWith("---"): a note opening with a
    // rule has no closing delimiter, so it still needs frontmatter added.
    expect(hasFrontmatter("---\n\n# Title\n\nprose")).toBe(false);
  });

  it("test_a_byte_order_mark_does_not_hide_frontmatter", () => {
    expect(hasFrontmatter('﻿---\ntitle: "A"\n---\n')).toBe(true);
  });

  it("test_a_note_without_frontmatter_is_reported_as_missing_it", () => {
    expect(hasFrontmatter(LEGACY_NOTE)).toBe(false);
  });
});

describe("buildFrontmatter", () => {
  it("test_blockquote_metadata_becomes_frontmatter_fields", () => {
    expect(buildFrontmatter(LEGACY_NOTE)).toBe(
      [
        "---",
        'title: "Statistical Process Control"',
        'description: "Learn SPC end to end."',
        'mode: "Tutorial"',
        'updated: "2026-06-15"',
        "---",
        "",
      ].join("\n"),
    );
  });

  it("test_description_falls_back_to_the_first_paragraph", () => {
    const note = "# Title\n\nControl charts separate signal from noise.\n";

    expect(buildFrontmatter(note)).toContain(
      'description: "Control charts separate signal from noise."',
    );
  });

  it("test_absent_fields_are_left_out_entirely", () => {
    expect(buildFrontmatter("# Title only\n")).toBe('---\ntitle: "Title only"\n---\n');
  });

  it("test_an_unrecognized_mode_is_dropped", () => {
    const note = "# Title\n\n> **Diataxis mode:** freeform\n";

    expect(buildFrontmatter(note)).not.toContain("mode:");
  });

  it("test_a_quote_in_the_title_is_escaped_for_yaml", () => {
    expect(buildFrontmatter('# The "hard" part\n')).toContain('title: "The \\"hard\\" part"');
  });
});

describe("metadataValue and normalizeMode", () => {
  it("test_metadata_label_variants_are_all_read", () => {
    expect(metadataValue("> **Purpose:** Ship it\n", ["Goal", "Purpose"])).toBe("Ship it");
    expect(
      metadataValue("> **Last updated:** 2026-06-15\n", ["Last Updated", "Last updated"]),
    ).toBe("2026-06-15");
  });

  it("test_a_missing_label_yields_an_empty_string", () => {
    expect(metadataValue("no metadata here\n", ["Goal"])).toBe("");
  });

  it("test_mode_words_map_to_the_content_modes_the_app_accepts", () => {
    expect(normalizeMode("tutorial. Follow in order.")).toBe("Tutorial");
    expect(normalizeMode("howto")).toBe("How-to");
    expect(normalizeMode("**Reference**")).toBe("Reference");
  });

  it("test_an_unknown_or_blank_mode_yields_an_empty_string", () => {
    expect(normalizeMode("freeform")).toBe("");
    expect(normalizeMode("")).toBe("");
  });
});

describe("firstDateLike and truncate", () => {
  it("test_a_date_is_lifted_out_of_surrounding_prose", () => {
    expect(firstDateLike("2026-06-15 (reviewed by hand)")).toBe("2026-06-15");
  });

  it("test_prose_with_no_date_yields_null", () => {
    expect(firstDateLike("last winter")).toBeNull();
  });

  it("test_truncate_keeps_short_text_whole", () => {
    expect(truncate("short", 180)).toBe("short");
  });

  it("test_truncate_marks_where_it_cut", () => {
    expect(truncate("abcdef", 4)).toBe("abc…");
  });
});

describe("collectMarkdownFiles", () => {
  it("test_markdown_is_collected_and_everything_else_is_left_alone", () => {
    const dir = makeNoteDir({
      "note.md": "# A\n",
      "guide.mdx": "# B\n",
      "notes.txt": "plain",
      "diagram.png": "binary",
      ".obsidian/config.md": "# hidden\n",
      "nested/deep.md": "# C\n",
    });

    try {
      const found = collectMarkdownFiles(dir)
        .map((file) => path.relative(dir, file))
        .sort();

      expect(found).toEqual(["guide.mdx", path.join("nested", "deep.md"), "note.md"]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("the shared markdown reductions", () => {
  // This script runs under bare node and cannot import the app's TypeScript, so
  // it keeps its own copy. These cases pin the copies together: if either side
  // changes, this goes red instead of the two silently diverging.
  const cases = [
    "Run `npm test` first",
    "See [the guide](https://example.com/a?b=c)",
    "> **Goal:** _learn_ ~~SPC~~ #tag",
    "  two\n\nlines\tapart  ",
    "A statistical process control primer.",
  ];

  it.each(cases)("test_strip_markdown_matches_the_app_for_%j", (input) => {
    expect(stripMarkdown(input)).toBe(canonicalStripMarkdown(input));
  });

  it("test_first_heading_matches_the_app", () => {
    const note = "intro\n\n# The `SPC` Primer\n\n# Later heading";

    expect(firstHeading(note)).toBe(findFirstHeading(note));
  });
});

describe("running the script", () => {
  it("test_dry_run_reports_the_change_without_touching_the_file", () => {
    const dir = makeNoteDir({ "note.md": LEGACY_NOTE });

    try {
      const output = execFileSync("node", [SCRIPT, dir, "--dry-run"], { encoding: "utf8" });

      expect(output).toContain("would update note.md");
      expect(output).toContain("Would update 1 file(s)");
      expect(fs.readFileSync(path.join(dir, "note.md"), "utf8")).toBe(LEGACY_NOTE);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("test_a_real_run_prepends_frontmatter_and_keeps_the_note_body", () => {
    const dir = makeNoteDir({ "note.md": LEGACY_NOTE });

    try {
      execFileSync("node", [SCRIPT, dir], { encoding: "utf8" });

      const updated = fs.readFileSync(path.join(dir, "note.md"), "utf8");

      expect(updated).toBe(`${buildFrontmatter(LEGACY_NOTE)}\n${LEGACY_NOTE}`);
      expect(updated).toContain("Control charts separate signal from noise.");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("test_a_second_run_changes_nothing", () => {
    const dir = makeNoteDir({ "note.md": LEGACY_NOTE });

    try {
      execFileSync("node", [SCRIPT, dir], { encoding: "utf8" });
      const afterFirst = fs.readFileSync(path.join(dir, "note.md"), "utf8");

      const output = execFileSync("node", [SCRIPT, dir], { encoding: "utf8" });

      expect(output).toContain("skipped 1 with existing frontmatter");
      expect(fs.readFileSync(path.join(dir, "note.md"), "utf8")).toBe(afterFirst);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("test_a_missing_directory_is_refused_before_anything_is_written", () => {
    const missing = path.join(os.tmpdir(), "marga-frontmatter-does-not-exist");

    expect(() => execFileSync("node", [SCRIPT, missing], { stdio: "pipe" })).toThrow(
      /Directory not found/,
    );
  });

  it("test_no_directory_argument_prints_usage_and_fails", () => {
    expect(() => execFileSync("node", [SCRIPT], { stdio: "pipe" })).toThrow(/Usage:/);
  });
});
