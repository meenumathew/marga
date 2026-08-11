# Create a Site From the Template

The `marga-cli` package makes your own site from this template: your name, your
wording, your notes, and a connection back to the template so later improvements
reach you.

You need Node.js 20 or newer, npm, and Git.

## Make the site

```bash
npx marga-cli new my-study-path --install
```

In a terminal it asks for each setting and offers a default:

```text
Site name [my-study-path]: My Study Path
Short description: Notes on the work I am learning to do
localStorage prefix [my-study-path]:
Hero message (optional): Begin the climb.
Folder your notes live in (optional, keeps them out of the site):
```

Then:

```bash
cd my-study-path
npm run dev
```

Open `http://localhost:3000`.

## Answer with flags instead

Every prompt has a flag, which is what you want in a script or when input is
piped:

```bash
npx marga-cli new my-study-path \
  --name "My Study Path" \
  --description "Notes on the work I am learning to do" \
  --hero "Begin the climb." \
  --notes ~/Documents/notes \
  --install
```

| Flag                   | Sets                                                   |
| ---------------------- | ------------------------------------------------------ |
| `--name`               | The site name (default: the directory name)            |
| `--description`        | The one-sentence description                           |
| `--prefix`             | The browser-storage prefix (default: slug of the name) |
| `--hero`               | The dashboard greeting                                 |
| `--notes`              | The folder your notes live in                          |
| `--template <git-url>` | Clone a different template repository                  |
| `--install`            | Run `npm install` in the new directory                 |

An unknown flag or a flag with no value stops the run rather than branding the
site with a guess.

## Any name works

Nothing requires the word `marga` or a `marga-` prefix. The directory name, the
site name, and the storage prefix are yours:

```bash
npx marga-cli new atlas --name "Atlas" --prefix atlas
```

The logo files in `public/` keep `marga` in their filenames. Replace their
contents and leave the names alone, and your site still has no code changes of
its own, which is what keeps updates conflict-free. See
[Configure your site](configure-your-site.md#replace-the-logo).

## By hand

The same result without the CLI:

```bash
# 1. Clone the template and keep it reachable for future updates
git clone https://github.com/meenumathew/marga.git my-study-path
cd my-study-path
git remote rename origin base

# 2. Write your settings into a file git ignores
cp .env.example .env.local
#    then edit the values in .env.local

# 3. Replace the contents of the logo files in public/, keeping their names

# 4. Add your notes under content/learn/

npm install && npm run dev
```

Step 2 is the one that matters. Putting settings in `.env.local` rather than in
`src/config/site.ts` is what keeps your tracked files identical to the template.

## What the CLI did

| Step                                          | Why                                                     |
| --------------------------------------------- | ------------------------------------------------------- |
| Cloned the template into your directory       | The site starts as the template                         |
| Renamed the `origin` remote to `base`         | The site knows where later improvements come from       |
| Wrote your answers to `.env.local`            | Git ignores that file, so an update cannot overwrite it |
| Copied the starter notes to your notes folder | Only when you named one and it was empty                |

Nothing Git tracks was changed. Check it yourself:

```bash
git -C my-study-path status
```

That clean result is the point. It means [updating](update-your-site.md) is a
fast-forward, and a fast-forward cannot produce a merge conflict.

## Publish your site as its own repository

The site's `base` remote points at the template, so add your own separately:

```bash
cd my-study-path
git remote add origin git@github.com:you/my-study-path.git
git push -u origin main
```

Keep `base` where it is. Removing it removes the update path.

## Next

- [Configure your site](configure-your-site.md): change the name, wording, and
  colours later, with no code.
- [Update your site](update-your-site.md): bring in template improvements.
- [Content model](../reference/content-model.md): how a Markdown file becomes a
  page.
