import fs from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import matter from "gray-matter";
import { isCalendarDate } from "@/lib/calendar-date";
import { CONTENT_ROOT, getAllLearnContent, makeMilestoneId } from "@/lib/learn-content";
import { logRouteError } from "@/lib/log";
import { rejectCrossOriginWrite } from "@/lib/request-guard";
import { resolveSafeStoragePath } from "@/lib/safe-storage-path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const refusal = rejectCrossOriginWrite(request);

  if (refusal) {
    return refusal;
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const slug = readString(payload.slug);
    const title = readString(payload.title);
    const date = readString(payload.date);
    const type = readString(payload.type) || "Milestone";
    const note = readString(payload.note);

    if (!slug || !title) {
      return NextResponse.json(
        { message: "A note and a milestone title are required." },
        { status: 400 },
      );
    }

    if (!isCalendarDate(date)) {
      return NextResponse.json({ message: "Use a date in YYYY-MM-DD format." }, { status: 400 });
    }

    const noteItem = getAllLearnContent().find((item) => item.slug === slug);

    if (!noteItem) {
      return NextResponse.json({ message: "That note no longer exists." }, { status: 404 });
    }

    const safeNote = await readSafeNote(noteItem.absolutePath);

    if (!safeNote) {
      return NextResponse.json({ message: "Invalid content path." }, { status: 400 });
    }

    // Append by rewriting the full block, so it works whether the note has no
    // milestones key, a block-form list, or an inline `milestones: []`.
    const id = makeMilestoneId(
      title,
      date,
      noteItem.milestones.map((milestone) => milestone.id),
    );
    const updated = replaceMilestonesBlock(safeNote.raw, [
      ...noteItem.milestones,
      { id, title, date, type, note, link: "" },
    ]);

    if (updated === null) {
      return NextResponse.json(
        { message: "Could not update this note's frontmatter safely." },
        { status: 500 },
      );
    }

    // Refuse to write anything the content system cannot read back.
    const parsed = matter(updated);
    const milestones = parsed.data.milestones as unknown;

    if (!Array.isArray(milestones)) {
      return NextResponse.json(
        { message: "Could not update this note's frontmatter safely." },
        { status: 500 },
      );
    }

    await fs.writeFile(safeNote.path, updated, "utf8");

    return NextResponse.json({
      message: `Milestone added to "${noteItem.title}".`,
      href: noteItem.href,
    });
  } catch (error) {
    logRouteError("POST /api/milestones", error);
    return NextResponse.json({ message: "Could not save this milestone." }, { status: 500 });
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
    const id = readString(payload.id);
    const originalTitle = readString(payload.originalTitle);
    const originalDate = readString(payload.originalDate);
    const title = readString(payload.title);
    const date = readString(payload.date);
    const type = readString(payload.type) || "Milestone";
    const note = readString(payload.note);

    if (!slug || !originalTitle || !title) {
      return NextResponse.json(
        { message: "A note and a milestone title are required." },
        { status: 400 },
      );
    }

    if (!isCalendarDate(date) || !isCalendarDate(originalDate)) {
      return NextResponse.json({ message: "Use a date in YYYY-MM-DD format." }, { status: 400 });
    }

    const noteItem = getAllLearnContent().find((item) => item.slug === slug);

    if (!noteItem) {
      return NextResponse.json({ message: "That note no longer exists." }, { status: 404 });
    }

    const safeNote = await readSafeNote(noteItem.absolutePath);

    if (!safeNote) {
      return NextResponse.json({ message: "Invalid content path." }, { status: 400 });
    }

    // Locate by index so identical (title, date) milestones stay distinct, and
    // verify the entry still matches to guard against a stale index.
    const index = resolveMilestoneIndex(
      noteItem.milestones,
      payload.index,
      id,
      originalTitle,
      originalDate,
    );

    if (index === -1) {
      return NextResponse.json(
        { message: "That milestone was not found in the note." },
        { status: 404 },
      );
    }

    const nextMilestones = [...noteItem.milestones];
    // Preserve any existing link; the edit form doesn't expose it.
    nextMilestones[index] = {
      id:
        noteItem.milestones[index]?.id ||
        makeMilestoneId(
          title,
          date,
          nextMilestones.map((milestone) => milestone.id),
        ),
      title,
      date,
      type,
      note,
      link: noteItem.milestones[index]?.link ?? "",
    };

    const updated = replaceMilestonesBlock(safeNote.raw, nextMilestones);

    if (updated === null) {
      return NextResponse.json(
        { message: "Could not update this note's frontmatter safely." },
        { status: 500 },
      );
    }

    const parsed = matter(updated);

    if (!Array.isArray(parsed.data.milestones)) {
      return NextResponse.json(
        { message: "Could not update this note's frontmatter safely." },
        { status: 500 },
      );
    }

    await fs.writeFile(safeNote.path, updated, "utf8");

    return NextResponse.json({ message: `Milestone updated in "${noteItem.title}".` });
  } catch (error) {
    logRouteError("PUT /api/milestones", error);
    return NextResponse.json({ message: "Could not update this milestone." }, { status: 500 });
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
    const id = readString(payload.id);
    const title = readString(payload.title);
    const date = readString(payload.date);

    if (!slug || !title || !isCalendarDate(date)) {
      return NextResponse.json(
        { message: "A note, milestone title, and date are required." },
        { status: 400 },
      );
    }

    const note = getAllLearnContent().find((item) => item.slug === slug);

    if (!note) {
      return NextResponse.json({ message: "That note no longer exists." }, { status: 404 });
    }

    const safeNote = await readSafeNote(note.absolutePath);

    if (!safeNote) {
      return NextResponse.json({ message: "Invalid content path." }, { status: 400 });
    }

    // Remove by index so identical (title, date) milestones stay distinct; the
    // title/date still act as a safety check that the index points at the right one.
    const index = resolveMilestoneIndex(note.milestones, payload.index, id, title, date);

    if (index === -1) {
      return NextResponse.json(
        { message: "That milestone was not found in the note." },
        { status: 404 },
      );
    }

    const remaining = note.milestones.filter((_, milestoneIndex) => milestoneIndex !== index);

    const updated = replaceMilestonesBlock(safeNote.raw, remaining);

    if (updated === null) {
      return NextResponse.json(
        { message: "Could not update this note's frontmatter safely." },
        { status: 500 },
      );
    }

    const parsed = matter(updated);
    const milestones = parsed.data.milestones as unknown;

    if (remaining.length > 0 && !Array.isArray(milestones)) {
      return NextResponse.json(
        { message: "Could not update this note's frontmatter safely." },
        { status: 500 },
      );
    }

    await fs.writeFile(safeNote.path, updated, "utf8");

    return NextResponse.json({ message: `Milestone removed from "${note.title}".` });
  } catch (error) {
    logRouteError("DELETE /api/milestones", error);
    return NextResponse.json({ message: "Could not delete this milestone." }, { status: 500 });
  }
}

async function readSafeNote(absolutePath: string): Promise<{ path: string; raw: string } | null> {
  const safePath = await resolveSafeStoragePath(CONTENT_ROOT, absolutePath);

  return safePath ? { path: safePath, raw: await fs.readFile(safePath, "utf8") } : null;
}

/**
 * Find which milestone to act on. Prefer the caller's index (unique even when
 * two milestones share a title and date), but only trust it when the entry there
 * still matches the expected title/date — otherwise fall back to a value match so
 * a stale index can't edit or delete the wrong milestone.
 */
function resolveMilestoneIndex(
  milestones: { id: string; title: string; date: string }[],
  rawIndex: unknown,
  id: string,
  title: string,
  date: string,
): number {
  if (id) {
    const byId = milestones.findIndex((milestone) => milestone.id === id);

    if (byId !== -1) {
      return byId;
    }
  }

  const index = typeof rawIndex === "number" && Number.isInteger(rawIndex) ? rawIndex : -1;
  const atIndex = index >= 0 ? milestones[index] : undefined;

  if (atIndex && atIndex.title === title && atIndex.date === date) {
    return index;
  }

  return milestones.findIndex((milestone) => milestone.title === title && milestone.date === date);
}

type WritableMilestone = {
  id: string;
  title: string;
  date: string;
  type: string;
  note: string;
  link?: string;
};

/** Rewrite the frontmatter's milestones block to exactly the given entries (drop it when empty). */
function replaceMilestonesBlock(raw: string, milestones: WritableMilestone[]): string | null {
  const blockLines = milestonesBlockLines(milestones);
  const frontmatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  // No frontmatter at all: create one holding just the milestones block.
  if (!frontmatterMatch) {
    if (blockLines.length === 0) {
      return raw;
    }

    return `${["---", ...blockLines, "---", "", ""].join("\n")}${raw}`;
  }

  const lines = frontmatterMatch[1]?.split("\n") ?? [];
  // Match the key in both block form (`milestones:`) and inline form
  // (`milestones: []`), so we replace rather than duplicate it.
  const milestonesIndex = lines.findIndex((line) => /^milestones:/.test(line));

  if (milestonesIndex === -1) {
    // No milestones key yet — append the block to the existing frontmatter.
    lines.push(...blockLines);
  } else {
    // Replace the existing key and any indented block entries under it.
    let end = milestonesIndex + 1;

    while (end < lines.length && /^\s/.test(lines[end] ?? "")) {
      end += 1;
    }

    lines.splice(milestonesIndex, end - milestonesIndex, ...blockLines);
  }

  const rebuilt = `---\n${lines.join("\n")}\n---\n`;
  return `${rebuilt}${raw.slice(frontmatterMatch[0].length)}`;
}

/** YAML lines for a milestones block, or [] to omit the key entirely. */
function milestonesBlockLines(milestones: WritableMilestone[]): string[] {
  if (milestones.length === 0) {
    return [];
  }

  return [
    "milestones:",
    ...milestones.flatMap((milestone) => [
      `  - id: ${yamlString(milestone.id)}`,
      `    title: ${yamlString(milestone.title)}`,
      `    date: ${yamlString(milestone.date)}`,
      `    type: ${yamlString(milestone.type)}`,
      ...(milestone.note ? [`    note: ${yamlString(milestone.note)}`] : []),
      ...(milestone.link ? [`    link: ${yamlString(milestone.link)}`] : []),
    ]),
  ];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}
