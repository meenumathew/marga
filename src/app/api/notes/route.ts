import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import matter from "gray-matter";
import { slugify, titleFromSlug } from "@/lib/content-utils";
import { CONTENT_ROOT, getAllLearnContent, SECTION_CONFIG_FILE } from "@/lib/learn-content";
import { setFrontmatterField } from "@/lib/frontmatter";
import { logRouteError } from "@/lib/log";
import { rejectCrossOriginWrite } from "@/lib/request-guard";
import { resolveSafeStoragePath } from "@/lib/safe-storage-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTENT_LENGTH = 200_000;

export async function GET(request: NextRequest) {
  try {
    const slug = request.nextUrl.searchParams.get("slug")?.trim() ?? "";
    const note = getAllLearnContent().find((item) => item.slug === slug);

    if (!note) {
      return NextResponse.json({ message: "That note does not exist." }, { status: 404 });
    }

    const safeNotePath = await resolveSafeStoragePath(CONTENT_ROOT, note.absolutePath);

    if (!safeNotePath) {
      return NextResponse.json({ message: "Invalid content path." }, { status: 400 });
    }

    const raw = await fs.readFile(safeNotePath, "utf8");

    return NextResponse.json({
      slug: note.slug,
      title: note.title,
      section: note.section,
      href: note.href,
      sourcePath: note.sourcePath,
      raw,
    });
  } catch (error) {
    logRouteError("GET /api/notes", error);
    return NextResponse.json({ message: "Could not read this note." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const refusal = rejectCrossOriginWrite(request);

  if (refusal) {
    return refusal;
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const slug = readString(payload.slug);
    const content = typeof payload.content === "string" ? payload.content : "";

    if (!slug || !content.trim()) {
      return NextResponse.json(
        { message: "A note and its content are required." },
        { status: 400 },
      );
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return NextResponse.json(
        { message: "This file is too large for the editor." },
        { status: 413 },
      );
    }

    const note = getAllLearnContent().find((item) => item.slug === slug);

    if (!note) {
      return NextResponse.json({ message: "That note does not exist." }, { status: 404 });
    }

    const safeNotePath = await resolveSafeStoragePath(CONTENT_ROOT, note.absolutePath);

    if (!safeNotePath) {
      return NextResponse.json({ message: "Invalid content path." }, { status: 400 });
    }

    // Refuse to save anything the content system cannot read back.
    try {
      matter(content);
    } catch {
      return NextResponse.json(
        { message: "The frontmatter is not valid YAML. Fix it and save again." },
        { status: 400 },
      );
    }

    await fs.writeFile(safeNotePath, content.endsWith("\n") ? content : `${content}\n`, "utf8");

    return NextResponse.json({ message: `Saved "${note.title}".`, href: note.href });
  } catch (error) {
    logRouteError("PUT /api/notes", error);
    return NextResponse.json({ message: "Could not save this note." }, { status: 500 });
  }
}

/**
 * Move a note to another section by relocating its file into that section's
 * folder. The folder is the source of truth; we also keep the frontmatter
 * `section` mirror accurate for portability.
 *
 * Accepts a target as `sectionSlug` (folder name; "" means the root/General
 * section) or a display `section` name, which is slugified.
 */
export async function PATCH(request: NextRequest) {
  const refusal = rejectCrossOriginWrite(request);

  if (refusal) {
    return refusal;
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const slug = readString(payload.slug);

    if (!slug) {
      return NextResponse.json({ message: "A note is required." }, { status: 400 });
    }

    const note = getAllLearnContent().find((item) => item.slug === slug);

    if (!note) {
      return NextResponse.json({ message: "That note does not exist." }, { status: 404 });
    }

    const safeSourcePath = await resolveSafeStoragePath(CONTENT_ROOT, note.absolutePath);

    if (!safeSourcePath) {
      return NextResponse.json({ message: "Invalid content path." }, { status: 400 });
    }

    const hasSlug = "sectionSlug" in payload;
    const rawTarget = hasSlug ? readString(payload.sectionSlug) : readString(payload.section);

    if (!hasSlug && !rawTarget) {
      return NextResponse.json({ message: "A target section is required." }, { status: 400 });
    }

    const targetSlug = rawTarget ? slugify(rawTarget) : "";

    if (targetSlug === note.sectionSlug) {
      return NextResponse.json({ message: `"${note.title}" is already in that section.` });
    }

    const fileName = path.basename(note.absolutePath);
    const targetDir = targetSlug ? path.join(CONTENT_ROOT, targetSlug) : CONTENT_ROOT;
    const targetPath = path.join(targetDir, fileName);
    const relative = path.relative(CONTENT_ROOT, targetPath);

    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      return NextResponse.json({ message: "That target section is not valid." }, { status: 400 });
    }

    const safeTargetPath = await resolveSafeStoragePath(CONTENT_ROOT, targetPath);

    if (!safeTargetPath) {
      return NextResponse.json({ message: "That target section is not valid." }, { status: 400 });
    }

    if (await pathExists(safeTargetPath)) {
      return NextResponse.json(
        { message: "A note with this file name already exists in that section." },
        { status: 409 },
      );
    }

    await fs.mkdir(path.dirname(safeTargetPath), { recursive: true });

    // Move first, then rewrite the frontmatter mirror at the destination. Doing
    // it the other way round leaves the note claiming a section it is not in
    // when the rename fails (a cross-device move, a permission error).
    const nextTitle = await sectionTitleForSlug(targetSlug);
    await fs.rename(safeSourcePath, safeTargetPath);

    const raw = await fs.readFile(safeTargetPath, "utf8");
    const updated = setFrontmatterField(raw, "section", nextTitle);

    if (updated !== null) {
      await fs.writeFile(safeTargetPath, updated, "utf8");
    }

    return NextResponse.json({ message: `Moved "${note.title}" to ${nextTitle}.` });
  } catch (error) {
    logRouteError("PATCH /api/notes", error);
    return NextResponse.json({ message: "Could not move this note." }, { status: 500 });
  }
}

/** Resolve a section slug to its display title (from _section.json, else the slug). */
async function sectionTitleForSlug(sectionSlug: string): Promise<string> {
  if (!sectionSlug) {
    return "General";
  }

  try {
    const configPath = await resolveSafeStoragePath(
      CONTENT_ROOT,
      path.join(CONTENT_ROOT, sectionSlug, SECTION_CONFIG_FILE),
    );

    if (!configPath) {
      return titleFromSlug(sectionSlug);
    }

    const raw = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const title = typeof parsed.title === "string" ? parsed.title.trim() : "";

    if (title) {
      return title;
    }
  } catch {
    // No config file; fall through to the title-cased slug.
  }

  return titleFromSlug(sectionSlug);
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function DELETE(request: NextRequest) {
  const refusal = rejectCrossOriginWrite(request);

  if (refusal) {
    return refusal;
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const slug = readString(payload.slug);

    if (!slug) {
      return NextResponse.json({ message: "A note is required." }, { status: 400 });
    }

    const note = getAllLearnContent().find((item) => item.slug === slug);

    if (!note) {
      return NextResponse.json({ message: "That note does not exist." }, { status: 404 });
    }

    const safeNotePath = await resolveSafeStoragePath(CONTENT_ROOT, note.absolutePath);

    if (!safeNotePath) {
      return NextResponse.json({ message: "Invalid content path." }, { status: 400 });
    }

    await fs.rm(safeNotePath);

    return NextResponse.json({ message: `Deleted "${note.title}".` });
  } catch (error) {
    logRouteError("DELETE /api/notes", error);
    return NextResponse.json({ message: "Could not delete this note." }, { status: 500 });
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
