# Run the Quality Gates

One command runs every check, and it is the same command CI runs:

```bash
npm run quality
```

Running it locally and in CI keeps a green pull request honest.

## The individual gates

| Command                  | Checks                                          |
| ------------------------ | ----------------------------------------------- |
| `npm run format:check`   | Prettier formatting                             |
| `npm run lint`           | ESLint                                          |
| `npm run docs:lint`      | Vale prose rules on the docs and notes          |
| `npm run typecheck`      | TypeScript, without emitting files              |
| `npm test`               | The Vitest suite                                |
| `npm run test:cli`       | The CLI's Node test-runner suite                |
| `npm run security:audit` | High-severity issues in production dependencies |
| `npm run build`          | A production Next.js build                      |

Fix formatting rather than checking it:

```bash
npm run format
```

## The other scripts

| Command              | Does                               |
| -------------------- | ---------------------------------- |
| `npm run dev`        | Start the local development server |
| `npm run start`      | Start the production server        |
| `npm run test:watch` | Run Vitest in watch mode           |

## When a gate fails

Fix the cause. Do not skip the gate and do not silence the tool. A suppression
that has to stay carries a comment saying why, so the next reader knows it was a
decision rather than an escape.

Vale is the one gate whose failures read as style rather than correctness. It
enforces the project's prose rules: no em dashes, inclusive language, and no
hedging words that make a sentence say less than it appears to.

## Optional commit hooks

`.pre-commit-config.yaml` adds a small set of local checks. They cover only what
the linters above cannot see: a committed secret, a private key, an oversized
binary, an unresolved merge marker, and broken YAML. Prose and formatting stay
with Vale and Prettier, so nothing is checked twice.

Hooks do not travel with a clone. Install them once per repository:

```bash
pipx install pre-commit
pre-commit install
pre-commit run --all-files
```

The secret scan is the one worth having. This is a public template that people
fill with their own notes, and `/add-content` writes pasted text straight to
disk, so a key pasted into a note is a realistic mistake. Hooks are skippable
with `git commit --no-verify`, so treat them as a fast net rather than a gate.

## In CI

GitHub Actions runs `npm run quality` for every pull request and every push to
`main`. The workflow lives in `.github/workflows/`.
