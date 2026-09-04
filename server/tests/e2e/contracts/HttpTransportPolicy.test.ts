import { describe, expect, it } from "@jest/globals";
import { resolve } from "node:path";
import { readTestSources, classifyTransportSuite, findUnscopedCases } from "./TransportSuitePolicy";

const testSources = readTestSources(resolve(__dirname, "../.."));
const pureHttpSuites = testSources.filter((suite) => classifyTransportSuite(suite) === "http");
const hybridSuites = testSources.filter((suite) => classifyTransportSuite(suite) === "hybrid");

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
          (suite) =>
            findUnscopedCases(suite, "hybrid").length > 0 ||
            !suite.source.includes("SocketGameTestSuite.start()") ||
            !suite.source.includes("await suite?.reset()") ||
            !suite.source.includes("await suite?.stop()")
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
      testSources
        .filter(({ source }) => /from\s+["']supertest["']|\bfetch\s*\(/.test(source))
        .map(({ path }) => path)
        .sort()
    ).toEqual([]);
  });
});
