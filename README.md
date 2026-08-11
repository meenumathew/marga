<p align="center">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="public/marga-logo-with-tagline-horizontal-on-dark.png"
    />
    <img
      src="public/marga-logo-with-tagline-horizontal-on-light-transparent.png"
      alt="Marga"
      width="420"
    />
  </picture>
</p>

<p align="center">
  <a href="https://github.com/meenumathew/marga/actions/workflows/quality.yml">
    <img
      src="https://github.com/meenumathew/marga/actions/workflows/quality.yml/badge.svg"
      alt="Quality"
    />
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" />
  </a>
  <a href="package.json">
    <img src="https://img.shields.io/badge/node-%3E%3D20.9-brightgreen.svg" alt="Node 20.9 or newer" />
  </a>
</p>

# Marga

**Marga** (मार्ग) is Sanskrit for _path_ or _way_. The name carries the idea the
template is built around: mastery is a path you walk and leave a visible trail on,
not a pile of notes you finished reading.

Marga turns a folder of Markdown notes into a learning dashboard. Files in
`content/learn/` become pages under `/learn`, and the dashboard tracks what you
produced from them.

- [Why this exists](#why-this-exists)
- [Who this is for](#who-this-is-for)
- [Quick start](#quick-start)
- [Make it your own](#make-it-your-own)
- [The routes](#the-routes)
- [Documentation](#documentation)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Why This Exists

Most note systems reward collecting. This one is built on two ideas taken from
outside the codebase:

- **[Diátaxis](https://diataxis.fr), the documentation framework.** Every note
  declares one `mode`: **Tutorial** (learn by doing), **How-to** (complete a
  task), **Reference** (look up a fact), or **Explanation** (understand why).
  Naming the mode forces you to write for one need instead of mixing four, and it
  lets you pick a note by the work in front of you rather than by title.
- **Evidence over consumption.** Marking a note read earns nothing. Sections are
  mastered by logging real output: a build, refactor, write-up, artifact, or
  feedback you acted on. The scorecard and achievements are derived from that
  evidence, so the dashboard cannot flatter you.

The result is a pull system: name the work, pick the smallest note that helps,
apply it, log the output, stop reading.

## Who This Is For

Someone with a named goal and a terminal. You are learning a specific thing on
purpose (a role, a certification, a craft), you already keep notes, and you want
the tracker to show proof of work rather than a reading list.

It is a poor fit if you want a hosted app with accounts and sync, a multi-user
team wiki, or a place to collect material you have not decided to use yet.

## Quick Start

Requirements: Node.js 20 or newer, npm, and Git.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Before release work, run every gate CI runs:

```bash
npm run quality
```

## Make It Your Own

Marga is a base template. Your own site is one command:

```bash
npx marga-cli new my-study-path --install
```

Any name works; nothing requires a `marga-` prefix.

Your site's name, wording, colours, and notes folder live in `.env.local`, which
Git ignores. Nothing the template tracks changes, so bringing in later template
improvements is a fast-forward, and a fast-forward cannot produce a merge
conflict:

```bash
npx marga-cli upgrade
```

Rename the site later by editing `.env.local` and restarting the server. You
never edit code for that. `.env.example` lists every setting.

Full detail: [Create a site](docs/how-to/create-a-site-from-the-template.md),
[Configure your site](docs/how-to/configure-your-site.md),
[Update your site](docs/how-to/update-your-site.md).

## The Routes

| Route           | What it is                                                              |
| --------------- | ----------------------------------------------------------------------- |
| `/`             | Dashboard: focus area, weekly target, streak, recent activity           |
| `/learn`        | Library of every note, filtered by section, mode, and level             |
| `/learn/*`      | The reader: rendered Markdown, table of contents, mark-read, next note  |
| `/evidence`     | The evidence log: artifacts and feedback that earn mastery              |
| `/milestones`   | Dated checkpoints and reviews, declared in note frontmatter             |
| `/plans`        | Quarterly plans and their review state                                  |
| `/achievements` | Badges derived from notes, evidence, feedback, streaks, and milestones  |
| `/add-content`  | Local content studio: paste or upload a note, and it is written to disk |

## Documentation

[docs/](docs/README.md) is the index. It is organised the same way Marga asks you
to organise your own notes.

**How-to**

- [Create a site from the template](docs/how-to/create-a-site-from-the-template.md)
- [Configure your site](docs/how-to/configure-your-site.md)
- [Update your site](docs/how-to/update-your-site.md)
- [Deploy](docs/how-to/deploy.md)
- [Run the quality gates](docs/how-to/run-quality-gates.md)

**Reference**

- [Content model](docs/reference/content-model.md)

**Explanation**

- [Why files, not a database](docs/explanation/why-files-not-a-database.md)
- [Progress state](docs/explanation/progress-state.md)
- [Local authoring and security](docs/explanation/local-authoring-and-security.md)

The running site has its own introduction under
[Knowledge System](content/learn/knowledge-system/start-here.md), which teaches
the method rather than the software.

## Tech Stack

| Area       | Technology                                    |
| ---------- | --------------------------------------------- |
| Framework  | Next.js 16 App Router                         |
| UI         | React 19, TypeScript 5                        |
| Styling    | Hand-written CSS in `src/app/globals.css`     |
| Content    | Markdown, MDX, gray-matter, unified, rehype   |
| Testing    | Vitest, and the Node test runner for the CLI  |
| Quality    | ESLint, Prettier, Vale, npm audit, pre-commit |
| Automation | GitHub Actions                                |

The root layout uses `next/font` with Geist and Geist Mono.

## Project Structure

```text
content/learn/             Markdown and MDX learning content
docs/                      Documentation for running and adapting the template
marga-cli/                 The `marga` command, zero dependencies, own toolchain
public/                    Static images, icons, and logos
scripts/                   Maintenance scripts
src/app/                   App Router pages and API routes
src/components/            React components
src/config/site.ts         The template's defaults, owned by the template
src/config/site-overrides.ts  Reads this site's settings from the environment
src/lib/                   Content, progress, validation, and safety helpers
types/                     Generated route types and local declarations
```

Where the behaviour lives:

- `src/lib/learn-content.ts`: content discovery, frontmatter parsing, and
  Markdown rendering.
- `src/lib/progress.ts`: client progress store and server synchronization.
- `src/lib/progress-state.ts`: the progress state shape, its limits, and the
  merge rule both sides share.
- `src/lib/section-contents.ts`: what a section folder holds, used to refuse a
  destructive delete.
- `src/lib/evidence.ts`: evidence entry normalization and link sanitization.
- `src/lib/calendar-date.ts`: the shared strict `YYYY-MM-DD` calendar-date rule.
- `src/lib/request-guard.ts`: loopback and same-origin write-request checks.
- `src/lib/safe-storage-path.ts`: canonical path containment checks.
- `src/lib/storage-paths.ts`: storage root and content root resolution.
- `src/lib/metadata-base.ts`: the absolute base for generated metadata URLs.

Static assets: `src/app/favicon.ico` is used automatically by the App Router;
the PNG icons and logo SVGs in `public/` are served from the site root and their
paths are listed in `src/config/site.ts` under `logo`.

## Known Limitations

- **Renaming the site needs a text file, not a form.** The dashboard customizer
  edits the greeting, display name, focus area, and weekly target. The site name,
  description, and theme colours have no form, so changing them means editing
  `.env.local` and restarting the server. An in-app settings page is the fix, and
  it is not built.
- **Content is re-read on every request.** Within a single request the library is
  parsed once and reused, so a page that needs it five times pays for one walk of
  `content/learn/`. Nothing is cached between requests. See
  [Why files, not a database](docs/explanation/why-files-not-a-database.md).
- **Nothing that needs a browser is tested.** The test runner is Node with no
  DOM, so React components have no tests, and neither does the `localStorage` and
  `fetch` wiring in `src/lib/progress.ts`. Covered instead: the progress state
  shape, its limits, and its merge rule directly, and every write route end to
  end against a temporary content tree.
- **`scripts/add-frontmatter.mjs` rewrites notes in place** with no backup. Run
  it with `--dry-run` first and keep the notes in Git.
- **A union merge cannot represent a deletion.** See
  [Progress state](docs/explanation/progress-state.md).
- **There is no authentication.** See
  [Local authoring and security](docs/explanation/local-authoring-and-security.md).

## Contributing

Read `CONTRIBUTING.md` before opening changes. Keep edits small, run
`npm run quality`, and preserve the file-backed architecture unless
the change explicitly proposes a new storage model.

## Security

Security guidance and vulnerability reporting instructions are in `SECURITY.md`.
Do not open public issues for private security reports.

## License

Marga is released under the MIT License. See `LICENSE`.
