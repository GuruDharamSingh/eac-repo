// Database package with simplified single-schema design
export { db, sql } from './client';
export { setupDatabase } from './schemas';
export { Events } from './events';

// Forum queries
export * from './queries/forum';