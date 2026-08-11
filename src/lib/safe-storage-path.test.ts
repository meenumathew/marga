import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveSafeStoragePath } from "./safe-storage-path";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true })));
});

async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "marga-safe-path-"));
  temporaryRoots.push(root);
  return root;
}

describe("resolveSafeStoragePath", () => {
  it("test_existing_target_outside_canonical_root_is_rejected", async () => {
    const fixtureRoot = await temporaryRoot();
    const storageRoot = path.join(fixtureRoot, "storage");
    const outsideFile = path.join(fixtureRoot, "outside.md");
    const linkedFile = path.join(storageRoot, "linked.md");
    await fs.mkdir(storageRoot);
    await fs.writeFile(outsideFile, "outside");
    await fs.symlink(outsideFile, linkedFile, "file");

    await expect(resolveSafeStoragePath(storageRoot, linkedFile)).resolves.toBeNull();
  });

  it("test_new_target_with_symlinked_parent_is_rejected", async () => {
    const fixtureRoot = await temporaryRoot();
    const storageRoot = path.join(fixtureRoot, "storage");
    const outsideRoot = path.join(fixtureRoot, "outside");
    const linkedDirectory = path.join(storageRoot, "linked");
    await fs.mkdir(storageRoot);
    await fs.mkdir(outsideRoot);
    await fs.symlink(outsideRoot, linkedDirectory, "dir");

    await expect(
      resolveSafeStoragePath(storageRoot, path.join(linkedDirectory, "new.md")),
    ).resolves.toBeNull();
  });

  it("test_new_target_under_canonical_parent_is_accepted", async () => {
    const fixtureRoot = await temporaryRoot();
    const storageRoot = path.join(fixtureRoot, "storage");
    const sectionRoot = path.join(storageRoot, "section");
    const target = path.join(sectionRoot, "new.md");
    await fs.mkdir(sectionRoot, { recursive: true });
    const canonicalTarget = path.join(await fs.realpath(sectionRoot), "new.md");

    await expect(resolveSafeStoragePath(storageRoot, target)).resolves.toBe(canonicalTarget);
  });
});
