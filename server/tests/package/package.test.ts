import { DataSource, Repository } from "typeorm";

import { Permissions } from "domain/enums/Permissions";
import { ContentPlacement } from "domain/enums/package/ContentPlacement";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { ShowAnswerLogic } from "domain/logic/question/ShowAnswerLogic";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PackageUploadResponse } from "domain/types/package/PackageUploadResponse";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { Package } from "infrastructure/database/models/package/Package";
import { AddCorrectChoiceOrder_0_31_0_1792700000000 } from "infrastructure/database/migrations/0.31.0_AddCorrectChoiceOrder_1792700000000";
import { AddQuestionContentFields_0_32_0_1793200000000 } from "infrastructure/database/migrations/0.32.0_AddQuestionContentFields_1793200000000";
import { AnswerType } from "domain/enums/package/AnswerType";
import { Permission } from "infrastructure/database/models/Permission";
import { User } from "infrastructure/database/models/User";
import { ValueUtils } from "domain/utils/ValueUtils";
import { createHttpTestClient, type HttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { PackageUtils } from "tests/utils/PackageUtils";
import { TestUtils } from "tests/utils/TestUtils";
import { deleteAll } from "tests/utils/TypeOrmTestUtils";

async function createPackages(
  count: number,
  packageUtils: PackageUtils,
  loginData: { user: User; cookie: string },
  http: HttpTestClient
) {
  for (let i = 0; i < count; i++) {
    const packageData = packageUtils.createTestPackageData(loginData.user, false);

    // Create package
    await http
      .post("/v1/packages")
      .send({
        content: packageData
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
    permissions: permissions
  });
  await userRepo.save(user);
  return user;
}

function getTimeOfStringDate(dateString: Date | string): number {
  return new Date(dateString).getTime();
}

describe("PackageRestApiController", () => {
  let harness: ServerTestHarness;
  let http: HttpTestClient;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let packageRepo: Repository<Package>;
  let permRepo: Repository<Permission>;
  let packageUtils: PackageUtils;
  let testUtils: TestUtils;

  beforeAll(async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });
    dataSource = harness.dataSource;
    userRepo = dataSource.getRepository<User>("User");
    packageRepo = dataSource.getRepository<Package>("Package");
    permRepo = dataSource.getRepository<Permission>("Permission");
    packageUtils = new PackageUtils();
    testUtils = new TestUtils(harness.app, userRepo, harness.serverUrl);
  });

  beforeEach(async () => {
    http = createHttpTestClient(harness.serverUrl);
  });

  afterEach(async () => {
    await deleteAll(packageRepo);
    await deleteAll(userRepo);
    await deleteAll(permRepo);
    await harness.resetState();
  });

  afterAll(async () => {
    await harness?.stop();
  });

  beforeEach(async () => {
    await deleteAll(packageRepo);
    await deleteAll(userRepo);
    await deleteAll(permRepo);
  });

  it("allows credentialed cross-origin PUT preflight for package edits", async () => {
    const origin = "http://localhost:5173";
    const response = await http
      .options("/v1/packages/1")
      .set("Origin", origin)
      .set("Access-Control-Request-Method", "PUT")
      .set("Access-Control-Request-Headers", "content-type");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(response.headers["access-control-allow-methods"].split(",")).toContain("PUT");
    expect(response.headers["access-control-allow-headers"].toLowerCase().split(",")).toContain(
      "content-type"
    );
  });

  it("should create package successfully", async () => {
    const loginData = await testUtils.createAndLoginUser("testuser");
    const packageData = packageUtils.createTestPackageData(loginData.user, false);

    // Create package
    const res = await http
      .post("/v1/packages")
      .send({
        content: packageData
      })
      .set("Cookie", loginData.cookie);

    // Validate package response
    const response = res.body as PackageUploadResponse;

    expect(ValueUtils.isObject(response.uploadLinks)).toBe(true);
    expect(response.id).toBeDefined();

    // Validate package in database
    const packageFromDB = await packageRepo.findOne({
      where: { id: response.id },
      relations: ["author"]
    });

    expect(packageFromDB).toBeDefined();
    expect(packageFromDB!.author.id).toBe(loginData.user.id);
    expect(packageFromDB!.id).toBe(response.id);
  });

  it("should retrieve package", async () => {
    const loginData = await testUtils.createAndLoginUser("testuser");
    const packageData = packageUtils.createTestPackageData(loginData.user, false);

    // Create package
    const createRes = await http
      .post("/v1/packages")
      .send({
        content: packageData
      })
      .set("Cookie", loginData.cookie);

    // Get package
    const id = (createRes.body as unknown as PackageUploadResponse).id;
    const res = await http.get(`/v1/packages/${id}`).set("Cookie", loginData.cookie);

    const result = res.body as PackageDTO;

    expect(result.id).toBe(id);
    expect(result.title).toBe(packageData.title);
    expect(result.author.id).toBe(loginData.user.id);
    expect(result.description).toBe(packageData.description);
    expect(result.language).toBe(packageData.language);
    expect(result.ageRestriction).toBe(packageData.ageRestriction);
  });

  it("round-trips an optional correct choice key through create, read and replace", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser("choice_key");
    const content = packageUtils.createTestPackageData(user, false);
    const choice = content.rounds[0].themes
      .flatMap((theme) => theme.questions)
      .find((question) => question.type === PackageQuestionType.CHOICE)!;
    const created = await http.post("/v1/packages").set("Cookie", cookie).send({ content });
    expect(created.status).toBe(200);
    const id = created.body.id;
    // The test database synchronizes entities; recreate the new column with
    // the migration to prove an existing legacy package survives the upgrade.
    const runner = dataSource.createQueryRunner();
    const migration = new AddCorrectChoiceOrder_0_31_0_1792700000000();
    try {
      await migration.down(runner);
      await migration.up(runner);
    } finally {
      await runner.release();
    }
    const legacy = await http.get(`/v1/packages/${id}`).set("Cookie", cookie);
    expect(legacy.status).toBe(200);
    const oldChoice = (legacy.body as PackageDTO).rounds
      .flatMap((round) => round.themes)
      .flatMap((theme) => theme.questions)
      .find((question) => question.type === PackageQuestionType.CHOICE)!;
    expect(oldChoice.correctChoiceOrder).toBeUndefined();
    choice.correctChoiceOrder = 0;
    const replaced = await http.put(`/v1/packages/${id}`).set("Cookie", cookie).send({ content });
    expect(replaced.status).toBe(200);
    const loaded = await http.get(`/v1/packages/${id}`).set("Cookie", cookie);
    const saved = (loaded.body as PackageDTO).rounds
      .flatMap((round) => round.themes)
      .flatMap((theme) => theme.questions)
      .find((question) => question.type === PackageQuestionType.CHOICE)!;
    expect(saved.correctChoiceOrder).toBe(0);
    for (const invalid of [99, 0.5]) {
      choice.correctChoiceOrder = invalid;
      expect(
        (await http.put(`/v1/packages/${id}`).set("Cookie", cookie).send({ content })).status
      ).toBe(400);
    }
    choice.correctChoiceOrder = 0;
    const originalOrder = choice.answers![1].order;
    choice.answers![1].order = 0;
    expect(
      (await http.put(`/v1/packages/${id}`).set("Cookie", cookie).send({ content })).status
    ).toBe(400);
    choice.answers![1].order = originalOrder;
    const simple = content.rounds[0].themes
      .flatMap((theme) => theme.questions)
      .find((question) => question.type === PackageQuestionType.SIMPLE)!;
    simple.correctChoiceOrder = 0;
    expect(
      (await http.put(`/v1/packages/${id}`).set("Cookie", cookie).send({ content })).status
    ).toBe(400);
    expect(
      (await http.get(`/v1/packages/${id}`).set("Cookie", cookie)).body.rounds
        .flatMap((round: PackageDTO["rounds"][number]) => round.themes)
        .flatMap((theme: PackageDTO["rounds"][number]["themes"][number]) => theme.questions)
        .find(
          (question: PackageDTO["rounds"][number]["themes"][number]["questions"][number]) =>
            question.type === PackageQuestionType.CHOICE
        ).correctChoiceOrder
    ).toBe(0);
  });

  it("migrates legacy content and round-trips sequenced text and explicit point targets", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser("content_fields");
    const content = packageUtils.createTestPackageData(user, false);
    const question = content.rounds[0].themes[0].questions[0];
    question.answerType = AnswerType.POINT;
    question.answerPoint = { x: 0.2, y: 0.4, imageAspectRatio: 1.5 };
    question.text = "Main";
    question.textOrder = 0;
    question.questionFiles = [
      { order: 1, displayTime: 5000, file: { md5: "a".repeat(32), type: PackageFileType.IMAGE } },
      { order: 3, displayTime: 5000, file: { md5: "b".repeat(32), type: PackageFileType.IMAGE } }
    ];
    const created = await http.post("/v1/packages").set("Cookie", cookie).send({ content });
    expect(created.status).toBe(200);
    const runner = dataSource.createQueryRunner();
    const migration = new AddQuestionContentFields_0_32_0_1793200000000();
    try {
      await migration.down(runner);
      await migration.up(runner);
    } finally {
      await runner.release();
    }
    const getQuestion = async () => {
      const response = await http.get(`/v1/packages/${created.body.id}`).set("Cookie", cookie);
      expect(response.status).toBe(200);
      return (response.body as PackageDTO).rounds
        .flatMap((round) => round.themes)
        .flatMap((theme) => theme.questions)
        .find((item) => item.text === "Main")!;
    };
    const legacy = await getQuestion();
    expect(legacy.pointImageOrder == null).toBe(true);
    expect(legacy.textItems == null).toBe(true);
    expect(legacy.answerPoint).toEqual(question.answerPoint);
    question.pointImageOrder = 3;
    question.textItems = [
      { order: 2, text: "Middle" },
      { order: 4, text: "Final" }
    ];
    expect(
      (await http.put(`/v1/packages/${created.body.id}`).set("Cookie", cookie).send({ content }))
        .status
    ).toBe(200);
    const saved = await getQuestion();
    expect(saved.pointImageOrder).toBe(3);
    expect(saved.textItems).toEqual(question.textItems);
    expect(saved.answerPoint).toEqual(question.answerPoint);
    question.pointImageOrder = 5;
    expect(
      (await http.put(`/v1/packages/${created.body.id}`).set("Cookie", cookie).send({ content }))
        .status
    ).toBe(400);
    question.pointImageOrder = 3;
    question.textItems = [{ order: 1, text: "Collision" }];
    expect(
      (await http.put(`/v1/packages/${created.body.id}`).set("Cookie", cookie).send({ content }))
        .status
    ).toBe(400);
    expect((await getQuestion()).textItems).toEqual(saved.textItems);
  });

  it("preserves background and nonblocking answer media through package storage and retrieval", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser("answer_media");
    const content = packageUtils.createTestPackageData(user, false);
    const question = content.rounds[0].themes[0].questions[0];
    question.answerFiles = [
      {
        order: 0,
        displayTime: 5000,
        placement: ContentPlacement.BACKGROUND,
        waitForFinish: false,
        file: { md5: "1".repeat(32), type: PackageFileType.AUDIO }
      },
      {
        order: 1,
        displayTime: 1000,
        placement: ContentPlacement.SCREEN,
        waitForFinish: true,
        file: { md5: "2".repeat(32), type: PackageFileType.IMAGE }
      }
    ];
    const created = await http.post("/v1/packages").set("Cookie", cookie).send({ content });
    expect(created.status).toBe(200);
    const loaded = await http.get(`/v1/packages/${created.body.id}`).set("Cookie", cookie);
    expect(loaded.status).toBe(200);
    const saved = (loaded.body as PackageDTO).rounds
      .flatMap((round) => round.themes)
      .flatMap((theme) => theme.questions)
      .find((item) => item.text === question.text)!;
    expect([...(saved.answerFiles ?? [])].sort((a, b) => a.order - b.order)).toEqual(
      question.answerFiles.map((file) =>
        expect.objectContaining({
          order: file.order,
          placement: file.placement,
          waitForFinish: file.waitForFinish
        })
      )
    );
    expect(ShowAnswerLogic.buildAnswerPlan(saved)).toMatchObject({
      totalMs: 1000,
      steps: [
        {
          startMs: 0,
          durationMs: 1000,
          items: [
            { order: 0, placement: ContentPlacement.BACKGROUND, durationMs: 5000 },
            { order: 1, placement: ContentPlacement.SCREEN, durationMs: 1000 }
          ]
        }
      ]
    });
  });

  it("keeps authors, sources and extra answers", async () => {
    const loginData = await testUtils.createAndLoginUser("testuser");
    const packageData = packageUtils.createTestPackageData(loginData.user, false);
    packageData.authors = ["Ann", " "];
    packageData.sources = ["Encyclopedia"];
    const question = packageData.rounds[0].themes[0].questions[0];
    question.rightAnswers = ["Alt answer"];
    question.wrongAnswers = ["Common mistake"];
    question.authors = ["Bob"];
    question.sources = ["https://example.com"];

    const createRes = await http
      .post("/v1/packages")
      .send({ content: packageData })
      .set("Cookie", loginData.cookie);
    const id = (createRes.body as unknown as PackageUploadResponse).id;
    const result = (await http.get(`/v1/packages/${id}`).set("Cookie", loginData.cookie))
      .body as PackageDTO;

    expect(result.authors).toEqual(["Ann"]);
    expect(result.sources).toEqual(["Encyclopedia"]);
    const saved = result.rounds
      .flatMap((r) => r.themes)
      .flatMap((t) => t.questions)
      .find((q) => q.text === question.text);
    expect(saved).toMatchObject({
      rightAnswers: ["Alt answer"],
      wrongAnswers: ["Common mistake"],
      authors: ["Bob"],
      sources: ["https://example.com"]
    });
  });

  it("should list packages", async () => {
    const loginData = await testUtils.createAndLoginUser("testuser");

    await createPackages(
      15,
      packageUtils,
      {
        user: loginData.user,
        cookie: loginData.cookie
      },
      http
    );

    // Get package
    const res = await http
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
        cookie: loginData.cookie
      },
      http
    );

    // Get package
    const res = await http
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
      const packageData = packageUtils.createTestPackageData(loginData.user, false);

      // Create package
      const createRes = await http
        .post("/v1/packages")
        .send({
          content: packageData
        })
        .set("Cookie", loginData.cookie);

      const packageId = createRes.body.id;

      // Verify package exists
      const getRes = await http.get(`/v1/packages/${packageId}`).set("Cookie", loginData.cookie);
      expect(getRes.status).toBe(200);

      // Delete package as author
      const deleteRes = await http
        .delete(`/v1/packages/${packageId}`)
        .set("Cookie", loginData.cookie);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toBe("Package deleted successfully");

      // Verify package is deleted
      const getAfterDeleteRes = await http
        .get(`/v1/packages/${packageId}`)
        .set("Cookie", loginData.cookie);

      expect(getAfterDeleteRes.status).toBe(404);
      expect(getAfterDeleteRes.body.error).toBe("Package not found");
    });

    it("should successfully delete package when user has DELETE_PACKAGE permission", async () => {
      // Create author and package
      const authorData = await testUtils.createAndLoginUser("author");
      const packageData = packageUtils.createTestPackageData(authorData.user, false);

      const createRes = await http
        .post("/v1/packages")
        .send({
          content: packageData
        })
        .set("Cookie", authorData.cookie);

      const packageId = createRes.body.id;

      // Create user with DELETE_PACKAGE permission
      const deletePermission = await preparePermission(permRepo, Permissions.DELETE_PACKAGE);
      const privilegedUser = await createUserWithPermissions(userRepo, "privileged", [
        deletePermission
      ]);

      // Login as this user using the standard test login
      const loginRes = await http.post("/v1/test/login").send({ userId: privilegedUser.id });
      expect(loginRes.status).toBe(200);
      const privilegedCookie = loginRes.headers["set-cookie"];

      // Delete package with permission
      const deleteRes = await http
        .delete(`/v1/packages/${packageId}`)
        .set("Cookie", privilegedCookie);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.message).toBe("Package deleted successfully");

      // Verify package is deleted
      const getAfterDeleteRes = await http
        .get(`/v1/packages/${packageId}`)
        .set("Cookie", authorData.cookie);
      expect(getAfterDeleteRes.status).toBe(404);
      expect(getAfterDeleteRes.body.error).toBe("Package not found");
    });

    it("should reject package deletion when user lacks permission and is not author", async () => {
      // Create author and package
      const authorData = await testUtils.createAndLoginUser("author");
      const packageData = packageUtils.createTestPackageData(authorData.user, false);

      const createRes = await http
        .post("/v1/packages")
        .send({
          content: packageData
        })
        .set("Cookie", authorData.cookie);

      const packageId = createRes.body.id;

      // Create user without DELETE_PACKAGE permission
      const unprivilegedUser = await createUserWithPermissions(userRepo, "unprivileged", []);
      // Login as this user
      const loginRes = await http.post("/v1/test/login").send({ userId: unprivilegedUser.id });
      const unprivilegedCookie = loginRes.headers["set-cookie"];

      // Attempt to delete package without permission
      const deleteRes = await http
        .delete(`/v1/packages/${packageId}`)
        .set("Cookie", unprivilegedCookie);

      expect(deleteRes.status).toBe(403);
      expect(deleteRes.body.error).toBe("You don't have permission to perform this action");

      // Verify package still exists
      const getAfterDeleteRes = await http
        .get(`/v1/packages/${packageId}`)
        .set("Cookie", authorData.cookie);
      expect(getAfterDeleteRes.status).toBe(200);
    });

    it("should reject package deletion when user is not authenticated", async () => {
      // Create package as authenticated user
      const authorData = await testUtils.createAndLoginUser("author");
      const packageData = packageUtils.createTestPackageData(authorData.user, false);

      const createRes = await http
        .post("/v1/packages")
        .send({
          content: packageData
        })
        .set("Cookie", authorData.cookie);

      const packageId = createRes.body.id;

      // Attempt to delete package without authentication
      const deleteRes = await http.delete(`/v1/packages/${packageId}`);

      expect(deleteRes.status).toBe(401);
      expect(deleteRes.body.error).toBe("Access denied");

      // Verify package still exists
      const getAfterDeleteRes = await http
        .get(`/v1/packages/${packageId}`)
        .set("Cookie", authorData.cookie);
      expect(getAfterDeleteRes.status).toBe(200);
    });

    it("should return 404 when trying to delete non-existent package", async () => {
      // Create user with DELETE_PACKAGE permission
      const deletePermission = await preparePermission(permRepo, Permissions.DELETE_PACKAGE);
      const privilegedUser = await createUserWithPermissions(userRepo, "privileged", [
        deletePermission
      ]);
      // Login as this user
      const loginRes = await http.post("/v1/test/login").send({ userId: privilegedUser.id });
      const privilegedCookie = loginRes.headers["set-cookie"];

      // Attempt to delete non-existent package
      const deleteRes = await http.delete(`/v1/packages/999999`).set("Cookie", privilegedCookie);

      expect(deleteRes.status).toBe(404);
      expect(deleteRes.body.error).toBe("Package not found");
    });

    it("should return 400 for invalid package ID", async () => {
      // Create user with DELETE_PACKAGE permission
      const deletePermission = await preparePermission(permRepo, Permissions.DELETE_PACKAGE);
      const privilegedUser = await createUserWithPermissions(userRepo, "privileged", [
        deletePermission
      ]);
      // Login as this user
      const loginRes = await http.post("/v1/test/login").send({ userId: privilegedUser.id });
      const privilegedCookie = loginRes.headers["set-cookie"];

      // Attempt to delete package with invalid ID
      const deleteRes = await http.delete(`/v1/packages/invalid`).set("Cookie", privilegedCookie);

      expect(deleteRes.status).toBe(400);
    });
  });
});
