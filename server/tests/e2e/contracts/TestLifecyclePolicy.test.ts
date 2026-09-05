import { describe, expect, it } from "@jest/globals";
import { resolve } from "node:path";
import ts from "typescript";
import { readTestSources } from "./TransportSuitePolicy";

const testsRoot = resolve(__dirname, "../..");
const testSources = readTestSources(testsRoot);

describe("Test lifecycle policy", () => {
  it("shuts direct test-app callers down through the ordered shared helper", () => {
    const violations = testSources
      .filter((test) => calls(test.source, "bootstrapTestApp"))
      .filter((test) => !calls(test.source, "teardownTestAppResources"))
      .map((test) => test.path)
      .sort();

    expect(violations).toEqual([]);
  });

  it("distinguishes actual lifecycle calls from comments and string fixtures", () => {
    expect(
      calls('// bootstrapTestApp();\nconst fixture = "bootstrapTestApp()";', "bootstrapTestApp")
    ).toBe(false);
    expect(calls("await bootstrapTestApp();", "bootstrapTestApp")).toBe(true);
    expect(calls("await harness.bootstrapTestApp();", "bootstrapTestApp")).toBe(true);
  });

  it("rejects teardown failures that are caught and only logged", () => {
    const swallowedTeardownMessage = ["Error during", "teardown:"].join(" ");
    const violations = testSources
      .filter((test) => test.source.includes(swallowedTeardownMessage))
      .map((test) => test.path)
      .sort();

    expect(violations).toEqual([]);
  });
});

function calls(source: string, name: string): boolean {
  const ast = ts.createSourceFile("lifecycle.ts", source, ts.ScriptTarget.Latest, true);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ((ts.isIdentifier(node.expression) && node.expression.text === name) ||
        (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === name))
    )
      found = true;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return found;
}
