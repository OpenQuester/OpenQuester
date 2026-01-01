import { type Express } from "express";
import request from "supertest";
import { DataSource, Repository } from "typeorm";

import { Permissions } from "domain/enums/Permissions";
import { Permission } from "infrastructure/database/models/Permission";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { LogTag } from "infrastructure/logger/LogTag";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { LogTestUtils, TestLogEntry } from "tests/utils/LogTestUtils";

/**
 * E2E tests for GET /v1/admin/api/system/logs endpoint.
 *
 * Tests cover:
 * - Permission enforcement (VIEW_SYSTEM_LOGS required)
 * - All filter parameters (levels, tags, correlationId, gameId, userId, since, until, search)
 * - Pagination (limit, offset)
 * - Combined filters
 * - Edge cases (empty file, no matches)
 */
describe("Admin Logs API", () => {
  let testEnv: TestEnvironment;
  let app: Express;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let permRepo: Repository<Permission>;
  let cleanup: (() => Promise<void>) | undefined;
  let logger: ILogger;
  let logTestUtils: LogTestUtils;

  // Test data
  let adminUser: User;
  let regularUser: User;
  let adminCookie: string;
  let regularUserCookie: string;
  let viewLogsPermission: Permission;

  const sampleEntries = LogTestUtils.generateSampleEntries();

  // ============================================================================
  // Setup & Teardown
  // ============================================================================

  beforeAll(async () => {
    // Initialize log test utils BEFORE bootstrapping app
    // (LogReaderService reads LOG_FILE_PATH at construction)
    logTestUtils = new LogTestUtils();
    logTestUtils.setup();

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

  beforeEach(async () => {
    // Clear data between tests
    await userRepo.delete({});
    await permRepo.delete({});
    logTestUtils.clearLogFile();

    // Create VIEW_SYSTEM_LOGS permission
    viewLogsPermission = permRepo.create({
      name: Permissions.VIEW_SYSTEM_LOGS,
    });
    await permRepo.save(viewLogsPermission);

    // Create admin user with permission
    adminUser = userRepo.create({
      username: "admin",
      email: "admin@test.com",
      is_deleted: false,
      permissions: [viewLogsPermission],
    });
    await userRepo.save(adminUser);

    // Create regular user without permission
    regularUser = userRepo.create({
      username: "regular",
      email: "regular@test.com",
      is_deleted: false,
      permissions: [],
    });
    await userRepo.save(regularUser);

    // Login both users
    const adminLoginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: adminUser.id });
    adminCookie = adminLoginRes.headers["set-cookie"];

    const regularLoginRes = await request(app)
      .post("/v1/test/login")
      .send({ userId: regularUser.id });
    regularUserCookie = regularLoginRes.headers["set-cookie"];
  });

  afterEach(async () => {
    await userRepo.delete({});
    await permRepo.delete({});
    logTestUtils.clearLogFile();
  });

  afterAll(async () => {
    try {
      logTestUtils.teardown();
      await testEnv.teardown();
      if (cleanup) await cleanup();
    } catch (err) {
      console.error("Error during teardown:", err);
    }
  });

  // ============================================================================
  // Permission Tests
  // ============================================================================

  describe("Permission Enforcement", () => {
    it("should return 401 for unauthenticated request", async () => {
      const res = await request(app).get("/v1/admin/api/system/logs");

      expect(res.status).toBe(401);
    });

    it("should return 403 for user without VIEW_SYSTEM_LOGS permission", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs")
        .set("Cookie", regularUserCookie);

      expect(res.status).toBe(403);
    });

    it("should return 200 for user with VIEW_SYSTEM_LOGS permission", async () => {
      logTestUtils.createEmptyFile();

      const res = await request(app)
        .get("/v1/admin/api/system/logs")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe("Edge Cases", () => {
    it("should return empty result when log file does not exist", async () => {
      // Don't create log file
      const res = await request(app)
        .get("/v1/admin/api/system/logs")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs).toEqual([]);
      expect(res.body.pagination.scanned).toBe(0);
    });

    it("should return empty result when log file is empty", async () => {
      logTestUtils.createEmptyFile();

      const res = await request(app)
        .get("/v1/admin/api/system/logs")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs).toEqual([]);
    });
  });

  // ============================================================================
  // Basic Reading (No Filters)
  // ============================================================================

  describe("Basic Reading", () => {
    it("should return all log entries when no filter applied", async () => {
      logTestUtils.writeEntries(sampleEntries);

      const res = await request(app)
        .get("/v1/admin/api/system/logs?limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(sampleEntries.length);
    });

    it("should return logs in reverse chronological order (newest first)", async () => {
      logTestUtils.writeEntries(sampleEntries);

      const res = await request(app)
        .get("/v1/admin/api/system/logs?limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      // First entry should be the newest (last in file)
      expect(res.body.logs[0].msg).toBe("Scheduled cleanup completed");
      // Last entry should be the oldest (first in file)
      expect(res.body.logs[res.body.logs.length - 1].msg).toBe(
        "Server started"
      );
    });
  });

  // ============================================================================
  // Filter: levels
  // ============================================================================

  describe("Filter: levels", () => {
    beforeEach(() => {
      logTestUtils.writeEntries(sampleEntries);
    });

    it("should filter by single level", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?levels=error&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(1);
      expect(res.body.logs[0].level).toBe("error");
    });

    it("should filter by multiple levels (comma-separated)", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?levels=error,warn&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(2);
      res.body.logs.forEach((entry: { level: string }) => {
        expect(["error", "warn"]).toContain(entry.level);
      });
    });

    it("should return empty when level has no matches", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?levels=trace&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(0);
    });

    it("should reject invalid level", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?levels=invalid_level")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(400);
    });
  });

  // ============================================================================
  // Filter: tags
  // ============================================================================

  describe("Filter: tags", () => {
    beforeEach(() => {
      logTestUtils.writeEntries(sampleEntries);
    });

    it("should filter by single tag", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?tags=game&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(3);
      res.body.logs.forEach((entry: { tags: string[] }) => {
        expect(entry.tags).toContain(LogTag.GAME);
      });
    });

    it("should filter by multiple tags (OR logic)", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?tags=db,redis&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(2);
    });

    it("should return empty when tag has no matches", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?tags=media&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(0);
    });

    it("should reject invalid tag", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?tags=invalid_tag")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(400);
    });
  });

  // ============================================================================
  // Filter: correlationId
  // ============================================================================

  describe("Filter: correlationId", () => {
    beforeEach(() => {
      logTestUtils.writeEntries(sampleEntries);
    });

    it("should filter by exact correlationId", async () => {
      const res = await request(app)
        .get(
          "/v1/admin/api/system/logs?correlationId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa&limit=100"
        )
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(1);
      expect(res.body.logs[0].msg).toBe("Game created");
    });

    it("should return empty for non-existent correlationId", async () => {
      const res = await request(app)
        .get(
          "/v1/admin/api/system/logs?correlationId=99999999-9999-4999-8999-999999999999&limit=100"
        )
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(0);
    });

    it("should reject invalid UUID format", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?correlationId=not-a-uuid")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(400);
    });
  });

  // ============================================================================
  // Filter: gameId
  // ============================================================================

  describe("Filter: gameId", () => {
    beforeEach(() => {
      logTestUtils.writeEntries(sampleEntries);
    });

    it("should filter by exact gameId", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?gameId=ABCD&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(2);
      res.body.logs.forEach((entry: { gameId: string }) => {
        expect(entry.gameId).toBe("ABCD");
      });
    });

    it("should return empty for non-existent gameId", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?gameId=ZZZZ&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(0);
    });

    it("should reject invalid gameId format", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?gameId=invalid")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(400);
    });
  });

  // ============================================================================
  // Filter: userId
  // ============================================================================

  describe("Filter: userId", () => {
    beforeEach(() => {
      logTestUtils.writeEntries(sampleEntries);
    });

    it("should filter by userId", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?userId=1&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(3);
      res.body.logs.forEach((entry: { userId: number }) => {
        expect(entry.userId).toBe(1);
      });
    });

    it("should return empty for non-existent userId", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?userId=999&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(0);
    });
  });

  // ============================================================================
  // Filter: Time Range (since/until)
  // ============================================================================

  describe("Filter: Time Range", () => {
    beforeEach(() => {
      logTestUtils.writeEntries(sampleEntries);
    });

    it("should filter by since timestamp", async () => {
      const res = await request(app)
        .get(
          "/v1/admin/api/system/logs?since=2025-01-01T14:00:00.000Z&limit=100"
        )
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      // Entries at 14:00, 15:00, 16:00, 17:00
      expect(res.body.logs.length).toBe(4);
    });

    it("should filter by until timestamp", async () => {
      const res = await request(app)
        .get(
          "/v1/admin/api/system/logs?until=2025-01-01T10:00:00.000Z&limit=100"
        )
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      // Entries at 08:00, 09:00, 10:00
      expect(res.body.logs.length).toBe(3);
    });

    it("should filter by time range (since + until)", async () => {
      const res = await request(app)
        .get(
          "/v1/admin/api/system/logs?since=2025-01-01T10:00:00.000Z&until=2025-01-01T13:00:00.000Z&limit=100"
        )
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      // Entries at 10:00, 11:00, 12:00, 13:00
      expect(res.body.logs.length).toBe(4);
    });

    it("should reject invalid ISO timestamp", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?since=not-a-date")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(400);
    });
  });

  // ============================================================================
  // Filter: search
  // ============================================================================

  describe("Filter: search", () => {
    beforeEach(() => {
      logTestUtils.writeEntries(sampleEntries);
    });

    it("should search in message text (case-insensitive)", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?search=game&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      // "Game created", "Game ended successfully"
      expect(res.body.logs.length).toBe(2);
    });

    it("should match partial word", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?search=auth&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(1);
      expect(res.body.logs[0].msg).toBe("User authenticated");
    });

    it("should return empty for non-matching search", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?search=nonexistent&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(0);
    });
  });

  // ============================================================================
  // Pagination (limit/offset)
  // ============================================================================

  describe("Pagination", () => {
    beforeEach(() => {
      logTestUtils.writeEntries(sampleEntries);
    });

    it("should respect limit parameter", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?limit=3")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(3);
      expect(res.body.pagination.scanned).toBe(3);
    });

    it("should respect offset parameter", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?offset=3&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(sampleEntries.length - 3);
      expect(res.body.pagination.skipped).toBe(3);
    });

    it("should combine offset and limit correctly", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?offset=2&limit=3")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.pagination.skipped).toBe(2);
      expect(res.body.pagination.scanned).toBe(3);
    });

    it("should use default limit when not specified", async () => {
      // Create more than 100 entries
      const manyEntries = LogTestUtils.generateSequentialEntries(150);
      logTestUtils.writeEntries(manyEntries);

      const res = await request(app)
        .get("/v1/admin/api/system/logs")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.pagination.scanned).toBe(100); // Default limit
    });
  });

  // ============================================================================
  // Combined Filters
  // ============================================================================

  describe("Combined Filters", () => {
    beforeEach(() => {
      logTestUtils.writeEntries(sampleEntries);
    });

    it("should filter by level + tag", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?levels=info&tags=game&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      // "Game created" and "Game ended successfully" (both info + game)
      expect(res.body.logs.length).toBe(2);
      res.body.logs.forEach((entry: { level: string; tags: string[] }) => {
        expect(entry.level).toBe("info");
        expect(entry.tags).toContain(LogTag.GAME);
      });
    });

    it("should filter by gameId + userId", async () => {
      const res = await request(app)
        .get("/v1/admin/api/system/logs?gameId=ABCD&userId=1&limit=100")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      // Only "Game created" matches (ABCD + userId 1)
      expect(res.body.logs.length).toBe(1);
      expect(res.body.logs[0].msg).toBe("Game created");
    });

    it("should filter by level + time range + search", async () => {
      const res = await request(app)
        .get(
          "/v1/admin/api/system/logs?levels=info&since=2025-01-01T12:00:00.000Z&search=game&limit=100"
        )
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      // "Game ended successfully" - info, after 12:00, contains "game"
      expect(res.body.logs.length).toBe(1);
      expect(res.body.logs[0].msg).toBe("Game ended successfully");
    });

    it("should apply all filters together", async () => {
      // Create specific test data
      const specificEntries: TestLogEntry[] = [
        {
          level: "info",
          msg: "Game session started for user",
          timestamp: "2025-01-01T10:00:00.000Z",
          correlationId: "11111111-2222-4333-8444-555555555555",
          gameId: "TEST",
          userId: 42,
          tags: [LogTag.GAME],
        },
        {
          level: "info",
          msg: "Another game event",
          timestamp: "2025-01-01T11:00:00.000Z",
          correlationId: "11111111-2222-4333-8444-555555555555",
          gameId: "TEST",
          userId: 42,
          tags: [LogTag.GAME],
        },
        {
          level: "debug",
          msg: "Game session debug info",
          timestamp: "2025-01-01T10:30:00.000Z",
          correlationId: "11111111-2222-4333-8444-555555555555",
          gameId: "TEST",
          userId: 42,
          tags: [LogTag.GAME],
        },
      ];
      logTestUtils.writeEntries(specificEntries);

      const res = await request(app)
        .get(
          "/v1/admin/api/system/logs?" +
            "levels=info&" +
            "tags=game&" +
            "correlationId=11111111-2222-4333-8444-555555555555&" +
            "gameId=TEST&" +
            "userId=42&" +
            "since=2025-01-01T09:00:00.000Z&" +
            "until=2025-01-01T12:00:00.000Z&" +
            "search=session&" +
            "limit=100"
        )
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      // Only first entry matches all criteria
      expect(res.body.logs.length).toBe(1);
      expect(res.body.logs[0].msg).toBe("Game session started for user");
    });
  });

  // ============================================================================
  // Response Structure
  // ============================================================================

  describe("Response Structure", () => {
    it("should include logs, pagination, and filter in response", async () => {
      logTestUtils.writeEntries(sampleEntries);

      const res = await request(app)
        .get("/v1/admin/api/system/logs?levels=info&limit=5")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);

      // Verify response structure
      expect(res.body).toHaveProperty("logs");
      expect(res.body).toHaveProperty("pagination");
      expect(res.body).toHaveProperty("filter");

      // Verify pagination structure
      expect(res.body.pagination).toHaveProperty("scanned");
      expect(res.body.pagination).toHaveProperty("skipped");
      expect(res.body.pagination).toHaveProperty("matched");

      // Verify filter echoed back
      expect(res.body.filter.levels).toEqual(["info"]);
      expect(res.body.filter.limit).toBe(5);
    });
  });
});
