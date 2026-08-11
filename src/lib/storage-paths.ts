import path from "node:path";

const STORAGE_ROOT_ENVIRONMENT_VARIABLE = "MARGA_STORAGE_ROOT";

export type StoragePaths = {
  contentRoot: string;
  statePath: string;
};

export function getStoragePaths(): StoragePaths {
  const configuredRoot = process.env[STORAGE_ROOT_ENVIRONMENT_VARIABLE]?.trim();
  const storageRoot = configuredRoot || process.cwd();

  return {
    contentRoot: path.join(storageRoot, "content", "learn"),
    statePath: path.join(storageRoot, "content", ".marga", "state.json"),
  };
}
