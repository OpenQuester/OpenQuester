import { type Express } from "express";
import request from "supertest";
import { DataSource, Repository } from "typeorm";

import { AgeRestriction } from "domain/enums/game/AgeRestriction";
import { PackageDTO } from "domain/types/dto/package/PackageDTO";
import { PaginatedResult } from "domain/types/pagination/PaginatedResult";
import { Package } from "infrastructure/database/models/package/Package";
import { PackageTag } from "infrastructure/database/models/package/PackageTag";
import { User } from "infrastructure/database/models/User";
import { ILogger } from "infrastructure/logger/ILogger";
import { PinoLogger } from "infrastructure/logger/PinoLogger";
import { bootstrapTestApp } from "tests/TestApp";
import { TestEnvironment } from "tests/TestEnvironment";
import { PackageUtils } from "tests/utils/PackageUtils";
import { TestUtils } from "tests/utils/TestUtils";
import { deleteAll } from "tests/utils/TypeOrmTestUtils";

describe("Package Search API", () => {
  let testEnv: TestEnvironment;
  let app: Express;
  let dataSource: DataSource;
  let userRepo: Repository<User>;
  let packageRepo: Repository<Package>;
  let packageTagRepo: Repository<PackageTag>;
  let cleanup: (() => Promise<void>) | undefined;
  let packageUtils: PackageUtils;
  let testUtils: TestUtils;
  let serverUrl: string;
  let logger: ILogger;

  // Test users
  let user1: User;
  let user2: User;
  let user1Cookie: string;
  let user2Cookie: string;

  beforeAll(async () => {
    logger = await PinoLogger.init({ pretty: true });
    testEnv = new TestEnvironment(logger);
    await testEnv.setup();
    const boot = await bootstrapTestApp(testEnv.getDatabase());
    app = boot.app;
    dataSource = boot.dataSource;
    cleanup = boot.cleanup;
    userRepo = dataSource.getRepository<User>("User");
    packageRepo = dataSource.getRepository<Package>("Package");
    packageTagRepo = dataSource.getRepository<PackageTag>("PackageTag");
    serverUrl = `http://localhost:${process.env.API_PORT || 3030}`;
    packageUtils = new PackageUtils();
    testUtils = new TestUtils(app, userRepo, serverUrl);
  });

  beforeEach(async () => {
    await testEnv.clearRedis();
    await deleteAll(packageRepo);
    await deleteAll(packageTagRepo);
    await deleteAll(userRepo);

    // Create test users
    const loginData1 = await testUtils.createAndLoginUser("testuser1");
    const loginData2 = await testUtils.createAndLoginUser("testuser2");
    user1 = loginData1.user;
    user2 = loginData2.user;
    user1Cookie = loginData1.cookie;
    user2Cookie = loginData2.cookie;
  });

  afterEach(async () => {
    await deleteAll(packageRepo);
    await deleteAll(packageTagRepo);
    await deleteAll(userRepo);
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

  /**
   * Helper to create a package with specific attributes
   */
  async function createPackage(params: {
    title: string;
    description?: string;
    language?: string;
    ageRestriction?: AgeRestriction;
    tags?: string[];
    authorCookie: string;
    author: User;
    includeFinalRound?: boolean;
    additionalQuestions?: number;
  }): Promise<number> {
    const packageData = packageUtils.createTestPackageData(
      params.author,
      params.includeFinalRound ?? false,
      params.additionalQuestions ?? 0
    );

    // Override specific fields
    packageData.title = params.title;
    if (params.description !== undefined) {
      packageData.description = params.description;
    }
    if (params.language !== undefined) {
      packageData.language = params.language;
    }
    if (params.ageRestriction !== undefined) {
      packageData.ageRestriction = params.ageRestriction;
    }
    if (params.tags) {
      packageData.tags = params.tags.map((tag) => ({ tag }));
    }

    const res = await request(app)
      .post("/v1/packages")
      .send({ content: packageData })
      .set("Cookie", params.authorCookie);

    expect(res.status).toBe(200);
    return res.body.id;
  }

  /**
   * Helper to create multiple packages with various patterns
   */
  async function createMultiplePackages(options: {
    count: number;
    titlePrefix?: string;
    languages?: string[] | ((index: number) => string);
    tags?: string[][] | ((index: number) => string[]);
    ageRestrictions?: AgeRestriction[] | ((index: number) => AgeRestriction);
    descriptions?: string[] | ((index: number) => string | undefined);
    additionalQuestions?: number | ((index: number) => number);
    includeFinalRound?: boolean;
    authors?:
      | "user1"
      | "user2"
      | "alternate"
      | ((index: number) => "user1" | "user2");
  }): Promise<number[]> {
    const {
      count,
      titlePrefix = "Package",
      languages,
      tags,
      ageRestrictions,
      descriptions,
      additionalQuestions = 0,
      includeFinalRound = false,
      authors = "user1",
    } = options;

    const ids: number[] = [];

    for (let i = 0; i < count; i++) {
      // Determine author
      let author: User;
      let authorCookie: string;
      if (typeof authors === "function") {
        const authorKey = authors(i);
        author = authorKey === "user1" ? user1 : user2;
        authorCookie = authorKey === "user1" ? user1Cookie : user2Cookie;
      } else if (authors === "alternate") {
        author = i % 2 === 0 ? user1 : user2;
        authorCookie = i % 2 === 0 ? user1Cookie : user2Cookie;
      } else {
        author = authors === "user1" ? user1 : user2;
        authorCookie = authors === "user1" ? user1Cookie : user2Cookie;
      }

      // Determine language
      let language: string | undefined;
      if (typeof languages === "function") {
        language = languages(i);
      } else if (Array.isArray(languages)) {
        language = languages[i % languages.length];
      }

      // Determine tags
      let packageTags: string[] | undefined;
      if (typeof tags === "function") {
        packageTags = tags(i);
      } else if (Array.isArray(tags)) {
        packageTags = tags[i % tags.length];
      }

      // Determine age restriction
      let ageRestriction: AgeRestriction | undefined;
      if (typeof ageRestrictions === "function") {
        ageRestriction = ageRestrictions(i);
      } else if (Array.isArray(ageRestrictions)) {
        ageRestriction = ageRestrictions[i % ageRestrictions.length];
      }

      // Determine description
      let description: string | undefined;
      if (typeof descriptions === "function") {
        description = descriptions(i);
      } else if (Array.isArray(descriptions)) {
        description = descriptions[i % descriptions.length];
      }

      // Determine additional questions
      let questions: number;
      if (typeof additionalQuestions === "function") {
        questions = additionalQuestions(i);
      } else {
        questions = additionalQuestions;
      }

      const id = await createPackage({
        title: `${titlePrefix} ${i + 1}`,
        language,
        tags: packageTags,
        ageRestriction,
        description,
        additionalQuestions: questions,
        includeFinalRound,
        author,
        authorCookie,
      });

      ids.push(id);
    }

    return ids;
  }

  describe("Text Search", () => {
    it("should find packages by exact title match", async () => {
      await createPackage({
        title: "JavaScript Quiz",
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "Python Quiz",
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ title: "JavaScript", limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("JavaScript Quiz");
    });

    it("should find packages by partial title match (case-insensitive)", async () => {
      await createPackage({
        title: "Advanced JavaScript",
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "Basic JAVASCRIPT Tutorial",
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "Python Programming",
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ title: "javascript", limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(2);
      expect(
        result.data.every((p) => p.title.toLowerCase().includes("javascript"))
      ).toBe(true);
    });

    it("should find packages by description match", async () => {
      await createPackage({
        title: "Quiz 1",
        description: "A comprehensive guide to React hooks",
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "Quiz 2",
        description: "Angular components tutorial",
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ description: "React", limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].description).toContain("React");
    });

    it("should support wildcard searches with special characters", async () => {
      await createPackage({
        title: "C++ Programming",
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "C# Basics",
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ title: "C++", limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("C++ Programming");
    });

    it("should return empty results for non-existent search term", async () => {
      await createPackage({
        title: "JavaScript Quiz",
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ title: "NonExistentLanguage", limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(0);
      expect(result.pageInfo.total).toBe(0);
    });
  });

  describe("Filter by Fields", () => {
    it("should filter packages by language", async () => {
      await createPackage({
        title: "English Quiz",
        language: "en",
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "Ukrainian Quiz",
        language: "ua",
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "Spanish Quiz",
        language: "es",
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ language: "es", limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].language).toBe("es");
    });

    it("should filter packages by author ID", async () => {
      await createPackage({
        title: "User1 Package 1",
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "User1 Package 2",
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "User2 Package 1",
        author: user2,
        authorCookie: user2Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ authorId: user1.id, limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(2);
      expect(result.data.every((p) => p.author.id === user1.id)).toBe(true);
    });

    it("should filter packages by age restriction", async () => {
      await createPackage({
        title: "Family Quiz",
        ageRestriction: AgeRestriction.NONE,
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "Teen Quiz",
        ageRestriction: AgeRestriction.A16,
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "Adult Quiz",
        ageRestriction: AgeRestriction.A18,
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ ageRestriction: AgeRestriction.A16, limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].ageRestriction).toBe(AgeRestriction.A16);
    });
  });

  describe("Filter by Tags", () => {
    it("should filter packages by single tag", async () => {
      await createPackage({
        title: "JavaScript Quiz",
        tags: ["programming", "web"],
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "History Quiz",
        tags: ["history", "education"],
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ tags: ["programming"], limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].tags?.some((t) => t.tag === "programming")).toBe(
        true
      );
    });

    it("should filter packages by multiple tags (any match)", async () => {
      await createPackage({
        title: "JavaScript Quiz",
        tags: ["programming", "javascript"],
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "Python Quiz",
        tags: ["programming", "python"],
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "History Quiz",
        tags: ["history"],
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ tags: ["javascript", "python"], limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data.length).toBeGreaterThanOrEqual(2);
      expect(
        result.data.every((p) =>
          p.tags?.some((t) => ["javascript", "python"].includes(t.tag))
        )
      ).toBe(true);
    });

    it("should handle comma-separated tags string", async () => {
      await createPackage({
        title: "Web Dev Quiz",
        tags: ["html", "css", "javascript"],
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "Backend Quiz",
        tags: ["nodejs", "database"],
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ tags: "html,css", limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("Web Dev Quiz");
    });

    it("should return empty results for non-existent tag", async () => {
      await createPackage({
        title: "Quiz 1",
        tags: ["tag1"],
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ tags: ["nonexistenttag"], limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(0);
    });
  });

  describe("Filter by Stats (Rounds and Questions)", () => {
    it("should filter packages by minimum rounds count", async () => {
      await createPackage({
        title: "Small Package",
        includeFinalRound: false,
        author: user1,
        authorCookie: user1Cookie,
      }); // 2 simple rounds

      await createPackage({
        title: "Large Package",
        includeFinalRound: true,
        author: user1,
        authorCookie: user1Cookie,
      }); // 1 simple + 1 final = 2 rounds

      const res = await request(app)
        .get("/v1/packages")
        .query({ minRounds: 2, limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(2);
    });

    it("should filter packages by maximum rounds count", async () => {
      await createPackage({
        title: "Small Package",
        includeFinalRound: false,
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ maxRounds: 1, limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(0);
    });

    it("should filter packages by rounds range", async () => {
      await createPackage({
        title: "Package 1",
        includeFinalRound: false,
        author: user1,
        authorCookie: user1Cookie,
      }); // 2 rounds

      await createPackage({
        title: "Package 2",
        includeFinalRound: true,
        author: user1,
        authorCookie: user1Cookie,
      }); // 2 rounds

      const res = await request(app)
        .get("/v1/packages")
        .query({ minRounds: 2, maxRounds: 2, limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(2);
    });

    it("should filter packages by minimum questions count", async () => {
      await createPackage({
        title: "Few Questions",
        additionalQuestions: 0,
        author: user1,
        authorCookie: user1Cookie,
      }); // 7 base questions in theme 1 + 1 in theme 2 = 8 questions

      await createPackage({
        title: "Many Questions",
        additionalQuestions: 10,
        author: user1,
        authorCookie: user1Cookie,
      }); // 7 + 10 + 1 = 18 questions

      const res = await request(app)
        .get("/v1/packages")
        .query({ minQuestions: 15, limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("Many Questions");
    });

    it("should filter packages by maximum questions count", async () => {
      await createPackage({
        title: "Few Questions",
        additionalQuestions: 0,
        author: user1,
        authorCookie: user1Cookie,
      });

      await createPackage({
        title: "Many Questions",
        additionalQuestions: 20,
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ maxQuestions: 10, limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("Few Questions");
    });

    it("should filter packages by questions range", async () => {
      await createPackage({
        title: "Package 1",
        additionalQuestions: 0,
        author: user1,
        authorCookie: user1Cookie,
      }); // 8 questions

      await createPackage({
        title: "Package 2",
        additionalQuestions: 5,
        author: user1,
        authorCookie: user1Cookie,
      }); // 13 questions

      const res = await request(app)
        .get("/v1/packages")
        .query({ minQuestions: 5, maxQuestions: 10, limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("Package 1");
    });
  });

  describe("Combined Filters", () => {
    it("should combine title search and language filter", async () => {
      await createPackage({
        title: "JavaScript Basics",
        language: "en",
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "JavaScript Advanced",
        language: "ua",
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "Python Basics",
        language: "en",
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ title: "JavaScript", language: "en", limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("JavaScript Basics");
      expect(result.data[0].language).toBe("en");
    });

    it("should combine author filter and tags", async () => {
      await createPackage({
        title: "User1 Programming Quiz",
        tags: ["programming"],
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "User1 History Quiz",
        tags: ["history"],
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "User2 Programming Quiz",
        tags: ["programming"],
        author: user2,
        authorCookie: user2Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({
          authorId: user1.id,
          tags: ["programming"],
          limit: 10,
          offset: 0,
        });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("User1 Programming Quiz");
    });

    it("should combine text search, tags, and stats filters", async () => {
      await createPackage({
        title: "Advanced JavaScript Course",
        tags: ["programming", "javascript"],
        additionalQuestions: 10,
        author: user1,
        authorCookie: user1Cookie,
      }); // ~18 questions

      await createPackage({
        title: "Basic JavaScript Tutorial",
        tags: ["programming", "javascript"],
        additionalQuestions: 0,
        author: user1,
        authorCookie: user1Cookie,
      }); // ~8 questions

      await createPackage({
        title: "Advanced Python Course",
        tags: ["programming", "python"],
        additionalQuestions: 10,
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({
          title: "Advanced",
          tags: ["javascript"],
          minQuestions: 15,
          limit: 10,
          offset: 0,
        });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("Advanced JavaScript Course");
    });

    it("should combine all available filters", async () => {
      await createPackage({
        title: "Complete Web Dev Course",
        description: "Learn everything about web development",
        language: "en",
        ageRestriction: AgeRestriction.NONE,
        tags: ["programming", "web", "javascript"],
        additionalQuestions: 8,
        includeFinalRound: true,
        author: user1,
        authorCookie: user1Cookie,
      });

      await createPackage({
        title: "Other Course",
        description: "Different content",
        language: "ua",
        ageRestriction: AgeRestriction.A16,
        tags: ["other"],
        additionalQuestions: 0,
        includeFinalRound: false,
        author: user2,
        authorCookie: user2Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({
          title: "Web",
          description: "development",
          language: "en",
          authorId: user1.id,
          tags: ["programming"],
          ageRestriction: AgeRestriction.NONE,
          minQuestions: 10,
          minRounds: 2,
          limit: 10,
          offset: 0,
        });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe("Complete Web Dev Course");
    });

    it("should return no results when combined filters match nothing", async () => {
      await createPackage({
        title: "JavaScript Quiz",
        language: "en",
        tags: ["programming"],
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app).get("/v1/packages").query({
        title: "JavaScript",
        language: "ua", // Different language
        limit: 10,
        offset: 0,
      });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(0);
    });
  });

  describe("Sorting and Pagination", () => {
    it("should sort by title ascending", async () => {
      await createPackage({
        title: "Zebra Quiz",
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "Apple Quiz",
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "Banana Quiz",
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ sortBy: "title", order: "asc", limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(3);
      expect(result.data[0].title).toBe("Apple Quiz");
      expect(result.data[1].title).toBe("Banana Quiz");
      expect(result.data[2].title).toBe("Zebra Quiz");
    });

    it("should sort by title descending", async () => {
      await createPackage({
        title: "Zebra Quiz",
        author: user1,
        authorCookie: user1Cookie,
      });
      await createPackage({
        title: "Apple Quiz",
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ sortBy: "title", order: "desc", limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(2);
      expect(result.data[0].title).toBe("Zebra Quiz");
      expect(result.data[1].title).toBe("Apple Quiz");
    });

    it("should sort by created_at descending (newest first)", async () => {
      const id1 = await createPackage({
        title: "First Package",
        author: user1,
        authorCookie: user1Cookie,
      });

      // Small delay to ensure different timestamps (10 ms delay is fine)
      await new Promise((resolve) => setTimeout(resolve, 10));

      const id2 = await createPackage({
        title: "Second Package",
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ sortBy: "created_at", order: "desc", limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe(id2);
      expect(result.data[1].id).toBe(id1);
    });

    it("should sort by author username", async () => {
      // user1 = testuser1, user2 = testuser2
      await createPackage({
        title: "Package A",
        author: user2,
        authorCookie: user2Cookie,
      });
      await createPackage({
        title: "Package B",
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ sortBy: "author", order: "asc", limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(2);
      expect(result.data[0].author.username).toBe("testuser1");
      expect(result.data[1].author.username).toBe("testuser2");
    });

    it("should paginate results correctly", async () => {
      // Create 5 packages
      await createMultiplePackages({ count: 5 });

      // First page
      const res1 = await request(app)
        .get("/v1/packages")
        .query({ limit: 2, offset: 0, sortBy: "title", order: "asc" });

      expect(res1.status).toBe(200);
      const result1: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res1.body;
      expect(result1.data).toHaveLength(2);
      expect(result1.pageInfo.total).toBe(5);
      expect(result1.data[0].title).toBe("Package 1");
      expect(result1.data[1].title).toBe("Package 2");

      // Second page
      const res2 = await request(app)
        .get("/v1/packages")
        .query({ limit: 2, offset: 2, sortBy: "title", order: "asc" });

      expect(res2.status).toBe(200);
      const result2: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res2.body;
      expect(result2.data).toHaveLength(2);
      expect(result2.pageInfo.total).toBe(5);
      expect(result2.data[0].title).toBe("Package 3");
      expect(result2.data[1].title).toBe("Package 4");

      // Third page
      const res3 = await request(app)
        .get("/v1/packages")
        .query({ limit: 2, offset: 4, sortBy: "title", order: "asc" });

      expect(res3.status).toBe(200);
      const result3: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res3.body;
      expect(result3.data).toHaveLength(1);
      expect(result3.data[0].title).toBe("Package 5");
    });

    it("should handle empty results on pagination beyond available data", async () => {
      await createPackage({
        title: "Only Package",
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ limit: 10, offset: 100 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(0);
      expect(result.pageInfo.total).toBe(1);
    });
  });

  describe("Validation and Edge Cases", () => {
    it("should require limit parameter", async () => {
      const res = await request(app).get("/v1/packages").query({ offset: 0 });

      expect(res.status).toBe(400);
    });

    it("should require offset parameter", async () => {
      const res = await request(app).get("/v1/packages").query({ limit: 10 });

      expect(res.status).toBe(400);
    });

    it("should reject invalid sortBy value", async () => {
      const res = await request(app)
        .get("/v1/packages")
        .query({ sortBy: "invalid_field", limit: 10, offset: 0 });

      expect(res.status).toBe(400);
    });

    it("should reject invalid order value", async () => {
      const res = await request(app)
        .get("/v1/packages")
        .query({ order: "invalid", limit: 10, offset: 0 });

      expect(res.status).toBe(400);
    });

    it("should reject negative limit", async () => {
      const res = await request(app)
        .get("/v1/packages")
        .query({ limit: -1, offset: 0 });

      expect(res.status).toBe(400);
    });

    it("should reject negative offset", async () => {
      const res = await request(app)
        .get("/v1/packages")
        .query({ limit: 10, offset: -1 });

      expect(res.status).toBe(400);
    });

    it("should reject invalid age restriction", async () => {
      const res = await request(app)
        .get("/v1/packages")
        .query({ ageRestriction: "invalid", limit: 10, offset: 0 });

      expect(res.status).toBe(400);
    });

    it("should handle search with no packages in database", async () => {
      const res = await request(app)
        .get("/v1/packages")
        .query({ limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(0);
      expect(result.pageInfo.total).toBe(0);
    });

    it("should handle very long search strings", async () => {
      const longString = "a".repeat(1000);
      const res = await request(app)
        .get("/v1/packages")
        .query({ title: longString, limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(0);
    });

    it("should handle special characters in search", async () => {
      await createPackage({
        title: "Test%Quiz_With-Special!Characters",
        author: user1,
        authorCookie: user1Cookie,
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({ title: "Special!Characters", limit: 10, offset: 0 });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data).toHaveLength(1);
    });
  });

  describe("Performance and Scalability", () => {
    it("should handle search across many packages efficiently", async () => {
      // Create 50 packages
      await createMultiplePackages({
        count: 50,
        languages: (i) => (i % 2 === 0 ? "en" : "ua"),
        tags: (i) => (i % 3 === 0 ? ["special"] : ["regular"]),
        authors: "alternate",
      });

      const startTime = Date.now();
      const res = await request(app)
        .get("/v1/packages")
        .query({ language: "en", limit: 20, offset: 0 });
      const endTime = Date.now();

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data.length).toBeLessThanOrEqual(20);
      expect(result.pageInfo.total).toBe(25);

      // Should complete in reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it("should handle complex filters on large dataset", async () => {
      // Create diverse packages
      await createMultiplePackages({
        count: 30,
        titlePrefix: "Complex Package",
        descriptions: (i) =>
          i % 5 === 0 ? "special description" : "regular content",
        languages: ["en", "ua", "es"],
        ageRestrictions: [
          AgeRestriction.NONE,
          AgeRestriction.A16,
          AgeRestriction.A18,
        ],
        tags: (i) => (i % 2 === 0 ? ["tag1", "tag2"] : ["tag3"]),
        additionalQuestions: (i) => i % 4,
        authors: "alternate",
      });

      const res = await request(app)
        .get("/v1/packages")
        .query({
          title: "Complex",
          language: "en",
          tags: ["tag1"],
          minQuestions: 5,
          limit: 10,
          offset: 0,
        });

      expect(res.status).toBe(200);
      const result: PaginatedResult<Omit<PackageDTO, "rounds">[]> = res.body;
      expect(result.data.every((p) => p.language === "en")).toBe(true);
    });
  });
});
