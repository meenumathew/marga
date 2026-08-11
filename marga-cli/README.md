# marga-cli

Command-line tools for the Marga learning-dashboard template. The command is
`marga`, with two subcommands: `new` and `upgrade`.

Both exist to keep one promise: a site never has to edit a file the template also
owns. That is what makes an update a fast-forward, and a fast-forward cannot
produce a merge conflict.

## Usage

This package is not published to npm yet, so run it from a checkout of the Marga
repository:

```bash
node marga-cli/index.js new my-site
```

Once published (see the publishing note below), it becomes:

```bash
npx marga-cli new my-site
```

Or, once installed globally:

```bash
marga new my-site
```

Run with no arguments, or with `--help`, to see usage.

## `marga new <directory>`

Scaffolds a new site from the template:

1. Clones the Marga template into the directory you name.
2. Renames the template's `origin` remote to `base`, so the site knows where
   later improvements come from.
3. Writes your answers to `.env.local`, which Git ignores. Nothing tracked is
   touched, so the site's files stay byte-identical to the template.
4. Copies the template's starter notes into your notes folder, when you named one
   with `--notes` and it holds nothing yet.
5. Prints the next steps.

In a terminal, any value not passed as a flag is prompted for. When input is
piped or non-interactive, flags and defaults are used.

### Options

- `--name <text>`: site name. Defaults to the directory name.
- `--description <text>`: short description.
- `--prefix <text>`: browser-storage prefix. Defaults to a slug of the name.
- `--hero <text>`: dashboard hero message.
- `--notes <path>`: the folder your notes live in, kept outside the site.
- `--template <git-url>`: clone from a different template repo. Defaults to the
  published Marga repo, or the `MARGA_TEMPLATE` environment variable.
- `--install`: run `npm install` in the new directory.

An unknown flag, or a flag with no value, stops the run rather than branding the
site with a guess.

## `marga upgrade [directory]`

Brings template changes into a site. Only ever fast-forwards.

Anything that would need a merge stops with the reason, because a half-finished
merge in someone's notes repository is worse than an update that did not happen.
There are two such cases, and both leave the working tree exactly as it was:

- tracked files have uncommitted changes: the message names each one;
- the site has commits of its own: the message hands back the
  `git pull --no-rebase base main` decision.

### Options

- `--branch <name>`: the template branch to update from. Defaults to `main`, then
  `master`.
- `--install`: run `npm install` afterwards.

## Requirements

- Node.js 20 or newer
- `git` on your `PATH`

## Develop

```bash
node --test
```

Zero runtime dependencies: Node built-ins only. The package has its own
toolchain and is excluded from the application's ESLint and Prettier config.

## Publishing note

This package is kept inside the Marga repository for convenience. To publish it
to npm as `marga-cli`, so `npx marga-cli` works for everyone, move this folder
into its own repository and set `DEFAULT_TEMPLATE` in `index.js` to your public
Marga repo URL.
