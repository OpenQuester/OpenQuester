import { describe, expect, it } from "@jest/globals";
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

interface TestSource {
  readonly path: string;
  readonly source: string;
}

const testsRoot = resolve(__dirname, "../..");
const testSources = readTestSources(testsRoot);

describe("Test lifecycle policy", () => {
  it("shuts direct test-app callers down through the ordered shared helper", () => {
    const bootstrapCall = ["bootstrapTest", "App("].join("");
    const violations = testSources
      .filter((test) => test.source.includes(bootstrapCall))
      .filter((test) => !test.source.includes("teardownTestAppResources("))
      .map((test) => test.path)
      .sort();

    expect(violations).toEqual([]);
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

function readTestSources(directory: string): readonly TestSource[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return readTestSources(entryPath);
    }
    if (!entry.name.endsWith(".test.ts")) {
      return [];
    }

    return [{ path: relative(testsRoot, entryPath), source: readFileSync(entryPath, "utf8") }];
  });
}
