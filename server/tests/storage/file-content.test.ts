import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { Readable } from "node:stream";
import { container } from "tsyringe";
import { type Repository } from "typeorm";

import { S3ObjectStorage } from "infrastructure/storage/S3ObjectStorage";
import { User } from "infrastructure/database/models/User";
import { createHttpTestClient } from "tests/e2e/harness/HttpTestClient";
import { ServerTestHarness } from "tests/e2e/harness/ServerTestHarness";
import { TestUtils } from "tests/utils/TestUtils";
import { deleteAll } from "tests/utils/TypeOrmTestUtils";

const md5 = "74ae4b7771e8661ba7599debaeff5110";

describe("GET /v1/files/:filename/content", () => {
  let harness: ServerTestHarness;
  let userRepo: Repository<User>;
  let testUtils: TestUtils;

  beforeAll(async () => {
    harness = await ServerTestHarness.start({ apiPort: 0 });
    userRepo = harness.dataSource.getRepository(User);
    testUtils = new TestUtils(harness.app, userRepo, harness.serverUrl);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await deleteAll(userRepo);
    await harness.resetState();
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it("streams the stored object from the API's origin", async () => {
    const getObject = jest
      .spyOn(container.resolve(S3ObjectStorage), "getObject")
      .mockImplementation(async () => ({
        body: Readable.from([Buffer.from("png-bytes")]),
        size: 9
      }));
    const { cookie } = await testUtils.createAndLoginUser(`file_content_${Date.now()}`);

    const res = await createHttpTestClient(harness.serverUrl)
      .get(`/v1/files/${md5}/content`)
      .set("Cookie", cookie)
      .buffer(true)
      .parse((response, done) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => done(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/octet-stream");
    expect(res.headers["content-disposition"]).toBe("attachment");
    expect(res.headers["content-length"]).toBe("9");
    expect((res.body as Buffer).toString()).toBe("png-bytes");
    expect(getObject).toHaveBeenCalledWith("test-bucket", `7/74/${md5}`);
  });

  it("answers 404 when the object is missing", async () => {
    jest.spyOn(container.resolve(S3ObjectStorage), "getObject").mockResolvedValue(null);
    const { cookie } = await testUtils.createAndLoginUser(`file_missing_${Date.now()}`);

    const res = await createHttpTestClient(harness.serverUrl)
      .get(`/v1/files/${md5}/content`)
      .set("Cookie", cookie);

    expect(res.status).toBe(404);
  });

  it("needs a session", async () => {
    const getObject = jest.spyOn(container.resolve(S3ObjectStorage), "getObject");

    const res = await createHttpTestClient(harness.serverUrl).get(`/v1/files/${md5}/content`);

    expect(res.status).toBe(401);
    expect(getObject).not.toHaveBeenCalled();
  });
});
