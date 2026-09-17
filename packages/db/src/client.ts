import postgres from 'postgres';

/**
 * PostgreSQL client - Simplified single-schema design
 *
 * Architecture:
 * - Single database with single public schema
 * - All tables use org_id column for filtering
 * - All connections are local (no network latency)
 */

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Prevent connection pool leaks during Next.js hot-reload in development.
// Without this, every module reload creates a new pool (max 20 connections)
// and the old pool is never closed, eventually exhausting postgres connections
// and causing CONNECT_TIMEOUT errors.
const globalForDb = globalThis as unknown as {
  __db?: ReturnType<typeof postgres>;
};

function createDb() {
  return postgres(databaseUrl!, {
    // ~17 app processes share one Postgres (max_connections = 100). At 20
    // each, a busy hour could ask for 340. Idle connections close after 20s,
    // so 5 is plenty per process; raise DB_POOL_MAX for a single hot app.
    max: Number(process.env.DB_POOL_MAX) || 5,
    idle_timeout: 20,
    connect_timeout: 30,
    debug: process.env.NODE_ENV === 'development',
    onnotice: process.env.NODE_ENV === 'development' ? console.log : undefined,
  });
}

export const db = globalForDb.__db ?? createDb();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__db = db;
}

// Re-export for convenience
export { postgres as sql };