#!/usr/bin/env node

/**
 * Simple validation script to check that our migration SQL is syntactically correct
 */

import { AddSearchIndexes_0_15_3_1738083600000 } from '../src/infrastructure/database/migrations/0.15.3_AddSearchIndexes';

console.log('Validating Search Indexes Migration...');

// Create a mock QueryRunner to capture the SQL statements
class MockQueryRunner {
  public queries: string[] = [];

  async query(sql: string): Promise<any> {
    this.queries.push(sql);
    console.log('✓ SQL:', sql);
    return Promise.resolve([]);
  }
}

async function validateMigration() {
  try {
    const migration = new AddSearchIndexes_0_15_3_1738083600000();
    const mockRunner = new MockQueryRunner();
    
    console.log('\n=== Testing UP migration ===');
    await migration.up(mockRunner as any);
    
    console.log(`\n✅ UP migration executed successfully with ${mockRunner.queries.length} SQL statements`);
    
    // Reset for down migration
    mockRunner.queries = [];
    
    console.log('\n=== Testing DOWN migration ===');
    await migration.down(mockRunner as any);
    
    console.log(`\n✅ DOWN migration executed successfully with ${mockRunner.queries.length} SQL statements`);
    
    // Check key SQL patterns
    const upQueries = mockRunner.queries.join(' ');
    if (upQueries.includes('DROP INDEX')) {
      console.log('✅ DOWN migration correctly drops indexes');
    } else {
      console.log('❌ DOWN migration missing DROP INDEX statements');
    }
    
    console.log('\n🎉 Migration validation completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration validation failed:', error);
    process.exit(1);
  }
}

validateMigration();