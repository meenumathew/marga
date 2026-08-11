# Content Model

How a Markdown file becomes a page, and what each frontmatter field does.

## Folders and routes

Notes live under `content/learn/`, or under `<MARGA_STORAGE_ROOT>/content/learn/`
when you set that. Every `.md` and `.mdx` file becomes a page:

| File                                              | Route                                   |
| ------------------------------------------------- | --------------------------------------- |
| `content/learn/software-engineering/tdd-notes.md` | `/learn/software-engineering/tdd-notes` |
| `content/learn/career/README.md`                  | `/learn/career`                         |

`README.md` is a folder's index page.

Relative Markdown links are rewritten to app routes, anchors included:
`[Map](../ml/diataxis-map.md)` becomes a link to `/learn/ml/diataxis-map`.
External and absolute links are left as they are.

## Frontmatter

```md
---
title: "TDD Notes"
description: "Use tests as design feedback."
mode: "How-to"
level: "Intermediate"
duration: "12 min"
updated: "2026-07-03"
order: 10
---

# TDD Notes

Write the lesson here.
```

| Field         | Default when missing                      |
| ------------- | ----------------------------------------- |
| `title`       | The first heading, then the filename      |
| `description` | The first paragraph, then `Learning note` |
| `mode`        | `Lesson`                                  |
| `level`       | `Any level`                               |
| `duration`    | `Self-paced`                              |
| `order`       | `1000`, so unordered notes sort last      |
| `updated`     | Not shown                                 |

A note with no frontmatter still renders. The cards and filters on `/learn` read
better with it.

### The folder decides the section

Section membership comes from the folder, and only from the folder. A `section`
field in frontmatter is read by nothing, so moving a note between sections means
moving the file.

A folder's own title and description come from an optional `_section.json`:

```json
{
  "title": "Knowledge System",
  "description": "Choose the right note by learning need.",
  "order": 1,
  "icon": "compass"
}
```

Without one, the section title is derived from the folder name.

### `mode`

`mode` accepts six values: the four Diataxis modes, plus two of Marga's own.

| Mode          | The reader's need     |
| ------------- | --------------------- |
| `Tutorial`    | Learn by doing        |
| `How-to`      | Complete a task       |
| `Reference`   | Look up a fact        |
| `Explanation` | Understand why        |
| `Lesson`      | A general note        |
| `Plan`        | A dated learning plan |

Anything else, including a missing `mode`, reads as `Lesson`.

## Milestones

Milestones are declared in a note's frontmatter and collected on `/milestones`:

```md
---
title: "Knowledge System Start Here"
mode: "Reference"
milestones:
  - id: "monthly-knowledge-base-review"
    title: "Monthly knowledge-base review"
    date: "2026-08-01"
    type: "Review"
    note: "Review the whole Knowledge System section"
    link: "/learn?section=knowledge-system"
---
```

Dates are strict `YYYY-MM-DD` calendar dates.

## Plan notes

`/plans` shows only notes that set both `mode: "Plan"` and a `year`. A note
missing either one never appears there, whatever else its frontmatter says:

```md
---
title: "2026 Learning Plan"
description: "Ship three systems and write about each."
mode: "Plan"
year: 2026
order: 1
---
```

Each plan year gets four automatic quarter-end review checkpoints, dated 31
March, 30 June, 30 September, and 31 December. A year's quarters show only the
milestones declared in that year's own plan notes, so checkpoints from unrelated
notes never appear in a plan.

## Two ways to add a note

1. Open `/add-content` in the running app, paste or upload a `.md` or `.mdx`
   file, and save. It writes the file to disk. See
   [Local authoring and security](../explanation/local-authoring-and-security.md).
2. Add the file under `content/learn/` yourself.

## Import notes that keep metadata in blockquotes

Notes that carry metadata as blockquote lines (`> **Goal:** ...`,
`> **Last Updated:** ...`, `> **Diataxis mode:** ...`) can have it lifted into
frontmatter:

```bash
node scripts/add-frontmatter.mjs path/to/content --dry-run
node scripts/add-frontmatter.mjs path/to/content
```

The script is idempotent: a file that already starts with frontmatter is skipped.
It rewrites files in place with no backup, so preview with `--dry-run` and keep
the notes in Git.
