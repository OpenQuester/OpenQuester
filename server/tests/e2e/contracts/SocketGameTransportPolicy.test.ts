import { describe, expect, it } from "@jest/globals";
import { readdirSync, readFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";
import ts from "typescript";
import {
  classifyTransportSuite,
  findUnscopedCases,
  forbiddenJestDefinitions,
  readTestSources
} from "./TransportSuitePolicy";

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
        /bootstrapTestApp|new TestEnvironment|PinoLogger\.init|cleanupGameClients|new EventJournal|console\.|\.catch\(\(\) => undefined\)/.test(
          suite.source
        )
      )
    ).toEqual([]);
  });

  it("rejects catch-all success branches", () => {
    expect(violatingPaths((suite) => /catch\s*\{/.test(suite.source))).toEqual([]);
  });

  it("rejects hand-written event promises including queue-mechanics collectors", () => {
    expect(
      violatingPaths((suite) => /new Promise|setTimeout|\.on\(|\.once\(/.test(suite.source))
    ).toEqual([]);
  });

  it("owns every gameplay test's assertions in a scenario, not just its resources", () => {
    expect(violatingPaths((suite) => findUnscopedCases(suite).length > 0)).toEqual([]);
  });

  it("recognizes unscoped parameterized cases and Jest modifier chains", () => {
    expect(
      findUnscopedCases({
        path: "ParameterizedFlow.test.ts",
        source: [
          'it.each([[1]])("array row", async () => {});',
          'test.each`value\n${1}`("tagged row", async () => {});',
          'it.concurrent.each([[1]])("concurrent row", async () => {});',
          'test.failing.each([[1]])("failing row", async () => {});',
          'it.skip.each([[1]])("skipped row", async () => {});',
          'test.only.each([[1]])("focused row", async () => {});',
          'test.concurrent("concurrent case", async () => {});'
        ].join("\n")
      })
    ).toEqual([
      '"array row"',
      '"tagged row"',
      '"concurrent row"',
      '"failing row"',
      '"skipped row"',
      '"focused row"',
      '"concurrent case"'
    ]);
  });

  it("accepts scoped parameterized cases without treating their tables as test bodies", () => {
    expect(
      findUnscopedCases({
        path: "ParameterizedFlow.test.ts",
        source: [
          'it.each([[1], [2]])("array %s", async () => suite.scenario(async () => {}));',
          'test.each`value\n${1}`("tagged $value", async () => suite.scenario(async () => {}));',
          'describe.each([[1]])("group %s", () => { it("case", () => suite.scenario(async () => {})); });'
        ].join("\n")
      })
    ).toEqual([]);
  });

  it("discovers every transport category and rejects unclassified transport imports", () => {
    const suites = readTestSources(resolve(__dirname, "../.."));
    expect(
      suites
        .filter((suite) => classifyTransportSuite(suite) === "unclassified")
        .map(({ path }) => path)
    ).toEqual([]);
    for (const kind of ["gameplay", "http", "hybrid", "media"]) {
      expect(suites.some((suite) => classifyTransportSuite(suite) === kind)).toBe(true);
    }
    expect(
      classifyTransportSuite({
        path: "new/NewEndpoint.test.ts",
        source: 'import { createHttpTestClient } from "tests/e2e/harness/HttpTestClient";'
      })
    ).toBe("http");
    expect(
      classifyTransportSuite({
        path: "new/NewHybrid.test.ts",
        source: 'import { SocketGameTestSuite } from "tests/socket/game/utils/SocketGameTestSuite";'
      })
    ).toBe("hybrid");
    expect(
      classifyTransportSuite({
        path: "new/RawSocket.test.ts",
        source: 'import { io } from "socket.io-client";'
      })
    ).toBe("unclassified");
  });

  it("rejects disabled/focused/failing and concurrent definitions across all transport categories", () => {
    const violations = readTestSources(resolve(__dirname, "../..")).flatMap((suite) => {
      const kind = classifyTransportSuite(suite);
      return kind && kind !== "self-test"
        ? forbiddenJestDefinitions(suite).map((title) => `${suite.path}: ${title}`)
        : [];
    });
    expect(violations).toEqual([]);
  });

  it.each([
    'it.only.each([[1]])("case", () => {});',
    'test.skip.each([[1]])("case", () => {});',
    'describe.only.each([[1]])("case", () => {});',
    'test.only.each`x\n${1}`("case", () => {});',
    'it.skip.each`x\n${1}`("case", () => {});',
    'test.failing.each([[1]])("case", () => {});',
    'it.concurrent.each([[1]])("case", () => {});',
    'test.todo("case");',
    'fit("case", () => {});',
    'xit("case", () => {});',
    'xtest("case", () => {});',
    'fdescribe("case", () => {});',
    'xdescribe.each([[1]])("case", () => {});'
  ])("rejects modifier-chain bypass: %s", (source) => {
    expect(forbiddenJestDefinitions({ path: "Example.test.ts", source })).toEqual(['"case"']);
  });

  it("does not confuse comments/string fixtures or parameterized tables with Jest definitions", () => {
    const source = [
      '// it.only("comment", () => {});',
      'const fixture = "test.skip.each([[1]])";',
      'it.each(["it.only"] )("row %s", () => suite.scenario(async () => {}));',
      'test.each`x\n${1}`("row $x", () => suite.scenario(async () => {}));',
      'describe.each([[1]])("group", () => { test("case", () => suite.scenario(async () => {})); });'
    ].join("\n");
    expect(forbiddenJestDefinitions({ path: "Example.test.ts", source })).toEqual([]);
    expect(findUnscopedCases({ path: "Example.test.ts", source })).toEqual([]);
  });

  it.each([
    'it("case", async () => { suite.scenario(async () => {}); });',
    'it("case", async () => { const fake = "suite.scenario("; });',
    'it("case", async () => { function unused() { return suite.scenario(async () => {}); } });',
    'it("case", async () => { if (false) await suite.scenario(async () => {}); });',
    'it("case", async () => { await suite.scenario(async () => {}); expect(true).toBe(true); });',
    'it("case", async () => { await Promise.resolve(); }); it("scoped", () => suite.scenario(async () => {}));'
  ])("requires each complete callback to return or await its wrapper: %s", (source) => {
    expect(findUnscopedCases({ path: "Example.test.ts", source })).toEqual(['"case"']);
  });

  it("accepts returned/awaited wrappers and applies the same case scope to dedicated media", () => {
    expect(
      findUnscopedCases({
        path: "Example.test.ts",
        source: [
          'it("returned", () => { return suite.scenario(async () => {}); });',
          'it("awaited", async () => { await suite.scenario(async () => {}); });'
        ].join("\n")
      })
    ).toEqual([]);
    expect(
      findUnscopedCases(
        {
          path: "Media.test.ts",
          source:
            'test("case", async () => { await withMediaDownloadFlow(options, async () => {}); });'
        },
        "media"
      )
    ).toEqual([]);
    expect(
      findUnscopedCases(
        {
          path: "Media.test.ts",
          source: 'test("case", async () => { withMediaDownloadFlow(options, async () => {}); });'
        },
        "media"
      )
    ).toEqual(['"case"']);
    const media = readTestSources(resolve(__dirname, "../..")).filter(
      (suite) => classifyTransportSuite(suite) === "media"
    );
    expect(media.flatMap((suite) => findUnscopedCases(suite, "media"))).toEqual([]);
  });

  it("rejects legacy event assertions and raw socket commands in transport tests", () => {
    expect(
      violatingPaths((suite) =>
        /\b(?:utils|testUtils)\.(?:waitForEvent|waitForEventMatching|waitForNoEvent|waitForPlayerReady|waitForPlayerUnready|emitAndWaitForEvent|runAndWaitForEvent)\b/.test(
          suite.source
        )
      )
    ).toEqual([]);
    expect(
      violatingPaths((suite) => {
        const ast = ts.createSourceFile(suite.path, suite.source, ts.ScriptTarget.Latest, true);
        let rawEmit = false;
        const visit = (node: ts.Node): void => {
          if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text === "emit"
          ) {
            const receiver = node.expression.expression;
            if (
              !(
                ts.isCallExpression(receiver) &&
                ts.isPropertyAccessExpression(receiver.expression) &&
                receiver.expression.name.text === "actor"
              )
            )
              rawEmit = true;
          }
          ts.forEachChild(node, visit);
        };
        visit(ast);
        return rawEmit;
      })
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
