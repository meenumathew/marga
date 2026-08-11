import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import matter from "gray-matter";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { isCalendarDate } from "./calendar-date";
import { isSameSitePath, titleFromSlug } from "./content-utils";
import { findFirstHeading, stripMarkdown } from "./markdown-text";
import { getStoragePaths } from "./storage-paths";

/**
 * Absolute so filesystem access never depends on the process working
 * directory, which differs between `next dev`, a standalone build, and a test
 * runner. `sourcePath` stays repo-relative for display.
 */
export const CONTENT_ROOT = getStoragePaths().contentRoot;
/** Repo-relative prefix used in UI labels and API responses. */
const CONTENT_ROOT_LABEL = "content/learn";
const SUPPORTED_EXTENSIONS = new Set([".md", ".mdx"]);

/** Optional per-folder metadata file describing a section. */
export const SECTION_CONFIG_FILE = "_section.json";
/** Root-level notes (no folder) belong to this virtual, non-editable section. */
export const GENERAL_SECTION_SLUG = "";
const GENERAL_SECTION_TITLE = "General";
const DEFAULT_SECTION_ORDER = 100;

export type LearnContentMode =
  | "Tutorial"
  | "How-to"
  | "Reference"
  | "Explanation"
  | "Lesson"
  | "Plan";

export type LessonMilestone = {
  /** Stable frontmatter id; used for confirmations and durable badge mapping. */
  id: string;
  title: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  type: string;
  /** Optional short context shown on milestone cards. */
  note: string;
  /** Optional in-site link this milestone points to instead of its source note (e.g. a section view). */
  link: string;
};

export type MilestoneWithSource = LessonMilestone & {
  sourceTitle: string;
  sourceHref: string;
  sourceSlug: string;
  /** Position within its source note's milestones array; identifies it for edit/delete. */
  sourceIndex: number;
};

/** A section is a top-level folder under content/learn. Metadata is optional (_section.json). */
export type SectionMeta = {
  /** Folder name; "" for the virtual General section (root-level notes). */
  slug: string;
  title: string;
  description: string;
  order: number;
  /** Optional Lucide icon name from _section.json. */
  icon: string;
  noteCount: number;
  /** False for the virtual General section, which has no folder to rename or delete. */
  editable: boolean;
};

export type LearnContentMeta = {
  slug: string;
  slugSegments: string[];
  href: string;
  title: string;
  description: string;
  section: string;
  /** Folder name the note lives in; "" for root-level (General) notes. */
  sectionSlug: string;
  mode: LearnContentMode;
  level: string;
  duration: string;
  updated: string;
  order: number;
  /** Plan year (from `year` frontmatter), e.g. 2026. 0 when unset. Used to group Plans. */
  year: number;
  /** Repo-relative posix path for display, e.g. "content/learn/ml/notes.md". */
  sourcePath: string;
  /** Absolute path. Use this for every filesystem read, write, rename, or delete. */
  absolutePath: string;
  milestones: LessonMilestone[];
};

export type LearnHeading = {
  level: number;
  text: string;
  anchor: string;
};

export type LearnContentPage = LearnContentMeta & {
  html: string;
  headings: LearnHeading[];
};

/**
 * Every note on disk, parsed and ordered.
 *
 * Memoized for the lifetime of one request: a single page can ask for the
 * library five times (the view, its sections, its milestones, a note's
 * neighbours), and each ask otherwise re-walks `content/learn` and re-parses
 * every file. Request scope is what makes this safe to cache at all — there is
 * nothing to invalidate, because a write in one request is always visible to the
 * next one. A longer-lived cache would have to answer "when does a file change
 * drop this?", and getting that wrong serves notes that no longer exist.
 *
 * The invariant a write route must keep: read the library *before* writing, and
 * do not read it again afterwards in the same request. Every route does this
 * today. A route that read, wrote, then re-read would see its own pre-write
 * answer.
 */
export const getAllLearnContent = cache((): LearnContentMeta[] => {
  return collectContentFiles(CONTENT_ROOT).map(readContentMeta).sort(compareContentMeta);
});

/** Create a frontmatter-safe milestone id, unique within one note. */
export function makeMilestoneId(
  title: string,
  date: string,
  existingIds: readonly string[] = [],
): string {
  const usedIds = new Set(existingIds.map(normalizeMilestoneId).filter(Boolean));
  const titlePart = normalizeMilestoneId(title) || "milestone";
  const base = isCalendarDate(date) ? `${date}-${titlePart}` : titlePart;

  return uniqueMilestoneId(base, usedIds);
}

/** Every milestone declared in note frontmatter, sorted by date. */
export function getAllMilestones(): MilestoneWithSource[] {
  return getAllLearnContent()
    .flatMap((item) =>
      item.milestones.map((milestone, sourceIndex) => ({
        ...milestone,
        sourceTitle: item.title,
        sourceHref: item.href,
        sourceSlug: item.slug,
        sourceIndex,
      })),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type ContentNeighbor = { title: string; href: string; section: string };

/**
 * Previous/next notes within the same section, in the library's display order,
 * so a reader can page through a section sequentially (Prev/Next footer).
 */
export function getSectionNeighbors(slug: string): {
  previous: ContentNeighbor | null;
  next: ContentNeighbor | null;
} {
  // Scan once: getAllLearnContent re-reads and re-parses every note on disk.
  const allContent = getAllLearnContent();
  const current = allContent.find((item) => item.slug === slug);

  if (!current) {
    return { previous: null, next: null };
  }

  const sectionItems = allContent.filter((item) => item.sectionSlug === current.sectionSlug);
  const index = sectionItems.findIndex((item) => item.slug === slug);

  const toNeighbor = (item?: LearnContentMeta): ContentNeighbor | null =>
    item ? { title: item.title, href: item.href, section: item.section } : null;

  return {
    previous: toNeighbor(sectionItems[index - 1]),
    next: toNeighbor(sectionItems[index + 1]),
  };
}

export async function getLearnContentBySlug(
  slugSegments: string[],
): Promise<LearnContentPage | null> {
  const slug = slugSegments.join("/");
  const meta = getAllLearnContent().find((contentItem) => contentItem.slug === slug);

  if (!meta || !fs.existsSync(meta.absolutePath)) {
    return null;
  }

  const raw = fs.readFileSync(meta.absolutePath, "utf8");
  const parsed = matter(raw);
  // Directory of this note relative to the content root, for resolving its links.
  const sourceDirSegments = toPosix(path.relative(CONTENT_ROOT, path.dirname(meta.absolutePath)))
    .split("/")
    .filter(Boolean);
  const html = await renderMarkdownToHtml(parsed.content, sourceDirSegments);

  return {
    ...meta,
    html,
    headings: extractHeadings(html),
  };
}

function collectContentFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectContentFiles(entryPath));
      continue;
    }

    if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function slugSegmentsFromRelativePath(relativePath: string): string[] {
  const extension = path.extname(relativePath);
  const segments = toPosix(relativePath.slice(0, -extension.length)).split("/");

  // A README file acts as the index page of its folder: content/learn/career/README.md → /learn/career.
  if (segments.length > 1 && (segments[segments.length - 1] ?? "").toLowerCase() === "readme") {
    segments.pop();
  }

  return segments;
}

/** The section a file belongs to is its top-level folder under content/learn. */
function sectionSlugFromRelativePath(relativePath: string): string {
  const dir = path.dirname(relativePath);
  return dir === "." ? GENERAL_SECTION_SLUG : (toPosix(dir).split("/")[0] ?? GENERAL_SECTION_SLUG);
}

type SectionConfig = {
  title?: string;
  description?: string;
  order?: number;
  icon?: string;
};

/** Read a folder's optional _section.json. Returns an empty config when absent or invalid. */
function readSectionConfig(sectionSlug: string): SectionConfig {
  if (!sectionSlug) {
    return {};
  }

  const configPath = path.join(CONTENT_ROOT, sectionSlug, SECTION_CONFIG_FILE);

  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown>;
    return {
      title: readString(parsed.title) || undefined,
      description: readString(parsed.description) || undefined,
      order: typeof parsed.order === "number" ? parsed.order : undefined,
      icon: readString(parsed.icon) || undefined,
    };
  } catch {
    return {};
  }
}

/** Display title for a section slug: _section.json title, else a title-cased slug, else "General". */
function sectionTitle(sectionSlug: string): string {
  if (!sectionSlug) {
    return GENERAL_SECTION_TITLE;
  }

  return readSectionConfig(sectionSlug).title || titleFromSlug(sectionSlug);
}

/**
 * Every section on the site, ordered by _section.json order then title.
 * Includes empty folders (so a freshly created section shows up) and a
 * virtual "General" section when any root-level notes exist.
 */
export const getAllSections = cache((): SectionMeta[] => {
  const counts = new Map<string, number>();

  for (const note of getAllLearnContent()) {
    counts.set(note.sectionSlug, (counts.get(note.sectionSlug) ?? 0) + 1);
  }

  const folderSlugs = new Set<string>();

  if (fs.existsSync(CONTENT_ROOT)) {
    for (const entry of fs.readdirSync(CONTENT_ROOT, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        folderSlugs.add(entry.name);
      }
    }
  }

  const sections: SectionMeta[] = [];

  for (const slug of folderSlugs) {
    const config = readSectionConfig(slug);
    sections.push({
      slug,
      title: config.title || titleFromSlug(slug),
      description: config.description ?? "",
      order: config.order ?? DEFAULT_SECTION_ORDER,
      icon: config.icon ?? "",
      noteCount: counts.get(slug) ?? 0,
      editable: true,
    });
  }

  const generalCount = counts.get(GENERAL_SECTION_SLUG) ?? 0;

  if (generalCount > 0) {
    sections.push({
      slug: GENERAL_SECTION_SLUG,
      title: GENERAL_SECTION_TITLE,
      description: "Notes not yet filed under a section.",
      order: Number.MAX_SAFE_INTEGER,
      icon: "",
      noteCount: generalCount,
      editable: false,
    });
  }

  return sections.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
});

function readContentMeta(filePath: string): LearnContentMeta {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  const relativePath = path.relative(CONTENT_ROOT, filePath);
  const slugSegments = slugSegmentsFromRelativePath(relativePath);
  const fileTitle = titleFromSlug(slugSegments[slugSegments.length - 1] ?? "lesson");
  const sectionSlug = sectionSlugFromRelativePath(relativePath);
  const title = readString(data.title) || findFirstHeading(parsed.content) || fileTitle;
  const description =
    readString(data.description) || firstParagraph(parsed.content) || "Learning note";
  const order = readNumber(data.order, 1000);
  const mode = readMode(data.mode);

  return {
    slug: slugSegments.join("/"),
    slugSegments,
    href: `/learn/${slugSegments.join("/")}`,
    title,
    description,
    // The folder is the single source of truth for section membership.
    section: sectionTitle(sectionSlug),
    sectionSlug,
    mode,
    level: readString(data.level) || "Any level",
    duration: readString(data.duration) || "Self-paced",
    updated: readString(data.updated) || "Draft",
    order,
    year: readNumber(data.year, 0),
    sourcePath: `${CONTENT_ROOT_LABEL}/${toPosix(relativePath)}`,
    absolutePath: filePath,
    milestones: readMilestones(data.milestones),
  };
}

function readMilestones(value: unknown): LessonMilestone[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const milestones: LessonMilestone[] = [];
  const usedIds = new Set<string>();

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const title = readString(record.title);
    // YAML parses unquoted dates into Date objects; accept both forms.
    const date =
      record.date instanceof Date
        ? record.date.toISOString().slice(0, 10)
        : readString(record.date);

    if (!title || !isCalendarDate(date)) {
      continue;
    }

    milestones.push({
      id: uniqueMilestoneId(
        normalizeMilestoneId(record.id) || makeMilestoneId(title, date),
        usedIds,
      ),
      title,
      date,
      type: readString(record.type) || "Milestone",
      note: readString(record.note),
      // Only same-site paths ("/learn?section=..."); ignore external/protocol URLs.
      link: sanitizeInternalLink(readString(record.link)),
    });
  }

  return milestones.sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeMilestoneId(value: unknown): string {
  return readString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function uniqueMilestoneId(base: string, usedIds: Set<string>): string {
  const normalizedBase = normalizeMilestoneId(base) || "milestone";
  let candidate = normalizedBase;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${normalizedBase}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);
  return candidate;
}

async function renderMarkdownToHtml(
  markdown: string,
  sourceDirSegments: string[],
): Promise<string> {
  const output = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeSlug)
    .use(rehypeRewriteMarkdownLinks, { baseSegments: sourceDirSegments })
    .use(rehypeStringify)
    .process(markdown);

  return String(output);
}

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const MARKDOWN_EXTENSION_PATTERN = /\.(md|mdx)$/i;

/**
 * Notes cross-link with relative Markdown links like `[Map](../ml/diataxis-map.md)`.
 * Rewrite those to their `/learn/...` routes so links keep working inside the site.
 */
function rehypeRewriteMarkdownLinks(options: { baseSegments: string[] }) {
  return (tree: HastNode) => {
    visitAnchors(tree, options.baseSegments);
  };
}

function visitAnchors(node: HastNode, baseSegments: string[]): void {
  if (node.type === "element" && node.tagName === "a" && node.properties) {
    const href = node.properties.href;

    if (typeof href === "string") {
      const rewritten = rewriteMarkdownHref(href, baseSegments);

      if (rewritten) {
        node.properties.href = rewritten;
      }
    }
  }

  for (const child of node.children ?? []) {
    visitAnchors(child, baseSegments);
  }
}

function rewriteMarkdownHref(href: string, baseSegments: string[]): string | null {
  // Leave absolute URLs, protocol links, site-root paths, and pure anchors alone.
  if (/^([a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(href)) {
    return null;
  }

  const hashIndex = href.indexOf("#");
  const pathPart = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex);

  if (!MARKDOWN_EXTENSION_PATTERN.test(pathPart)) {
    return null;
  }

  const segments = resolveRelativeSegments(
    baseSegments,
    pathPart.replace(MARKDOWN_EXTENSION_PATTERN, ""),
  );

  if (!segments || segments.length === 0) {
    return null;
  }

  if (segments.length > 1 && (segments[segments.length - 1] ?? "").toLowerCase() === "readme") {
    segments.pop();
  }

  return `/learn/${segments.map(encodeURIComponent).join("/")}${hash}`;
}

function resolveRelativeSegments(baseSegments: string[], relativePath: string): string[] | null {
  const segments = [...baseSegments];

  for (const part of relativePath.split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      if (segments.length === 0) {
        return null;
      }

      segments.pop();
      continue;
    }

    try {
      segments.push(decodeURIComponent(part));
    } catch {
      segments.push(part);
    }
  }

  return segments;
}

/** A rendered `h2`/`h3`, capturing the id rehype-slug assigned and its inner HTML. */
const RENDERED_HEADING = /<h([23])\b[^>]*\sid="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/g;

/**
 * Read the headings back out of the rendered HTML.
 *
 * The anchor has to be whatever `rehype-slug` actually put in the `id`, or the
 * table of contents links to fragments the page does not contain. Deriving the
 * slug from the Markdown instead means reimplementing github-slugger, and every
 * difference becomes a dead link: it keeps hyphens and underscores, turns each
 * space into its own dash rather than collapsing runs, and leaves leading and
 * trailing dashes in place. Reading the ids back is exact by construction.
 */
export function extractHeadings(html: string): LearnHeading[] {
  const headings: LearnHeading[] = [];

  for (const match of html.matchAll(RENDERED_HEADING)) {
    headings.push({
      level: Number(match[1]),
      text: htmlToPlainText(match[3] ?? ""),
      anchor: match[2] ?? "",
    });
  }

  return headings;
}

/** Heading inner HTML to display text: drop tags, then decode entities. */
function htmlToPlainText(value: string): string {
  return (
    value
      .replace(/<[^>]*>/g, "")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&(?:apos|#39);/g, "'")
      // Ampersand last, so a decoded entity is never decoded a second time.
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function compareContentMeta(firstItem: LearnContentMeta, secondItem: LearnContentMeta): number {
  return (
    firstItem.order - secondItem.order ||
    firstItem.section.localeCompare(secondItem.section) ||
    firstItem.title.localeCompare(secondItem.title)
  );
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Accept only same-site links: a path starting with a single "/" (e.g.
 * "/learn?section=knowledge-system"). Rejects protocol URLs and anything else,
 * so a milestone link can never navigate off-site.
 *
 * Both "//host" and "/\host" must be rejected: browsers normalize a backslash
 * in the authority position to "/", so "/\evil.example" resolves to
 * "http://evil.example" despite starting with a single slash.
 */
export function sanitizeInternalLink(value: string): string {
  if (!isSameSitePath(value)) {
    return "";
  }

  return value;
}

function readNumber(value: unknown, fallback: number): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function readMode(value: unknown): LearnContentMode {
  const mode = readString(value);
  const modes: LearnContentMode[] = [
    "Tutorial",
    "How-to",
    "Reference",
    "Explanation",
    "Lesson",
    "Plan",
  ];
  return modes.includes(mode as LearnContentMode) ? (mode as LearnContentMode) : "Lesson";
}

function firstParagraph(markdown: string): string {
  const paragraph = markdown
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find((block) => block && !block.startsWith("#") && !block.startsWith("```"));

  return paragraph ? stripMarkdown(paragraph).slice(0, 180) : "";
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}
