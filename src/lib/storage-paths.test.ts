import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { getStoragePaths } from "@/lib/storage-paths";

const originalStorageRoot = process.env.MARGA_STORAGE_ROOT;

afterEach(() => {
  if (originalStorageRoot === undefined) {
    delete process.env.MARGA_STORAGE_ROOT;
  } else {
    process.env.MARGA_STORAGE_ROOT = originalStorageRoot;
  }
});

describe("storage paths", () => {
  it("test_storage_paths_default_to_repository_storage", () => {
    delete process.env.MARGA_STORAGE_ROOT;

    expect(getStoragePaths()).toEqual({
      contentRoot: path.join(process.cwd(), "content", "learn"),
      statePath: path.join(process.cwd(), "content", ".marga", "state.json"),
    });
  });

  it("test_storage_paths_use_configured_isolated_root", () => {
    const isolatedRoot = path.join(process.cwd(), ".test-storage");
    process.env.MARGA_STORAGE_ROOT = isolatedRoot;

    expect(getStoragePaths()).toEqual({
      contentRoot: path.join(isolatedRoot, "content", "learn"),
      statePath: path.join(isolatedRoot, "content", ".marga", "state.json"),
    });
  });
});
