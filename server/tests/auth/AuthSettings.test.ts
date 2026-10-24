import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";

import { createHttpTestClient, type HttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";

describe("Auth settings", () => {
  let harness: ServerTestHarness;
  let http: HttpTestClient;
  const previousClientId = process.env.DISCORD_CLIENT_ID;

  beforeAll(async () => {
    process.env.DISCORD_CLIENT_ID = " 123456789 ";
    harness = await ServerTestHarness.start({ apiPort: 0 });
    http = createHttpTestClient(harness.serverUrl);
  });

  afterEach(async () => {
    await harness.resetState();
  });

  afterAll(async () => {
    await harness?.stop();

    if (previousClientId === undefined) {
      delete process.env.DISCORD_CLIENT_ID;
    } else {
      process.env.DISCORD_CLIENT_ID = previousClientId;
    }
  });

  it("serves the Discord application id to visitors without a session", async () => {
    const res = await http.get("/v1/auth/settings");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      oauthProviders: [{ provider: "discord", clientId: "123456789" }]
    });
  });
});
