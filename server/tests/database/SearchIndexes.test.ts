import { TestEnvironment } from "tests/TestEnvironment";

describe("Search Indexes Migration Test", () => {
  let testEnv: TestEnvironment;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
  });

  afterAll(async () => {
    await testEnv.teardown();
  });

  describe("Database Indexes Verification", () => {
    it("should verify search indexes exist in the database", async () => {
      const dataSource = testEnv.getDatabase();
      
      // Query to check if our search indexes exist
      const indexQuery = `
        SELECT indexname, tablename, indexdef 
        FROM pg_indexes 
        WHERE indexname LIKE 'idx_%' 
        AND schemaname = 'public'
        ORDER BY tablename, indexname;
      `;
      
      const indexes = await dataSource.query(indexQuery);
      
      // Verify key indexes exist
      const expectedIndexes = [
        'idx_package_title_trgm',
        'idx_package_created_at',
        'idx_package_author_created_at',
        'idx_user_created_at',
        'idx_file_filename',
        'idx_package_tag_tag'
      ];
      
      const indexNames = indexes.map((idx: any) => idx.indexname);
      
      for (const expectedIndex of expectedIndexes) {
        expect(indexNames).toContain(expectedIndex);
      }
      
      // Verify trigram extension is enabled
      const extensionQuery = `
        SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
      `;
      
      const extensions = await dataSource.query(extensionQuery);
      expect(extensions.length).toBe(1);
      expect(extensions[0].extname).toBe('pg_trgm');
    });

    it("should verify trigram index works for case-insensitive text search", async () => {
      const dataSource = testEnv.getDatabase();
      
      // Insert test data
      await dataSource.query(`
        INSERT INTO "user" (username, email, discord_id, birthday, created_at, updated_at, is_deleted)
        VALUES ('testuser', 'test@example.com', null, null, NOW(), NOW(), false)
      `);
      
      const userResult = await dataSource.query('SELECT id FROM "user" WHERE username = $1', ['testuser']);
      const userId = userResult[0].id;
      
      await dataSource.query(`
        INSERT INTO package (title, created_at, author, language, description, age_restriction)
        VALUES 
          ('JavaScript Programming Guide', NOW(), $1, 'en', 'A guide to JS', 'NONE'),
          ('Python Data Science Tutorial', NOW(), $1, 'en', 'Learn Python', 'NONE'),
          ('Web Development Fundamentals', NOW(), $1, 'en', 'Web dev basics', 'NONE')
      `, [userId]);
      
      // Test case-insensitive search using the trigram index
      const searchResults = await dataSource.query(`
        SELECT title FROM package WHERE title ILIKE '%script%'
      `);
      
      expect(searchResults.length).toBe(1);
      expect(searchResults[0].title).toBe('JavaScript Programming Guide');
      
      // Test another case-insensitive search
      const searchResults2 = await dataSource.query(`
        SELECT title FROM package WHERE title ILIKE '%PYTHON%'
      `);
      
      expect(searchResults2.length).toBe(1);
      expect(searchResults2[0].title).toBe('Python Data Science Tutorial');
    });
  });
});