import { type Express } from "express";
import request from "supertest";
import { DataSource, Repository } from "typeorm";

import { Permissions } from "domain/enums/Permissions";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PackageUploadResponse } from "domain/types/package/PackageUploadResponse";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { Package } from "infrastructure/database/models/package/Package";
import { Permission } from "infrastructure/database/models/Permission";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { ValueUtils } from "infrastructure/utils/ValueUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { PackageUtils } from "tests/utils/PackageUtils";
import { TestUtils } from "tests/utils/TestUtils";
import { deleteAll } from "tests/utils/TypeOrmTestUtils";

async function createPackages(
  count: number,
  packageUtils: PackageUtils,
  loginData: { user: User; cookie: string },
  app: Express
) {
  for (let i = 0; i < count; i++) {
    const packageData = packageUtils.createTestPackageData(
      loginData.user,
      false
    );

    // Create package
    await request(app)
      .post("/v1/packages")
      .send({
        content: packageData,
      })
      .set("Cookie", loginData.cookie);
  }
}

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

async function createUserWithPermissions(
  userRepo: Repository<User>,
  username: string,
  permissions: Permission[]
): Promise<User> {
  const user = userRepo.create({
    username,
    email: `${username}@test.com`,
    is_deleted: false,
    permissions: permissions,
  });
  await userRepo.save(user);
  return user;
}

function getTimeOfStringDate(dateString: Date | string): number {
  return new Date(dateString).getTime();
}

describe("PackageRestApiController", () => {
  let testEnv: TestEnvironment;
  let app: Express;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let packageRepo: Repository<Package>;
  let permRepo: Repository<Permission>;
  let cleanup: (() => Promise<void>) | undefined;
  let packageUtils: PackageUtils;
  let testUtils: TestUtils;
  let serverUrl: string;
  let logger: ILogger;

  beforeAll(async () => {
    // --- setup ---
    logger = await PinoLogger.init({ pretty: true });
    testEnv = new TestEnvironment(logger);
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    dataSource = boot.dataSource;
    cleanup = boot.cleanup;
    // --- repositories ---
    userRepo = dataSource.getRepository<User>("User");
    packageRepo = dataSource.getRepository<Package>("Package");
    permRepo = dataSource.getRepository<Permission>("Permission");
    // --- utils ---
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    packageUtils = new PackageUtils();
    testUtils = new TestUtils(app, userRepo, serverUrl);
  });

  beforeEach(async () => {
    // Clear Redis cache to prevent stale user data from affecting tests
    await testEnv.clearRedis();
  });

  afterEach(async () => {
    await deleteAll(packageRepo);
    await deleteAll(userRepo);
    await deleteAll(permRepo);
  });

  afterAll(async () => {
    try {
      await testEnv.teardown();
      if (cleanup) {
        await cleanup();
      }
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  beforeEach(async () => {
    await deleteAll(packageRepo);
    await deleteAll(userRepo);
    await deleteAll(permRepo);
  });

  it("should create package successfully", async () => {
    const loginData = await testUtils.createAndLoginUser("testuser");
    const packageData = packageUtils.createTestPackageData(
      loginData.user,
      false
    );

    // Create package
    const res = await request(app)
      .post("/v1/packages")
      .send({
        content: packageData,
      })
      .set("Cookie", loginData.cookie);

    // Validate package response
    const response = res.body as PackageUploadResponse;

    expect(ValueUtils.isObject(response.uploadLinks)).toBe(true);
    expect(response.id).toBeDefined();

    // Validate package in database
    const packageFromDB = await packageRepo.findOne({
      where: { id: response.id },
      relations: ["author"],
    });

    expect(packageFromDB).toBeDefined();
    expect(packageFromDB!.author.id).toBe(loginData.user.id);
    expect(packageFromDB!.id).toBe(response.id);
  });

  it("should retrieve package", async () => {
    const loginData = await testUtils.createAndLoginUser("testuser");
    const packageData = packageUtils.createTestPackageData(
      loginData.user,
      false
    );

    // Create package
    const createRes = await request(app)
      .post("/v1/packages")
      .send({
        content: packageData,
      })
      .set("Cookie", loginData.cookie);

    // Get package
    const id = (createRes.body as unknown as PackageUploadResponse).id;
    const res = await request(app)
      .get(`/v1/packages/${id}`)
      .set("Cookie", loginData.cookie);

    const result = res.body as PackageDTO;

    expect(result.id).toBe(id);
    expect(result.title).toBe(packageData.title);
    expect(result.author.id).toBe(loginData.user.id);
    expect(result.description).toBe(packageData.description);
    expect(result.language).toBe(packageData.language);
    expect(result.ageRestriction).toBe(packageData.ageRestriction);
  });

  it("should list packages", async () => {
    const loginData = await testUtils.createAndLoginUser("testuser");

    await createPackages(
      15,
      packageUtils,
      {
        user: loginData.user,
        cookie: loginData.cookie,
      },
      app
    );

    // Get package
    const res = await request(app)
      .get(`/v1/packages/?limit=20&offset=0&sortBy=id`)
      .set("Cookie", loginData.cookie);

    const result = res.body as PaginatedResult<Omit<PackageDTO, "rounds">[]>;
    expect(result.data.length).toBe(15);
    expect(result.pageInfo).toBeDefined();
    expect(result.pageInfo.total).toBe(15);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data[0].author.id).toBe(loginData.user.id);
    expect(result.data[0].id).toBeLessThan(result.data[1].id!);
    expect(result.data[1].id).toBeLessThan(result.data[2].id!);
  });

  it("should list packages with query parameters", async () => {
    const loginData = await testUtils.createAndLoginUser("testuser");

    await createPackages(
      5,
      packageUtils,
      {
        user: loginData.user,
        cookie: loginData.cookie,
      },
      app
    );

    // Get package
    const res = await request(app)
      .get(`/v1/packages/?limit=3&offset=0&sortBy=created_at&order=desc`)
      .set("Cookie", loginData.cookie);

    const result = res.body as PaginatedResult<Omit<PackageDTO, "rounds">[]>;
    expect(result.data.length).toBe(3);
    expect(result.pageInfo).toBeDefined();
    expect(result.pageInfo.total).toBe(5);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data[0].author.id).toBe(loginData.user.id);
    expect(getTimeOfStringDate(result.data[0].createdAt)).toBeGreaterThan(
      getTimeOfStringDate(result.data[1].createdAt)
    );
    expect(getTimeOfStringDate(result.data[1].createdAt)).toBeGreaterThan(
      getTimeOfStringDate(result.data[2].createdAt)
    );
  });

  describe("Package Deletion", () => {
    it("should successfully delete package when user is the author", async () => {
      const loginData = await testUtils.createAndLoginUser("author");
      const packageData = packageUtils.createTestPackageData(
        loginData.user,
        false
      );

      // Create package
      const createRes = await request(app)
        .post("/v1/packages")
        .send({
          content: packageData,
        })
        .set("Cookie", loginData.cookie);

      const packageId = createRes.body.id;

      // Verify package exists
      const getRes = await request(app)
        .get(`/v1/packages/${packageId}`)
        .set("Cookie", loginData.cookie);
      expect(getRes.status).toBe(200);

      // Delete package as author
      const deleteRes = await request(app)
        .delete(`/v1/packages/${packageId}`)
        .set("Cookie", loginData.cookie);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toBe("Package deleted successfully");

      // Verify package is deleted
      const getAfterDeleteRes = await request(app)
        .get(`/v1/packages/${packageId}`)
        .set("Cookie", loginData.cookie);

      expect(getAfterDeleteRes.status).toBe(404);
      expect(getAfterDeleteRes.body.error).toBe("Package not found");
    });

    it("should successfully delete package when user has DELETE_PACKAGE permission", async () => {
      // Create author and package
      const authorData = await testUtils.createAndLoginUser("author");
      const packageData = packageUtils.createTestPackageData(
        authorData.user,
        false
      );

      const createRes = await request(app)
        .post("/v1/packages")
        .send({
          content: packageData,
        })
        .set("Cookie", authorData.cookie);

      const packageId = createRes.body.id;

      // Create user with DELETE_PACKAGE permission
      const deletePermission = await preparePermission(
        permRepo,
        Permissions.DELETE_PACKAGE
      );
      const privilegedUser = await createUserWithPermissions(
        userRepo,
        "privileged",
        [deletePermission]
      );

      // Login as this user using the standard test login
      const loginRes = await request(app)
        .post("/v1/test/login")
        .send({ userId: privilegedUser.id });
      expect(loginRes.status).toBe(200);
      const privilegedCookie = loginRes.headers["set-cookie"];

      // Delete package with permission
      const deleteRes = await request(app)
        .delete(`/v1/packages/${packageId}`)
        .set("Cookie", privilegedCookie);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toBe("Package deleted successfully");

      // Verify package is deleted
      const getAfterDeleteRes = await request(app)
        .get(`/v1/packages/${packageId}`)
        .set("Cookie", authorData.cookie);
      expect(getAfterDeleteRes.status).toBe(404);
      expect(getAfterDeleteRes.body.error).toBe("Package not found");
    });

    it("should reject package deletion when user lacks permission and is not author", async () => {
      // Create author and package
      const authorData = await testUtils.createAndLoginUser("author");
      const packageData = packageUtils.createTestPackageData(
        authorData.user,
        false
      );

      const createRes = await request(app)
        .post("/v1/packages")
        .send({
          content: packageData,
        })
        .set("Cookie", authorData.cookie);

      const packageId = createRes.body.id;

      // Create user without DELETE_PACKAGE permission
      const unprivilegedUser = await createUserWithPermissions(
        userRepo,
        "unprivileged",
        []
      );
      // Login as this user
      const loginRes = await request(app)
        .post("/v1/test/login")
        .send({ userId: unprivilegedUser.id });
      const unprivilegedCookie = loginRes.headers["set-cookie"];

      // Attempt to delete package without permission
      const deleteRes = await request(app)
        .delete(`/v1/packages/${packageId}`)
        .set("Cookie", unprivilegedCookie);

      expect(deleteRes.status).toBe(403);
      expect(deleteRes.body.error).toBe(
        "You don't have permission to perform this action"
      );

      // Verify package still exists
      const getAfterDeleteRes = await request(app)
        .get(`/v1/packages/${packageId}`)
        .set("Cookie", authorData.cookie);
      expect(getAfterDeleteRes.status).toBe(200);
    });

    it("should reject package deletion when user is not authenticated", async () => {
      // Create package as authenticated user
      const authorData = await testUtils.createAndLoginUser("author");
      const packageData = packageUtils.createTestPackageData(
        authorData.user,
        false
      );

      const createRes = await request(app)
        .post("/v1/packages")
        .send({
          content: packageData,
        })
        .set("Cookie", authorData.cookie);

      const packageId = createRes.body.id;

      // Attempt to delete package without authentication
      const deleteRes = await request(app).delete(`/v1/packages/${packageId}`);

      expect(deleteRes.status).toBe(401);
      expect(deleteRes.body.error).toBe("Access denied");

      // Verify package still exists
      const getAfterDeleteRes = await request(app)
        .get(`/v1/packages/${packageId}`)
        .set("Cookie", authorData.cookie);
      expect(getAfterDeleteRes.status).toBe(200);
    });

    it("should return 404 when trying to delete non-existent package", async () => {
      // Create user with DELETE_PACKAGE permission
      const deletePermission = await preparePermission(
        permRepo,
        Permissions.DELETE_PACKAGE
      );
      const privilegedUser = await createUserWithPermissions(
        userRepo,
        "privileged",
        [deletePermission]
      );
      // Login as this user
      const loginRes = await request(app)
        .post("/v1/test/login")
        .send({ userId: privilegedUser.id });
      const privilegedCookie = loginRes.headers["set-cookie"];

      // Attempt to delete non-existent package
      const deleteRes = await request(app)
        .delete(`/v1/packages/999999`)
        .set("Cookie", privilegedCookie);

      expect(deleteRes.status).toBe(404);
      expect(deleteRes.body.error).toBe("Package not found");
    });

    it("should return 400 for invalid package ID", async () => {
      // Create user with DELETE_PACKAGE permission
      const deletePermission = await preparePermission(
        permRepo,
        Permissions.DELETE_PACKAGE
      );
      const privilegedUser = await createUserWithPermissions(
        userRepo,
        "privileged",
        [deletePermission]
      );
      // Login as this user
      const loginRes = await request(app)
        .post("/v1/test/login")
        .send({ userId: privilegedUser.id });
      const privilegedCookie = loginRes.headers["set-cookie"];

      // Attempt to delete package with invalid ID
      const deleteRes = await request(app)
        .delete(`/v1/packages/invalid`)
        .set("Cookie", privilegedCookie);

      expect(deleteRes.status).toBe(400);
    });
  });
});
