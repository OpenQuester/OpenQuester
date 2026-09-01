import { describe, expect, it } from "@jest/globals";
import { readdirSync, readFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import ts from "typescript";

interface TransportSuiteSource {
  readonly path: string;
  readonly source: string;
}

const socketGameRoot = resolve(__dirname, "../../socket/game");
const transportSuites = readTransportSuites(socketGameRoot);
const TRACKED_WAIT_METHODS = new Set([
  "waitForEvent",
  "waitForEventMatching",
  "waitForNoEvent",
  "waitForPlayerReady",
  "waitForPlayerUnready",
  "waitForSubmittedActions"
]);

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
        /bootstrapTestApp|new TestEnvironment|PinoLogger\.init|cleanupGameClients|new EventJournal|console\./.test(
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

  it("rejects explicit void escapes for tracked assertion waits", () => {
    expect(violatingPaths((suite) => findVoidedTrackedWaits(suite.source).length > 0)).toEqual([]);
  });

  it("recognizes direct, chained, and aggregated void wait escapes", () => {
    expect(
      findVoidedTrackedWaits(`
        void utils.waitForEvent(socket, "event").catch(() => undefined);
        void Promise.all([utils.waitForNoEvent(socket, "quiet")]);
        const broadcasts = Promise.all([]);
        void broadcasts.catch(() => undefined);
      `).map((violation) => violation.method)
    ).toEqual(["waitForEvent", "waitForNoEvent"]);
  });
});

interface VoidedTrackedWait {
  readonly method: string;
  readonly line: number;
}

function findVoidedTrackedWaits(source: string): readonly VoidedTrackedWait[] {
  const sourceFile = ts.createSourceFile(
    "transport-suite.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const violations: VoidedTrackedWait[] = [];

  const collectTrackedCalls = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const method = getCalledMethodName(node.expression);
      if (method && TRACKED_WAIT_METHODS.has(method)) {
        violations.push({
          method,
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
        });
      }
    }

    ts.forEachChild(node, collectTrackedCalls);
  };

  const visit = (node: ts.Node): void => {
    if (ts.isVoidExpression(node)) {
      collectTrackedCalls(node.expression);
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return violations;
}

function getCalledMethodName(expression: ts.LeftHandSideExpression): string | undefined {
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text;
  }
  if (
    ts.isElementAccessExpression(expression) &&
    expression.argumentExpression &&
    ts.isStringLiteral(expression.argumentExpression)
  ) {
    return expression.argumentExpression.text;
  }

  return undefined;
}

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
