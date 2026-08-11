# Contributing to Marga

Thanks for your interest. Marga is a small Next.js learning-dashboard template,
so contributions should keep it small, clear, and easy to clone.

## The One Rule That Shapes Everything

Marga is a **base template**. A cloned site should only ever customize three
places:

- `src/config/site.ts` — name, description, storage prefix, copy, theme;
- `content/learn/` — the Markdown notes;
- the logo files in `public/`.

Everything else under `src/` should stay identical across clones so that
`git pull base main` merges cleanly. When you change shared code, ask: _would
this force every clone to edit a component?_ If yes, push the difference into
`site.ts` instead.

## Prerequisites

- Node.js 20 or newer
- npm (the repo ships a `package-lock.json`)

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Before You Open a Pull Request

Run the full quality gate and make sure each step is clean:

```bash
npm run quality
```

`npm run format` rewrites files in place if `format:check` fails.

The quality command checks formatting, ESLint, documentation, TypeScript,
application tests, CLI tests, production dependencies, and the production
build. It stops at the first failure. GitHub Actions installs from the lockfile
and runs the same command for every pull request and push to `main`.

The production dependency scan requires the npm advisory service. If that
service is unavailable, the gate fails instead of silently releasing without a
security result. When applying a Next.js security patch, update `next` and
`eslint-config-next` together and regenerate the lockfile with npm.

Do not drop the `build` step: it applies checks the others cannot. `typecheck`
will happily accept a `route.ts` that exports a helper alongside its handlers,
while `next build` rejects it, because every export from a route file is part of
the route contract. Keep shared helpers in `src/lib/`.

The `marga-cli/` folder is a standalone package, deliberately excluded from the
app's ESLint and Prettier config. Its test suite remains part of `npm run
quality` through the root `test:cli` script.

## Conventions

- **Formatting** is Prettier-owned: 2-space indent, double quotes, semicolons,
  trailing commas, 100-character line width. Do not hand-format around it.
- **Types**: no `any` escapes for convenience; the code is fully typed today,
  keep it that way.
- **Tests** use Vitest and live next to the code as `*.test.ts`. Name tests by
  behaviour, not implementation — for example
  `it("does NOT master a section from reading alone")`. New logic in `src/lib/`
  should come with tests. The runner also picks up `scripts/**/*.test.mjs`, which
  is where the note-rewriting scripts are covered.
- **Content** notes carry frontmatter (`title`, `description`, `mode`, `level`,
  `duration`, `updated`, `order`, and `year` for plan notes). Section membership
  comes from the folder, not frontmatter.
  See [Content model](docs/reference/content-model.md) for the shape.
- **Security**: the content-write API must keep its path-traversal guard and
  size limit; rendered Markdown and evidence links must stay sanitized. See
  `SECURITY.md`.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`,
`fix:`, `docs:`, `refactor:`, `test:`, `chore:`. Keep one logical change per
commit and explain _why_ in the body when it is not obvious.

## Pull Requests

1. Branch from `main`.
2. Make the change and run `npm run quality`.
3. Open a PR describing the change and how you verified it.

Small, focused PRs are reviewed fastest. If you are planning a larger change to
shared `src/` code, open an issue first so we can keep the template clean.
