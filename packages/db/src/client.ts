import postgres from 'postgres';

/**
 * PostgreSQL client - Simplified single-schema design
 *
 * Architecture:
 * - Single database with single public schema
 * - All tables use org_id column for filtering
 * - All connections are local (no network latency)
 */

const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/elkdonis_dev';

// Main database connection
export const db = postgres(databaseUrl, {
  max: 20, // Connection pool size
  idle_timeout: 20,
  connect_timeout: 10,
  debug: process.env.NODE_ENV === 'development',
  onnotice: process.env.NODE_ENV === 'development' ? console.log : undefined,
});

// Re-export for convenience
export { postgres as sql };