import { describe, expect, it } from "vitest";
import { isSameSitePath, slugify, stripFrontmatter, titleFromSlug } from "./content-utils";

const BASE = "http://localhost:3000";

describe("isSameSitePath", () => {
  it("accepts ordinary site paths", () => {
    for (const value of ["/", "/learn", "/learn/ml/notes", "/learn?section=x", "/a#b"]) {
      expect(isSameSitePath(value)).toBe(true);
    }
  });

  it("accepts paths whose next character is punctuation", () => {
    // A denylist that included "-" would wrongly reject these.
    for (const value of ["/-dashed", "/_under", "/.well-known", "/~user"]) {
      expect(isSameSitePath(value)).toBe(true);
    }
  });

  it("rejects protocol-relative URLs", () => {
    expect(isSameSitePath("//evil.example")).toBe(false);
  });

  it("rejects backslash authorities that browsers resolve off-site", () => {
    for (const value of ["/\\evil.example", "/\\evil.example/p", "/\\/evil.example"]) {
      expect(isSameSitePath(value)).toBe(false);
      // Prove the risk is real: this is where a browser would actually navigate.
      expect(new URL(value, BASE).host).toBe("evil.example");
    }
  });

  it("rejects control characters, which URL parsing strips to reveal a host", () => {
    // Interior whitespace survives a .trim(), so these do reach the sanitizer.
    for (const value of ["/\t/evil.example", "/\n/evil.example", "/\r/evil.example"]) {
      expect(isSameSitePath(value)).toBe(false);
      expect(new URL(value, BASE).host).toBe("evil.example");
    }
  });

  it("still allows a plain space, which is escaped rather than stripped", () => {
    expect(isSameSitePath("/my notes")).toBe(true);
    expect(new URL("/my notes", BASE).host).toBe("localhost:3000");
  });

  it("rejects anything that is not a path", () => {
    for (const value of ["", "https://evil.example", "javascript:alert(1)", "learn", "#f"]) {
      expect(isSameSitePath(value)).toBe(false);
    }
  });
});

describe("stripFrontmatter", () => {
  it("removes a real frontmatter mapping", () => {
    const input = ["---", 'title: "T"', "order: 3", "---", "", "Body text.", ""].join("\n");
    expect(stripFrontmatter(input)).toBe("Body text.\n");
  });

  it("removes frontmatter that carries nothing", () => {
    expect(stripFrontmatter("---\n---\n\nBody.\n")).toBe("Body.\n");
  });

  it("keeps a body that opens with a horizontal rule", () => {
    const input = "---\n\nAn opening rule.\n\n---\n\nThis paragraph must survive.\n";
    expect(stripFrontmatter(input)).toBe(input);
  });

  it("does NOT delete the whole note when a rule has no closing pair", () => {
    const input = "---\n\nJust prose after a rule.\n";
    expect(stripFrontmatter(input)).toBe(input);
  });

  it("leaves a note with no frontmatter untouched", () => {
    const input = "# Heading\n\nBody.\n";
    expect(stripFrontmatter(input)).toBe(input);
  });

  it("leaves a setext heading untouched", () => {
    const input = "My Title\n---\n\nBody.\n";
    expect(stripFrontmatter(input)).toBe(input);
  });

  it("handles CRLF line endings", () => {
    const input = '---\r\ntitle: "T"\r\n---\r\n\r\nBody.\r\n';
    expect(stripFrontmatter(input)).toBe("Body.\r\n");
  });

  it("keeps block-form keys such as milestones", () => {
    const input = ["---", "milestones:", '  - title: "M"', "---", "", "Body.", ""].join("\n");
    expect(stripFrontmatter(input)).toBe("Body.\n");
  });

  it("is idempotent", () => {
    const once = stripFrontmatter('---\ntitle: "T"\n---\n\nBody.\n');
    expect(stripFrontmatter(once)).toBe(once);
  });
});

describe("slugify", () => {
  it("strips diacritics rather than dropping the letters", () => {
    expect(slugify("Café Déjà Vu")).toBe("cafe-deja-vu");
  });

  it("expands ampersands into a word", () => {
    expect(slugify("Testing & Design")).toBe("testing-and-design");
  });

  it("collapses path separators so a slug can never traverse directories", () => {
    expect(slugify("../../etc/passwd")).toBe("etc-passwd");
  });

  it("falls back to untitled when nothing survives", () => {
    expect(slugify("!!!")).toBe("untitled");
  });
});

describe("titleFromSlug", () => {
  it("title-cases dashed slugs", () => {
    expect(titleFromSlug("software-engineering")).toBe("Software Engineering");
  });
});
