import { type Express } from "express";
import request from "supertest";
import { DataSource, Repository } from "typeorm";

import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PackageUploadResponse } from "domain/types/package/PackageUploadResponse";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { Package } from "infrastructure/database/models/package/Package";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { ValueUtils } from "infrastructure/utils/ValueUtils";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { PackageUtils } from "tests/utils/PackageUtils";
import { TestUtils } from "tests/utils/TestUtils";

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

function getTimeOfStringDate(dateString: Date | string): number {
  return new Date(dateString).getTime();
}

describe("PackageRestApiController", () => {
  let testEnv: TestEnvironment;
  let app: Express;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let packageRepo: Repository<Package>;
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
    // --- utils ---
    serverUrl = `http://localhost:${process.env.PORT || 3000}`;
    packageUtils = new PackageUtils();
    testUtils = new TestUtils(app, userRepo, serverUrl);
  });

  afterEach(async () => {
    await userRepo.delete({});
    await packageRepo.delete({});
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
    await userRepo.delete({});
    await packageRepo.delete({});
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
});
