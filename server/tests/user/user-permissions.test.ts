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
import { deleteAll } from "tests/utils/TypeOrmTestUtils";

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

async function createTargetUser(
  userRepo: Repository<User>,
  permissions: Permission[] = []
) {
  const user = userRepo.create({
    username: "targetuser",
    email: "target@example.com",
    is_deleted: false,
    permissions: permissions,
  });
  await userRepo.save(user);
  return user;
}

describe("User Permissions Management", () => {
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
    await deleteAll(userRepo);
    await deleteAll(permRepo);

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
    await deleteAll(userRepo);
  });

  it("should update user permissions successfully", async () => {
    // Create permissions
    const managePerm = await preparePermission(
      permRepo,
      Permissions.MANAGE_PERMISSIONS
    );
    await preparePermission(permRepo, Permissions.EDIT_PACKAGE);
    await preparePermission(permRepo, Permissions.DELETE_PACKAGE);

    // Create admin user with manage permissions permission
    const adminUser = await createUser(userRepo, [managePerm]);

    // Create target user with no permissions
    const targetUser = await createTargetUser(userRepo, []);

    // Login as admin
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: adminUser.id });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers["set-cookie"];

    // Update target user permissions
    const updateRes = await request(app)
      .patch(`/v1/users/${targetUser.id}/permissions`)
      .set("Cookie", cookies)
      .send({
        permissions: [Permissions.EDIT_PACKAGE, Permissions.DELETE_PACKAGE],
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.message).toBe(
      "User permissions updated successfully"
    );
    expect(updateRes.body.data).toBeDefined();
    expect(updateRes.body.data.id).toBe(targetUser.id);
    expect(updateRes.body.data.permissions).toHaveLength(2);

    const permissionNames = updateRes.body.data.permissions.map(
      (p: Permission) => p.name
    );
    expect(permissionNames).toContain(Permissions.EDIT_PACKAGE);
    expect(permissionNames).toContain(Permissions.DELETE_PACKAGE);
  });

  it("should require manage_permissions permission", async () => {
    // Create permissions
    const editPerm = await preparePermission(
      permRepo,
      Permissions.EDIT_PACKAGE
    );

    // Create user without manage permissions permission
    const user = await createUser(userRepo, [editPerm]);

    // Create target user
    const targetUser = await createTargetUser(userRepo, []);

    // Login as user without manage permissions
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: user.id });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers["set-cookie"];

    // Try to update permissions (should fail)
    const updateRes = await request(app)
      .patch(`/v1/users/${targetUser.id}/permissions`)
      .set("Cookie", cookies)
      .send({
        permissions: [Permissions.EDIT_PACKAGE],
      });

    expect(updateRes.status).toBe(403);
  });

  it("should handle empty permissions array", async () => {
    // Create permissions
    const managePerm = await preparePermission(
      permRepo,
      Permissions.MANAGE_PERMISSIONS
    );
    const editPerm = await preparePermission(
      permRepo,
      Permissions.EDIT_PACKAGE
    );

    // Create admin user
    const adminUser = await createUser(userRepo, [managePerm]);

    // Create target user with some permissions
    const targetUser = await createTargetUser(userRepo, [editPerm]);

    // Login as admin
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: adminUser.id });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers["set-cookie"];

    // Remove all permissions
    const updateRes = await request(app)
      .patch(`/v1/users/${targetUser.id}/permissions`)
      .set("Cookie", cookies)
      .send({
        permissions: [],
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.permissions).toHaveLength(0);
  });

  it("should handle invalid permission names", async () => {
    // Create permissions
    const managePerm = await preparePermission(
      permRepo,
      Permissions.MANAGE_PERMISSIONS
    );

    // Create admin user
    const adminUser = await createUser(userRepo, [managePerm]);

    // Create target user
    const targetUser = await createTargetUser(userRepo, []);

    // Login as admin
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: adminUser.id });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers["set-cookie"];

    // Try to assign invalid permission
    const updateRes = await request(app)
      .patch(`/v1/users/${targetUser.id}/permissions`)
      .set("Cookie", cookies)
      .send({
        permissions: ["invalid_permission", "another_invalid"],
      });

    expect(updateRes.status).toBe(400);
  });

  it("should handle non-existent user", async () => {
    // Create permissions
    const managePerm = await preparePermission(
      permRepo,
      Permissions.MANAGE_PERMISSIONS
    );

    // Create admin user
    const adminUser = await createUser(userRepo, [managePerm]);

    // Login as admin
    const loginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: adminUser.id });

    expect(loginRes.status).toBe(200);
    const cookies = loginRes.headers["set-cookie"];

    // Try to update permissions for non-existent user
    const updateRes = await request(app)
      .patch("/v1/users/99999/permissions")
      .set("Cookie", cookies)
      .send({
        permissions: [Permissions.EDIT_PACKAGE],
      });

    expect(updateRes.status).toBe(404);
  });
});
