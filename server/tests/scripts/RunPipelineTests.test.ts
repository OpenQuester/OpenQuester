import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";

interface PipelineResults {
  readonly openHandles?: readonly unknown[];
  readonly success: boolean;
}

type OpenHandleProcessor = (results: PipelineResults) => PipelineResults;

interface PipelineLock {
  release(): void;
}

type AcquirePipelineLock = (lockPath: string) => PipelineLock;

const requireFromTest = createRequire(__filename);
const failOnOpenHandles = requireFromTest(
  resolve(__dirname, "../../scripts/test/failOnOpenHandles.cjs")
) as OpenHandleProcessor;
const pipelineLockModule = resolve(__dirname, "../../scripts/test/pipelineLock.cjs");
const { acquirePipelineLock } = requireFromTest(pipelineLockModule) as {
  acquirePipelineLock: AcquirePipelineLock;
};
const execFileAsync = promisify(execFile);
const pipelineRunner = resolve(__dirname, "../../scripts/test/runPipelineTests.mjs");
const packageManifest = resolve(__dirname, "../../package.json");
let temporaryDirectory: string;

beforeEach(() => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), "openquester-pipeline-lock-"));
});

afterEach(() => {
  rmSync(temporaryDirectory, { force: true, recursive: true });
});

describe("pipeline test runner", () => {
  it("routes the default npm test command through the canonical pipeline", () => {
    const manifest = JSON.parse(readFileSync(packageManifest, "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(manifest.scripts?.test).toBe("npm run test:pipeline --");
  });

  it("preserves successful results when Jest reports no open handles", () => {
    const results: PipelineResults = { openHandles: [], success: true };

    expect(failOnOpenHandles(results)).toBe(results);
  });

  it("fails with handle diagnostics when Jest reports open handles", () => {
    const leakedTimer = new Error("leaked timer handle");
    const results: PipelineResults = { openHandles: [leakedTimer], success: true };

    expect(() => failOnOpenHandles(results)).toThrow(
      "Jest detected 1 open handle(s) after tests completed"
    );
    expect(() => failOnOpenHandles(results)).toThrow("leaked timer handle");
  });

  it("prevents concurrent pipeline ownership in the same checkout", () => {
    const lockPath = join(temporaryDirectory, "test-pipeline.lock");
    const lock = acquirePipelineLock(lockPath);

    try {
      expect(() => acquirePipelineLock(lockPath)).toThrow(
        `Another test:pipeline process owns this checkout (PID ${process.pid}`
      );
    } finally {
      lock.release();
    }

    expect(existsSync(lockPath)).toBe(false);
  });

  it("recovers a pipeline lock after its owner process exits", async () => {
    const lockPath = join(temporaryDirectory, "test-pipeline.lock");
    const acquireWithoutRelease =
      "const { acquirePipelineLock } = require(process.argv[1]); " +
      "acquirePipelineLock(process.argv[2]);";

    await execFileAsync(process.execPath, [
      "-e",
      acquireWithoutRelease,
      pipelineLockModule,
      lockPath
    ]);

    const staleOwner = JSON.parse(readFileSync(lockPath, "utf8")) as { pid: number };
    expect(staleOwner.pid).not.toBe(process.pid);

    const recoveredLock = acquirePipelineLock(lockPath);
    const currentOwner = JSON.parse(readFileSync(lockPath, "utf8")) as { pid: number };
    expect(currentOwner.pid).toBe(process.pid);

    recoveredLock.release();
    expect(existsSync(lockPath)).toBe(false);
  });

  it("recovers when the stale-lock recovery owner process exits", async () => {
    const lockPath = join(temporaryDirectory, "test-pipeline.lock");
    const recoveryPath = `${lockPath}.recovery`;
    const acquireLockWithoutRelease =
      "const { acquirePipelineLock } = require(process.argv[1]); " +
      "acquirePipelineLock(process.argv[2]);";
    const acquireRecoveryWithoutRelease =
      "const { acquireRecoveryLease } = require(process.argv[1]); " +
      "if (!acquireRecoveryLease(process.argv[2])) process.exitCode = 2;";

    await execFileAsync(process.execPath, [
      "-e",
      acquireLockWithoutRelease,
      pipelineLockModule,
      lockPath
    ]);
    await execFileAsync(process.execPath, [
      "-e",
      acquireRecoveryWithoutRelease,
      pipelineLockModule,
      recoveryPath
    ]);

    const staleRecoveryOwner = JSON.parse(
      readFileSync(join(recoveryPath, "owner.json"), "utf8")
    ) as { pid: number };
    expect(staleRecoveryOwner.pid).not.toBe(process.pid);

    const recoveredLock = acquirePipelineLock(lockPath);
    const currentOwner = JSON.parse(readFileSync(lockPath, "utf8")) as {
      pid: number;
    };
    expect(currentOwner.pid).toBe(process.pid);

    recoveredLock.release();
    expect(existsSync(lockPath)).toBe(false);
    expect(existsSync(recoveryPath)).toBe(false);
  });

  it("adopts an ownerless recovery mutex left during creation", async () => {
    const lockPath = join(temporaryDirectory, "test-pipeline.lock");
    const recoveryPath = `${lockPath}.recovery`;
    const acquireLockWithoutRelease =
      "const { acquirePipelineLock } = require(process.argv[1]); " +
      "acquirePipelineLock(process.argv[2]);";
    const createOwnerlessRecovery = "require('node:fs').mkdirSync(process.argv[1]);";

    await execFileAsync(process.execPath, [
      "-e",
      acquireLockWithoutRelease,
      pipelineLockModule,
      lockPath
    ]);
    await execFileAsync(process.execPath, ["-e", createOwnerlessRecovery, recoveryPath]);

    expect(existsSync(join(recoveryPath, "owner.json"))).toBe(false);

    const recoveredLock = acquirePipelineLock(lockPath);
    const currentOwner = JSON.parse(readFileSync(lockPath, "utf8")) as {
      pid: number;
    };
    expect(currentOwner.pid).toBe(process.pid);

    recoveredLock.release();
    expect(existsSync(lockPath)).toBe(false);
    expect(existsSync(recoveryPath)).toBe(false);
  });

  it.each(["--forceExit", "--no-detectOpenHandles", "--detectOpenHandles=false"])(
    "rejects leak-hiding Jest argument %s",
    async (argument) => {
      const failure = await captureRunnerFailure(argument);

      expect(failure.code).toBe(1);
      expect(failure.stderr).toContain(`Unsupported pipeline Jest argument "${argument}"`);
    }
  );
});

async function captureRunnerFailure(argument: string): Promise<RunnerFailure> {
  try {
    await execFileAsync(process.execPath, [pipelineRunner, argument]);
  } catch (error) {
    return error as RunnerFailure;
  }

  throw new Error(`Expected pipeline runner to reject ${argument}`);
}

interface RunnerFailure extends Error {
  readonly code?: number | string;
  readonly stderr?: string;
}
