import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import ts from "typescript";

export interface TestSource {
  readonly path: string;
  readonly source: string;
}

export type TransportKind = "gameplay" | "hybrid" | "http" | "media";

// These exercise the transport machinery itself, not the application's public behavior.
const SELF_TESTS = new Set([
  "TestAppLifecycle.test.ts",
  "e2e/harness/HttpTestClient.test.ts",
  "e2e/harness/ServerTestHarness.test.ts",
  "e2e/harness/ServerTestHarnessState.test.ts",
  "e2e/harness/SocketClientTestUtils.test.ts",
  "e2e/harness/SocketTestWait.test.ts",
  "e2e/harness/ServeApiReadiness.test.ts",
  "e2e/scenario/EventJournal.test.ts",
  "e2e/scenario/GameScenario.test.ts",
  "e2e/scenario/ScenarioActor.test.ts",
  "e2e/flows/media-download/MediaDownloadFlow.test.ts",
  "socket/game/utils/SocketGameTestUserUtils.test.ts",
  "socket/game/utils/SocketGameTestSuite.test.ts",
  "socket/game/utils/SocketGameTestEventUtils.test.ts",
  "socket/game/utils/SocketGameTestFlowUtils.test.ts",
  "socket/game/utils/SocketGameTestLobbyUtils.test.ts",
  "socket/game/utils/SocketIOGameTestUtils.test.ts"
]);

export function readTestSources(root: string, directory = root): readonly TestSource[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return readTestSources(root, path);
    return entry.name.endsWith(".test.ts")
      ? [{ path: relative(root, path).replaceAll("\\", "/"), source: readFileSync(path, "utf8") }]
      : [];
  });
}

function parse(suite: TestSource): ts.SourceFile {
  return ts.createSourceFile(suite.path, suite.source, ts.ScriptTarget.Latest, true);
}

/** Discover new endpoint suites by imports, not an allowlist that silently omits new files. */
export function classifyTransportSuite(
  suite: TestSource
): TransportKind | "self-test" | "unclassified" | undefined {
  if (SELF_TESTS.has(suite.path)) return "self-test";
  const imports = parse(suite)
    .statements.filter(ts.isImportDeclaration)
    .map((node) => (ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : ""));
  const uses = (module: string): boolean => imports.some((name) => name.endsWith(module));
  if (suite.path.startsWith("socket/game/") && !suite.path.startsWith("socket/game/utils/"))
    return "gameplay";
  if (uses("SocketGameTestSuite")) return "hybrid";
  if (uses("MediaDownloadFlow")) return "media";
  if (uses("HttpTestClient")) return "http";
  if (
    uses("ServerTestHarness") ||
    uses("SocketIOGameTestUtils") ||
    uses("socket.io-client") ||
    uses("supertest")
  )
    return "unclassified";
  return undefined;
}

interface JestDefinition {
  readonly name: "it" | "test" | "describe";
  readonly modifiers: readonly string[];
  readonly title: string;
  readonly callback: ts.Expression | undefined;
}

function member(expression: ts.Expression): { receiver: ts.Expression; name: string } | undefined {
  if (ts.isPropertyAccessExpression(expression))
    return { receiver: expression.expression, name: expression.name.text };
  if (
    ts.isElementAccessExpression(expression) &&
    ts.isStringLiteral(expression.argumentExpression)
  ) {
    return { receiver: expression.expression, name: expression.argumentExpression.text };
  }
  return undefined;
}

function definition(node: ts.CallExpression): JestDefinition | undefined {
  let expression = node.expression as ts.Expression;
  const modifiers: string[] = [];
  if (ts.isCallExpression(expression) || ts.isTaggedTemplateExpression(expression)) {
    const builder = member(
      ts.isCallExpression(expression) ? expression.expression : expression.tag
    );
    if (builder?.name !== "each") return;
    modifiers.push("each");
    expression = builder.receiver;
  } else if (member(expression)?.name === "each") {
    return; // Only a table builder; its outer call declares the test/describe.
  }
  let access = member(expression);
  while (access) {
    modifiers.push(access.name);
    expression = access.receiver;
    access = member(expression);
  }
  if (!ts.isIdentifier(expression)) return;
  const aliases: Record<string, [JestDefinition["name"], string]> = {
    fit: ["it", "only"],
    xit: ["it", "skip"],
    xtest: ["test", "skip"],
    fdescribe: ["describe", "only"],
    xdescribe: ["describe", "skip"]
  };
  const alias = aliases[expression.text];
  const name = alias?.[0] ?? expression.text;
  if (name !== "it" && name !== "test" && name !== "describe") return;
  if (alias) modifiers.push(alias[1]);
  return {
    name,
    modifiers,
    title: node.arguments[0]?.getText() ?? "<missing title>",
    callback: node.arguments[1]
  };
}

export function forbiddenJestDefinitions(suite: TestSource, transport = true): readonly string[] {
  const failures: string[] = [];
  const forbidden = new Set([
    "only",
    "skip",
    "todo",
    "failing",
    ...(transport ? ["concurrent"] : [])
  ]);
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const test = definition(node);
      if (test?.modifiers.some((modifier) => forbidden.has(modifier))) failures.push(test.title);
    }
    ts.forEachChild(node, visit);
  };
  visit(parse(suite));
  return failures;
}

export function findUnscopedCases(
  suite: TestSource,
  kind: TransportKind = "gameplay"
): readonly string[] {
  const failures: string[] = [];
  const visit = (node: ts.Node, helperUnitTest = false): void => {
    if (ts.isCallExpression(node)) {
      const test = definition(node);
      if (
        test?.name === "describe" &&
        test.title === '"Game lock test cleanup helpers"' &&
        suite.path.replaceAll("\\", "/").endsWith("GameLockAndQueueMechanics.test.ts")
      )
        helperUnitTest = true;
      if (
        test &&
        test.name !== "describe" &&
        !helperUnitTest &&
        !scopedCallback(test.callback, kind)
      )
        failures.push(test.title);
    }
    ts.forEachChild(node, (child) => visit(child, helperUnitTest));
  };
  visit(parse(suite));
  return failures;
}

function unwrap(expression: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(expression)) expression = expression.expression;
  return expression;
}

function scopedCallback(callback: ts.Expression | undefined, kind: TransportKind): boolean {
  if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)))
    return false;
  let result: ts.Expression | undefined;
  if (ts.isBlock(callback.body)) {
    const statements = callback.body.statements.filter((node) => !ts.isEmptyStatement(node));
    if (statements.length !== 1) return false;
    const statement = statements[0];
    if (ts.isReturnStatement(statement)) result = statement.expression;
    else if (
      ts.isExpressionStatement(statement) &&
      ts.isAwaitExpression(unwrap(statement.expression))
    )
      result = statement.expression;
  } else result = callback.body;
  if (!result) return false;
  result = unwrap(result);
  if (ts.isAwaitExpression(result)) result = unwrap(result.expression);
  if (!ts.isCallExpression(result)) return false;
  if (kind === "media")
    return ts.isIdentifier(result.expression) && result.expression.text === "withMediaDownloadFlow";
  const call = member(result.expression);
  return (
    call?.name === "scenario" && ts.isIdentifier(call.receiver) && call.receiver.text === "suite"
  );
}
