import fs from "node:fs/promises";
import path from "node:path";

export async function resolveSafeStoragePath(
  storageRoot: string,
  requestedPath: string,
): Promise<string | null> {
  const absoluteRoot = path.resolve(storageRoot);
  const absoluteTarget = path.resolve(requestedPath);

  if (!isWithin(absoluteRoot, absoluteTarget)) {
    return null;
  }

  try {
    const canonicalRoot = await fs.realpath(absoluteRoot);
    const existingAncestor = await nearestExistingPath(absoluteRoot, absoluteTarget);

    if (!existingAncestor) {
      return null;
    }

    const canonicalAncestor = await fs.realpath(existingAncestor);

    if (!isWithin(canonicalRoot, canonicalAncestor)) {
      return null;
    }

    const relativeTarget = path.relative(existingAncestor, absoluteTarget);
    const canonicalTarget = path.resolve(canonicalAncestor, relativeTarget);
    return isWithin(canonicalRoot, canonicalTarget) ? canonicalTarget : null;
  } catch {
    return null;
  }
}

async function nearestExistingPath(root: string, target: string): Promise<string | null> {
  let candidate = target;

  while (isWithin(root, candidate)) {
    try {
      await fs.lstat(candidate);
      return candidate;
    } catch (error) {
      if (!isFileNotFound(error)) {
        return null;
      }
    }

    if (candidate === root) {
      return null;
    }

    candidate = path.dirname(candidate);
  }

  return null;
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isFileNotFound(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
