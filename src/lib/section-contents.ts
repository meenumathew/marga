import fs from "node:fs/promises";
import path from "node:path";
import { SECTION_CONFIG_FILE } from "./learn-content";

/**
 * Names a section delete may remove without destroying anything the learner
 * wrote: the app's own section config, plus editor and operating-system scratch
 * files that reappear on their own.
 */
const DISPOSABLE_ENTRIES = new Set([SECTION_CONFIG_FILE, ".DS_Store", "Thumbs.db", ".gitkeep"]);

/** Enough names to explain a refusal; the caller does not need the full list. */
const MAX_REPORTED_ENTRIES = 10;

/**
 * Paths inside a section folder that deleting the folder would destroy, relative
 * to it and capped. An empty result means the folder holds nothing but
 * disposable entries and empty subfolders, so removing it loses nothing.
 *
 * Deliberately not extension-based. A section can hold images, PDFs, exports, or
 * an editor's dot-folder, and an emptiness test that counted only Markdown would
 * call those folders empty right before a recursive delete removed them.
 */
export async function findSectionContents(dir: string): Promise<string[]> {
  const found: string[] = [];
  await collectContents(dir, "", found);
  return found;
}

async function collectContents(dir: string, prefix: string, found: string[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (found.length >= MAX_REPORTED_ENTRIES) {
      return;
    }

    if (DISPOSABLE_ENTRIES.has(entry.name)) {
      continue;
    }

    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      await collectContents(path.join(dir, entry.name), relativePath, found);
      continue;
    }

    // Anything that is not a directory counts, including symlinks and other
    // special files: the folder is not the app's to throw away.
    found.push(relativePath);
  }
}
