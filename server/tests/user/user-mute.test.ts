import { type Express } from "express";
import request from "supertest";
import { DataSource, Repository } from "typeorm";

import { Permissions } from "domain/enums/Permissions";
import { RedisConfig } from "infrastructure/config/RedisConfig";
import { Permission } from "infrastructure/database/models/Permission";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";

async function preparePermission(
  permRepo: Repository<Permission>,
  permissionName: string
): Promise<Permission> {
  let perm = await permRepo.findOne({ where: { name: permissionName } });
  if (!perm) {
    perm = permRepo.create({ name: permissionName });
    await permRepo.save(perm);
  }
  return perm;
}

async function createAdminUser(
  userRepo: Repository<User>,
  permissions: Permission[]
) {
  const user = userRepo.create({
    username: "adminuser",
    email: "admin@example.com",
    is_deleted: false,
    permissions: permissions,
  });
  await userRepo.save(user);
  return user;
}

async function createTargetUser(
  userRepo: Repository<User>,
  username: string = "targetuser",
  email: string = "target@example.com"
) {
  const user = userRepo.create({
    username,
    email,
    is_deleted: false,
    permissions: [],
  });
  await userRepo.save(user);
  return user;
}

describe("User Mute Functionality", () => {
  let testEnv: TestEnvironment;
  let app: Express;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let permRepo: Repository<Permission>;
  let cleanup: (() => Promise<void>) | undefined;
  let logger: ILogger;

  beforeAll(async () => {
    logger = await PinoLogger.init({ pretty: true });
    testEnv = new TestEnvironment(logger);
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    dataSource = boot.dataSource;
    userRepo = dataSource.getRepository<User>("User");
    permRepo = dataSource.getRepository<Permission>("Permission");
    cleanup = boot.cleanup;
  });

  afterEach(async () => {
    // Clear Redis cache
    const redisClient = RedisConfig.getClient();
    const keys = await redisClient.keys("cache:user:*");
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  beforeEach(async () => {
    await userRepo.delete({});
    await permRepo.delete({});
  });

  describe("Mute Endpoints", () => {
    it("should mute user with mute_player permission", async () => {
      // Create mute permission
      const mutePerm = await preparePermission(
        permRepo,
        Permissions.MUTE_PLAYER
      );

      // Create admin user with mute permission
      const adminUser = await createAdminUser(userRepo, [mutePerm]);

      // Create target user
      const targetUser = await createTargetUser(userRepo);

      // Login as admin
      const loginRes = await request(app)
        .post("/v1/test/login")
        .send({ userId: adminUser.id });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers["set-cookie"];

      // Mute target user for 1 hour from now
      const mutedUntil = new Date(Date.now() + 3600000); // 1 hour from now

      const muteRes = await request(app)
        .post(`/v1/admin/api/users/${targetUser.id}/mute`)
        .set("Cookie", cookies)
        .send({ mutedUntil: mutedUntil.toISOString() });

      expect(muteRes.status).toBe(200);
      expect(muteRes.body.userId).toBe(targetUser.id);
      expect(muteRes.body.mutedUntil).toBeDefined();

      // Verify in database
      const mutedUser = await userRepo.findOne({
        where: { id: targetUser.id },
      });
      expect(mutedUser).toBeDefined();
      expect(mutedUser!.muted_until).toBeDefined();
      expect(new Date(mutedUser!.muted_until!).getTime()).toBeGreaterThan(
        Date.now()
      );
    });

    it("should unmute user with mute_player permission", async () => {
      // Create mute permission
      const mutePerm = await preparePermission(
        permRepo,
        Permissions.MUTE_PLAYER
      );

      // Create admin user with mute permission
      const adminUser = await createAdminUser(userRepo, [mutePerm]);

      // Create target user with existing mute
      const targetUser = userRepo.create({
        username: "muteduser",
        email: "muted@example.com",
        is_deleted: false,
        permissions: [],
        muted_until: new Date(Date.now() + 3600000), // Muted for 1 hour
      });
      await userRepo.save(targetUser);

      // Login as admin
      const loginRes = await request(app)
        .post("/v1/test/login")
        .send({ userId: adminUser.id });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers["set-cookie"];

      // Unmute target user
      const unmuteRes = await request(app)
        .post(`/v1/admin/api/users/${targetUser.id}/unmute`)
        .set("Cookie", cookies);

      expect(unmuteRes.status).toBe(200);
      expect(unmuteRes.body.userId).toBe(targetUser.id);
      expect(unmuteRes.body.mutedUntil).toBeNull();

      // Verify in database
      const unmutedUser = await userRepo.findOne({
        where: { id: targetUser.id },
      });
      expect(unmutedUser).toBeDefined();
      expect(unmutedUser!.muted_until).toBeNull();
    });

    it("should require mute_player permission to mute", async () => {
      // Create user without mute permission
      const user = await createTargetUser(
        userRepo,
        "nonadmin",
        "nonadmin@example.com"
      );

      // Create target user
      const targetUser = await createTargetUser(userRepo);

      // Login as user without mute permission
      const loginRes = await request(app)
        .post("/v1/test/login")
        .send({ userId: user.id });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers["set-cookie"];

      // Try to mute (should fail)
      const mutedUntil = new Date(Date.now() + 3600000);
      const muteRes = await request(app)
        .post(`/v1/admin/api/users/${targetUser.id}/mute`)
        .set("Cookie", cookies)
        .send({ mutedUntil: mutedUntil.toISOString() });

      expect(muteRes.status).toBe(403);
    });

    it("should require mute_player permission to unmute", async () => {
      // Create user without mute permission
      const user = await createTargetUser(
        userRepo,
        "nonadmin",
        "nonadmin@example.com"
      );

      // Create target user with existing mute
      const targetUser = userRepo.create({
        username: "muteduser",
        email: "muted@example.com",
        is_deleted: false,
        permissions: [],
        muted_until: new Date(Date.now() + 3600000),
      });
      await userRepo.save(targetUser);

      // Login as user without mute permission
      const loginRes = await request(app)
        .post("/v1/test/login")
        .send({ userId: user.id });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers["set-cookie"];

      // Try to unmute (should fail)
      const unmuteRes = await request(app)
        .post(`/v1/admin/api/users/${targetUser.id}/unmute`)
        .set("Cookie", cookies);

      expect(unmuteRes.status).toBe(403);
    });

    it("should return 404 for non-existent user when muting", async () => {
      // Create mute permission
      const mutePerm = await preparePermission(
        permRepo,
        Permissions.MUTE_PLAYER
      );

      // Create admin user
      const adminUser = await createAdminUser(userRepo, [mutePerm]);

      // Login as admin
      const loginRes = await request(app)
        .post("/v1/test/login")
        .send({ userId: adminUser.id });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers["set-cookie"];

      // Try to mute non-existent user
      const mutedUntil = new Date(Date.now() + 3600000);
      const muteRes = await request(app)
        .post("/v1/admin/api/users/99999/mute")
        .set("Cookie", cookies)
        .send({ mutedUntil: mutedUntil.toISOString() });

      expect(muteRes.status).toBe(404);
    });

    it("should validate mutedUntil date format", async () => {
      // Create mute permission
      const mutePerm = await preparePermission(
        permRepo,
        Permissions.MUTE_PLAYER
      );

      // Create admin user
      const adminUser = await createAdminUser(userRepo, [mutePerm]);

      // Create target user
      const targetUser = await createTargetUser(userRepo);

      // Login as admin
      const loginRes = await request(app)
        .post("/v1/test/login")
        .send({ userId: adminUser.id });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers["set-cookie"];

      // Try to mute with invalid date format
      const muteRes = await request(app)
        .post(`/v1/admin/api/users/${targetUser.id}/mute`)
        .set("Cookie", cookies)
        .send({ mutedUntil: "invalid-date" });

      expect(muteRes.status).toBe(400);
    });
  });

  describe("UserDTO includes mutedUntil", () => {
    it("should include mutedUntil in user data", async () => {
      // Create user with muted_until
      const mutedUntil = new Date(Date.now() + 3600000);
      const user = userRepo.create({
        username: "muteduser",
        email: "muted@example.com",
        is_deleted: false,
        permissions: [],
        muted_until: mutedUntil,
      });
      await userRepo.save(user);

      // Login as this user
      const loginRes = await request(app)
        .post("/v1/test/login")
        .send({ userId: user.id });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers["set-cookie"];

      // Get user data
      const meRes = await request(app).get("/v1/me").set("Cookie", cookies);

      expect(meRes.status).toBe(200);
      expect(meRes.body.mutedUntil).toBeDefined();
      expect(new Date(meRes.body.mutedUntil).getTime()).toBeCloseTo(
        mutedUntil.getTime(),
        -2
      ); // Allow 10ms difference
    });

    it("should have null mutedUntil for non-muted users", async () => {
      // Create user without mute
      const user = await createTargetUser(userRepo);

      // Login as this user
      const loginRes = await request(app)
        .post("/v1/test/login")
        .send({ userId: user.id });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers["set-cookie"];

      // Get user data
      const meRes = await request(app).get("/v1/me").set("Cookie", cookies);

      expect(meRes.status).toBe(200);
      expect(meRes.body.mutedUntil).toBeNull();
    });
  });
});
