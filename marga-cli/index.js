#!/usr/bin/env node
"use strict";

/**
 * marga — command-line tools for the Marga learning-dashboard template.
 *
 *   marga new my-site     Scaffold a site from the template.
 *   marga upgrade         Bring template improvements into a site.
 *
 * Both commands exist to keep one promise: a site never has to edit a file the
 * template also owns. `new` puts the site's name, description, and notes folder
 * in an untracked `.env.local` rather than in `src/config/site.ts`, so the site's
 * tracked files stay byte-identical to the template. `upgrade` can then
 * fast-forward, and a fast-forward cannot produce a merge conflict. That matters
 * because the people this template is for should not have to resolve one.
 *
 * When a site does edit tracked files, `upgrade` stops and says which ones
 * instead of starting a merge it cannot finish.
 *
 * Zero runtime dependencies: Node built-ins only.
 */

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");

// The template is cloned from here. Point this at your published Marga repo,
// or override per run with `--template <git-url>` or the MARGA_TEMPLATE env var.
const DEFAULT_TEMPLATE = process.env.MARGA_TEMPLATE || "https://github.com/meenumathew/marga.git";

const ENV_FILE = ".env.local";

// Tried in order when no --branch is given.
const DEFAULT_BRANCHES = ["main", "master"];

/** Turn a display name into a safe, lowercase, dash-separated slug. */
function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * One `KEY="value"` line.
 *
 * Quoted and escaped, because a value is free text: an unescaped quote would end
 * the value early and the remainder would parse as another setting, and an
 * unescaped newline would split one answer into two broken lines.
 */
function envAssignment(key, value) {
  const escaped = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");

  return `${key}="${escaped}"`;
}

/**
 * The contents of a site's `.env.local`. Pure, so it is cheap to test.
 *
 * Only answered settings are written. An empty value would read as "name this
 * site nothing" rather than "leave the default alone".
 */
function buildEnvLocal(answers) {
  const lines = [
    `# Marga settings for ${answers.name ? `"${answers.name}"` : "this site"}.`,
    "#",
    "# Git ignores this file, so updating the template never touches it. Change a",
    "# value, restart the dev server, and the site follows. Every setting, and what",
    "# happens when you leave one out, is documented in",
    "# docs/how-to/configure-your-site.md.",
    "",
  ];

  const settings = [
    ["NEXT_PUBLIC_MARGA_SITE_NAME", answers.name],
    ["NEXT_PUBLIC_MARGA_SITE_DESCRIPTION", answers.description],
    ["NEXT_PUBLIC_MARGA_STORAGE_PREFIX", answers.storagePrefix],
    ["NEXT_PUBLIC_MARGA_HERO_MESSAGE", answers.heroMessage],
    ["MARGA_STORAGE_ROOT", answers.storageRoot],
  ];

  for (const [key, value] of settings) {
    if (value) {
      lines.push(envAssignment(key, value));
    }
  }

  return `${lines.join("\n")}\n`;
}

/**
 * What `upgrade` should do, given the state of the site's repository. Pure.
 *
 * `up-to-date` is decided first: there is nothing to pull, so an edited working
 * tree is not a problem worth mentioning. Editing files is allowed; it only
 * blocks an update, and only while an update is available.
 */
function planUpgrade({ dirtyFiles, ahead, behind }) {
  if (behind === 0) {
    return { action: "up-to-date", message: "This site is already up to date with the template." };
  }

  if (dirtyFiles.length > 0) {
    return {
      action: "blocked-dirty",
      message: [
        "This site has unsaved changes to files the template also owns:",
        ...dirtyFiles.map((file) => `  ${file}`),
        "",
        "Updating would have to merge them, and a merge can conflict. Commit or undo",
        "these changes first, then run `marga upgrade` again. Settings belong in",
        `${ENV_FILE}, and notes belong in your notes folder, so neither appears here.`,
      ].join("\n"),
    };
  }

  if (ahead > 0) {
    return {
      action: "blocked-diverged",
      message: [
        `This site has ${ahead} commit(s) of its own, so the update is not a fast-forward.`,
        "Merging is a judgement call, so it is yours to make:",
        "",
        "  git pull --no-rebase base main",
        "",
        "See docs/how-to/update-your-site.md before you run it.",
      ].join("\n"),
    };
  }

  return {
    action: "fast-forward",
    message: `${behind} template change(s) to bring in. Nothing of yours is in the way.`,
  };
}

// Flags that take a value, mapped to the args field they set.
const VALUE_FLAGS = {
  "--template": "template",
  "--name": "name",
  "--description": "description",
  "--prefix": "storagePrefix",
  "--hero": "heroMessage",
  "--notes": "storageRoot",
  "--branch": "branch",
};

/** Parse argv into { command, targetDir, flags..., install, help }. */
function parseArgs(argv) {
  const args = {
    command: undefined,
    targetDir: undefined,
    template: DEFAULT_TEMPLATE,
    install: false,
    help: false,
    name: undefined,
    description: undefined,
    storagePrefix: undefined,
    heroMessage: undefined,
    storageRoot: undefined,
    branch: undefined,
  };
  const positionals = [];
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (Object.prototype.hasOwnProperty.call(VALUE_FLAGS, arg)) {
      const value = rest[i + 1];
      // Refuse rather than accept nothing: a missing value used to leave the
      // field unset without a word, and `--name --install` swallowed the next
      // flag as the name, so the site was branded "--install" and never installed.
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`${arg} needs a value. Run "marga --help" for usage.`);
      }
      args[VALUE_FLAGS[arg]] = value;
      i += 1;
    } else if (arg === "--install") {
      args.install = true;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg.startsWith("-")) {
      // A typo like --nmae would otherwise be ignored, and the run would quietly
      // brand the site with a default instead of what was asked for.
      throw new Error(`Unknown flag "${arg}". Run "marga --help" for usage.`);
    } else {
      positionals.push(arg);
    }
  }
  args.command = positionals[0];
  args.targetDir = positionals[1];
  return args;
}

function printUsage() {
  console.log(
    [
      "marga — command-line tools for the Marga learning-dashboard template",
      "",
      "Usage:",
      "  marga new <directory> [options]   Scaffold a new site from the template",
      "  marga upgrade [directory]         Bring template improvements into a site",
      "",
      "Options for `new`:",
      "  --name <text>          Site name (default: the directory name)",
      "  --description <text>   Short description",
      "  --prefix <text>        localStorage prefix (default: slug of the name)",
      "  --hero <text>          Dashboard hero message",
      "  --notes <path>         Folder your notes live in (default: inside the site)",
      "  --template <git-url>   Clone from a different template repo",
      "  --install              Run npm install in the new directory",
      "",
      "Options for `upgrade`:",
      "  --branch <name>        Template branch to update from (default: main)",
      "  --install              Run npm install afterwards",
      "",
      `Answers are written to ${ENV_FILE}, which git ignores, so updating the`,
      "template never overwrites them.",
      "",
      "In an interactive terminal, any value not passed as a flag is prompted",
      "for. When input is piped or non-interactive, flags and defaults are used.",
      "",
      "Examples:",
      "  marga new my-site",
      '  marga new my-site --name "PE Site" --description "Your path to mastery"',
      "  marga new my-site --notes ~/Documents/notes --install",
      "  marga upgrade",
    ].join("\n"),
  );
}

function printNextSteps(targetDir, answers, installed) {
  const lines = ["", "Done. Your site is ready.", "", "Next steps:", `  cd ${targetDir}`];
  if (!installed) {
    lines.push("  npm install");
  }
  lines.push("  npm run dev");
  lines.push("");
  lines.push(`To rename the site or change its wording later, edit ${ENV_FILE}`);
  lines.push("and restart the dev server. You never need to edit code for that.");
  lines.push("");
  lines.push("To bring in later template improvements:");
  lines.push("  marga upgrade");
  lines.push("");
  lines.push(
    answers.storageRoot
      ? `Your notes stay in ${answers.storageRoot}, outside this folder.`
      : "Add notes under content/learn/, and replace the logo files in public/.",
  );
  console.log(lines.join("\n"));
}

/**
 * Resolve the branding answers from flags, then interactive prompts, then
 * defaults — in that order. Prompting happens only when stdin is a real TTY;
 * piped or non-interactive input falls straight through to flags and defaults,
 * because readline drops lines that arrive in a single burst. All prompts run
 * before any subprocess, so nothing contends over stdin.
 */
async function resolveAnswers(args) {
  const interactive = Boolean(stdin.isTTY);
  const rl = interactive ? readline.createInterface({ input: stdin, output: stdout }) : null;

  // Return a flag value if present, else prompt (when interactive), else the
  // default. An empty prompt answer also falls back to the default.
  const resolve = async (flagValue, question, fallback) => {
    if (flagValue !== undefined) {
      return flagValue;
    }
    if (!rl) {
      return fallback;
    }
    const answer = (await rl.question(question)).trim();
    return answer || fallback;
  };

  try {
    const targetDir = args.targetDir || (await resolve(undefined, "Project directory name: ", ""));
    if (!targetDir) {
      throw new Error("A project directory name is required. Usage: marga new <directory>");
    }
    const name = await resolve(args.name, `Site name [${targetDir}]: `, targetDir);
    const description = await resolve(
      args.description,
      "Short description: ",
      "A customizable learning dashboard.",
    );
    const defaultPrefix = slugify(name) || slugify(targetDir);
    const storagePrefix = await resolve(
      args.storagePrefix,
      `localStorage prefix [${defaultPrefix}]: `,
      defaultPrefix,
    );
    const heroMessage = await resolve(args.heroMessage, "Hero message (optional): ", undefined);
    const storageRoot = await resolve(
      args.storageRoot,
      "Folder your notes live in (optional, keeps them out of the site): ",
      undefined,
    );

    return { targetDir, name, description, storagePrefix, heroMessage, storageRoot };
  } finally {
    rl?.close();
  }
}

/**
 * Run git and return its output verbatim.
 *
 * Not trimmed: `git status --porcelain` puts a status letter in the first two
 * columns, and for an unstaged edit the first of them is a space. Trimming ate
 * it, and every filename in the "cannot update" message lost its first letter.
 */
function gitRead(dir, gitArgs) {
  return execFileSync("git", ["-C", dir, ...gitArgs], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** Run git and let its output through to the terminal. */
function gitRun(dir, gitArgs) {
  execFileSync("git", ["-C", dir, ...gitArgs], { stdio: ["ignore", "inherit", "inherit"] });
}

/**
 * Copy the template's starter notes into a notes folder that has none yet.
 *
 * Keeping notes outside the site is what makes an update touch code only, but it
 * would otherwise cost the reader the introduction the template ships, because
 * those notes live in the site folder that is no longer being read. Only an
 * empty library is seeded: an existing one is the whole reason someone points
 * Marga at a folder, and overwriting it would destroy the notes they already have.
 */
function seedNotesFolder(destination, storageRoot) {
  const source = path.join(destination, "content", "learn");
  const target = path.resolve(process.cwd(), storageRoot, "content", "learn");

  if (!fs.existsSync(source)) {
    return;
  }

  if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
    console.log(`Left the notes already in ${target} alone.`);
    return;
  }

  fs.mkdirSync(target, { recursive: true });
  fs.cpSync(source, target, { recursive: true });
  console.log(`Copied the starter notes into ${target}.`);
}

/**
 * Clone the template, wire the `base` remote, write the settings file, and
 * (optionally) install. No prompting happens here, so git and npm can safely
 * take over the terminal. stdin is withheld from the children so they can never
 * consume input meant for the prompts.
 */
function scaffold(answers, args) {
  const destination = path.resolve(process.cwd(), answers.targetDir);
  if (fs.existsSync(destination)) {
    throw new Error(`"${answers.targetDir}" already exists. Choose a new directory name.`);
  }

  const childStdio = { stdio: ["ignore", "inherit", "inherit"] };

  // 1. Clone the template.
  console.log(`\nCloning template from ${args.template} ...`);
  execFileSync("git", ["clone", args.template, destination], childStdio);

  // 2. Keep the template reachable as `base` so `marga upgrade` has a source.
  execFileSync("git", ["-C", destination, "remote", "rename", "origin", "base"], childStdio);

  // 3. Write the settings. Nothing tracked is touched, which is what keeps a
  //    later update a fast-forward.
  fs.writeFileSync(path.join(destination, ENV_FILE), buildEnvLocal(answers), "utf8");
  console.log(`Wrote ${ENV_FILE}.`);

  // 4. Give an outside notes folder the template's introduction to start from.
  if (answers.storageRoot) {
    seedNotesFolder(destination, answers.storageRoot);
  }

  // 5. Optionally install dependencies.
  if (args.install) {
    console.log("\nInstalling dependencies ...");
    execFileSync("npm", ["install"], { cwd: destination, ...childStdio });
  }

  // 6. Next steps.
  printNextSteps(answers.targetDir, answers, args.install);
}

/** `marga new <dir>` — scaffold a new site from the template. */
async function runNew(args) {
  const answers = await resolveAnswers(args);
  scaffold(answers, args);
}

/** The template branch to update from, once `base` has been fetched. */
function resolveBaseBranch(site, requested) {
  const candidates = requested ? [requested] : DEFAULT_BRANCHES;

  for (const branch of candidates) {
    try {
      gitRead(site, ["rev-parse", "--verify", "--quiet", `refs/remotes/base/${branch}`]);
      return branch;
    } catch {
      // Not this one; try the next.
    }
  }

  throw new Error(
    `The template has no branch named ${candidates.join(" or ")}. ` +
      "Pass the right one with `marga upgrade --branch <name>`.",
  );
}

/** The tracked files with uncommitted changes. */
function dirtyTrackedFiles(site) {
  return gitRead(site, ["status", "--porcelain", "--untracked-files=no"])
    .split("\n")
    .filter((line) => line.length > 3)
    .map((line) => line.slice(3).trim());
}

/**
 * `marga upgrade [dir]` — bring template changes into a site.
 *
 * Only ever fast-forwards. Anything that would need a merge stops here with the
 * reason, because a half-finished merge in someone's notes repository is worse
 * than an update that did not happen.
 */
function runUpgrade(args) {
  const site = path.resolve(process.cwd(), args.targetDir || ".");

  try {
    gitRead(site, ["rev-parse", "--git-dir"]);
  } catch {
    throw new Error(
      `${site} is not a git repository, so there is no template to update from. ` +
        "Create sites with `marga new` so the template stays connected.",
    );
  }

  if (!gitRead(site, ["remote"]).trim().split("\n").includes("base")) {
    throw new Error(
      [
        "This site has no `base` remote, so it does not know which template to update from.",
        "Point it at the template once:",
        "",
        "  git remote add base https://github.com/meenumathew/marga.git",
      ].join("\n"),
    );
  }

  console.log("Checking the template for changes ...");
  gitRun(site, ["fetch", "--quiet", "base"]);

  const branch = resolveBaseBranch(site, args.branch);
  const [ahead, behind] = gitRead(site, [
    "rev-list",
    "--left-right",
    "--count",
    `HEAD...base/${branch}`,
  ])
    .trim()
    .split(/\s+/)
    .map(Number);

  const plan = planUpgrade({ dirtyFiles: dirtyTrackedFiles(site), ahead, behind });

  if (plan.action !== "fast-forward") {
    if (plan.action === "up-to-date") {
      console.log(plan.message);
      return;
    }
    throw new Error(plan.message);
  }

  console.log(`\n${plan.message}\n`);
  gitRun(site, ["log", "--oneline", `HEAD..base/${branch}`]);
  gitRun(site, ["merge", "--ff-only", "--quiet", `base/${branch}`]);
  console.log("\nUpdated. Your settings and notes were not touched.");

  if (args.install) {
    console.log("\nInstalling dependencies ...");
    execFileSync("npm", ["install"], { cwd: site, stdio: ["ignore", "inherit", "inherit"] });
  } else {
    console.log("Run `npm install` next, in case the update changed dependencies.");
  }
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help || !args.command) {
    printUsage();
    return;
  }

  if (args.command === "new") {
    await runNew(args);
    return;
  }

  if (args.command === "upgrade") {
    runUpgrade(args);
    return;
  }

  throw new Error(`Unknown command "${args.command}". Run "marga --help" for usage.`);
}

module.exports = { slugify, envAssignment, buildEnvLocal, planUpgrade, parseArgs };

if (require.main === module) {
  main().catch((error) => {
    console.error(`\nError: ${error.message}`);
    process.exit(1);
  });
}
