---
title: "Rename This Site"
description: "Change the site name, wording, and colours without touching code."
mode: "How-to"
level: "Beginner"
duration: "3 min"
updated: "2026-08-02"
order: 1
---

# Rename This Site

This site arrived named after the template. Changing that takes one text file and
no code.

## Change The Name

1. Open the site's folder in Finder, Explorer, or your editor.
2. Open the file called `.env.local`. If there is none, copy `.env.example` to
   `.env.local` and open that.
3. Find the line starting `NEXT_PUBLIC_MARGA_SITE_NAME` and change the words
   between the quotes:

   ```bash
   NEXT_PUBLIC_MARGA_SITE_NAME="My Study Path"
   ```

4. Save the file.
5. Stop the site with `Ctrl+C` in the terminal where it is running, then start it
   again with `npm run dev`.

The new name appears in the browser tab and in link previews. Any name works;
nothing has to mention Marga.

## Change The Rest

Every line in that file works the same way: change the words between the quotes,
save, restart.

| Line                                 | Changes                       |
| ------------------------------------ | ----------------------------- |
| `NEXT_PUBLIC_MARGA_SITE_NAME`        | The site name                 |
| `NEXT_PUBLIC_MARGA_SITE_DESCRIPTION` | The one-sentence description  |
| `NEXT_PUBLIC_MARGA_HERO_MESSAGE`     | The greeting on the dashboard |
| `NEXT_PUBLIC_MARGA_DISPLAY_NAME`     | The name the dashboard greets |
| `NEXT_PUBLIC_MARGA_FOCUS_AREA`       | The focus area shown          |
| `NEXT_PUBLIC_MARGA_WEEKLY_TARGET`    | The weekly target shown       |

A line you delete, or leave empty, goes back to the template's wording. Deleting
a line is always safe.

Leave `NEXT_PUBLIC_MARGA_STORAGE_PREFIX` alone once you have recorded progress.
It names where this site keeps your progress, so changing it later makes the
dashboard look empty. Your progress is not lost, and putting the old value back
brings it into view.

## Change The Greeting Without Any File

The greeting, display name, focus area, and weekly target also have a form. Open
the dashboard and use **Customize dashboard**. That saves in this browser only,
on top of whatever the file above says.

The site name, description, and colours have no form yet, so they need the file.

## Replace The Logo

The picture files live in the site's `public` folder. Replace what is inside them
and keep their names exactly as they are. Keeping the names means this site has no
code changes of its own, which is what keeps future template updates painless.

## The Full List

`.env.example` in the site's folder lists every setting with a comment. The
complete reference, including theme colours and where your notes live, is in
`docs/how-to/configure-your-site.md`.
