import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from "@jest/globals";
import { Environment, EnvType } from "shared/config/Environment";
import { createHttpTestClient, type HttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";

describe.each([EnvType.DEV, EnvType.PROD, EnvType.TEST])("Dev login in %s", (mode) => {
  let harness: ServerTestHarness;
  let http: HttpTestClient;

  beforeAll(async () => {
    // Keep the destructive-test environment in test mode; vary the runtime route policy only.
    jest.spyOn(Environment.prototype, "ENV", "get").mockReturnValue(mode);
    harness = await ServerTestHarness.start({ apiPort: 0 });
  });

  beforeEach(() => {
    http = createHttpTestClient(harness.serverUrl);
  });

  afterEach(async () => {
    await harness.resetState();
  });

  afterAll(async () => {
    try {
      await harness?.stop();
    } finally {
      jest.restoreAllMocks();
    }
  });

  it("only creates a full-account session in development environments", async () => {
    const login = await http.post("/v1/dev/login/42");
    if (mode === EnvType.PROD || mode === EnvType.TEST) {
      expect(login.status).toBe(401);
      expect(login.body.success).toBeUndefined();
      return;
    }

    expect(login.status).toBe(200);
    expect(login.body.user.username).toBe("dev-user-42");
    const cookies = login.headers["set-cookie"] as unknown as string[];
    expect(cookies.length).toBeGreaterThan(0);
    const me = await http
      .get("/v1/me")
      .set("Cookie", cookies.map((c) => c.split(";")[0]).join("; "));
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ username: "dev-user-42", isGuest: false });
  });
});
