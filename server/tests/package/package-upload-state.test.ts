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
import { PackageUploadService } from "application/services/package/PackageUploadService";
import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { type PackageDTO } from "domain/types/dto/package/PackageDTO";
import { File } from "infrastructure/database/models/File";
import { Package } from "infrastructure/database/models/package/Package";
import { User } from "infrastructure/database/models/User";
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

    // The last file arrives without the client reporting back: starting a game checks again.
    stored.add(files[1]);
    const game = await createGame(cookie, id);
    expect(game.status).toBe(200);
  });

  it("checks storage again when an uploading package is opened", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_view_${Date.now()}`);
    const file = md5(7);
    const created = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, [file]) });
    expect((await http.get(`/v1/packages/${created.body.id}`)).body.uploadStatus).toBe("uploading");
    stored.add(file);
    expect((await http.get(`/v1/packages/${created.body.id}`)).body.uploadStatus).toBe("ready");
  });

  it("starts a game once storage holds every file, with no report from the client", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_after_${Date.now()}`);
    const files = [md5(8)];
    stored.add(files[0]);
    const created = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, files) });
    const id = created.body.id as number;
    const game = await createGame(cookie, id);
    expect(game.status).toBe(200);
    expect((await http.get(`/v1/packages/${id}`)).body.uploadStatus).toBe("ready");
  });

  it("only lets the author or an editor see the upload state", async () => {
    const { user, cookie } = await testUtils.createAndLoginUser(`upload_owner_${Date.now()}`);
    const other = await testUtils.createAndLoginUser(`upload_other_${Date.now()}`);
    const created = await http
      .post("/v1/packages")
      .set("Cookie", cookie)
      .send({ content: packageWith(user, [md5(3)]) });

    const res = await http
      .get(`/v1/packages/${created.body.id}/upload`)
      .set("Cookie", other.cookie);
    expect(res.status).toBe(403);
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
      "0 */5 * * * *"
    );
    await job.execute();

    const pack = await packageRepo.findOneByOrFail({ id: created.body.id });
    expect(pack.upload_status).toBe("ready");
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
    expect(staleCheck.status).toBe(200);
    expect(replaced).toBe(true);
    expect(staleCheck.body.status).toBe("uploading");
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
      const replacement = await http
        .put(`/v1/packages/${id}`)
        .set("Cookie", cookie)
        .send({ content: packageWith(user, [md5(84)]), sourceHash: newHash });
      expect(replacement.status).toBe(200);
      expect(replacement.body.uploadStatus).toBe("uploading");
      return markReady(id, startedAt);
    });

    const staleCheck = await http
      .get(`/v1/packages/${created.body.id}/upload`)
      .set("Cookie", cookie);
    expect(staleCheck.status).toBe(200);
    expect(staleCheck.body.status).toBe("uploading");
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
