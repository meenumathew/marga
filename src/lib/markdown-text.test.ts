import { describe, expect, it } from "vitest";

import { findFirstHeading, stripMarkdown } from "./markdown-text";

describe("stripMarkdown", () => {
  it("test_inline_code_keeps_its_content", () => {
    expect(stripMarkdown("Run `npm test` first")).toBe("Run npm test first");
  });

  it("test_link_keeps_its_text_and_drops_its_target", () => {
    expect(stripMarkdown("See [the guide](https://example.com/a?b=c)")).toBe("See the guide");
  });

  it("test_emphasis_and_quote_markers_are_removed", () => {
    expect(stripMarkdown("> **Goal:** _learn_ ~~SPC~~ #tag")).toBe("Goal: learn SPC tag");
  });

  it("test_whitespace_collapses_to_single_spaces", () => {
    expect(stripMarkdown("  two\n\nlines\tapart  ")).toBe("two lines apart");
  });

  it("test_plain_prose_is_returned_unchanged", () => {
    expect(stripMarkdown("A statistical process control primer.")).toBe(
      "A statistical process control primer.",
    );
  });
});

describe("findFirstHeading", () => {
  it("test_first_heading_is_returned_as_plain_text", () => {
    expect(findFirstHeading("intro\n\n# The `SPC` Primer\n\n# Later heading")).toBe(
      "The SPC Primer",
    );
  });

  it("test_a_note_with_no_heading_yields_an_empty_string", () => {
    expect(findFirstHeading("## Subheading only\n\nprose")).toBe("");
  });
});
