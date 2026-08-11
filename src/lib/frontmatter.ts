import matter from "gray-matter";

/**
 * Set or insert a top-level frontmatter string field, creating the frontmatter
 * block when the file has none.
 *
 * Returns null when the edit would produce frontmatter the content system
 * cannot read back, so callers can leave the file alone instead of corrupting it.
 *
 * Lives here rather than beside the route that uses it: Next treats every
 * export from a `route.ts` as part of the route contract and fails the
 * production build on anything it does not recognise.
 */
export function setFrontmatterField(raw: string, field: string, value: string): string | null {
  const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const line = `${field}: ${JSON.stringify(value)}`;

  if (!frontmatterMatch) {
    return `---\n${line}\n---\n\n${raw}`;
  }

  const lines = frontmatterMatch[1]?.split("\n") ?? [];
  const fieldPattern = new RegExp(`^${escapeForPattern(field)}:`);
  const index = lines.findIndex((existing) => fieldPattern.test(existing));

  if (index === -1) {
    lines.push(line);
  } else {
    lines[index] = line;
  }

  const rebuilt = `---\n${lines.join("\n")}\n---\n`;
  const result = `${rebuilt}${raw.slice(frontmatterMatch[0].length)}`;

  try {
    matter(result);
  } catch {
    return null;
  }

  return result;
}

/** The field name is interpolated into a RegExp, so neutralise its metacharacters. */
function escapeForPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
