import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";

import { createHttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";

describe("Auth settings", () => {
  let harness: ServerTestHarness | undefined;
  const previousClientId = process.env.DISCORD_CLIENT_ID;

  beforeAll(async () => {
    process.env.DISCORD_CLIENT_ID = " 123456789 ";
    harness = await ServerTestHarness.start({ apiPort: 0 });
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
    const res = await createHttpTestClient(harness!.serverUrl).get("/v1/auth/settings");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ discordClientId: "123456789" });
  });
});
