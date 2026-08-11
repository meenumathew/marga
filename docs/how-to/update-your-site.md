# Update Your Site

The base template keeps getting fixes and features. This page brings them into
your site without putting you in front of a merge conflict.

You need no Git knowledge for the normal case.

## Update

From inside your site folder:

```bash
npx marga-cli upgrade
```

Or, if you have the repository checked out:

```bash
node marga-cli/index.js upgrade
```

It prints the incoming changes, brings them in, and says what it did:

```text
Checking the template for changes ...

3 template change(s) to bring in. Nothing of yours is in the way.

a1b2c3d fix: keep long note titles on one line
d4e5f6a feat: add a print stylesheet
9f8e7d6 docs: explain the storage prefix

Updated. Your settings and notes were not touched.
Run `npm install` next, in case the update changed dependencies.
```

Then:

```bash
npm install
npm run dev
```

## Why this cannot conflict

An update is a fast-forward, and a fast-forward has nothing to merge.

That holds because your site keeps nothing of its own in the files Git tracks:

| Yours                       | Lives in                            | Tracked by Git            |
| --------------------------- | ----------------------------------- | ------------------------- |
| Site name, wording, colours | `.env.local`                        | No                        |
| Notes and progress          | `content/learn/`, or a notes folder | Yours, not the template's |
| Everything else             | The template's files                | Yes, unchanged            |

Your settings sit in a file Git ignores, so an update cannot reach them. Your
notes are either in your own repository or in a folder outside the site. What
remains is template code, and yours is identical to the template's, so an update
only moves forward.

## When it refuses

`marga upgrade` never starts a merge it cannot finish. There are two reasons it
stops, and both leave your work exactly as it was.

### You edited files the template owns

```text
Error: This site has unsaved changes to files the template also owns:
  src/config/site.ts

Updating would have to merge them, and a merge can conflict. Commit or undo
these changes first, then run `marga upgrade` again. Settings belong in
.env.local, and notes belong in your notes folder, so neither appears here.
```

Nothing was pulled and your edit is still there. Two ways forward:

- The edit is branding: move it to `.env.local` instead. See
  [Configure your site](configure-your-site.md). Then undo the file edit with
  `git checkout -- <file>` and update again.
- The edit is a real change you want to keep: commit it. The next update takes
  the diverged path below.

### Your site has commits of its own

```text
Error: This site has 2 commit(s) of its own, so the update is not a fast-forward.
Merging is a judgement call, so it is yours to make:

  git pull --no-rebase base main
```

Now a merge is genuinely needed, and a merge can conflict, so the decision is
yours rather than a tool's. If you are not comfortable resolving a conflict, ask
someone who is, or read [Keep your own changes](#keep-your-own-changes) first.

`--no-rebase` is not optional there. A site and the template have genuinely
divergent histories, so Git refuses to guess when `pull.rebase` is unset. Merging
rather than rebasing is what you want, because it keeps your site's own commits
intact.

## Keep your own changes

Sites that do change template code stay updatable with three habits:

1. **Keep the change small and in few files.** A conflict is a conversation about
   one file. Ten files is ten conversations.
2. **Update often.** A merge across three template commits is manageable. A merge
   across three hundred is a rewrite.
3. **Stay Prettier-clean** (`npm run format`). The template is formatted, so an
   unformatted site conflicts on every rewrapped line even when the words did not
   change.

Resolve a conflict in a file you deliberately changed by keeping your version:

```bash
git checkout --ours <file>
```

Before a merge, know how to abandon it:

```bash
git merge --abort
```

That returns the site to how it was before the merge started, so trying is safe.

## Where the template comes from

`marga new` names the template repository `base`, so the site knows where updates
come from. A site made another way needs that once:

```bash
git remote add base https://github.com/meenumathew/marga.git
```

A template on a branch other than `main` or `master`:

```bash
npx marga-cli upgrade --branch release
```

## If you maintain the template

Never rewrite published history. No `commit --amend`, rebase, or force-push on a
commit that sites were cloned from. Doing so orphans the shared ancestor, and
every existing site loses the fast-forward path this whole design exists to
protect.

## Check the update worked

```bash
npm run quality
```

That runs the same gates CI runs. If a gate fails after an update, the failure is
in the template rather than in your notes, so
[open an issue](https://github.com/meenumathew/marga/issues) rather than working
around it.
