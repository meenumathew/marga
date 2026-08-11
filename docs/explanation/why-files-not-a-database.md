# Why Files, Not a Database

Marga keeps notes as Markdown files on disk and progress in a JSON file beside
them. This page explains what that buys, and the point at which it stops being
the right choice.

## What files buy

Your notes outlive the application. They are readable in any editor, diffable in
any review, and versioned by Git without Marga knowing anything about it. Delete
Marga and you still have your notes. A database would make the notes an export
away from being useful.

It also makes the whole system inspectable. A wrong page is a wrong file, and you
can open it. There is no migration to run, no schema to keep in step, and no
server to have running before you can write.

The cost is that everything personal is per-machine. There is no sync, no
accounts, and no shared view.

## When a database becomes the right answer

Files stop being enough as soon as more than one person, or more than one device,
needs the same state. Concretely:

- accounts and login
- progress that follows you between devices
- saved plans that two people can both see
- quiz scores, or anything else that must not be lost with a browser profile
- any record you would have to audit

At that point the honest move is a database for the personal data, with the notes
left as files. Those are separate concerns and only one of them needs a server.

## Content is re-read on every request

Within one request the library is parsed once and reused, so a page needing it
five times pays for one walk of `content/learn/`. Nothing is cached between
requests, so each page load walks the folder again.

That is cheap for a few hundred notes and gets slower with a large vault. A
longer-lived cache would have to decide when a file change drops it, and getting
that wrong shows stale notes, which is worse than a slow page. Request scope is
where this deliberately stops. If your vault is large enough for it to hurt, that
is the change worth making, and it is a real design decision rather than a
missing line.

## Why not a documentation engine

A tool like [Fumadocs](https://fumadocs.dev) brings stronger MDX conventions,
generated sidebars, and docs-focused layouts. It would replace a good deal of
`src/lib/learn-content.ts`.

It is not used because Marga is not a documentation site. The dashboard, evidence
log, achievements, and progress model are the product, and the reader is the part
a docs engine would own. Adopting one would mean fitting those around its
conventions. Keeping the content pipeline small and local keeps it easy to change,
which matters more while the progress model is still moving.

If you want the reader and nothing else, a docs engine is a better fit than this
template.
