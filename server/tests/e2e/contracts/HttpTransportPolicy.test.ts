import { describe, expect, it } from "@jest/globals";
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

interface TestSource {
  readonly path: string;
  readonly source: string;
}

const testsRoot = resolve(__dirname, "../..");
const pureHttpPaths = [
  "user/user.test.ts",
  "user/user-permissions.test.ts",
  "user/user-mute.test.ts",
  "package/package.test.ts",
  "package/package-search.test.ts",
  "log/admin-logs.test.ts"
];
const hybridPaths = [
  "user/UserNotificationRooms.test.ts",
  "user/user-data-update.test.ts",
  "game/game-update.test.ts"
];
const pureHttpSuites = pureHttpPaths.map(readSource);
const hybridSuites = hybridPaths.map(readSource);

describe("HTTP E2E transport policy", () => {
  it("uses the listening harness and bounded HTTP client for REST suites", () => {
    expect(
      pureHttpSuites
        .filter(
          ({ source }) =>
            !source.includes("ServerTestHarness.start({ apiPort: 0 })") ||
            !source.includes("createHttpTestClient(harness.serverUrl)") ||
            !source.includes("await harness.resetState()") ||
            !source.includes("await harness?.stop()")
        )
        .map(({ path }) => path)
    ).toEqual([]);
  });

  it("owns hybrid HTTP and Socket.IO assertions through the shared game scenario", () => {
    expect(
      hybridSuites
        .filter(
          ({ source }) =>
            !source.includes("SocketGameTestSuite.start()") ||
            !source.includes("suite.scenario(") ||
            !source.includes("await suite?.reset()") ||
            !source.includes("await suite?.stop()")
        )
        .map(({ path }) => path)
    ).toEqual([]);
  });

  it("does not restore direct bootstrap or guessed server URLs in migrated endpoint suites", () => {
    expect(
      [...pureHttpSuites, ...hybridSuites]
        .filter(({ source }) =>
          /bootstrapTestApp|new TestEnvironment|PinoLogger\.init|process\.env\.API_PORT/.test(
            source
          )
        )
        .map(({ path }) => path)
    ).toEqual([]);
  });

  it("routes test HTTP requests through the bounded transport helper", () => {
    expect(
      readTestSources(testsRoot)
        .filter(({ source }) => /from\s+["']supertest["']|\bfetch\s*\(/.test(source))
        .map(({ path }) => path)
        .sort()
    ).toEqual([]);
  });
});

function readSource(path: string): TestSource {
  return { path, source: readFileSync(resolve(testsRoot, path), "utf8") };
}

function readTestSources(directory: string): readonly TestSource[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      return readTestSources(entryPath);
    }
    return entry.name.endsWith(".test.ts") ? [readSource(relative(testsRoot, entryPath))] : [];
  });
}
