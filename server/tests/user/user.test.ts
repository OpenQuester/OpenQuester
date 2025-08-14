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

async function createUser(
  userRepo: Repository<User>,
  permissions: Permission[]
) {
  const user = userRepo.create({
    username: "testuser",
    email: "test@example.com",
    is_deleted: false,
    permissions: permissions,
  });
  await userRepo.save(user);
  return user;
}

describe("UserRestApiController", () => {
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
    cleanup = boot.cleanup; // Save cleanup function from bootstrapTestApp
  });

  afterEach(async () => {
    await userRepo.delete({});
    await permRepo.delete({});

    // Clear Redis cache to avoid cache coherency issues
    const redisClient = RedisConfig.getClient();
    const keys = await redisClient.keys("cache:user:*");
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup(); // Ensure Redis is disconnected
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  beforeEach(async () => {
    await userRepo.delete({});
  });

  it("should create and list users", async () => {
    const perm = await preparePermission(permRepo, Permissions.GET_ALL_USERS);
    const user = await createUser(userRepo, [perm]);

    // List users as guest (should be forbidden or unauthorized)
    const resGuest = await request(app).get("/v1/users");
    expect([403, 401]).toContain(resGuest.status);

    // Login as this user
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: user.id });

    expect(loginRes.status).toBe(200);

    const cookies = loginRes.headers["set-cookie"];
    expect(cookies).toBeDefined();

    // List users as logged-in user
    const resAuth = await request(app)
      .get("/v1/users/?limit=10&offset=0")
      .set("Cookie", cookies);

    expect(resAuth.status).toBe(200);
    expect(resAuth.body.data.length).toBe(1);
    expect(resAuth.body.data[0].id).toBe(user.id);
  });

  it("should get a user by id", async () => {
    const perm = await preparePermission(
      permRepo,
      Permissions.GET_ANOTHER_USER
    );
    const user = await createUser(userRepo, [perm]);

    // Try to get user by id as guest (should be forbidden or unauthorized)
    const resGuest = await request(app).get(`/v1/users/${user.id}`);
    expect([403, 401]).toContain(resGuest.status);

    // Login as this user
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: user.id });
    expect(loginRes.status).toBe(200);

    const cookies = loginRes.headers["set-cookie"];
    expect(cookies).toBeDefined();

    // Try to get user by id as logged-in user
    const resAuth = await request(app)
      .get(`/v1/users/${user.id}`)
      .set("Cookie", cookies);

    expect(resAuth.status).toBe(200);
    expect(resAuth.body.id).toBe(user.id);

    const res = await request(app)
      .get(`/v1/users/${user.id}`)
      .set("Cookie", cookies);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
  });

  it("should allow login and set session cookie", async () => {
    // Insert a user
    const user = userRepo.create({
      username: "sessionuser",
      email: "session@example.com",
      is_deleted: false,
    });
    await userRepo.save(user);

    // Login via test endpoint
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: user.id });
    expect(loginRes.status).toBe(200);

    const cookies = loginRes.headers["set-cookie"];
    expect(cookies).toBeDefined();

    // Use cookie to access /v1/me
    const meRes = await request(app).get("/v1/me").set("Cookie", cookies);
    expect(meRes.status).toBe(200);
  });

  it("should return 404 for non-existent user", async () => {
    const perm = await preparePermission(
      permRepo,
      Permissions.GET_ANOTHER_USER
    );
    const user = await createUser(userRepo, [perm]);

    // Login as this user
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: user.id });
    expect(loginRes.status).toBe(200);

    const cookies = loginRes.headers["set-cookie"];
    expect(cookies).toBeDefined();

    const res = await request(app)
      .get("/v1/users/999999")
      .set("Cookie", cookies);

    expect(res.status).toBe(404);
  });

  it("should return 400 for invalid user id", async () => {
    const perm = await preparePermission(
      permRepo,
      Permissions.GET_ANOTHER_USER
    );
    const user = await createUser(userRepo, [perm]);

    // Login as this user
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: user.id });
    expect(loginRes.status).toBe(200);

    const cookies = loginRes.headers["set-cookie"];
    expect(cookies).toBeDefined();

    const res = await request(app)
      .get("/v1/users/invalid")
      .set("Cookie", cookies);
    expect(res.status).toBe(400);
  });

  it("should not allow update with empty body", async () => {
    // Insert a user
    const user = userRepo.create({
      username: "updateuser",
      email: "update@example.com",
      is_deleted: false,
    });
    await userRepo.save(user);

    // Try to update as guest
    const resGuest = await request(app).patch(`/v1/me`).send({});
    expect([403, 401]).toContain(resGuest.status);

    // Login as this user
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: user.id });
    const cookies = loginRes.headers["set-cookie"];
    expect(cookies).toBeDefined();

    // Try to update as logged-in user
    const resAuth = await request(app)
      .patch(`/v1/me`)
      .set("Cookie", cookies)
      .send({});
    expect(resAuth.status).toBe(400);
  });

  it("should allow users to update username and name", async () => {
    // Create a user
    const user = userRepo.create({
      username: "olduser",
      name: "Old Name",
      email: "updatetest@example.com",
      is_deleted: false,
    });
    await userRepo.save(user);

    // Login as this user
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: user.id });
    const cookies = loginRes.headers["set-cookie"];
    expect(cookies).toBeDefined();

    // Update username and name
    const updateData = {
      username: "newuser.123",
      name: "New Display Name",
    };

    const res = await request(app)
      .patch("/v1/me")
      .set("Cookie", cookies)
      .send(updateData);

    expect(res.status).toBe(200);
    expect(res.body.username).toBe("newuser.123");
    expect(res.body.name).toBe("New Display Name");

    // Verify in database
    const updatedUser = await userRepo.findOne({ where: { id: user.id } });
    expect(updatedUser!.username).toBe("newuser.123");
    expect(updatedUser!.name).toBe("New Display Name");
  });

  it("should reject invalid username formats", async () => {
    // Create a user
    const user = userRepo.create({
      username: "testuser",
      email: "invalidtest@example.com",
      is_deleted: false,
    });
    await userRepo.save(user);

    // Login as this user
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: user.id });
    const cookies = loginRes.headers["set-cookie"];

    // Test uppercase username gets rejected (invalid behavior)
    const invalidData1 = { username: "Invalid.Username" };
    const res1 = await request(app)
      .patch("/v1/me")
      .set("Cookie", cookies)
      .send(invalidData1);
    expect(res1.status).toBe(400);
    expect(res1.body.error).toContain("can only contain lowercase letters");

    // Test valid lowercase username
    const validData = { username: "valid.username" };
    const res1valid = await request(app)
      .patch("/v1/me")
      .set("Cookie", cookies)
      .send(validData);
    expect(res1valid.status).toBe(200);
    expect(res1valid.body.username).toBe("valid.username");

    // Test invalid username with consecutive periods
    const invalidData2 = { username: "user..name" };
    const res2 = await request(app)
      .patch("/v1/me")
      .set("Cookie", cookies)
      .send(invalidData2);
    expect(res2.status).toBe(400);

    // Test invalid username with special characters
    const invalidData3 = { username: "user@name" };
    const res3 = await request(app)
      .patch("/v1/me")
      .set("Cookie", cookies)
      .send(invalidData3);
    expect(res3.status).toBe(400);
  });

  it("should reject duplicate usernames", async () => {
    // Create two users
    const user1 = userRepo.create({
      username: "user1",
      email: "user1@example.com",
      is_deleted: false,
    });
    const user2 = userRepo.create({
      username: "user2",
      email: "user2@example.com",
      is_deleted: false,
    });
    await userRepo.save([user1, user2]);

    // Login as user2
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: user2.id });
    const cookies = loginRes.headers["set-cookie"];

    // Try to change username to user1's username
    const updateData = { username: "user1" };
    const res = await request(app)
      .patch("/v1/me")
      .set("Cookie", cookies)
      .send(updateData);

    expect(res.status).toBe(400);
  });

  it("should allow duplicate names", async () => {
    // Create two users
    const user1 = userRepo.create({
      username: "user1",
      name: "Same Name",
      email: "user1@example.com",
      is_deleted: false,
    });
    const user2 = userRepo.create({
      username: "user2",
      email: "user2@example.com",
      is_deleted: false,
    });
    await userRepo.save([user1, user2]);

    // Login as user2
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: user2.id });
    const cookies = loginRes.headers["set-cookie"];

    // Change name to same as user1's name (should be allowed)
    const updateData = { name: "Same Name" };
    const res = await request(app)
      .patch("/v1/me")
      .set("Cookie", cookies)
      .send(updateData);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Same Name");
  });

  it("should allow Unicode characters in names", async () => {
    // Test guest login with Unicode name
    const unicodeGuestData = {
      username: "Юзернейм Тест іїІЇґҐ", // Cyrillic
    };

    const guestRes = await request(app)
      .post("/v1/auth/guest")
      .send(unicodeGuestData);

    expect(guestRes.status).toBe(200);
    expect(guestRes.body.name).toBe("Юзернейм Тест іїІЇґҐ");

    // Test user update with Unicode name
    const user = userRepo.create({
      username: "unicodetest",
      email: "unicode@example.com",
      is_deleted: false,
    });
    await userRepo.save(user);

    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: user.id });
    const cookies = loginRes.headers["set-cookie"];

    const updateData = {
      name: "测试用户名", // Chinese characters
    };

    const res = await request(app)
      .patch("/v1/me")
      .set("Cookie", cookies)
      .send(updateData);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("测试用户名");
  });

  describe("Guest User Authentication", () => {
    it("should allow guest login with username only", async () => {
      const guestData = {
        username: "guestuser123",
      };

      const res = await request(app).post("/v1/auth/guest").send(guestData);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(guestData.username); // Display name should match input
      expect(res.body.username).toMatch(/^guest_\d{3,}$/); // Auto-generated username
      expect(res.body.isGuest).toBe(true);
      expect(res.body.email).toBeNull();
      expect(res.body.discordId).toBeNull();

      // Should set session cookie
      const cookies = res.headers["set-cookie"];

      expect(cookies).toBeDefined();

      const guestFromDB = await userRepo.findOne({
        where: { id: res.body.id },
      });
      expect(guestFromDB).toBeDefined();
      expect(guestFromDB!.name).toBe(guestData.username);
      expect(guestFromDB!.username).toMatch(/^guest_\d{3,}$/);
      expect(guestFromDB!.is_guest).toBe(true);
      expect(guestFromDB!.email).toBeNull();
      expect(guestFromDB!.discord_id).toBeNull();
    });

    it("should create unique guest users even with same display name", async () => {
      const guestData = {
        username: "samename",
      };

      // First login
      const res1 = await request(app).post("/v1/auth/guest").send(guestData);

      expect(res1.status).toBe(200);
      const userId1 = res1.body.id;
      const username1 = res1.body.username;

      // Second login with same display name
      const res2 = await request(app).post("/v1/auth/guest").send(guestData);

      expect(res2.status).toBe(200);
      expect(res2.body.id).not.toBe(userId1); // Different users
      expect(res2.body.username).not.toBe(username1); // Different auto-generated usernames
      expect(res2.body.name).toBe(guestData.username); // Same display name
      expect(res2.body.isGuest).toBe(true);
    });

    it("should reject guest login with invalid username", async () => {
      const invalidData = {
        username: "", // Empty string
      };

      const res = await request(app).post("/v1/auth/guest").send(invalidData);

      expect(res.status).toBe(400);

      // Test consecutive spaces
      const invalidData2 = {
        username: "user  name", // Consecutive spaces
      };

      const res2 = await request(app).post("/v1/auth/guest").send(invalidData2);

      expect(res2.status).toBe(400);
    });

    it("should prevent guest users from uploading packages", async () => {
      const guestData = {
        username: "guestpackagetest",
      };

      // Login as guest
      const loginRes = await request(app)
        .post("/v1/auth/guest")
        .send(guestData);

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers["set-cookie"];

      // Try to upload package as guest
      const packageData = {
        content: {
          title: "Test Package",
          description: "Test Description",
          language: "en",
          ageRestriction: 0,
          rounds: [],
        },
      };

      const uploadRes = await request(app)
        .post("/v1/packages")
        .set("Cookie", cookies)
        .send(packageData);

      expect(uploadRes.status).toBe(403);
    });

    it("should allow guest users to access protected endpoints", async () => {
      const guestData = {
        username: "guestaccess",
      };

      // Login as guest
      const loginRes = await request(app)
        .post("/v1/auth/guest")
        .send(guestData);

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers["set-cookie"];

      // Test accessing /v1/me endpoint
      const meRes = await request(app).get("/v1/me").set("Cookie", cookies);

      expect(meRes.status).toBe(200);
      expect(meRes.body.isGuest).toBe(true);
    });
  });
});
