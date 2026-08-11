# Configure Your Site

Your site's name, wording, colours, and notes folder live in a file called
`.env.local`. Git ignores that file, so updating the base template never
overwrites your settings and never asks you to merge anything.

You do not edit code to change any of this.

## Change the site name

1. Open `.env.local` in the site folder. If there is no such file, copy
   `.env.example` to `.env.local` first.
2. Change the words between the quotes:

   ```bash
   NEXT_PUBLIC_MARGA_SITE_NAME="My Study Path"
   ```

3. Stop the dev server with `Ctrl+C` and start it again with `npm run dev`.

The name appears in the browser tab, in page descriptions, and as the label a
screen reader reads with the logo.

`marga new` writes this file from the answers you give it, so a site created that
way already has one.

A shorter version of these steps ships inside the running site, at
`/learn/guides/rename-this-site`, for readers who never open this folder.

## Every setting

Leave a setting out and the template's default applies. A setting left empty
counts as left out.

| Setting                              | Changes                                    |
| ------------------------------------ | ------------------------------------------ |
| `NEXT_PUBLIC_MARGA_SITE_NAME`        | The site name in titles and metadata       |
| `NEXT_PUBLIC_MARGA_SITE_DESCRIPTION` | The one-sentence page description          |
| `NEXT_PUBLIC_MARGA_STORAGE_PREFIX`   | The prefix for this site's browser storage |
| `NEXT_PUBLIC_MARGA_LOGO_LABEL`       | The logo's accessible label                |
| `NEXT_PUBLIC_MARGA_DISPLAY_NAME`     | The name the dashboard greets              |
| `NEXT_PUBLIC_MARGA_FOCUS_AREA`       | The focus area on the dashboard            |
| `NEXT_PUBLIC_MARGA_WEEKLY_TARGET`    | The weekly target on the dashboard         |
| `NEXT_PUBLIC_MARGA_HERO_MESSAGE`     | The dashboard greeting                     |
| `NEXT_PUBLIC_MARGA_THEME_LIGHT`      | Light-theme colour overrides, as JSON      |
| `NEXT_PUBLIC_MARGA_THEME_DARK`       | Dark-theme colour overrides, as JSON       |
| `NEXT_PUBLIC_SITE_URL`               | The origin that serves the site            |
| `MARGA_STORAGE_ROOT`                 | Where your notes and progress live         |

`.env.example` lists all of them with comments.

### Do not change the storage prefix later

The prefix names this site's keys in browser storage. Change it after you have
recorded progress and the dashboard reads a different set of keys, so it looks
empty. The progress is still in the browser under the old prefix, and setting the
old value back brings it into view.

## Change the colours

Both theme settings take a JSON object of CSS custom properties:

```bash
NEXT_PUBLIC_MARGA_THEME_LIGHT={"--gold":"#0f7f95"}
NEXT_PUBLIC_MARGA_THEME_DARK={"--gold-2":"#22d3ee"}
```

Declaring one property leaves the others alone. `src/app/globals.css` lists the
property names the site uses.

Marga checks these before putting them on the page. A property name that is not
a CSS custom property, or a value carrying anything beyond colours, lengths, and
plain functions, is dropped with a warning in the server log rather than written
into the page.

## Replace the logo

The logo files live in `public/`. Replace the file contents and keep the
filenames, and nothing in code changes:

| File                                                          | Used for             |
| ------------------------------------------------------------- | -------------------- |
| `marga-logo-with-tagline-horizontal-on-light-transparent.svg` | Header, light theme  |
| `marga-logo-with-tagline-horizontal-on-dark.svg`              | Header, dark theme   |
| `marga-logo-with-tagline-stacked-on-light.svg`                | Stacked, light theme |
| `marga-logo-with-tagline-stacked-on-dark.svg`                 | Stacked, dark theme  |
| `apple-touch-icon.svg`                                        | The compact mark     |
| `favicon-16x16.png`, `favicon-32x32.png`                      | Browser tab icons    |
| `apple-touch-icon.png`                                        | Home-screen icon     |

The filenames keep the word `marga` in them. Readers never see a filename, and
keeping them means your site has no code changes of its own, which is what makes
an update a fast-forward. To rename them you have to edit
`src/config/site.ts`, and that file then conflicts on every future update.

## Choose where your notes live

By default your notes sit inside the site folder, under `content/learn/`. That
works, and it means your notes and the application share one Git repository.

Pointing Marga at a folder of your own keeps the site folder free of your work,
so an update touches code only:

```bash
MARGA_STORAGE_ROOT="/Users/you/Documents/notes"
```

Marga then reads and writes:

| Path                               | Holds                                    |
| ---------------------------------- | ---------------------------------------- |
| `<root>/content/learn/`            | Your notes, and anything written to them |
| `<root>/content/.marga/state.json` | The mirrored progress file               |

Two things follow. Notes come from the new root, so `/learn` shows that folder's
notes. Progress does too, and each root carries its own `state.json`, so
switching roots shows the progress recorded under the new one, which may be older
or empty. The browser copy is not cleared: it merges with whatever the new root
holds on the next load. See
[Progress state](../explanation/progress-state.md).

`marga new --notes <path>` sets this up and copies the template's starter notes
into an empty folder, so you keep the introduction. A folder that already has
notes in it is left alone.

## What you can change without any file

The dashboard has a customizer form behind the "Customize dashboard" control. It
edits the greeting, display name, focus area, and weekly target, and saves them
in that browser. Those edits sit on top of the matching settings above.

The site name, description, and colours have no form yet, so they need
`.env.local`. See [Known limitations](../../README.md#known-limitations).

## Change a default for every site

`src/config/site.ts` holds the template's defaults: the navigation links, the
page headings, the search placeholder. Editing it changes the default for every
site created from the template, and it is the right place for a change you want
all of them to have.

It is the wrong place for one site's branding. A site that edits this file has a
change the template does not have, so a later update has to merge rather than
fast-forward. See [Update your site](update-your-site.md).
