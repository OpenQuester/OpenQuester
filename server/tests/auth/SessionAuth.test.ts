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

import { UserService } from "application/services/user/UserService";
import { User } from "infrastructure/database/models/User";
import { createHttpTestClient, type HttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";

describe("Session authentication", () => {
  let harness: ServerTestHarness;
  let http: HttpTestClient;
  let user: User;
  let cookie: string;

  beforeAll(async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });
  });

  beforeEach(async () => {
    http = createHttpTestClient(harness.serverUrl);
    const users = harness.dataSource.getRepository(User);
    user = await users.save(
      users.create({ username: "session-test", is_guest: true, is_deleted: false })
    );
    const login = await http.post("/v1/test/login").send({ userId: user.id });
    expect(login.status).toBe(200);
    const cookies = login.headers["set-cookie"] as unknown as string[];
    cookie = cookies.map((value) => value.split(";")[0]).join("; ");
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await harness.dataSource.getRepository(User).delete({ username: "session-test" });
    await harness.resetState();
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it("invalidates a session whose user was deleted and keeps serving requests", async () => {
    const users = harness.dataSource.getRepository(User);
    await users.delete(user.id);

    const stale = await http.get("/v1/me").set("Cookie", cookie);
    expect(stale.status).toBe(401);
    expect(stale.body.error).toEqual(expect.any(String));

    // The stale session must stay unauthenticated even if this user ID is reused.
    await users.save(user);
    const retry = await http.get("/v1/me").set("Cookie", cookie);
    expect(retry.status).toBe(401);

    const login = await http.post("/v1/test/login").send({ userId: user.id });
    expect(login.status).toBe(200);
    const me = await http.get("/v1/me").set("Cookie", login.headers["set-cookie"]);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(user.id);
  });

  it("returns 500 for unexpected lookup failures and preserves the valid session", async () => {
    jest
      .spyOn(UserService.prototype, "getUserBySession")
      .mockRejectedValueOnce(new Error("Session lookup failed"));

    const failed = await http.get("/v1/me").set("Cookie", cookie);
    expect(failed.status).toBe(500);

    const me = await http.get("/v1/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(user.id);
  });
});
