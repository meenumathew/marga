"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { slugify, envAssignment, buildEnvLocal, planUpgrade, parseArgs } = require("./index.js");

test("slugify lowercases, trims, and dasherizes", () => {
  assert.equal(slugify("Product Engineering!"), "product-engineering");
  assert.equal(slugify("  Hello  World  "), "hello-world");
});

test("envAssignment quotes the value", () => {
  assert.equal(envAssignment("KEY", "PE Site"), 'KEY="PE Site"');
});

test("envAssignment escapes quotes and backslashes", () => {
  // Unescaped, a quote would end the value early and the rest would parse as
  // another setting, so the site would be branded with half a sentence.
  assert.equal(envAssignment("KEY", 'a "b" c'), 'KEY="a \\"b\\" c"');
  assert.equal(envAssignment("KEY", "a\\b"), 'KEY="a\\\\b"');
});

test("envAssignment escapes newlines so a value stays one setting", () => {
  assert.equal(envAssignment("KEY", "one\ntwo"), 'KEY="one\\ntwo"');
});

test("buildEnvLocal writes the branding it was given", () => {
  const env = buildEnvLocal({
    name: "PE Site",
    description: "Your path to mastery",
    storagePrefix: "pe-site",
  });

  assert.match(env, /^NEXT_PUBLIC_MARGA_SITE_NAME="PE Site"$/m);
  assert.match(env, /^NEXT_PUBLIC_MARGA_SITE_DESCRIPTION="Your path to mastery"$/m);
  assert.match(env, /^NEXT_PUBLIC_MARGA_STORAGE_PREFIX="pe-site"$/m);
});

test("buildEnvLocal omits the settings that were not answered", () => {
  const env = buildEnvLocal({ name: "PE Site" });

  assert.doesNotMatch(env, /NEXT_PUBLIC_MARGA_HERO_MESSAGE/);
  assert.doesNotMatch(env, /MARGA_STORAGE_ROOT/);
});

test("buildEnvLocal writes the hero message when answered", () => {
  const env = buildEnvLocal({ name: "PE Site", heroMessage: "Begin the climb" });

  assert.match(env, /^NEXT_PUBLIC_MARGA_HERO_MESSAGE="Begin the climb"$/m);
});

test("buildEnvLocal writes the notes folder when answered", () => {
  const env = buildEnvLocal({ name: "PE Site", storageRoot: "/Users/me/notes" });

  assert.match(env, /^MARGA_STORAGE_ROOT="\/Users\/me\/notes"$/m);
});

test("buildEnvLocal ends with a newline and explains where the file is documented", () => {
  const env = buildEnvLocal({ name: "PE Site" });

  assert.match(env, /\n$/);
  assert.match(env, /docs\/how-to\/configure-your-site\.md/);
});

// The CLI writes settings that the app has to read back. These tests read both
// sides so a rename on either one fails here instead of producing a site that
// silently shows the template's name.
const REPO_ROOT = path.join(__dirname, "..");

function readRepoFile(...segments) {
  return fs.readFileSync(path.join(REPO_ROOT, ...segments), "utf8");
}

test("every setting the CLI writes is a setting the app reads", () => {
  const written = [...buildEnvLocal({
    name: "PE Site",
    description: "Your path to mastery",
    storagePrefix: "pe-site",
    heroMessage: "Begin the climb",
    storageRoot: "/Users/me/notes",
  }).matchAll(/^([A-Z_]+)=/gm)].map(([, key]) => key);

  const overrides = readRepoFile("src", "config", "site-overrides.ts");
  const storagePaths = readRepoFile("src", "lib", "storage-paths.ts");
  const readByTheApp = new Set([
    ...[...overrides.matchAll(/NEXT_PUBLIC_MARGA_[A-Z_]+/g)].map(([key]) => key),
    ...[...storagePaths.matchAll(/MARGA_STORAGE_ROOT/g)].map(([key]) => key),
  ]);

  assert.ok(written.length >= 5, `expected several settings, got ${written.length}`);
  for (const key of written) {
    assert.ok(readByTheApp.has(key), `${key} is written but nothing in src/ reads it`);
  }
});

test("planUpgrade refuses while tracked files are edited", () => {
  const plan = planUpgrade({ dirtyFiles: ["src/config/site.ts"], ahead: 0, behind: 3 });

  assert.equal(plan.action, "blocked-dirty");
  assert.match(plan.message, /src\/config\/site\.ts/);
});

test("planUpgrade reports nothing to do when the site is current", () => {
  assert.equal(planUpgrade({ dirtyFiles: [], ahead: 0, behind: 0 }).action, "up-to-date");
});

test("planUpgrade fast-forwards when only the template moved", () => {
  const plan = planUpgrade({ dirtyFiles: [], ahead: 0, behind: 3 });

  assert.equal(plan.action, "fast-forward");
  assert.match(plan.message, /3 /);
});

test("planUpgrade refuses to merge when the site has its own commits", () => {
  // A fast-forward cannot conflict. A merge can, so this stops and hands the
  // decision back instead of leaving a half-merged working tree behind.
  const plan = planUpgrade({ dirtyFiles: [], ahead: 2, behind: 3 });

  assert.equal(plan.action, "blocked-diverged");
  assert.match(plan.message, /git pull --no-rebase base/);
});

test("planUpgrade reports up to date before it reports a dirty tree", () => {
  // Nothing to pull means nothing to warn about; editing files is allowed.
  assert.equal(planUpgrade({ dirtyFiles: ["a.md"], ahead: 0, behind: 0 }).action, "up-to-date");
});

test("parseArgs reads the command, target dir, template, and install flag", () => {
  const args = parseArgs(["node", "marga", "new", "my-site", "--template", "git@x", "--install"]);
  assert.equal(args.command, "new");
  assert.equal(args.targetDir, "my-site");
  assert.equal(args.template, "git@x");
  assert.equal(args.install, true);
});

test("parseArgs sets help and leaves command undefined for --help", () => {
  const args = parseArgs(["node", "marga", "--help"]);
  assert.equal(args.help, true);
  assert.equal(args.command, undefined);
});

test("parseArgs defaults install to false and keeps positional order", () => {
  const args = parseArgs(["node", "marga", "new", "first"]);
  assert.equal(args.command, "new");
  assert.equal(args.targetDir, "first");
  assert.equal(args.install, false);
});

test("parseArgs reads every branding flag as its setting", () => {
  const args = parseArgs([
    "node",
    "marga",
    "new",
    "my-site",
    "--name",
    "PE Site",
    "--description",
    "Your path to mastery",
    "--prefix",
    "pe",
    "--hero",
    "Begin the climb",
    "--notes",
    "/Users/me/notes",
  ]);
  assert.equal(args.name, "PE Site");
  assert.equal(args.description, "Your path to mastery");
  assert.equal(args.storagePrefix, "pe");
  assert.equal(args.heroMessage, "Begin the climb");
  assert.equal(args.storageRoot, "/Users/me/notes");
});

test("parseArgs reads the upgrade command and its branch flag", () => {
  const args = parseArgs(["node", "marga", "upgrade", "--branch", "release"]);
  assert.equal(args.command, "upgrade");
  assert.equal(args.branch, "release");
});

test("parseArgs refuses a value flag with nothing after it", () => {
  assert.throws(() => parseArgs(["node", "marga", "new", "my-site", "--name"]), /--name needs a/);
});

test("parseArgs refuses a value flag followed by another flag", () => {
  // Without this, --install becomes the site name and never takes effect.
  assert.throws(
    () => parseArgs(["node", "marga", "new", "my-site", "--name", "--install"]),
    /--name needs a/,
  );
});

test("parseArgs refuses an unknown flag", () => {
  assert.throws(() => parseArgs(["node", "marga", "new", "my-site", "--nmae", "PE"]), /--nmae/);
});

const CLI = path.join(__dirname, "index.js");
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
const GIT_IDENTITY = ["-c", "user.email=test@example.com", "-c", "user.name=Test"];

function git(dir, ...rest) {
  return execFileSync("git", ["-C", dir, ...GIT_IDENTITY, ...rest], {
    env: GIT_ENV,
    encoding: "utf8",
  });
}

/** Build a throwaway local git repo that stands in for the published template. */
function makeTemplateRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "marga-template-"));
  const seedNote = path.join(dir, "content", "learn", "guides", "start-here.md");
  fs.mkdirSync(path.dirname(seedNote), { recursive: true });
  fs.writeFileSync(seedNote, "# Start here\n", "utf8");
  const configPath = path.join(dir, "src", "config", "site.ts");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(
    configPath,
    [
      "export const siteDefaults = {",
      '  name: "MARGA",',
      '  description: "A customizable learning dashboard.",',
      '  storagePrefix: "marga",',
      "};",
      "",
    ].join("\n"),
    "utf8",
  );
  execFileSync("git", ["-C", dir, "init", "-q"], { env: GIT_ENV });
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "template");
  return dir;
}

/** Scaffold a site from a template repo the way a non-interactive shell would. */
function runCli(cwd, ...args) {
  return execFileSync("node", [CLI, ...args], {
    cwd,
    env: GIT_ENV,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

function makeSite(template, workdir, ...extraArgs) {
  runCli(
    workdir,
    "new",
    "site",
    "--name",
    "PE Site",
    "--description",
    "Your path to mastery",
    "--template",
    template,
    ...extraArgs,
  );
  return path.join(workdir, "site");
}

test("marga new clones the template, renames origin to base, and writes .env.local", () => {
  const template = makeTemplateRepo();
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "marga-work-"));
  const notes = fs.mkdtempSync(path.join(os.tmpdir(), "marga-notes-"));
  try {
    const site = makeSite(template, workdir, "--notes", notes);

    // The template stays reachable as `base` for future `marga upgrade`.
    assert.equal(execFileSync("git", ["-C", site, "remote"], { encoding: "utf8" }).trim(), "base");

    const env = fs.readFileSync(path.join(site, ".env.local"), "utf8");
    assert.match(env, /^NEXT_PUBLIC_MARGA_SITE_NAME="PE Site"$/m);
    assert.match(env, /^NEXT_PUBLIC_MARGA_SITE_DESCRIPTION="Your path to mastery"$/m);
    assert.match(env, /^NEXT_PUBLIC_MARGA_STORAGE_PREFIX="pe-site"$/m);
    assert.match(env, new RegExp(`^MARGA_STORAGE_ROOT="${notes}"$`, "m"));
  } finally {
    for (const dir of [template, workdir, notes]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("marga new leaves every tracked file identical to the template", () => {
  // This is what makes an update a fast-forward: branding lives in an ignored
  // file, so the new site has no changes of its own to merge.
  const template = makeTemplateRepo();
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "marga-work-"));
  try {
    const site = makeSite(template, workdir);

    assert.equal(git(site, "status", "--porcelain", "--untracked-files=no").trim(), "");
    assert.equal(
      fs.readFileSync(path.join(site, "src", "config", "site.ts"), "utf8"),
      fs.readFileSync(path.join(template, "src", "config", "site.ts"), "utf8"),
    );
  } finally {
    fs.rmSync(template, { recursive: true, force: true });
    fs.rmSync(workdir, { recursive: true, force: true });
  }
});

test("marga new seeds an empty notes folder with the template's introduction", () => {
  // Notes kept outside the site are what makes an update touch code only. Doing
  // that should not cost the reader the introduction the template ships.
  const template = makeTemplateRepo();
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "marga-work-"));
  const notes = fs.mkdtempSync(path.join(os.tmpdir(), "marga-notes-"));
  try {
    makeSite(template, workdir, "--notes", notes);

    assert.equal(
      fs.readFileSync(path.join(notes, "content", "learn", "guides", "start-here.md"), "utf8"),
      "# Start here\n",
    );
  } finally {
    for (const dir of [template, workdir, notes]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("marga new leaves an existing notes folder untouched", () => {
  const template = makeTemplateRepo();
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "marga-work-"));
  const notes = fs.mkdtempSync(path.join(os.tmpdir(), "marga-notes-"));
  const mine = path.join(notes, "content", "learn", "mine.md");
  fs.mkdirSync(path.dirname(mine), { recursive: true });
  fs.writeFileSync(mine, "# Mine\n", "utf8");
  try {
    makeSite(template, workdir, "--notes", notes);

    assert.equal(fs.readFileSync(mine, "utf8"), "# Mine\n");
    assert.ok(
      !fs.existsSync(path.join(notes, "content", "learn", "guides")),
      "an existing library should not be seeded",
    );
  } finally {
    for (const dir of [template, workdir, notes]) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("marga new refuses to overwrite an existing directory", () => {
  const template = makeTemplateRepo();
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "marga-work-"));
  fs.mkdirSync(path.join(workdir, "site"));
  try {
    assert.throws(
      () => runCli(workdir, "new", "site", "--template", template),
      /already exists/,
    );
  } finally {
    fs.rmSync(template, { recursive: true, force: true });
    fs.rmSync(workdir, { recursive: true, force: true });
  }
});

test("marga upgrade brings template changes into an unmodified site", () => {
  const template = makeTemplateRepo();
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "marga-work-"));
  try {
    const site = makeSite(template, workdir);

    // The template ships a fix after the site was created.
    fs.writeFileSync(path.join(template, "src", "fix.ts"), "export const fixed = true;\n", "utf8");
    git(template, "add", ".");
    git(template, "commit", "-qm", "fix: correct the thing");

    const output = runCli(site, "upgrade");

    assert.match(output, /fix: correct the thing/);
    assert.ok(fs.existsSync(path.join(site, "src", "fix.ts")), "the fix should have arrived");
    // The site's own settings survive the update.
    assert.match(fs.readFileSync(path.join(site, ".env.local"), "utf8"), /"PE Site"/);
  } finally {
    fs.rmSync(template, { recursive: true, force: true });
    fs.rmSync(workdir, { recursive: true, force: true });
  }
});

test("marga upgrade says so when the site is already current", () => {
  const template = makeTemplateRepo();
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "marga-work-"));
  try {
    const site = makeSite(template, workdir);

    assert.match(runCli(site, "upgrade"), /already up to date/i);
  } finally {
    fs.rmSync(template, { recursive: true, force: true });
    fs.rmSync(workdir, { recursive: true, force: true });
  }
});

test("marga upgrade stops and names the files when tracked files were edited", () => {
  const template = makeTemplateRepo();
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "marga-work-"));
  try {
    const site = makeSite(template, workdir);

    fs.writeFileSync(path.join(template, "src", "fix.ts"), "export const fixed = true;\n", "utf8");
    git(template, "add", ".");
    git(template, "commit", "-qm", "fix: correct the thing");

    const configPath = path.join(site, "src", "config", "site.ts");
    fs.writeFileSync(configPath, 'export const siteDefaults = { name: "edited" };\n', "utf8");

    assert.throws(() => runCli(site, "upgrade"), /src\/config\/site\.ts/);
    // Refusing has to leave the edit alone, or it would destroy the work it warns about.
    assert.match(fs.readFileSync(configPath, "utf8"), /edited/);
    assert.ok(!fs.existsSync(path.join(site, "src", "fix.ts")), "nothing should have been pulled");
  } finally {
    fs.rmSync(template, { recursive: true, force: true });
    fs.rmSync(workdir, { recursive: true, force: true });
  }
});

test("marga upgrade explains what to do when there is no base remote", () => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "marga-work-"));
  try {
    execFileSync("git", ["-C", workdir, "init", "-q"], { env: GIT_ENV });

    assert.throws(() => runCli(workdir, "upgrade"), /git remote add base/);
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
});

test("marga upgrade explains what to do outside a git repository", () => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "marga-work-"));
  try {
    assert.throws(() => runCli(workdir, "upgrade"), /not a git repository/i);
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
});
