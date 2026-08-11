import { describe, expect, it } from "vitest";
import { normalizeEvidenceEntry, sanitizeEvidenceLink } from "@/lib/evidence";

describe("sanitizeEvidenceLink", () => {
  it("keeps http(s) URLs", () => {
    expect(sanitizeEvidenceLink("https://example.com/pr/42")).toBe("https://example.com/pr/42");
    expect(sanitizeEvidenceLink("http://localhost:3000/x")).toBe("http://localhost:3000/x");
  });

  it("keeps site-relative paths", () => {
    expect(sanitizeEvidenceLink("/learn/practice/keep-a-project-log")).toBe(
      "/learn/practice/keep-a-project-log",
    );
  });

  it("strips active-content and protocol-relative links", () => {
    expect(sanitizeEvidenceLink("javascript:alert(1)")).toBe("");
    expect(sanitizeEvidenceLink("//evil.example.com")).toBe("");
    expect(sanitizeEvidenceLink("data:text/html,<script>")).toBe("");
    expect(sanitizeEvidenceLink("mailto:x@y.com")).toBe("");
  });

  it("strips links that only look site-relative", () => {
    // A browser normalizes the backslash into a slash, so each of these
    // resolves to evil.example despite starting with a single "/".
    for (const value of ["/\\evil.example", "/\\evil.example/pr/42", "/\\/evil.example"]) {
      expect(sanitizeEvidenceLink(value)).toBe("");
      expect(new URL(value, "http://localhost:3000").host).toBe("evil.example");
    }
  });

  it("strips interior control characters that URL parsing would remove", () => {
    for (const value of ["/x\t/evil.example", "/x\n/evil.example"]) {
      expect(sanitizeEvidenceLink(value)).toBe("");
    }
  });

  it("treats blank and non-string input as empty", () => {
    expect(sanitizeEvidenceLink("")).toBe("");
    expect(sanitizeEvidenceLink("   ")).toBe("");
    expect(sanitizeEvidenceLink(undefined)).toBe("");
    expect(sanitizeEvidenceLink(42)).toBe("");
  });
});

describe("normalizeEvidenceEntry", () => {
  const valid = {
    id: "abc",
    date: "2026-07-03",
    kind: "Build",
    title: "Shipped the ingest job",
    sectionSlug: "practice",
    section: "Practice",
    source: "",
    link: "https://example.com",
    note: "",
  };

  it("accepts a well-formed entry", () => {
    expect(normalizeEvidenceEntry(valid)).toMatchObject({
      id: "abc",
      kind: "Build",
      sectionSlug: "practice",
    });
  });

  it("rejects entries missing an id, title, or valid date", () => {
    expect(normalizeEvidenceEntry({ ...valid, id: "" })).toBeNull();
    expect(normalizeEvidenceEntry({ ...valid, title: "   " })).toBeNull();
    expect(normalizeEvidenceEntry({ ...valid, date: "07/03/2026" })).toBeNull();
    expect(normalizeEvidenceEntry({ ...valid, date: "2026-99-99" })).toBeNull();
    expect(normalizeEvidenceEntry({ ...valid, date: "2025-02-29" })).toBeNull();
    expect(normalizeEvidenceEntry(null)).toBeNull();
  });

  it("accepts leap-year February 29", () => {
    expect(normalizeEvidenceEntry({ ...valid, date: "2024-02-29" })?.date).toBe("2024-02-29");
  });

  it("falls back to the Other kind for an unknown kind", () => {
    expect(normalizeEvidenceEntry({ ...valid, kind: "Nonsense" })?.kind).toBe("Other");
  });

  it("sanitizes the link while normalizing", () => {
    expect(normalizeEvidenceEntry({ ...valid, link: "javascript:alert(1)" })?.link).toBe("");
  });
});
