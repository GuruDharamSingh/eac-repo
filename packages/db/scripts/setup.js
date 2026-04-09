#!/usr/bin/env node

// Simple setup script to create database tables
import { setupDatabase } from '../src/schemas.js';

console.log('Starting database setup...');

setupDatabase()
  .then(() => {
    console.log('Database setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database setup failed:', error);
    process.exit(1);
  });
