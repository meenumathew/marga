# Local Authoring and Security

Marga writes notes to disk from the browser, and it has no login. This page
explains what that means, what stops it being dangerous locally, and what you
have to add before hosting it.

## The threat is the page in your other tab

A remote attacker cannot reach `localhost`, so the realistic risk is not a
stranger scanning ports. It is any page you visit while `npm run dev` is running.
A browser will send a cross-origin `POST` with no preflight, and therefore
actually perform the write, as long as the request stays a CORS simple request.
Without a guard, a page you happened to open could create or overwrite notes on
your disk.

Three checks in `src/lib/request-guard.ts` close that path. Every state-changing
request has to pass all of them.

| Check                                    | Refusal |
| ---------------------------------------- | ------- |
| A JSON content type                      | `415`   |
| A loopback request target                | `403`   |
| Not labelled cross-origin by the browser | `403`   |

**A JSON content type.** `application/json` is not a simple-request content type,
so a browser has to preflight it. Next answers no CORS headers, so the real
request is never sent.

**A loopback target.** The hostname has to be `localhost`, `127.0.0.1`, or `::1`.
The default `npm run dev` and `npm run start` bind to loopback anyway, and this
check is independent of that, so a reverse proxy that makes the site reachable
cannot turn the write APIs on.

**Not cross-origin.** `Sec-Fetch-Site` decides, with an `Origin` and `Host`
comparison as the fallback for anything that does not send it. An unparseable
`Origin` counts as hostile.

A request with no browser origin headers at all, from curl, an editor, or the
test suite, is allowed. Reaching this port directly already implies local access.

## Paths cannot leave the storage root

Before writing, the routes canonicalize the configured storage root and, for a
new file, the nearest existing parent. A symlinked path that resolves outside the
canonical root is refused, for notes, content, sections, milestones, and
progress-state writes alike.

This is containment, not authentication. It also does not eliminate every
filesystem race a trusted local process could win between the check and the
write.

## Deleting a section is refused when it would take work with it

Deleting a section removes its folder, so the route refuses unless the folder
holds nothing you put there. Notes, images, exports, and an editor's own
dot-folder each block the delete, and the response names what it found. Only the
section's `_section.json` and throwaway files such as `.DS_Store` count as
removable.

Move the contents elsewhere first if you mean to delete the folder whole.

## Hosting it

A hosted Marga is a read-only reader. The write APIs are not public authoring
endpoints, and the checks above are not a substitute for a login.

Exposing authoring on a hosted site means adding, at minimum: authentication,
authorization, request-size limits, monitoring, and whatever storage controls
your environment requires. See [Deploy](../how-to/deploy.md).

## Progress state is not a user database

`content/.marga/` and the browser's `localStorage` hold personal learning state:
which notes you finished, what you produced, which days you were active. Treat it
as local, non-sensitive data rather than an audited record. See
[Progress state](progress-state.md).

## Reporting a vulnerability

`SECURITY.md` holds the policy. Do not open a public issue for a private security
report.
