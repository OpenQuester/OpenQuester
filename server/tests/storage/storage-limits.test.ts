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
import { container } from "tsyringe";
import { In, type DataSource, type Repository } from "typeorm";

import { GuestCleanupJob } from "application/jobs/GuestCleanupJob";
import { StorageCleanupService } from "application/services/storage/StorageCleanupService";
import { PackageStore } from "infrastructure/database/repositories/PackageStore";
import { RedisRepository } from "infrastructure/database/repositories/RedisRepository";
import { PackageUploadStatus } from "domain/enums/package/PackageUploadStatus";
import { type PackageDTO } from "domain/types/dto/package/PackageDTO";
import { FileSource } from "domain/enums/file/FileSource";
import { Permissions } from "domain/enums/Permissions";
import { PackageFileType } from "domain/enums/package/PackageFileType";
import { PackageQuestionType } from "domain/enums/package/QuestionType";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { StorageGroup } from "domain/types/storage/StorageTypes";
import { File } from "infrastructure/database/models/File";
import { Permission } from "infrastructure/database/models/Permission";
import { StorageRepository } from "infrastructure/database/repositories/StorageRepository";
import { Package } from "infrastructure/database/models/package/Package";
import { StorageLimit } from "infrastructure/database/models/StorageLimit";
import { User } from "infrastructure/database/models/User";
import { FileUsage } from "infrastructure/database/models/FileUsage";
import { GameStatistics } from "infrastructure/database/models/statistics/GameStatistics";
import { PlayerGameStats } from "infrastructure/database/models/statistics/PlayerGameStats";
import { DI_TOKENS } from "shared/di/tokens";
import { Environment } from "shared/config/Environment";
import { type ILogger } from "shared/logging/ILogger";
import { S3ObjectStorage } from "infrastructure/storage/S3ObjectStorage";
import { createHttpTestClient, type HttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { PackageUtils, TEST_MEDIA_FILE_MD5 } from "tests/utils/PackageUtils";
import { TestUtils } from "tests/utils/TestUtils";
import { deleteAll } from "tests/utils/TypeOrmTestUtils";

const md5 = (n: number) => n.toString(16).padStart(32, "a");

describe("Storage limits", () => {
  let harness: ServerTestHarness;
  let http: HttpTestClient;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let packageRepo: Repository<Package>;
  let limitRepo: Repository<StorageLimit>;
  let fileRepo: Repository<File>;
  let packageUtils: PackageUtils;
  let testUtils: TestUtils;

  beforeAll(async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });
    dataSource = harness.dataSource;
    userRepo = dataSource.getRepository(User);
    packageRepo = dataSource.getRepository(Package);
    limitRepo = dataSource.getRepository(StorageLimit);
    fileRepo = dataSource.getRepository(File);
    packageUtils = new PackageUtils();
    testUtils = new TestUtils(harness.app, userRepo, harness.serverUrl);
  });

  beforeEach(async () => {
    http = createHttpTestClient(harness.serverUrl);
    await limitRepo.save(
      limitRepo.create({
        group: StorageGroup.USER,
        user_quota_bytes: 10_000,
        package_bytes: 5_000,
        image_bytes: 3_000,
        audio_bytes: 3_000,
        video_bytes: 3_000
      })
    );
  });

  afterEach(async () => {
    await deleteAll(dataSource.getRepository(PlayerGameStats));
    await deleteAll(dataSource.getRepository(GameStatistics));
    await deleteAll(packageRepo);
    await userRepo.createQueryBuilder().update().set({ avatar: null }).execute();
    await deleteAll(fileRepo);
    await deleteAll(userRepo);
    await harness.resetState();
  });

  afterAll(async () => {
    await harness?.stop();
  });

  /** The test package with its one picture swapped for these files. */
  function packageWith(author: User, files: string[]): PackageDTO {
    const data = packageUtils.createTestPackageData(author, false, 0, true);
    const question = data.rounds[0].themes[0].questions[0];
    const template = question.questionFiles![0];
    question.questionFiles = files.map((m, i) => ({
      ...template,
      order: i,
      file: { ...template.file, md5: m }
    }));
    // Nothing else in the package references the shared test picture.
    expect(JSON.stringify(data)).not.toContain(TEST_MEDIA_FILE_MD5);
    return data;
  }

  const upload = (cookie: string, content: PackageDTO, fileSizes: Record<string, number>) =>
    http.post("/v1/packages").send({ content, fileSizes }).set("Cookie", cookie);

  it("reports usage and the group's limits", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`storage_me_${Date.now()}`);
    const res = await upload(cookie, packageWith(user, [md5(1)]), { [md5(1)]: 1_000 });
    expect(res.status).toBe(200);

    const me = await http.get("/v1/me/storage").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      group: "user",
      usedBytes: 1_000,
      quotaBytes: 10_000,
      quotaOverridden: false,
      limits: { packageBytes: 5_000, imageBytes: 3_000 }
    });
  });

  it("refuses a file over its type's limit and a package over the package limit", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`storage_file_${Date.now()}`);
    const big = await upload(cookie, packageWith(user, [md5(2)]), { [md5(2)]: 3_001 });
    expect(big.status).toBe(413);
    expect(big.body.error).toContain("the limit for one image file is");

    const files = [md5(3), md5(4)];
    const heavy = await upload(cookie, packageWith(user, files), {
      [files[0]]: 2_900,
      [files[1]]: 2_900
    });
    expect(heavy.status).toBe(413);
    expect(heavy.body.error).toContain("the limit for one package is");
    expect(await packageRepo.count()).toBe(0);
  });

  it("counts a file once per user, and a per-user quota overrides the group's", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`storage_quota_${Date.now()}`);
    await dataSource.query(`UPDATE "user" SET "storage_quota_bytes" = 3500 WHERE "id" = $1`, [
      user.id
    ]);

    expect((await upload(cookie, packageWith(user, [md5(5)]), { [md5(5)]: 2_000 })).status).toBe(
      200
    );
    // The same picture in a second package costs nothing more.
    expect((await upload(cookie, packageWith(user, [md5(5)]), { [md5(5)]: 2_000 })).status).toBe(
      200
    );
    // A new one would bring the total to 4 000 bytes.
    const over = await upload(cookie, packageWith(user, [md5(6)]), { [md5(6)]: 2_000 });
    expect(over.status).toBe(413);
    expect(over.body.error).toContain("your limit is");

    // Someone else uploading the same picture is charged for it too.
    const other = await testUtils.createAndLoginUser(`storage_other_${Date.now()}`);
    expect(
      (await upload(other.cookie, packageWith(other.user, [md5(5)]), { [md5(5)]: 2_000 })).status
    ).toBe(200);
    const mine = await http.get("/v1/me/storage").set("Cookie", other.cookie);
    expect(mine.body.usedBytes).toBe(2_000);
  });

  it.each([
    { reference: "avatar only", status: 200, usage: 2_000 },
    { reference: "old avatar in own package", status: 413, usage: 2_500 },
    { reference: "new avatar in own package", status: 200, usage: 2_000 },
    { reference: "old avatar in another user's package", status: 200, usage: 2_000 }
  ])("checks final avatar replacement usage: $reference", async ({ reference, status, usage }) => {
    const { user, cookie } = await testUtils.createAndLoginUser(`avatar_quota_${Date.now()}`);
    const oldFilename = md5(201);
    const newFilename = md5(202);
    const sizes = new Map([
      [oldFilename, 2_500],
      [newFilename, 2_000]
    ]);
    await fileRepo.save(
      [...sizes].map(([filename, size]) =>
        fileRepo.create({
          filename,
          size,
          path: "",
          source: FileSource.S3,
          created_at: new Date(),
          size_verified_at: new Date()
        })
      )
    );
    const storage = container.resolve(S3ObjectStorage);
    const head = jest.spyOn(storage, "headObject").mockImplementation(async (_bucket, key) => {
      const size = sizes.get(key.split("/").pop()!);
      return size === undefined ? null : { size };
    });
    const remove = jest.spyOn(storage, "deleteObjects").mockResolvedValue({ errors: [] });
    try {
      const first = await http.patch("/v1/me").set("Cookie", cookie).send({ avatar: oldFilename });
      expect(first.status).toBe(200);
      if (reference !== "avatar only") {
        const owner = reference.includes("another user")
          ? await testUtils.createAndLoginUser(`avatar_other_${Date.now()}`)
          : { user, cookie };
        const filename = reference.startsWith("new") ? newFilename : oldFilename;
        expect((await upload(owner.cookie, packageWith(owner.user, [filename]), {})).status).toBe(
          200
        );
      }
      await limitRepo.update({ group: StorageGroup.USER }, { user_quota_bytes: 3_000 });
      const replaced = await http
        .patch("/v1/me")
        .set("Cookie", cookie)
        .send({ avatar: newFilename });
      expect(replaced.status).toBe(status);
      if (status === 413) expect(replaced.body.error).toContain("your limit is");
      const saved = await userRepo.findOneOrFail({
        where: { id: user.id },
        relations: { avatar: true }
      });
      expect(saved.avatar?.filename).toBe(status === 200 ? newFilename : oldFilename);
      const me = await http.get("/v1/me/storage").set("Cookie", cookie);
      expect(me.status).toBe(200);
      expect(me.body.usedBytes).toBe(usage);
    } finally {
      head.mockRestore();
      remove.mockRestore();
    }
  });

  it("uses newly verified sizes for the current upload's file limit", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`storage_verified_${Date.now()}`);
    const filename = md5(11);
    const content = packageWith(user, [filename]);
    expect((await upload(cookie, content, { [filename]: 1_000 })).status).toBe(200);

    const headObject = jest
      .spyOn(container.resolve(S3ObjectStorage), "headObject")
      .mockResolvedValue({ size: 4_000 });
    try {
      const rejected = await upload(cookie, content, { [filename]: 1_000 });
      expect(rejected.status).toBe(413);
      expect(rejected.body.error).toContain("the limit for one image file is");
      expect(await packageRepo.count()).toBe(1);
      const measuredFile = await fileRepo.findOneByOrFail({ filename });
      expect(measuredFile.size).toBe(4_000);
      expect(measuredFile.size_verified_at).not.toBeNull();
    } finally {
      headObject.mockRestore();
    }
  });

  it.each([
    { kind: "omitted file", sizes: [4_000], status: 413, message: "one image file" },
    { kind: "underdeclared file", sizes: [4_000], status: 413, message: "one image file" },
    { kind: "choice image", sizes: [4_000], status: 413, message: "one image file" },
    { kind: "shared media", sizes: [4_000], status: 413, message: "one image file" },
    { kind: "package", sizes: [2_000, 2_000, 2_000], status: 413, message: "one package" },
    { kind: "user", sizes: [2_500, 2_500], status: 413, message: "your limit" },
    { kind: "bucket", sizes: [2_500, 2_500], status: 507, message: "Storage is full" }
  ])(
    "rejects the measured $kind quota before accepting an uploaded package",
    async ({ kind, sizes, status, message }) => {
      const { user, cookie } = await testUtils.createAndLoginUser(`measured_${Date.now()}`);
      if (kind === "user") {
        await limitRepo.update({ group: StorageGroup.USER }, { user_quota_bytes: 4_000 });
      }
      if (kind === "shared media") {
        await limitRepo.update({ group: StorageGroup.USER }, { video_bytes: 10_000 });
      }
      const environment = Environment.getInstance(container.resolve<ILogger>(DI_TOKENS.Logger));
      const previousBucketQuota = environment.S3_BUCKET_QUOTA_BYTES;
      if (kind === "bucket") environment.S3_BUCKET_QUOTA_BYTES = 5_000;
      const filenames = sizes.map((_, index) => md5(100 + index));
      const actualSizes = new Map(filenames.map((filename, index) => [filename, sizes[index]]));
      const head = jest
        .spyOn(container.resolve(S3ObjectStorage), "headObject")
        .mockImplementation(async (_bucket, key) => {
          const size = actualSizes.get(key.split("/").pop()!);
          return size === undefined ? null : { size };
        });
      try {
        const content = packageWith(user, filenames);
        if (kind === "shared media") {
          content.logo = { file: { md5: filenames[0], type: PackageFileType.IMAGE } };
          content.rounds[0].themes[0].questions[0].questionFiles![0].file.type =
            PackageFileType.VIDEO;
        }
        if (kind === "choice image") {
          const question = content.rounds[0].themes[0].questions[0];
          question.questionFiles = [];
          question.type = PackageQuestionType.CHOICE;
          question.showDelay = 1;
          question.answers = [
            { order: 0, file: { md5: filenames[0], type: PackageFileType.IMAGE }, text: "Image" },
            { order: 1, file: null, text: "Text" }
          ];
        }
        const created = await http
          .post("/v1/packages")
          .set("Cookie", cookie)
          .send({
            content,
            ...(kind === "omitted file"
              ? {}
              : { fileSizes: Object.fromEntries(filenames.map((filename) => [filename, 1])) })
          });
        expect(created.status).toBe(200);
        expect(created.body.uploadStatus).toBe("uploading");

        const finalized = await http
          .get(`/v1/packages/${created.body.id}/upload`)
          .set("Cookie", cookie);
        expect(finalized.status).toBe(status);
        expect(finalized.body.error).toContain(message);
        expect((await packageRepo.findOneByOrFail({ id: created.body.id })).upload_status).toBe(
          "uploading"
        );
        const game = await http.post("/v1/games").set("Cookie", cookie).send({
          title: "Measured quota game",
          packageId: created.body.id,
          isPrivate: false,
          ageRestriction: AgeRestriction.NONE,
          maxPlayers: 5
        });
        expect(game.status).toBe(status);
      } finally {
        head.mockRestore();
        environment.S3_BUCKET_QUOTA_BYTES = previousBucketQuota;
      }
    }
  );

  it("preserves distinct storage accounting, verification and admin usage across duplicate rows", async () => {
    const owner = await testUtils.createAndLoginUser(`storage_rows_owner_${Date.now()}`);
    const other = await testUtils.createAndLoginUser(`storage_rows_other_${Date.now()}`);
    const filename = md5(15);
    const ownerUpload = await upload(owner.cookie, packageWith(owner.user, [filename]), {
      [filename]: 1_000
    });
    expect(ownerUpload.status).toBe(200);
    expect(
      (await upload(other.cookie, packageWith(other.user, [filename]), { [filename]: 1_000 }))
        .status
    ).toBe(200);

    const original = await fileRepo.findOneByOrFail({ filename });
    const confirmed = await fileRepo.save(
      fileRepo.create({
        filename,
        path: original.path,
        source: original.source,
        created_at: new Date(),
        size: 1_500,
        size_verified_at: new Date()
      })
    );
    const repository = container.resolve(StorageRepository);
    expect((await repository.getSizes([filename])).get(filename)).toBe(1_500);
    expect(await repository.getUserFiles(owner.user.id)).toEqual([{ filename, size: 1_500 }]);
    expect(await repository.getUserFiles(owner.user.id, ownerUpload.body.id)).toEqual([]);
    expect(await repository.getPackageFileStates(ownerUpload.body.id)).toEqual([
      { filename, path: original.path, verified: true }
    ]);

    await repository.setDeclaredSizes(new Map([[filename, 2_000]]));
    expect((await fileRepo.findOneByOrFail({ id: confirmed.id })).size).toBe(1_500);
    expect(await repository.getUnverifiedFilenames(50, owner.user.id)).toContain(filename);
    await repository.setVerifiedSizes(new Map([[filename, 3_000]]));
    expect(
      (await fileRepo.findBy({ filename })).every(
        (file) => file.size === 3_000 && file.size_verified_at !== null
      )
    ).toBe(true);
    expect(await repository.getUnverifiedFilenames(50, owner.user.id)).toEqual([]);

    const permissionRepository = dataSource.getRepository(Permission);
    const permissions: Permission[] = [];
    for (const name of [Permissions.ADMIN_PANEL_ACCESS, Permissions.MANAGE_STORAGE]) {
      permissions.push(
        (await permissionRepository.findOneBy({ name })) ??
          (await permissionRepository.save(permissionRepository.create({ name })))
      );
    }
    await userRepo.save({ ...owner.user, permissions });
    await repository.setUserQuota(owner.user.id, 2_500);
    expect(await repository.getUserQuota(owner.user.id)).toBe(2_500);
    expect(await repository.getUserFacts(owner.user.id)).toMatchObject({
      is_guest: false,
      permissions: expect.arrayContaining(
        permissions.map((permission) => ({ name: permission.name }))
      )
    });
    const admin = await userRepo.save(
      userRepo.create({
        username: `storage_rows_admin_${Date.now()}`,
        is_guest: false,
        is_deleted: false,
        permissions
      })
    );
    const login = await http.post("/v1/test/login").send({ userId: admin.id });
    expect(login.status).toBe(200);
    const overview = await http
      .get("/v1/admin/api/storage")
      .set("Cookie", login.headers["set-cookie"]);
    expect(overview.status).toBe(200);
    expect(overview.body.bucket).toMatchObject({ usedBytes: 3_000, fileCount: 1 });
    expect(overview.body.topUsers).toHaveLength(2);
    expect(overview.body.topUsers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: owner.user.id,
          usedBytes: 3_000,
          quotaBytes: 2_500,
          quotaOverridden: true
        }),
        expect.objectContaining({
          id: other.user.id,
          usedBytes: 3_000,
          quotaBytes: 10_000,
          quotaOverridden: false
        })
      ])
    );
  });

  it("protects every legacy direct file reference across duplicate rows during cleanup", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`storage_references_${Date.now()}`);
    const [
      logoFilename,
      questionFilename,
      answerFilename,
      choiceFilename,
      avatarFilename,
      unusedFilename,
      futureFilename
    ] = [20, 21, 22, 23, 24, 25, 26].map(md5);
    const content = packageWith(user, [questionFilename]);
    const question = content.rounds[0].themes[0].questions[0];
    const questionFile = question.questionFiles![0];
    content.logo = { file: { md5: logoFilename, type: PackageFileType.IMAGE } };
    question.answerFiles = [
      { ...questionFile, file: { md5: answerFilename, type: PackageFileType.IMAGE } }
    ];
    question.type = PackageQuestionType.CHOICE;
    question.showDelay = 1;
    question.answers = [
      { order: 0, file: { md5: choiceFilename, type: PackageFileType.IMAGE }, text: "Picture" },
      { order: 1, file: null, text: "Text" }
    ];
    const packageFilenames = [logoFilename, questionFilename, answerFilename, choiceFilename];
    const created = await upload(
      cookie,
      content,
      Object.fromEntries(packageFilenames.map((filename) => [filename, 100]))
    );
    expect(created.status).toBe(200);
    await dataSource.getRepository(FileUsage).delete({ package: { id: created.body.id } });

    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const avatar = await fileRepo.save(
      fileRepo.create({
        filename: avatarFilename,
        path: "",
        source: FileSource.S3,
        created_at: old,
        size: 100
      })
    );
    await userRepo.update(user.id, { avatar });
    const protectedFilenames = [...packageFilenames, avatarFilename];
    const originals = await fileRepo.findBy({ filename: In(protectedFilenames) });
    await fileRepo.save(
      originals.map((file) =>
        fileRepo.create({
          filename: file.filename,
          path: file.path,
          source: file.source,
          created_at: old,
          size: 100
        })
      )
    );
    await fileRepo.save(
      [1, 2].map(() =>
        fileRepo.create({
          filename: unusedFilename,
          path: "",
          source: FileSource.S3,
          created_at: old,
          size: 100
        })
      )
    );

    await fileRepo.save(
      fileRepo.create({
        filename: futureFilename,
        path: "",
        source: FileSource.S3,
        created_at: new Date(Date.now() + 120_000),
        size: 100
      })
    );

    const repository = container.resolve(StorageRepository);
    const candidates = [...protectedFilenames, unusedFilename, futureFilename];
    expect(await repository.filterUnused(candidates)).toEqual([unusedFilename]);
    expect(await repository.getUnusedFilenames(new Date())).toEqual([unusedFilename]);
    const deleteObjects = jest
      .spyOn(container.resolve(S3ObjectStorage), "deleteObjects")
      .mockResolvedValue({ errors: [] });
    try {
      expect(await container.resolve(StorageCleanupService).removeIfUnused(candidates)).toEqual([
        unusedFilename
      ]);
      expect(await fileRepo.countBy({ filename: unusedFilename })).toBe(0);
      expect(await fileRepo.countBy({ filename: futureFilename })).toBe(1);
      for (const filename of protectedFilenames) {
        expect(await fileRepo.countBy({ filename })).toBeGreaterThanOrEqual(2);
      }
    } finally {
      deleteObjects.mockRestore();
    }
  });

  it("keeps a file that a package started using after it was found unused", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`storage_race_${Date.now()}`);
    const filename = md5(41);
    expect((await upload(cookie, packageWith(user, [filename]), { [filename]: 100 })).status).toBe(
      200
    );

    // The unused check ran before the package above saved its use of the file
    const repository = container.resolve(StorageRepository);
    const filterUnused = jest.spyOn(repository, "filterUnused").mockResolvedValue([filename]);
    const deleteObjects = jest
      .spyOn(container.resolve(S3ObjectStorage), "deleteObjects")
      .mockResolvedValue({ errors: [] });
    try {
      expect(await container.resolve(StorageCleanupService).removeIfUnused([filename])).toEqual([]);
      expect(await fileRepo.countBy({ filename })).toBeGreaterThanOrEqual(1);
      expect(deleteObjects).not.toHaveBeenCalled();
    } finally {
      filterUnused.mockRestore();
      deleteObjects.mockRestore();
    }
  });

  it("deletes media an edit drops, but keeps media another package still uses", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`storage_edit_${Date.now()}`);
    const first = await upload(cookie, packageWith(user, [md5(7), md5(8)]), {
      [md5(7)]: 100,
      [md5(8)]: 100
    });
    expect(first.status).toBe(200);
    expect((await upload(cookie, packageWith(user, [md5(8)]), { [md5(8)]: 100 })).status).toBe(200);

    const edit = await http
      .put(`/v1/packages/${first.body.id}`)
      .send({ content: packageWith(user, [md5(9)]), fileSizes: { [md5(9)]: 100 } })
      .set("Cookie", cookie);
    expect(edit.status).toBe(200);

    expect(await fileRepo.count({ where: { filename: md5(7) } })).toBe(0);
    expect(await fileRepo.count({ where: { filename: md5(8) } })).toBeGreaterThan(0);
    expect(await fileRepo.count({ where: { filename: md5(9) } })).toBeGreaterThan(0);
    const me = await http.get("/v1/me/storage").set("Cookie", cookie);
    expect(me.body.usedBytes).toBe(200);
  });

  it.each([
    { legacy: false, action: "edit" },
    { legacy: true, action: "edit" },
    { legacy: false, action: "delete" },
    { legacy: true, action: "delete" }
  ])(
    "keeps active game media after package $action (legacy=$legacy)",
    async ({ legacy, action }) => {
      const { user, cookie } = await testUtils.createAndLoginUser(`storage_game_${Date.now()}`);
      const content = packageWith(user, [md5(17)]);
      const first = content.rounds[0].themes[0].questions[0];
      const file = first.questionFiles![0].file;
      content.logo = { file: { ...file, md5: md5(18) } };
      first.answerFiles = [{ order: 0, displayTime: 1000, file: { ...file, md5: md5(19) } }];
      const choice = content.rounds[0].themes
        .flatMap(({ questions }) => questions)
        .find((question) => question.type === PackageQuestionType.CHOICE)!;
      choice.answers![0].file = { ...file, md5: md5(20) };
      const filenames = [17, 18, 19, 20].map(md5);
      const created = await upload(
        cookie,
        content,
        Object.fromEntries(filenames.map((name) => [name, 100]))
      );
      expect(created.status).toBe(200);

      // Seed the immutable snapshot of an already-created game with persisted IDs.
      const loaded = await http.get(`/v1/packages/${created.body.id}`).set("Cookie", cookie);
      expect(loaded.status).toBe(200);
      const packageStore = container.resolve(PackageStore);
      for (const gameId of ["EDIT", "SECOND"]) {
        await packageStore.storePackage(gameId, {
          ...loaded.body,
          uploadStatus: PackageUploadStatus.READY
        });
        if (legacy) {
          await container
            .resolve(RedisRepository)
            .pipeline()
            .hdel(packageStore.getPackageKey(gameId), "files")
            .exec();
        }
      }
      const deleteObjects = jest
        .spyOn(container.resolve(S3ObjectStorage), "deleteObjects")
        .mockResolvedValue({ errors: [] });
      try {
        const changed =
          action === "delete"
            ? await http.delete(`/v1/packages/${created.body.id}`).set("Cookie", cookie)
            : await http
                .put(`/v1/packages/${created.body.id}`)
                .send({ content: packageWith(user, [md5(21)]), fileSizes: { [md5(21)]: 100 } })
                .set("Cookie", cookie);
        expect(changed.status).toBe(200);
        for (const filename of filenames) {
          expect(await fileRepo.countBy({ filename })).toBeGreaterThan(0);
        }
        expect(deleteObjects).not.toHaveBeenCalled();

        // Once the last game snapshot is gone, deferred cleanup can delete every kind of media.
        await packageStore.deletePackage("EDIT");
        expect(await container.resolve(StorageCleanupService).removeIfUnused(filenames)).toEqual(
          []
        );
        expect(deleteObjects).not.toHaveBeenCalled();
        await packageStore.deletePackage("SECOND");
        expect(await container.resolve(StorageCleanupService).removeIfUnused(filenames)).toEqual(
          expect.arrayContaining(filenames)
        );
        for (const filename of filenames) expect(await fileRepo.countBy({ filename })).toBe(0);
        expect(deleteObjects).toHaveBeenCalledTimes(1);
      } finally {
        deleteObjects.mockRestore();
      }
    }
  );

  it("deleting a package drops only its ownership and retains shared files and legacy avatars", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`delete_shared_${Date.now()}`);
    const unique = md5(31),
      shared = md5(32),
      avatar = md5(33);
    const first = await upload(cookie, packageWith(user, [unique, shared, avatar]), {
      [unique]: 100,
      [shared]: 100,
      [avatar]: 100
    });
    const second = await upload(cookie, packageWith(user, [shared]), { [shared]: 100 });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const viewer = await testUtils.createAndLoginUser(`avatar_shared_${Date.now()}`);
    const avatarFile = await fileRepo.findOneByOrFail({ filename: avatar });
    await userRepo.update(viewer.user.id, { avatar: { id: avatarFile.id } });
    const deleteObjects = jest
      .spyOn(container.resolve(S3ObjectStorage), "deleteObjects")
      .mockResolvedValue({ errors: [] });
    try {
      expect(
        (await http.delete(`/v1/packages/${first.body.id}`).set("Cookie", cookie)).status
      ).toBe(200);
      expect(await fileRepo.countBy({ filename: unique })).toBe(0);
      expect(await fileRepo.countBy({ filename: shared })).toBeGreaterThan(0);
      expect(await fileRepo.countBy({ filename: avatar })).toBeGreaterThan(0);
      expect((await http.get("/v1/me/storage").set("Cookie", cookie)).body.usedBytes).toBe(100);
      expect(
        (await http.delete(`/v1/packages/${second.body.id}`).set("Cookie", cookie)).status
      ).toBe(200);
      expect(await fileRepo.countBy({ filename: shared })).toBe(0);
      expect(await fileRepo.countBy({ filename: avatar })).toBeGreaterThan(0);
      expect((await http.get("/v1/me/storage").set("Cookie", cookie)).body.usedBytes).toBe(0);
    } finally {
      deleteObjects.mockRestore();
    }
  });

  it("asks for an account before handing out a file upload link", async () => {
    const res = await http.post(`/v1/files/${md5(10)}`);
    expect(res.status).toBe(401);
  });

  it("records first and stale activity without changing profile timestamps", async () => {
    const now = Date.now();
    const originalUpdatedAt = new Date(now - 48 * 60 * 60 * 1000);
    const recentSeen = new Date(now - 10 * 60 * 1000);
    const staleSeen = new Date(now - 2 * 60 * 60 * 1000);
    const users = await userRepo.save(
      [null, recentSeen, staleSeen].map((lastSeen, index) =>
        userRepo.create({
          username: `activity_${index}_${now}`,
          is_guest: true,
          is_deleted: false,
          last_seen_at: lastSeen
        })
      )
    );
    await userRepo.update(
      { id: In(users.map((user) => user.id)) },
      { updated_at: originalUpdatedAt }
    );

    const repository = container.resolve(StorageRepository);
    const startedAt = Date.now();
    for (const user of users) {
      await repository.touchLastSeen(user.id);
    }
    const finishedAt = Date.now();

    const [first, recent, stale] = await Promise.all(
      users.map((user) => userRepo.findOneByOrFail({ id: user.id }))
    );
    for (const user of [first, recent, stale]) {
      expect(user.updated_at.getTime()).toBe(originalUpdatedAt.getTime());
    }
    expect(recent.last_seen_at?.getTime()).toBe(recentSeen.getTime());
    for (const user of [first, stale]) {
      expect(user.last_seen_at!.getTime()).toBeGreaterThanOrEqual(startedAt);
      expect(user.last_seen_at!.getTime()).toBeLessThanOrEqual(finishedAt);
    }
  });

  it("removes guests nobody has used for a while", async () => {
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const [stale, recent] = await userRepo.save([
      userRepo.create({ username: `guest_old_${Date.now()}`, is_guest: true, is_deleted: false }),
      userRepo.create({ username: `guest_new_${Date.now()}`, is_guest: true, is_deleted: false })
    ]);
    await dataSource.query(`UPDATE "user" SET "last_seen_at" = $2 WHERE "id" = $1`, [
      stale.id,
      old
    ]);
    await dataSource.query(`UPDATE "user" SET "last_seen_at" = now() WHERE "id" = $1`, [recent.id]);

    const job = new GuestCleanupJob(
      container.resolve<ILogger>(DI_TOKENS.Logger),
      container.resolve(StorageCleanupService),
      30,
      "0 4 * * *"
    );
    await job.execute();

    expect(await userRepo.findOne({ where: { id: stale.id } })).toBeNull();
    expect(await userRepo.findOne({ where: { id: recent.id } })).not.toBeNull();
  });

  it("cleans multiple guest batches without losing scores, game history or package attribution", async () => {
    const staleSince = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const guests = await userRepo.save(
      Array.from({ length: 501 }, (_, index) =>
        userRepo.create({
          username: `cleanup_guest_${index}`,
          is_guest: true,
          is_deleted: false,
          last_seen_at: staleSince
        })
      )
    );
    const [host, player, author, avatarOwner, deletedGuest] = guests;
    await userRepo.update({ id: In([host.id, player.id, author.id]) }, { updated_at: staleSince });
    const recentGuest = await userRepo.save(
      userRepo.create({
        username: "cleanup_recent",
        is_guest: true,
        is_deleted: false,
        last_seen_at: now
      })
    );
    const registeredUser = await userRepo.save(
      userRepo.create({
        username: "cleanup_registered",
        is_guest: false,
        is_deleted: false,
        last_seen_at: staleSince
      })
    );

    const gameRepository = dataSource.getRepository(GameStatistics);
    const game = await gameRepository.save(
      gameRepository.create({
        game_id: "guest-history",
        started_at: staleSince,
        finished_at: now,
        created_by: host.id,
        duration: 120
      })
    );
    const playerStatsRepository = dataSource.getRepository(PlayerGameStats);
    const score = await playerStatsRepository.save(
      playerStatsRepository.create({
        game_stats_id: game.id,
        user_id: player.id,
        final_score: 900,
        placement: 1,
        joined_at: staleSince,
        questions_answered: 3,
        correct_answers: 3,
        wrong_answers: 0
      })
    );
    const authoredPackage = await packageRepo.save(
      packageRepo.create({
        title: "Retained guest attribution",
        author,
        created_at: now,
        age_restriction: AgeRestriction.NONE
      })
    );

    const sharedAvatar = await fileRepo.save(
      fileRepo.create({
        filename: md5(900),
        path: "",
        source: FileSource.S3,
        created_at: staleSince
      })
    );
    const unusedAvatar = await fileRepo.save(
      fileRepo.create({
        filename: md5(901),
        path: "",
        source: FileSource.S3,
        created_at: staleSince
      })
    );
    await userRepo.update(avatarOwner.id, { avatar: sharedAvatar });
    await userRepo.update(deletedGuest.id, { avatar: unusedAvatar });
    await packageRepo.update(authoredPackage.id, { logo: sharedAvatar });
    const fileUsageRepository = dataSource.getRepository(FileUsage);
    await fileUsageRepository.save([
      fileUsageRepository.create({ file: sharedAvatar, user: avatarOwner }),
      fileUsageRepository.create({ file: unusedAvatar, user: deletedGuest })
    ]);

    const job = new GuestCleanupJob(
      container.resolve<ILogger>(DI_TOKENS.Logger),
      container.resolve(StorageCleanupService),
      30,
      "0 4 * * *"
    );
    await job.execute();

    const remaining = await userRepo.find({ order: { id: "ASC" } });
    expect(remaining.map((user) => user.id)).toEqual([
      host.id,
      player.id,
      author.id,
      recentGuest.id,
      registeredUser.id
    ]);
    expect(remaining.filter((user) => user.is_deleted).map((user) => user.id)).toEqual([
      host.id,
      player.id,
      author.id
    ]);
    for (const user of remaining.filter((user) => user.is_deleted)) {
      expect(user.updated_at.getTime()).toBe(staleSince.getTime());
    }
    expect(await gameRepository.findOneByOrFail({ id: game.id })).toMatchObject({
      created_by: host.id
    });
    expect(await playerStatsRepository.findOneByOrFail({ id: score.id })).toMatchObject({
      user_id: player.id,
      final_score: 900,
      placement: 1,
      correct_answers: 3
    });
    expect(
      await packageRepo.findOneOrFail({ where: { id: authoredPackage.id }, relations: ["author"] })
    ).toMatchObject({ author: { id: author.id } });
    expect(await fileRepo.findOneBy({ id: sharedAvatar.id })).not.toBeNull();
    expect(await fileRepo.findOneBy({ id: unusedAvatar.id })).toBeNull();
    expect(await fileUsageRepository.count()).toBe(0);

    // Repeated scheduled runs leave retained records and their references intact.
    await job.execute();
    expect(await userRepo.count()).toBe(5);
    expect(await playerStatsRepository.count()).toBe(1);
  });
});
