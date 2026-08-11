import { describe, expect, it } from "vitest";
import matter from "gray-matter";
import { setFrontmatterField } from "./frontmatter";

describe("setFrontmatterField", () => {
  it("replaces an existing field in place", () => {
    const raw = '---\ntitle: "T"\nsection: "Old"\n---\n\nBody.\n';
    const result = setFrontmatterField(raw, "section", "New");
    expect(matter(result ?? "").data.section).toBe("New");
    expect(result).toContain("Body.");
  });

  it("appends a field that is not present yet", () => {
    const raw = '---\ntitle: "T"\n---\n\nBody.\n';
    const result = setFrontmatterField(raw, "section", "New");
    expect(matter(result ?? "").data).toMatchObject({ title: "T", section: "New" });
  });

  it("creates frontmatter when the file has none", () => {
    const result = setFrontmatterField("# Heading\n\nBody.\n", "section", "New");
    expect(matter(result ?? "").data.section).toBe("New");
    expect(result).toContain("# Heading");
  });

  it("preserves the body exactly", () => {
    const raw = '---\ntitle: "T"\n---\n\nLine one.\n\n- a\n- b\n';
    const result = setFrontmatterField(raw, "section", "New");
    expect(matter(result ?? "").content).toBe("\nLine one.\n\n- a\n- b\n");
  });

  it("quotes values that would otherwise break YAML", () => {
    const raw = '---\ntitle: "T"\n---\n\nBody.\n';
    const result = setFrontmatterField(raw, "section", 'Has: a colon and "quotes"');
    expect(matter(result ?? "").data.section).toBe('Has: a colon and "quotes"');
  });

  it("does not let a field name act as a regular expression", () => {
    // A field of "." previously matched any line and would overwrite the first one.
    const raw = '---\ntitle: "Keep me"\n---\n\nBody.\n';
    const result = setFrontmatterField(raw, ".", "x");
    expect(matter(result ?? "").data.title).toBe("Keep me");
  });

  it("keeps block-form keys intact", () => {
    const raw = '---\ntitle: "T"\nmilestones:\n  - title: "M"\n---\n\nBody.\n';
    const result = setFrontmatterField(raw, "section", "New");
    const data = matter(result ?? "").data;
    expect(data.section).toBe("New");
    expect(Array.isArray(data.milestones)).toBe(true);
  });
});
