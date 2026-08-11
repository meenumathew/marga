#!/usr/bin/env node
/**
 * One-time import helper: add frontmatter to Markdown notes that lack it.
 *
 * Existing notes keep metadata in blockquote lines like:
 *   > **Goal:** Learn SPC end to end.
 *   > **Last Updated:** 2026-06-15
 *   > **Diataxis mode:** tutorial. ...
 *
 * This script lifts those into the frontmatter fields marga reads
 * (title, description, mode, updated). Files that already start with
 * frontmatter are left untouched, so it is safe to re-run.
 *
 * Usage:
 *   node scripts/add-frontmatter.mjs <content-dir> [--dry-run]
 *
 * Example:
 *   node scripts/add-frontmatter.mjs content/learn
 *   node scripts/add-frontmatter.mjs ../software-engineer/content --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED_EXTENSIONS = new Set([".md", ".mdx"]);
const MODE_MAP = new Map([
  ["tutorial", "Tutorial"],
  ["how-to", "How-to"],
  ["howto", "How-to"],
  ["reference", "Reference"],
  ["explanation", "Explanation"],
  ["lesson", "Lesson"],
]);

/**
 * True only for a real frontmatter block: an opening `---` on its own first
 * line and a matching closing delimiter later. A note that merely opens with a
 * horizontal rule has no closing delimiter, so it still needs frontmatter.
 */
export function hasFrontmatter(raw) {
  const lines = raw.replace(/^﻿/, "").split(/\r?\n/);

  if (lines[0]?.trim() !== "---") {
    return false;
  }

  return lines.slice(1).some((line) => /^(?:---|\.\.\.)\s*$/.test(line));
}

/**
 * Walk the target directory and add frontmatter where it is missing.
 *
 * Every side effect this script has lives here rather than at module scope, so
 * importing the file to test its helpers cannot rewrite anyone's notes.
 */
export function main(argv) {
  const dryRun = argv.includes("--dry-run");
  const targetDir = argv.find((arg) => !arg.startsWith("--"));

  if (!targetDir) {
    console.error("Usage: node scripts/add-frontmatter.mjs <content-dir> [--dry-run]");
    return 1;
  }

  const rootDir = path.resolve(targetDir);

  if (!fs.existsSync(rootDir)) {
    console.error(`Directory not found: ${rootDir}`);
    return 1;
  }

  let updatedCount = 0;
  let skippedCount = 0;

  for (const filePath of collectMarkdownFiles(rootDir)) {
    const raw = fs.readFileSync(filePath, "utf8");

    if (hasFrontmatter(raw)) {
      skippedCount += 1;
      continue;
    }

    const frontmatter = buildFrontmatter(raw);
    const nextContent = `${frontmatter}\n${raw}`;
    const relativePath = path.relative(rootDir, filePath);

    if (dryRun) {
      console.log(`[dry-run] would update ${relativePath}`);
      console.log(indent(frontmatter));
    } else {
      fs.writeFileSync(filePath, nextContent, "utf8");
      console.log(`updated ${relativePath}`);
    }

    updatedCount += 1;
  }

  console.log(
    `\n${dryRun ? "Would update" : "Updated"} ${updatedCount} file(s), skipped ${skippedCount} with existing frontmatter.`,
  );

  return 0;
}

export function collectMarkdownFiles(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(entryPath));
    } else if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

export function buildFrontmatter(markdown) {
  const fields = [];
  const title = firstHeading(markdown);
  const description =
    metadataValue(markdown, ["Goal", "Purpose", "Summary"]) || firstParagraph(markdown);
  const updated = metadataValue(markdown, ["Last Updated", "Last updated", "Updated"]);
  const mode = normalizeMode(
    metadataValue(markdown, [
      "Diataxis mode",
      "Diataxis Mode",
      "Diátaxis mode",
      "Diátaxis Mode",
      "Mode",
    ]),
  );

  if (title) {
    fields.push(`title: ${yamlString(title)}`);
  }

  if (description) {
    fields.push(`description: ${yamlString(truncate(stripMarkdown(description), 180))}`);
  }

  if (mode) {
    fields.push(`mode: ${yamlString(mode)}`);
  }

  if (updated) {
    fields.push(`updated: ${yamlString(firstDateLike(updated) ?? stripMarkdown(updated))}`);
  }

  return `---\n${fields.join("\n")}\n---\n`;
}

export function firstHeading(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? stripMarkdown(match[1]) : "";
}

/** First real prose block: skips headings, blockquote metadata, tables, and code fences. */
export function firstParagraph(markdown) {
  const block = markdown
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .find((part) => part && !/^[#>|`\-*]/.test(part));

  return block ? truncate(stripMarkdown(block), 180) : "";
}

export function metadataValue(markdown, labels) {
  for (const label of labels) {
    const pattern = new RegExp(`^>?\\s*\\*\\*${escapeRegExp(label)}:?\\*\\*:?\\s*(.+)$`, "m");
    const match = markdown.match(pattern);

    if (match) {
      return match[1].trim();
    }
  }

  return "";
}

export function normalizeMode(value) {
  if (!value) {
    return "";
  }

  const firstWord = stripMarkdown(value)
    .split(/[\s.,;]+/)[0]
    .toLowerCase();
  return MODE_MAP.get(firstWord) ?? "";
}

export function firstDateLike(value) {
  const match = value.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

/**
 * Copy of `src/lib/markdown-text.ts`. This script runs under bare node with no
 * build step, so it cannot import the app's TypeScript; the drift test in
 * add-frontmatter.test.mjs compares the two on shared inputs.
 */
export function stripMarkdown(value) {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(value, maxLength) {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function yamlString(value) {
  return JSON.stringify(value);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function indent(value) {
  return value
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

/** True when node was pointed at this file, false when a test imported it. */
function isDirectRun() {
  const entryPoint = process.argv[1];

  if (!entryPoint) {
    return false;
  }

  // realpath both sides: node reports the module path with symlinks resolved,
  // so a symlinked checkout would otherwise never look like a direct run.
  try {
    return fs.realpathSync(entryPoint) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  process.exit(main(process.argv.slice(2)));
}
