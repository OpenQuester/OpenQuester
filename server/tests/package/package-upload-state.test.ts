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

import { PackageUploadCheckJob } from "application/jobs/PackageUploadCheckJob";
import { PackageUploadRefreshGate } from "application/services/package/PackageUploadRefreshGate";
import { PackageUploadService } from "application/services/package/PackageUploadService";
import { RedisService } from "application/services/redis/RedisService";
import { StorageQuotaService } from "application/services/storage/StorageQuotaService";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { PackageUploadStatus } from "domain/enums/package/PackageUploadStatus";
import { Permissions } from "domain/enums/Permissions";
import { type PackageDTO } from "domain/types/dto/package/PackageDTO";
import { UserCacheStore } from "infrastructure/cache/UserCacheStore";
import { File } from "infrastructure/database/models/File";
import { Package } from "infrastructure/database/models/package/Package";
import { User } from "infrastructure/database/models/User";
import { Permission } from "infrastructure/database/models/Permission";
import { S3ObjectStorage } from "infrastructure/storage/S3ObjectStorage";
import { PackageRepository } from "infrastructure/database/repositories/PackageRepository";
import { DI_TOKENS } from "shared/di/tokens";
import { type ILogger } from "shared/logging/ILogger";
import { createHttpTestClient, type HttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { PackageUtils } from "tests/utils/PackageUtils";
import { TestUtils } from "tests/utils/TestUtils";
import { deleteAll } from "tests/utils/TypeOrmTestUtils";

const md5 = (n: number) => n.toString(16).padStart(32, "b");

describe("Package upload state", () => {
  let harness: ServerTestHarness;
  let http: HttpTestClient;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let packageRepo: Repository<Package>;
  let fileRepo: Repository<File>;
  let packageUtils: PackageUtils;
  let testUtils: TestUtils;
  /** MD5s the fake storage holds. */
  let stored: Set<string>;

  beforeAll(async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });
    dataSource = harness.dataSource;
    userRepo = dataSource.getRepository(User);
    packageRepo = dataSource.getRepository(Package);
    fileRepo = dataSource.getRepository(File);
    packageUtils = new PackageUtils();
    testUtils = new TestUtils(harness.app, userRepo, harness.serverUrl);
  });

  beforeEach(() => {
    http = createHttpTestClient(harness.serverUrl);
    stored = new Set();
    jest
      .spyOn(container.resolve(S3ObjectStorage), "deleteObjects")
      .mockImplementation(async (_bucket, keys) => {
        for (const key of keys) stored.delete(key.split("/").pop()!);
        return { errors: [] };
      });
    jest
      .spyOn(container.resolve(S3ObjectStorage), "headObject")
      .mockImplementation(async (_bucket: string, key: string) => {
        const name = key.split("/").pop()!;
        return stored.has(name) ? { size: 100 } : null;
      });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await deleteAll(packageRepo);
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
    return data;
  }

  const createGame = (cookie: string, packageId: number) =>
    http.post("/v1/games").set("Cookie", cookie).send({
      title: "Upload state game",
      packageId,
      isPrivate: false,
      ageRestriction: AgeRestriction.NONE,
      maxPlayers: 5
    });

  it("keeps a package unplayable until storage holds all its files", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_state_${Date.now()}`);
    const files = [md5(1), md5(2)];
    const created = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, files) });
    expect(created.status).toBe(200);
    expect(created.body.uploadStatus).toBe("uploading");
    const id = created.body.id as number;

    const pack = await http.get(`/v1/packages/${id}`);
    expect(pack.body.uploadStatus).toBe("uploading");

    const refused = await createGame(cookie, id);
    expect(refused.status).toBe(409);
    expect(refused.body.error).toContain("2 of its 2 media files");

    // One file arrives; the state lists the other with a fresh link.
    stored.add(files[0]);
    const half = await http.get(`/v1/packages/${id}/upload`).set("Cookie", cookie);
    expect(half.status).toBe(200);
    expect(half.body).toMatchObject({
      id,
      status: "uploading",
      totalFiles: 2,
      uploadedFiles: 1,
      missing: [files[1]]
    });
    expect(Object.keys(half.body.uploadLinks)).toEqual([files[1]]);

    const head = jest.mocked(container.resolve(S3ObjectStorage).headObject);
    head.mockClear();
    const deferred = await http.get(`/v1/packages/${id}/upload`).set("Cookie", cookie);
    expect(deferred.status).toBe(429);
    expect(deferred.headers["retry-after"]).toBe("2");
    expect(head).not.toHaveBeenCalled();
  });

  it("reads the saved status until the author confirms the uploaded file", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_view_${Date.now()}`);
    const file = md5(7);
    const created = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, [file]) });
    expect(created.status).toBe(200);
    const id = created.body.id as number;
    stored.add(file);
    const head = jest.mocked(container.resolve(S3ObjectStorage).headObject);
    head.mockClear();
    const meta = await http.get(`/v1/packages/${id}`);
    expect(meta.status).toBe(200);
    expect(meta.body.uploadStatus).toBe("uploading");
    expect((await createGame(cookie, id)).status).toBe(409);
    expect(head).not.toHaveBeenCalled();

    const upload = await http.get(`/v1/packages/${id}/upload`).set("Cookie", cookie);
    expect(upload.status).toBe(200);
    expect(upload.body).toMatchObject({ status: "ready", uploadedFiles: 1, missing: [] });
    expect(head).toHaveBeenCalledTimes(1);
    expect((await createGame(cookie, id)).status).toBe(200);
    expect((await http.get(`/v1/packages/${id}`)).body.uploadStatus).toBe("ready");
    expect(head).toHaveBeenCalledTimes(1);
  });

  it("only lets the author or an editor see the upload state", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_owner_${Date.now()}`);
    const other = await testUtils.createAndLoginUser(`upload_other_${Date.now()}`);
    const file = md5(3);
    const created = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, [file]) });
    const path = `/v1/packages/${created.body.id}/upload`;
    stored.add(file);

    const head = jest.mocked(container.resolve(S3ObjectStorage).headObject);
    head.mockClear();
    await http.get(path).expect(401);
    await http.get(path).set("Cookie", other.cookie).expect(403);
    expect(head).not.toHaveBeenCalled();

    const permissions = dataSource.getRepository(Permission);
    const editPackage =
      (await permissions.findOneBy({ name: Permissions.EDIT_PACKAGE })) ??
      (await permissions.save({ name: Permissions.EDIT_PACKAGE }));
    await userRepo.save({ ...other.user, permissions: [editPackage] });
    await container.resolve(UserCacheStore).delete(other.user.id);

    const confirmed = await http.get(path).set("Cookie", other.cookie).expect(200);
    expect(confirmed.body.status).toBe("ready");
    expect(head).toHaveBeenCalledTimes(1);
  });

  it("shares upload check slots and cooldowns between independent gates", async () => {
    const redis = container.resolve(RedisService);
    const logger = container.resolve<ILogger>(DI_TOKENS.Logger);
    const first = new PackageUploadRefreshGate(redis, logger);
    const second = new PackageUploadRefreshGate(redis, logger);
    const releaseFirst = await first.acquire(1, 1);
    const releaseSecond = await second.acquire(2, 1);
    try {
      await expect(second.acquire(1, 2)).rejects.toMatchObject({ code: 429 });
      await expect(first.acquire(3, 1)).rejects.toMatchObject({ code: 503 });
    } finally {
      await releaseFirst(true);
      await releaseSecond(false);
    }
    await expect(second.acquire(1, 1)).rejects.toMatchObject({ code: 429 });
    const releaseNewVersion = await second.acquire(1, 2);
    await releaseNewVersion(false);
  });

  it("fails closed when Redis admission does not respond", async () => {
    const redis = container.resolve(RedisService);
    const gate = new PackageUploadRefreshGate(redis, container.resolve<ILogger>(DI_TOKENS.Logger));
    jest.spyOn(redis, "eval").mockImplementationOnce(() => new Promise(() => {}));
    jest.useFakeTimers();
    try {
      const denied = expect(gate.acquire(1, 1)).rejects.toMatchObject({ code: 503 });
      await jest.advanceTimersByTimeAsync(1000);
      await denied;
    } finally {
      jest.useRealTimers();
    }
  });

  it("keeps a replacement lease when the expired owner releases it", async () => {
    const redis = container.resolve(RedisService);
    const gate = container.resolve(PackageUploadRefreshGate);
    const releaseExpired = await gate.acquire(1, 1);
    const leaseKeys = await redis.scan("{package-upload-check}:*");
    expect(leaseKeys).toHaveLength(2);
    await Promise.all(leaseKeys.map((key) => redis.expire(key, 0)));

    const releaseCurrent = await gate.acquire(1, 1);
    try {
      await releaseExpired(true);
      await expect(gate.acquire(1, 1)).rejects.toMatchObject({ code: 429 });
    } finally {
      await releaseCurrent(false);
    }

    const releaseNext = await gate.acquire(1, 1);
    await releaseNext(false);
  });

  it("does not contact storage when upload check admission is unavailable", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_gate_${Date.now()}`);
    const created = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, [md5(9)]) });
    const head = jest.mocked(container.resolve(S3ObjectStorage).headObject);
    head.mockClear();
    jest.spyOn(container.resolve(RedisService), "eval").mockRejectedValueOnce(new Error("Redis unavailable"));
    const unavailable = await http.get(`/v1/packages/${created.body.id}/upload`).set("Cookie", cookie);
    expect(unavailable.status).toBe(503);
    expect(unavailable.headers["retry-after"]).toBe("2");
    expect(head).not.toHaveBeenCalled();
  });

  it("leaves timed-out files unconfirmed and stops at the current batch", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_timeout_${Date.now()}`);
    const files = [10, 11, 12, 13, 14].map(md5);
    const created = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, files) });
    expect(created.status).toBe(200);

    const check = new AbortController();
    jest.spyOn(AbortSignal, "timeout").mockReturnValueOnce(check.signal);
    const head = jest.mocked(container.resolve(S3ObjectStorage).headObject);
    head.mockClear().mockImplementation(async (_bucket, _key, signal) => {
      if (signal !== check.signal) return null;
      return new Promise((_, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        if (head.mock.calls.length === 4) check.abort();
      });
    });

    const res = await http.get(`/v1/packages/${created.body.id}/upload`).set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "uploading", uploadedFiles: 0 });
    expect(new Set(res.body.missing)).toEqual(new Set(files));
    expect(head).toHaveBeenCalledTimes(4);
    expect(head.mock.calls.every(([, , signal]) => signal === check.signal)).toBe(true);
  });

  it("limits distinct media names on both create and replacement", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_cap_${Date.now()}`);
    const created = await http.post("/v1/packages").set("Cookie", cookie)
      .send({ content: packageWith(user, []) });
    expect(created.status).toBe(200);
    const content = packageWith(user, [md5(1)]);
    const template = content.rounds[0].themes[0].questions[0];
    const file = template.questionFiles![0];
    const mediaName = (n: number) => n.toString(16).padStart(32, "0");
    const media = (offset: number) => Array.from({ length: 25 }, (_, order) => ({
      ...file,
      order,
      file: { ...file.file, md5: mediaName(offset + order + 1) }
    }));
    content.rounds[0].themes[0].questions = Array.from({ length: 20 }, (_, order) => ({
      ...template,
      order,
      questionFiles: media(order * 50),
      answerFiles: media(order * 50 + 25)
    }));
    content.logo = { file: { ...file.file, md5: mediaName(1) } };
    await expect(container.resolve(StorageQuotaService).assertPackageFits(user, content, undefined))
      .resolves.toEqual(new Map());
    content.logo.file.md5 = mediaName(1_001);
    const { author: _author, createdAt: _createdAt, ...packageInput } = content;
    const body = JSON.stringify({ content: packageInput });
    expect(Buffer.byteLength(body)).toBeLessThan(100 * 1024);
    const head = jest.mocked(container.resolve(S3ObjectStorage).headObject);
    head.mockClear();
    for (const request of [http.post("/v1/packages"), http.put(`/v1/packages/${created.body.id}`)]) {
      const refused = await request.set("Cookie", cookie).type("json").send(body);
      expect(refused.status).toBe(413);
      expect(refused.body.error).toContain("1001 distinct media files");
    }
    expect(await packageRepo.count()).toBe(1);
    expect((await packageRepo.findOneByOrFail({ id: created.body.id })).upload_status).toBe("ready");
    expect(head).not.toHaveBeenCalled();
  });

  it("is ready at once when every file is already stored", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_reuse_${Date.now()}`);
    const file = md5(4);
    const first = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, [file]) });
    stored.add(file);
    await http.get(`/v1/packages/${first.body.id}/upload`).set("Cookie", cookie);

    const second = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, [file]) });
    expect(second.body.uploadStatus).toBe("ready");
    expect((await createGame(cookie, second.body.id)).status).toBe(200);
  });

  it("filters the list by upload state and finds duplicates by source hash", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_list_${Date.now()}`);
    const hash = "c".repeat(32);
    const pending = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, [md5(5)]), sourceHash: hash });
    expect(pending.status).toBe(200);
    const ready = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageUtils.createTestPackageData(user, false, 0) });
    expect(ready.body.uploadStatus).toBe("ready");

    const list = (query: string) =>
      http
        .get(`/v1/packages?limit=50&offset=0&${query}`)
        .then((r) => r.body.data as { id: number }[]);
    const playable = (await list("uploadStatus=ready")).map((p) => p.id);
    expect(playable).toContain(ready.body.id);
    expect(playable).not.toContain(pending.body.id);

    const same = await list(`sourceHash=${hash}`);
    expect(same.map((p) => p.id)).toEqual([pending.body.id]);
    expect(same[0]).toMatchObject({ uploadStatus: "uploading" });

    // Replacing the content without a hash keeps it; null clears it.
    await http
      .put(`/v1/packages/${pending.body.id}`)
      .set("Cookie", cookie)
      .send({ content: packageWith(user, [md5(5)]) });
    expect(await list(`sourceHash=${hash}`)).toHaveLength(1);
    await http
      .put(`/v1/packages/${pending.body.id}`)
      .set("Cookie", cookie)
      .send({ content: packageWith(user, [md5(5)]), sourceHash: null });
    expect(await list(`sourceHash=${hash}`)).toHaveLength(0);
  });

  it("lets the background check mark finished uploads ready", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_job_${Date.now()}`);
    const file = md5(6);
    const created = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, [file]) });
    stored.add(file);

    const job = new PackageUploadCheckJob(
      container.resolve<ILogger>(DI_TOKENS.Logger),
      container.resolve(PackageUploadService),
      container.resolve(RedisService),
      "0 */5 * * * *"
    );
    await job.execute();

    const pack = await packageRepo.findOneByOrFail({ id: created.body.id });
    expect(pack.upload_status).toBe("ready");
    expect((await createGame(cookie, created.body.id)).status).toBe(200);
  });

  it("continues background checks from the last attempted package", async () => {
    const uploads = container.resolve(PackageUploadService);
    const list = jest.spyOn(uploads, "getUploadingSince")
      .mockResolvedValueOnce([41, 42])
      .mockResolvedValueOnce([43])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([41]);
    const refresh = jest.spyOn(uploads, "refresh").mockResolvedValue({
      status: PackageUploadStatus.UPLOADING, files: [], pending: new Set(), startedAt: null
    });
    const job = new PackageUploadCheckJob(
      container.resolve<ILogger>(DI_TOKENS.Logger), uploads,
      container.resolve(RedisService), "0 */5 * * * *"
    );
    await job.execute();
    await job.execute();
    await job.execute();
    expect(list).toHaveBeenNthCalledWith(1, expect.any(Date), 50, 0);
    expect(list).toHaveBeenNthCalledWith(2, expect.any(Date), 50, 42);
    expect(list).toHaveBeenNthCalledWith(3, expect.any(Date), 50, 43);
    expect(list).toHaveBeenNthCalledWith(4, expect.any(Date), 50, 0);
    expect(refresh.mock.calls).toEqual([[41], [42], [43], [41]]);
  });

  it("keeps an unconfirmed package unplayable during a storage outage", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_outage_${Date.now()}`);
    const created = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, [md5(80)]) });
    expect(created.status).toBe(200);
    jest
      .mocked(container.resolve(S3ObjectStorage).headObject)
      .mockRejectedValue(new Error("storage unavailable"));

    const upload = await http.get(`/v1/packages/${created.body.id}/upload`).set("Cookie", cookie);
    expect(upload.body).toMatchObject({ status: "uploading", missing: [md5(80)] });
    expect((await createGame(cookie, created.body.id)).status).toBe(409);
    expect((await packageRepo.findOneByOrFail({ id: created.body.id })).upload_status).toBe(
      "uploading"
    );
  });

  it("does not let an old refresh mark replacement media ready", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_race_${Date.now()}`);
    const oldFile = md5(81);
    const newFile = md5(82);
    const created = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, [oldFile]) });
    expect(created.status).toBe(200);
    let replaced = false;
    jest
      .mocked(container.resolve(S3ObjectStorage).headObject)
      .mockImplementation(async (_bucket, key) => {
        if (key.endsWith(oldFile) && !replaced) {
          replaced = true;
          const replacement = await http
            .put(`/v1/packages/${created.body.id}`)
            .set("Cookie", cookie)
            .send({ content: packageWith(user, [newFile]) });
          expect(replacement.status).toBe(200);
          expect(replacement.body.uploadStatus).toBe("uploading");
          return { size: 100 };
        }
        return null;
      });

    const staleCheck = await http
      .get(`/v1/packages/${created.body.id}/upload`)
      .set("Cookie", cookie);
    expect(staleCheck.status).toBe(429);
    expect(staleCheck.headers["retry-after"]).toBe("2");
    expect(replaced).toBe(true);
    expect((await packageRepo.findOneByOrFail({ id: created.body.id })).upload_status).toBe(
      "uploading"
    );
    expect((await createGame(cookie, created.body.id)).status).toBe(409);
  });

  it("does not accept a replacement made after the previous content passed validation", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_cas_${Date.now()}`);
    const oldFile = md5(83);
    const created = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, [oldFile]), sourceHash: "a".repeat(32) });
    expect(created.status).toBe(200);
    stored.add(oldFile);
    const repository = container.resolve(PackageRepository);
    const markReady = repository.markUploadReady.bind(repository);
    const newHash = "b".repeat(32);
    jest.spyOn(repository, "markUploadReady").mockImplementationOnce(async (id, startedAt) => {
      const { pack } = await repository.create(packageWith(user, [md5(84)]), user, id, newHash);
      expect(pack.upload_status).toBe(PackageUploadStatus.UPLOADING);
      return markReady(id, startedAt);
    });

    const staleCheck = await http
      .get(`/v1/packages/${created.body.id}/upload`)
      .set("Cookie", cookie);
    expect(staleCheck.status).toBe(429);
    expect(staleCheck.headers["retry-after"]).toBe("2");
    expect(await packageRepo.findOneByOrFail({ id: created.body.id })).toMatchObject({
      upload_status: "uploading",
      source_hash: newHash
    });
    expect((await createGame(cookie, created.body.id)).status).toBe(409);
  });

  it.each([false, true])(
    "saves content as unplayable before finalization can fail (replacement: %s)",
    async (replace) => {
      const { user, cookie } = await testUtils.createAndLoginUser(`upload_atomic_${Date.now()}`);
      const content = packageWith(user, []);
      let id: number | undefined;
      if (replace) {
        const created = await http.post("/v1/packages").set("Cookie", cookie).send({ content });
        expect(created.status).toBe(200);
        expect(created.body.uploadStatus).toBe("ready");
        id = created.body.id;
      }
      jest
        .spyOn(container.resolve(PackageUploadService), "markSaved")
        .mockRejectedValueOnce(new Error("finalization failed"));
      const request = replace ? http.put(`/v1/packages/${id}`) : http.post("/v1/packages");
      const result = await request
        .set("Cookie", cookie)
        .send({ content, sourceHash: "c".repeat(32) });
      expect(result.status).toBe(500);
      const saved = await packageRepo.findOneByOrFail({ source_hash: "c".repeat(32) });
      expect(saved.upload_status).toBe("uploading");
      expect(saved.upload_started_at).toBeInstanceOf(Date);
      if (replace) expect(saved.id).toBe(id);
    }
  );

  it("preserves saving a schema-valid theme with no questions", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_empty_${Date.now()}`);
    const content = packageWith(user, []);
    content.rounds[0].themes[0].questions = [];
    const saved = await http.post("/v1/packages").set("Cookie", cookie).send({ content });
    expect(saved.status).toBe(200);
    expect(saved.body.uploadStatus).toBe("ready");
  });

  it("rejects replacement media changed after the game readiness check", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_snapshot_${Date.now()}`);
    const created = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, []) });
    expect(created.body.uploadStatus).toBe("ready");
    const uploads = container.resolve(PackageUploadService);
    const assertPlayable = uploads.assertPlayable.bind(uploads);
    jest.spyOn(uploads, "assertPlayable").mockImplementationOnce(async (id) => {
      await assertPlayable(id);
      const replaced = await http
        .put(`/v1/packages/${id}`)
        .set("Cookie", cookie)
        .send({ content: packageWith(user, [md5(85)]) });
      expect(replaced.status).toBe(200);
      expect(replaced.body.uploadStatus).toBe("uploading");
    });
    const game = await createGame(cookie, created.body.id);
    expect(game.status).toBe(409);
  });
});
