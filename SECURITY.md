# Security Policy

Marga is a small learning-dashboard template. It is meant to be cloned and run
locally or deployed as a read-only personal site. It can organize learning in
any field, but it is not a regulated or specialized system. This policy explains
what is supported and how to report a problem.

## Supported Versions

Only the latest `main` is supported. There is no long-term support branch.

| Version               | Supported |
| --------------------- | --------- |
| latest `main` (0.1.x) | Yes       |
| older commits         | No        |

## Reporting a Vulnerability

Please **do not** open a public issue for a security problem.

Use GitHub's private vulnerability reporting: go to the repository's
**Security** tab and choose **Report a vulnerability**. This opens a private
advisory visible only to the maintainer.

Include, where you can:

- what the issue is and the impact you expect;
- steps to reproduce (a minimal case is ideal);
- the commit or version you tested against.

This is a personal, best-effort project, so there is no guaranteed response
time. You should expect an acknowledgement within a few days.

## Known Design Considerations

These are intentional properties of the template, not bugs. Read them before
deploying.

- **The content studio writes files to disk.** The `POST /api/content` route
  and the local "Add Content" studio create Markdown files on the machine
  running the server. This is designed for **local, single-user** authoring.
  The default `dev` and `start` commands bind to `127.0.0.1`, and every
  state-changing request must target an explicit loopback hostname. Hosted or
  non-loopback mutation requests receive `403`; hosted deployments are therefore
  read-only unless you add an authenticated authoring layer. Marga has **no
  authentication** by default.
- **Filesystem paths are canonicalized.** Content, note, section, milestone,
  and progress-state mutations resolve the configured root and the nearest
  existing parent before writing. Symlinks that escape the canonical root are
  rejected, including paths used for atomic progress-state replacement. This
  is a boundary check, not a complete defense against a trusted local attacker
  who swaps a path between validation and write (a filesystem TOCTOU race).
- **Learning progress is stored per user in local runtime state** under
  `content/.marga/` and in browser `localStorage`. Treat it as non-sensitive,
  device-local data, not as an audited store.
- **User-supplied Markdown is sanitized** on render (`rehype-sanitize`), and
  evidence links are filtered against active-content and protocol-relative
  URLs. If you change the rendering pipeline, keep sanitization in place.

## Scope

In scope: the application code in `src/`, the content API, and the build
configuration. Out of scope: vulnerabilities in third-party dependencies
(report those upstream) and issues that require an already-compromised host.
