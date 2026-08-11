import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts?: Record<string, string>;
};

function readPackageManifest(): PackageManifest {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
  ) as PackageManifest;
}

describe("release quality contract", () => {
  it("test_quality_gate_runs_every_required_check", () => {
    const scripts = readPackageManifest().scripts ?? {};

    expect(scripts.quality?.split(" && ")).toEqual([
      "npm run format:check",
      "npm run lint",
      "npm run docs:lint",
      "npm run typecheck",
      "npm test",
      "npm run test:cli",
      "npm run security:audit",
      "npm run build",
    ]);
  });

  it("test_quality_gate_fails_when_a_required_check_fails", () => {
    const qualityCommand = readPackageManifest().scripts?.quality;
    const temporaryDirectory = mkdtempSync(join(tmpdir(), "marga-quality-contract-"));
    const npmStub = join(temporaryDirectory, "npm");
    const invocationLog = join(temporaryDirectory, "invocations.log");

    writeFileSync(
      npmStub,
      [
        "#!/bin/sh",
        'printf "%s\\n" "$*" >> "$MARGA_QUALITY_INVOCATION_LOG"',
        'if [ "$*" = "run lint" ]; then exit 17; fi',
      ].join("\n"),
    );
    chmodSync(npmStub, 0o755);

    try {
      const result = spawnSync("sh", ["-c", qualityCommand ?? ""], {
        env: {
          ...process.env,
          MARGA_QUALITY_INVOCATION_LOG: invocationLog,
          PATH: `${temporaryDirectory}:${process.env.PATH ?? ""}`,
        },
      });

      expect(result.status).toBe(17);
      expect(readFileSync(invocationLog, "utf8").trim().split("\n")).toEqual([
        "run format:check",
        "run lint",
      ]);
    } finally {
      rmSync(temporaryDirectory, { recursive: true });
    }
  });

  it("test_local_and_ci_quality_contracts_match", () => {
    const workflowPath = resolve(process.cwd(), ".github", "workflows", "quality.yml");

    expect(existsSync(workflowPath)).toBe(true);

    const workflow = readFileSync(workflowPath, "utf8");
    const actionReferences = [...workflow.matchAll(/uses: [^@\s]+@([^\s]+)/g)];

    expect(workflow.match(/run: npm run quality/g)).toHaveLength(1);
    expect(workflow).toContain("run: npm ci");
    expect(actionReferences).toHaveLength(2);
    expect(actionReferences.every(([, ref]) => /^[a-f0-9]{40}$/.test(ref))).toBe(true);
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("timeout-minutes: 20");
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).not.toContain("continue-on-error");
    expect(workflow).not.toContain("pull_request_target");
  });
});
