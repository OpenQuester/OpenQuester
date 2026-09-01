import { describe, expect, it } from "@jest/globals";
import { readdirSync, readFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";

interface TransportSuiteSource {
  readonly path: string;
  readonly source: string;
}

const socketGameRoot = resolve(__dirname, "../../socket/game");
const transportSuites = readTransportSuites(socketGameRoot);

describe("Socket game transport suite policy", () => {
  it("routes every transport suite through the shared lifecycle", () => {
    expect(
      violatingPaths(
        (suite) =>
          !suite.source.includes("SocketGameTestSuite") ||
          !suite.source.includes("await suite?.reset()") ||
          !suite.source.includes("await suite?.stop()")
      )
    ).toEqual([]);
  });

  it("rejects copied lifecycle and cleanup that can mask the primary failure", () => {
    expect(
      violatingPaths((suite) =>
        /bootstrapTestApp|new TestEnvironment|PinoLogger\.init|cleanupGameClients|console\./.test(
          suite.source
        )
      )
    ).toEqual([]);
  });

  it("rejects disabled or focused cases and catch-all success branches", () => {
    expect(
      violatingPaths((suite) =>
        /\.(?:skip|only|todo)\s*\(|\b(?:xit|xtest|xdescribe|fit|fdescribe)\s*\(|catch\s*\{/.test(
          suite.source
        )
      )
    ).toEqual([]);
  });

  it("rejects hand-written event promises outside the bounded queue-mechanics collectors", () => {
    expect(
      violatingPaths(
        (suite) => /new Promise|setTimeout|\.on\(|\.once\(/.test(suite.source),
        new Set(["GameLockAndQueueMechanics.test.ts"])
      )
    ).toEqual([]);
  });
});

function readTransportSuites(directory: string): readonly TransportSuiteSource[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return entry.name === "utils" ? [] : readTransportSuites(entryPath);
    }
    if (!entry.name.endsWith(".test.ts")) {
      return [];
    }

    return [{ path: relative(socketGameRoot, entryPath), source: readFileSync(entryPath, "utf8") }];
  });
}

function violatingPaths(
  violates: (suite: TransportSuiteSource) => boolean,
  allowedBasenames: ReadonlySet<string> = new Set()
): readonly string[] {
  return transportSuites
    .filter((suite) => !allowedBasenames.has(basename(suite.path)) && violates(suite))
    .map((suite) => suite.path)
    .sort();
}
