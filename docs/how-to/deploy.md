# Deploy

A deployed Marga is a read-only reader. Notes are rendered; nothing is written.

## Build and run

```bash
npm run build
npm run start
```

Any host that runs a Next.js App Router application works.

## Set the site URL

```bash
NEXT_PUBLIC_SITE_URL="https://notes.example.com"
```

Page metadata builds absolute URLs from this, which is what link previews and
canonical URLs need. Leave it unset for local use: those URLs then stay relative
and keep working on whichever origin serves them.

## Ship the notes with the build

Notes are read from disk at request time, so the deployed application needs them
present. Two ways:

- Commit them under `content/learn/` in the repository you deploy. The notes are
  then versioned with the site.
- Set `MARGA_STORAGE_ROOT` to a path the host mounts, and put the notes there.

A note that is not on the deployed filesystem is a `404`, not an error.

## Authoring stays off

The write APIs refuse any request that is not on loopback, so `/add-content` and
the other authoring routes do not work on a hosted site. That is deliberate. Do
not expose them as public authoring endpoints without adding authentication,
authorization, request-size limits, monitoring, and the storage controls your
environment requires. See
[Local authoring and security](../explanation/local-authoring-and-security.md).

Write notes locally, commit, and deploy. That is the intended loop.

## Progress on a hosted site

Progress is stored per browser, so each visitor to a hosted site has their own,
and it never reaches the server, because the mirror write needs loopback. A
personal site deployed for reading on a phone therefore shows the phone's
progress rather than the laptop's.

Treat `content/.marga/` and browser `localStorage` as local, non-sensitive
learning state, not as a user database. See
[Progress state](../explanation/progress-state.md).

## Before you publish

```bash
npm run quality
```

The build is one of those gates, so a green run means the deployable artifact
builds. See [Run the quality gates](run-quality-gates.md).
