export function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "untitled";
}

export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** A path starting with "/" that is not followed by another slash or a backslash. */
const SAME_SITE_PATH = /^\/(?![/\\])/;

/**
 * True for a link that stays on this site.
 *
 * The second character matters as much as the first. Browsers normalize a
 * backslash in the authority position to a slash, so "//evil.example" and
 * "/\\evil.example" both resolve off-site even though only the first looks
 * protocol-relative. Rejecting both is what makes "starts with /" actually mean
 * "same-site". Control characters are refused too, because URL parsing strips
 * them and can re-expose the trick after a sanitizer has approved the string.
 */
export function isSameSitePath(value: string): boolean {
  return SAME_SITE_PATH.test(value) && !/\p{Cc}/u.test(value);
}

/** A leading "---" fence and the block it closes. */
const FRONTMATTER_BLOCK = /^---[ \t]*\r?\n([\s\S]*?)\r?\n?---[ \t]*(?:\r?\n|$)/;
/** A top-level YAML mapping entry, e.g. \`title: "x"\` or \`milestones:\`. */
const MAPPING_KEY_LINE = /^[A-Za-z0-9_.$-]+[ \t]*:(?:[ \t]|$)/;

/**
 * Remove a pasted frontmatter block so the caller's own fields drive the file.
 *
 * Real frontmatter is a YAML *mapping*. A body that merely opens with a
 * horizontal rule is not, and stripping to its next "---" silently deletes the
 * first paragraph, or the entire note when there is no second rule. So the block
 * is only removed when its first meaningful line reads as \`key:\`.
 *
 * Pure and dependency-free, so the client studio and the content API strip
 * identically without pulling a YAML parser into the browser bundle.
 */
export function stripFrontmatter(value: string): string {
  const match = value.match(FRONTMATTER_BLOCK);

  if (!match || !looksLikeMapping(match[1] ?? "")) {
    return value;
  }

  return value.slice(match[0].length).replace(/^(?:\r?\n)+/, "");
}

/** True when a fenced block reads as YAML key/value pairs rather than prose. */
function looksLikeMapping(block: string): boolean {
  const firstLine = block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));

  // An empty block ("---\\n---") is frontmatter that simply carries nothing.
  return firstLine === undefined || MAPPING_KEY_LINE.test(firstLine);
}
