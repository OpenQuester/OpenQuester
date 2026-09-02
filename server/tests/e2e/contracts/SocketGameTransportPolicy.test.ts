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
          'it.concurrent.each([[1]])("concurrent %s", async () => suite.scenario(async () => {}));'
        ].join("\n")
      })
    ).toEqual([]);
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

function findUnscopedCases(suite: TransportSuiteSource): readonly string[] {
  const ast = ts.createSourceFile(suite.path, suite.source, ts.ScriptTarget.Latest, true);
  const failures: string[] = [];
  const visit = (node: ts.Node, helperUnitTest = false): void => {
    if (ts.isCallExpression(node)) {
      const definition = getJestDefinitionName(node);
      const title = node.arguments[0];
      if (
        definition === "describe" &&
        title &&
        ts.isStringLiteral(title) &&
        title.text === "Game lock test cleanup helpers" &&
        basename(suite.path) === "GameLockAndQueueMechanics.test.ts"
      )
        helperUnitTest = true;
      if (
        (definition === "it" || definition === "test") &&
        !helperUnitTest &&
        !node.arguments[1]?.getText(ast).includes("suite.scenario(")
      )
        failures.push(title?.getText(ast) ?? "<missing test title>");
    }
    ts.forEachChild(node, (child) => visit(child, helperUnitTest));
  };
  visit(ast);
  return failures;
}

function getJestDefinitionName(node: ts.CallExpression): string | undefined {
  let expression: ts.Expression = node.expression;
  if (ts.isCallExpression(expression) || ts.isTaggedTemplateExpression(expression)) {
    const builder = ts.isCallExpression(expression) ? expression.expression : expression.tag;
    if (!ts.isPropertyAccessExpression(builder) || builder.name.text !== "each") return;
    expression = builder.expression;
  } else if (ts.isPropertyAccessExpression(expression) && expression.name.text === "each") {
    // it.each(rows) only binds the table; the surrounding call declares the actual case.
    return;
  }

  while (ts.isPropertyAccessExpression(expression)) expression = expression.expression;
  return ts.isIdentifier(expression) && ["it", "test", "describe"].includes(expression.text)
    ? expression.text
    : undefined;
}

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
