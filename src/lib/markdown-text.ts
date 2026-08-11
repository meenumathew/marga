/**
 * Plain-text reductions of Markdown, used where a note's prose has to become a
 * title or a description: frontmatter defaults, card subtitles, search text.
 *
 * These live apart from `learn-content.ts` because `scripts/add-frontmatter.mjs`
 * needs the same reductions. That script runs under bare `node` with no build
 * step, so it cannot import this module and carries its own copy instead;
 * `scripts/add-frontmatter.test.mjs` compares the two on a shared table of
 * inputs, so the copies cannot drift without a test going red.
 */

/**
 * Markdown decoration removed and whitespace collapsed, leaving readable prose.
 *
 * Inline code and link text keep their content and lose their syntax; emphasis,
 * strikethrough, blockquote, and heading markers go entirely. The result is safe
 * to put in a YAML string or a `<title>`.
 */
export function stripMarkdown(value: string): string {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Text of the first `# ` heading as plain prose, or "" when a note has none. */
export function findFirstHeading(markdown: string): string {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? stripMarkdown(match[1] ?? "") : "";
}
