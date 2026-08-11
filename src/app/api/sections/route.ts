import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { slugify } from "@/lib/content-utils";
import { CONTENT_ROOT, getAllSections, SECTION_CONFIG_FILE } from "@/lib/learn-content";
import { logRouteError } from "@/lib/log";
import { rejectCrossOriginWrite } from "@/lib/request-guard";
import { resolveSafeStoragePath } from "@/lib/safe-storage-path";
import { findSectionContents } from "@/lib/section-contents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SectionConfigFile = {
  title: string;
  description?: string;
  order?: number;
  icon?: string;
};

/** Create a section: a folder plus an optional _section.json describing it. */
export async function POST(request: NextRequest) {
  const refusal = rejectCrossOriginWrite(request);

  if (refusal) {
    return refusal;
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const title = readString(payload.title);
    const description = readString(payload.description);

    if (!title) {
      return NextResponse.json({ message: "A section name is required." }, { status: 400 });
    }

    const slug = slugify(title);
    const dir = await safeSectionDir(slug);

    if (!dir) {
      return NextResponse.json({ message: "That section name is not valid." }, { status: 400 });
    }

    if (await pathExists(dir)) {
      return NextResponse.json(
        { message: "A section with this name already exists." },
        { status: 409 },
      );
    }

    const nextOrder =
      Math.max(
        0,
        ...getAllSections()
          .map((section) => section.order)
          .filter((order) => Number.isFinite(order)),
      ) + 1;

    await fs.mkdir(dir, { recursive: true });
    await writeSectionConfig(dir, {
      title,
      description: description || undefined,
      order: nextOrder,
    });

    return NextResponse.json({ message: `Created section "${title}".`, slug, title });
  } catch (error) {
    logRouteError("POST /api/sections", error);
    return NextResponse.json({ message: "Could not create this section." }, { status: 500 });
  }
}

/** Rename or retitle a section: rename the folder (changing note URLs) and update _section.json. */
export async function PATCH(request: NextRequest) {
  const refusal = rejectCrossOriginWrite(request);

  if (refusal) {
    return refusal;
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const slug = readString(payload.slug);
    const title = readString(payload.title);
    const description = readString(payload.description);

    if (!slug) {
      return NextResponse.json(
        { message: "The General section cannot be renamed." },
        { status: 400 },
      );
    }

    if (!title) {
      return NextResponse.json({ message: "A new section name is required." }, { status: 400 });
    }

    const fromDir = await safeSectionDir(slug);

    if (!fromDir) {
      return NextResponse.json({ message: "That section path is not valid." }, { status: 400 });
    }

    if (!(await isDirectory(fromDir))) {
      return NextResponse.json({ message: "That section does not exist." }, { status: 404 });
    }

    const newSlug = slugify(title);
    const toDir = await safeSectionDir(newSlug);

    if (!toDir) {
      return NextResponse.json({ message: "That section name is not valid." }, { status: 400 });
    }

    if (newSlug !== slug) {
      if (await pathExists(toDir)) {
        return NextResponse.json(
          { message: "A section with this name already exists." },
          { status: 409 },
        );
      }

      await fs.rename(fromDir, toDir);
    }

    const existing = await readSectionConfig(toDir);
    await writeSectionConfig(toDir, {
      ...existing,
      title,
      description: description || existing.description,
    });

    return NextResponse.json({
      message:
        newSlug === slug
          ? `Renamed section to "${title}".`
          : `Renamed section to "${title}". Note links under it changed.`,
      slug: newSlug,
      title,
    });
  } catch (error) {
    logRouteError("PATCH /api/sections", error);
    return NextResponse.json({ message: "Could not rename this section." }, { status: 500 });
  }
}

/** Delete a section, but only when it holds nothing the learner would lose. */
export async function DELETE(request: NextRequest) {
  const refusal = rejectCrossOriginWrite(request);

  if (refusal) {
    return refusal;
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const slug = readString(payload.slug);

    if (!slug) {
      return NextResponse.json(
        { message: "The General section cannot be deleted." },
        { status: 400 },
      );
    }

    const dir = await safeSectionDir(slug);

    if (!dir) {
      return NextResponse.json({ message: "That section path is not valid." }, { status: 400 });
    }

    if (!(await isDirectory(dir))) {
      return NextResponse.json({ message: "That section does not exist." }, { status: 404 });
    }

    // Everything in the folder goes, so refuse unless the folder holds nothing
    // worth keeping — notes, images, exports, anything the learner put there.
    const contents = await findSectionContents(dir);

    if (contents.length > 0) {
      return NextResponse.json(
        {
          message: `This section still holds ${contents.join(", ")}. Move or delete its contents first.`,
          contents,
        },
        { status: 409 },
      );
    }

    await fs.rm(dir, { recursive: true, force: true });

    return NextResponse.json({ message: "Section deleted." });
  } catch (error) {
    logRouteError("DELETE /api/sections", error);
    return NextResponse.json({ message: "Could not delete this section." }, { status: 500 });
  }
}

/** Resolve a section folder, guaranteeing it stays directly under content/learn. */
async function safeSectionDir(slug: string): Promise<string | null> {
  if (!slug || slug.includes("/") || slug.includes("\\") || slug === "." || slug === "..") {
    return null;
  }

  const dir = path.join(CONTENT_ROOT, slug);
  const relative = path.relative(CONTENT_ROOT, dir);

  if (
    relative.includes(path.sep) ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative === ""
  ) {
    return null;
  }

  return resolveSafeStoragePath(CONTENT_ROOT, dir);
}

async function writeSectionConfig(
  dir: string,
  config: Partial<SectionConfigFile> & { title: string },
): Promise<void> {
  const body: SectionConfigFile = {
    title: config.title,
    ...(config.description ? { description: config.description } : {}),
    ...(typeof config.order === "number" ? { order: config.order } : {}),
    ...(config.icon ? { icon: config.icon } : {}),
  };

  await fs.writeFile(
    path.join(dir, SECTION_CONFIG_FILE),
    `${JSON.stringify(body, null, 2)}\n`,
    "utf8",
  );
}

async function readSectionConfig(dir: string): Promise<Partial<SectionConfigFile>> {
  try {
    const raw = await fs.readFile(path.join(dir, SECTION_CONFIG_FILE), "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
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

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isDirectory();
  } catch {
    return false;
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
