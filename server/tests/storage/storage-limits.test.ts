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

  it("keeps media an edit drops while a running game still shows it", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`storage_game_${Date.now()}`);
    const content = packageWith(user, [md5(17)]);
    const created = await upload(cookie, content, { [md5(17)]: 100 });
    expect(created.status).toBe(200);

    // A game made before the edit plays from its own copy of the package
    const packageStore = container.resolve(PackageStore);
    await packageStore.storePackage("EDIT", { ...content, id: created.body.id, tags: [] });

    const edit = await http
      .put(`/v1/packages/${created.body.id}`)
      .send({ content: packageWith(user, [md5(18)]), fileSizes: { [md5(18)]: 100 } })
      .set("Cookie", cookie);
    expect(edit.status).toBe(200);
    expect(await fileRepo.count({ where: { filename: md5(17) } })).toBeGreaterThan(0);

    // Once the game is gone, the next cleanup deletes it
    await packageStore.deletePackage("EDIT");
    await container.resolve(StorageCleanupService).removeIfUnused([md5(17)]);
    expect(await fileRepo.count({ where: { filename: md5(17) } })).toBe(0);
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
