import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import { type Repository } from "typeorm";

import { container } from "tsyringe";

import { DiscordEntryPointService } from "application/services/discord/DiscordEntryPointService";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { User } from "infrastructure/database/models/User";
import { createHttpTestClient, type HttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { PackageUtils } from "tests/utils/PackageUtils";
import { FakeDiscordApi } from "tests/utils/FakeDiscordApi";
import { deleteAll } from "tests/utils/TypeOrmTestUtils";

const CLIENT_ID = "123456789";
const CLIENT_SECRET = "activity-secret";
const GOOD_CODE = "good-code";
const ACCESS_TOKEN = "discord-access-token";
const DISCORD_USER = { id: "424242", username: "discord_pilot", avatar: null, email: null };
const ACTIVITY_ORIGIN = `https://${CLIENT_ID}.discordsays.com`;
/** Other people in the voice call; each signs in with the code `code-{name}` */
const CALL_MEMBERS = ["listener", "host", "guest", "first", "second"] as const;

type CallMember = (typeof CALL_MEMBERS)[number];

const ENV_KEYS = ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_API_URL"] as const;

interface LoggedInUser {
  user: User;
  cookie: string;
}

function sessionCookie(setCookie: string[] | string | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = cookies.find((c) => c.startsWith("connect.sid="));

  if (!cookie) {
    throw new Error(`No session cookie in ${JSON.stringify(cookies)}`);
  }

  return cookie;
}

describe("Discord Activity", () => {
  let harness: ServerTestHarness;
  let http: HttpTestClient;
  let discord: FakeDiscordApi;
  let userRepo: Repository<User>;
  const previousEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  const packageUtils = new PackageUtils();

  beforeAll(async () => {
    discord = await FakeDiscordApi.start({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      code: GOOD_CODE,
      accessToken: ACCESS_TOKEN,
      user: DISCORD_USER,
      others: CALL_MEMBERS.map((name, index) => ({
        code: `code-${name}`,
        accessToken: `token-${name}`,
        user: { id: String(500 + index), username: name, avatar: null, email: null }
      }))
    });
    process.env.DISCORD_CLIENT_ID = CLIENT_ID;
    process.env.DISCORD_CLIENT_SECRET = CLIENT_SECRET;
    process.env.DISCORD_API_URL = discord.url;

    harness = await ServerTestHarness.start({ apiPort: 0 });
    http = createHttpTestClient(harness.serverUrl);
    userRepo = harness.dataSource.getRepository<User>("User");
  });

  afterEach(async () => {
    await deleteAll(userRepo);
    await harness.resetState();
  });

  afterAll(async () => {
    await harness?.stop();
    await discord?.stop();

    for (const key of ENV_KEYS) {
      if (previousEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousEnv[key];
      }
    }
  });

  async function activityLogin(code: string = GOOD_CODE) {
    // Discord's proxy reaches the API over HTTPS; the session cookie is Secure
    return http
      .post("/v1/auth/discord/activity")
      .set("X-Forwarded-Proto", "https")
      .set("Origin", ACTIVITY_ORIGIN)
      .send({ code });
  }

  /** Signs a call member in through the Activity, like opening it in Discord */
  async function joinCall(name: CallMember): Promise<LoggedInUser> {
    const res = await activityLogin(`code-${name}`);

    expect(res.status).toBe(200);

    const user = await userRepo.findOneByOrFail({ id: res.body.user.id });

    return { user, cookie: sessionCookie(res.headers["set-cookie"]).split(";")[0] };
  }

  async function loginAs(username: string): Promise<LoggedInUser> {
    const user = await userRepo.save(userRepo.create({ username, is_deleted: false }));
    const res = await http.post("/v1/test/login").send({ userId: user.id });

    expect(res.status).toBe(200);

    return { user, cookie: sessionCookie(res.headers["set-cookie"]) };
  }

  async function createPackage(user: User, cookie: string): Promise<number> {
    const content = packageUtils.createTestPackageData(
      { id: user.id, username: user.username },
      false,
      0
    );
    const res = await http.post("/v1/packages").set("Cookie", cookie).send({ content });

    expect(res.status).toBe(200);

    return res.body.id;
  }

  function gameBody(packageId: number) {
    return {
      title: "Call game",
      packageId,
      isPrivate: false,
      ageRestriction: AgeRestriction.NONE,
      maxPlayers: 4
    };
  }

  describe("launch command", () => {
    it("registers the Activity's entry point command once at startup", async () => {
      expect(discord.commands).toEqual([
        expect.objectContaining({ name: "launch", type: 4, handler: 2 })
      ]);

      // A later start finds it and leaves it alone
      const again = await container.resolve(DiscordEntryPointService).ensureEntryPointCommand();

      expect(again).toBe("exists");
      expect(discord.commands).toHaveLength(1);
    });
  });

  describe("settings", () => {
    it("tells the web app which media host to route through Discord's proxy", async () => {
      const res = await http.get("/v1/auth/settings");

      expect(res.status).toBe(200);
      expect(res.body.discordActivity).toEqual({
        urlMappings: [{ prefix: "/media", target: "localhost:9000" }]
      });
    });

    it("lets discordsays.com call the API and Discord embed the app", async () => {
      const res = await http.get("/v1/auth/settings").set("Origin", ACTIVITY_ORIGIN);

      expect(res.headers["access-control-allow-origin"]).toBe(ACTIVITY_ORIGIN);
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
      expect(res.headers["content-security-policy"]).toContain(
        "frame-ancestors 'self' https://discord.com https://*.discord.com https://*.discordsays.com"
      );
      expect(res.headers["x-frame-options"]).toBeUndefined();
    });

    it("still refuses other origins", async () => {
      const res = await http.get("/v1/auth/settings").set("Origin", "https://987.discordsays.com");

      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  describe("sign-in", () => {
    it("swaps the SDK code, signs the Discord user in and returns the token", async () => {
      const res = await activityLogin();

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBe(ACCESS_TOKEN);
      expect(res.body.user).toMatchObject({ username: DISCORD_USER.username, isGuest: false });

      const cookie = sessionCookie(res.headers["set-cookie"]);
      const attributes = cookie.split(";").map((part) => part.trim().toLowerCase());

      expect(attributes).toEqual(
        expect.arrayContaining(["secure", "samesite=none", "partitioned", "httponly"])
      );
      expect(attributes.some((part) => part.startsWith("domain="))).toBe(false);

      const me = await http.get("/v1/me").set("Cookie", cookie.split(";")[0]);

      expect(me.status).toBe(200);
      expect(me.body.id).toBe(res.body.user.id);
    });

    it("signs the same Discord account into the same user every time", async () => {
      const first = await activityLogin();
      const second = await activityLogin();

      expect(second.body.user.id).toBe(first.body.user.id);
      expect(await userRepo.count({ where: { discord_id: DISCORD_USER.id } })).toBe(1);
    });

    it("rejects a code Discord refuses without starting a session", async () => {
      const res = await activityLogin("stolen-code");

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Discord did not accept the sign-in code (invalid_grant)");
      expect(res.headers["set-cookie"]).toBeUndefined();
    });

    it("validates the body", async () => {
      const res = await http.post("/v1/auth/discord/activity").send({});

      expect(res.status).toBe(400);
    });
  });

  describe("one lobby per call", () => {
    const instanceId = "i-1234567890-gc-555-666";
    const path = `/v1/discord/activity/instances/${instanceId}/game`;

    it("has no game until someone picks a package", async () => {
      const { cookie } = await joinCall("listener");

      const res = await http.get(path).set("Cookie", cookie);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ game: null, password: null, created: false });
    });

    it("makes the first person host and puts the rest of the call in the same private game", async () => {
      const host = await joinCall("host");
      const guest = await joinCall("guest");
      const packageId = await createPackage(host.user, host.cookie);

      const created = await http.post(path).set("Cookie", host.cookie).send(gameBody(packageId));

      expect(created.status).toBe(200);
      expect(created.body.created).toBe(true);
      expect(created.body.game.isPrivate).toBe(true);
      expect(created.body.password).toEqual(expect.any(String));

      const second = await http.post(path).set("Cookie", guest.cookie).send(gameBody(packageId));
      const listed = await http.get(path).set("Cookie", guest.cookie);

      expect(second.body).toMatchObject({ created: false, password: created.body.password });
      expect(second.body.game.id).toBe(created.body.game.id);
      expect(listed.body.game.id).toBe(created.body.game.id);

      const otherCall = await http
        .get(`/v1/discord/activity/instances/i-other/game`)
        .set("Cookie", guest.cookie);

      expect(otherCall.body.game).toBeNull();
    });

    it("never makes two games when the call launches at once", async () => {
      const a = await joinCall("first");
      const b = await joinCall("second");
      const packageId = await createPackage(a.user, a.cookie);

      const results = await Promise.all([
        http.post(path).set("Cookie", a.cookie).send(gameBody(packageId)),
        http.post(path).set("Cookie", b.cookie).send(gameBody(packageId))
      ]);

      const ok = results.filter((res) => res.status === 200);

      expect(results.every((res) => res.status === 200 || res.status === 409)).toBe(true);
      expect(ok.filter((res) => res.body.created)).toHaveLength(1);
      expect(new Set(ok.map((res) => res.body.game.id)).size).toBe(1);
    });

    it("frees the call for a new game once its game is gone", async () => {
      const host = await joinCall("host");
      const packageId = await createPackage(host.user, host.cookie);
      const created = await http.post(path).set("Cookie", host.cookie).send(gameBody(packageId));

      const deleted = await http
        .delete(`/v1/games/${created.body.game.id}`)
        .set("Cookie", host.cookie);

      expect(deleted.status).toBe(204);

      const res = await http.get(path).set("Cookie", host.cookie);

      expect(res.body.game).toBeNull();
    });

    it("needs a session and a well-formed instance id", async () => {
      const { cookie } = await joinCall("listener");

      const anonymous = await http.get(path);
      const malformed = await http
        .get("/v1/discord/activity/instances/bad%20id%3B/game")
        .set("Cookie", cookie);

      expect(anonymous.status).toBe(401);
      expect(malformed.status).toBe(400);
    });

    it("keeps the call's game and password from sessions not opened in the Activity", async () => {
      const host = await joinCall("host");
      const website = await loginAs("website");
      const packageId = await createPackage(host.user, host.cookie);

      await http.post(path).set("Cookie", host.cookie).send(gameBody(packageId));

      const read = await http.get(path).set("Cookie", website.cookie);
      const create = await http.post(path).set("Cookie", website.cookie).send(gameBody(packageId));

      expect(read.status).toBe(403);
      expect(read.body.password).toBeUndefined();
      expect(create.status).toBe(403);
    });
  });
});
