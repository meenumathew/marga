import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { slugify, stripFrontmatter } from "@/lib/content-utils";
import {
  CONTENT_ROOT,
  getAllSections,
  GENERAL_SECTION_SLUG,
  SECTION_CONFIG_FILE,
} from "@/lib/learn-content";
import { logRouteError } from "@/lib/log";
import { rejectCrossOriginWrite } from "@/lib/request-guard";
import { resolveSafeStoragePath } from "@/lib/safe-storage-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 120_000;
const modes = new Set(["Tutorial", "How-to", "Reference", "Explanation", "Lesson", "Plan"]);

export async function POST(request: NextRequest) {
  const refusal = rejectCrossOriginWrite(request);

  if (refusal) {
    return refusal;
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const title = readString(payload.title);
    const description = readString(payload.description);
    const section = readString(payload.section) || "General";
    const requestedMode = readString(payload.mode);
    const mode = modes.has(requestedMode) ? requestedMode : "Lesson";
    const level = readString(payload.level) || "Any level";
    const duration = readString(payload.duration) || "Self-paced";
    const body = stripFrontmatter(readString(payload.body));
    const extension = readString(payload.extension) === "mdx" ? "mdx" : "md";
    // Plans carry a year so the /plans view can group them; 0 means "unset".
    const yearValue = Number(readString(payload.year));
    const year =
      Number.isInteger(yearValue) && yearValue >= 2000 && yearValue <= 2100 ? yearValue : 0;

    if (!title || !description || !body) {
      return NextResponse.json(
        { message: "Title, description, and note body are required." },
        { status: 400 },
      );
    }

    if (body.length > MAX_BODY_LENGTH) {
      return NextResponse.json(
        { message: "This file is too large for the local content studio." },
        { status: 413 },
      );
    }

    const sectionSlug = slugify(section);
    const fileSlug = slugify(readString(payload.slug) || title);
    const outputPath = path.join(CONTENT_ROOT, sectionSlug, `${fileSlug}.${extension}`);
    const relativeOutputPath = path.relative(CONTENT_ROOT, outputPath);

    if (relativeOutputPath.startsWith("..") || path.isAbsolute(relativeOutputPath)) {
      return NextResponse.json({ message: "Invalid content path." }, { status: 400 });
    }

    const safeOutputPath = await resolveSafeStoragePath(CONTENT_ROOT, outputPath);

    if (!safeOutputPath) {
      return NextResponse.json({ message: "Invalid content path." }, { status: 400 });
    }

    try {
      await fs.access(safeOutputPath);
      return NextResponse.json(
        { message: "A content file with this slug already exists. Choose a different slug." },
        { status: 409 },
      );
    } catch {
      await fs.mkdir(path.dirname(safeOutputPath), { recursive: true });
    }

    // If saving this note is what created the section folder, give it the same
    // _section.json the dedicated section feature would — so an inline "＋ New
    // section…" preserves the typed title casing and gets a real display order,
    // instead of falling back to a title-cased slug at the default order.
    if (!(await ensureSectionConfig(sectionSlug, section))) {
      return NextResponse.json({ message: "Invalid content path." }, { status: 400 });
    }

    const markdown = buildMarkdown({
      title,
      description,
      section,
      mode,
      level,
      duration,
      body,
      year,
    });
    await fs.writeFile(safeOutputPath, markdown, "utf8");

    return NextResponse.json({
      message: "Content saved. It now appears in the learning library.",
      href: `/learn/${sectionSlug}/${fileSlug}`,
      path: toPosix(path.join("content", "learn", relativeOutputPath)),
    });
  } catch (error) {
    logRouteError("POST /api/content", error);
    return NextResponse.json({ message: "Could not save this content file." }, { status: 500 });
  }
}

/**
 * Ensure a section folder has a _section.json. No-ops for the virtual General
 * section and for sections that already have config, so it never overwrites an
 * existing section's title or order.
 */
async function ensureSectionConfig(sectionSlug: string, sectionTitle: string): Promise<boolean> {
  if (!sectionSlug || sectionSlug === GENERAL_SECTION_SLUG) {
    return true;
  }

  const configPath = path.join(CONTENT_ROOT, sectionSlug, SECTION_CONFIG_FILE);
  const safeConfigPath = await resolveSafeStoragePath(CONTENT_ROOT, configPath);

  if (!safeConfigPath) {
    return false;
  }

  try {
    await fs.access(safeConfigPath);
    return true; // Existing section — leave its config untouched.
  } catch {
    // No config yet: this save created the section, so mint one.
  }

  // Next order among other real sections, mirroring the dedicated section
  // route. Skip this just-created folder and the virtual General section (its
  // sentinel order would otherwise dominate the max).
  const nextOrder =
    Math.max(
      0,
      ...getAllSections()
        .filter((section) => section.slug !== sectionSlug && section.slug !== GENERAL_SECTION_SLUG)
        .map((section) => section.order)
        .filter((order) => Number.isFinite(order)),
    ) + 1;

  const config = { title: sectionTitle.trim(), order: nextOrder };
  await fs.writeFile(safeConfigPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  return true;
}

function buildMarkdown(input: {
  title: string;
  description: string;
  section: string;
  mode: string;
  level: string;
  duration: string;
  body: string;
  year: number;
}): string {
  const frontmatter = [
    "---",
    `title: ${yamlString(input.title)}`,
    `description: ${yamlString(input.description)}`,
    `section: ${yamlString(input.section)}`,
    `mode: ${yamlString(input.mode)}`,
    `level: ${yamlString(input.level)}`,
    `duration: ${yamlString(input.duration)}`,
    // Year is only meaningful for Plans; omit it otherwise to keep frontmatter clean.
    ...(input.year > 0 ? [`year: ${input.year}`] : []),
    `updated: ${yamlString(new Date().toISOString().slice(0, 10))}`,
    "order: 100",
    "---",
    "",
  ].join("\n");

  return `${frontmatter}${input.body.trim()}\n`;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function yamlString(value: string): string {
  return JSON.stringify(value.trim());
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}
