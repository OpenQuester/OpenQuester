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
import { type DataSource, type Repository } from "typeorm";

import { GuestCleanupJob } from "application/jobs/GuestCleanupJob";
import { StorageCleanupService } from "application/services/storage/StorageCleanupService";
import { type PackageDTO } from "domain/types/dto/package/PackageDTO";
import { FileSource } from "domain/enums/file/FileSource";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { StorageGroup } from "domain/types/storage/StorageTypes";
import { File } from "infrastructure/database/models/File";
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

  it("asks for an account before handing out a file upload link", async () => {
    const res = await http.post(`/v1/files/${md5(10)}`);
    expect(res.status).toBe(401);
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
