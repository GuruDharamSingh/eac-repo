#!/usr/bin/env node

import { setupDatabase } from '../dist/index.js';

async function main() {
  try {
    console.log('🚀 Starting database setup...');
    await setupDatabase();
    console.log('✅ Database setup completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

main();