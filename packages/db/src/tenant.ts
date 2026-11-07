import type { TransactionSql } from 'postgres';
import { db } from './client';

/**
 * Run `fn` with the database itself enforcing one org (migration 227).
 *
 * Inside the transaction the session acts as the `eac_tenant` role with
 * `app.org_id` set, so row-level security on the org-owned tables (site_config,
 * threads, events, org_profiles, email_* and the rest listed in 227) shows and
 * accepts only rows of `orgId`. A query that forgets its `WHERE org_id = …`
 * gets this org's rows, never another org's.
 *
 * `orgId` is organizations.id. Use the `sql` handed to `fn` for every query
 * that should be scoped; the global `db` outside it is still unrestricted.
 *
 *   const pages = await withOrg(org.id, (sql) => sql`SELECT * FROM site_config`);
 */
export async function withOrg<T>(orgId: string, fn: (sql: TransactionSql) => Promise<T>): Promise<T> {
  if (!orgId || typeof orgId !== 'string') {
    throw new Error('withOrg: an org id is required');
  }
  const result = await db.begin(async (sql) => {
    await sql`SELECT set_config('app.org_id', ${orgId}, true)`;
    await sql`SET LOCAL ROLE eac_tenant`;
    return fn(sql);
  });
  return result as T;
}
