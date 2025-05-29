import request from "supertest";
import { DataSource, Repository } from "typeorm";

import { Permissions } from "domain/enums/Permissions";
import { AppDataSource } from "infrastructure/database/DataSource";
import { Permission } from "infrastructure/database/models/Permission";
import { User } from "infrastructure/database/models/User";
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
  let app: any;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let permRepo: Repository<Permission>;
  let cleanup: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    testEnv = new TestEnvironment(AppDataSource);
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
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) await cleanup(); // Ensure Redis is disconnected
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  // Global error handlers to ensure process exits on unhandled errors
  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
    setTimeout(() => process.exit(1), 1000);
  });
  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    setTimeout(() => process.exit(1), 1000);
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
});
